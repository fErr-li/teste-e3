import './env';
import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { DatabaseService } from '../src/database/database.service';
import { Lead } from '../src/leads/interfaces/lead.interface';
import { MockLlmProvider } from '../src/llm/providers/mock-llm.provider';

export const TENANT = 'sol-nascente';
export const TELEFONE = '5581999990000';

export interface AppDeTeste {
  app: INestApplication;
  url: string;
  llm: MockLlmProvider;
  db: DatabaseService;
}

/** Sobe a aplicação completa com banco em memória e LLM mockado. Cada teste ganha um banco novo. */
export async function criarApp(): Promise<AppDeTeste> {
  const app = await NestFactory.create(AppModule, { logger: false });
  configurarApp(app);
  await app.listen(0);
  return {
    app,
    url: await app.getUrl(),
    llm: app.get(MockLlmProvider),
    db: app.get(DatabaseService),
  };
}

let contador = 0;

export async function enviar(ctx: AppDeTeste, texto: string, extras: Record<string, unknown> = {}) {
  const resposta = await fetch(`${ctx.url}/webhook/mensagem`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message_id: `wamid.${++contador}`,
      tenant_id: TENANT,
      telefone: TELEFONE,
      texto,
      timestamp: new Date().toISOString(),
      ...extras,
    }),
  });
  const corpo = await resposta.text();
  return { status: resposta.status, corpo: corpo ? JSON.parse(corpo) : null };
}

export async function intervir(ctx: AppDeTeste, acao: 'assumir' | 'religar') {
  const resposta = await fetch(`${ctx.url}/intervencao`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tenant_id: TENANT, telefone: TELEFONE, acao }),
  });
  return resposta.json();
}

export async function obterConversa(ctx: AppDeTeste): Promise<{ lead: Lead; mensagens: any[] }> {
  const resposta = await fetch(`${ctx.url}/conversas/${TENANT}/${TELEFONE}`);
  return resposta.json();
}

export function auditoria(ctx: AppDeTeste, nome: string) {
  return ctx.db.db.prepare('SELECT * FROM acoes WHERE nome = ? ORDER BY id').all(nome) as any[];
}

export const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
