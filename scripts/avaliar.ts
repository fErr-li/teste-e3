import './avaliacao/env';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/app.setup';
import { DatabaseService } from '../src/database/database.service';
import { Conversa, CONVERSAS, ResultadoConversa, Verificacao } from './avaliacao/conversas';

// Roda as conversas do Anexo C contra o LLM configurado no .env (em modo simulação)
// e gera avaliacao/relatorio.md dizendo, para cada uma, se o resultado esperado aconteceu.
//
// Uso: npm run avaliar -- [--repeticoes=N] [--pausa-ms=N] [--conversas=C1,C3] [--permitir-mock]

const TENANT = 'sol-nascente';

interface Execucao {
  conversa: Conversa;
  repeticao: number;
  verificacoes: Verificacao[];
  transcricao: { autor: string; texto: string }[];
  acoes: string[];
  custo: number;
  latenciaMediaMs: number;
  tokens: number;
  modelo: string;
  erro?: string;
}

const argumentos = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [chave, valor] = a.replace(/^--/, '').split('=');
    return [chave, valor ?? 'true'];
  }),
);
const repeticoes = Number(argumentos.repeticoes ?? 1);
const pausaMs = Number(argumentos['pausa-ms'] ?? 0);
const selecionadas = argumentos.conversas?.split(',');

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const app = await NestFactory.create(AppModule, { logger: ['warn', 'error'] });
  configurarApp(app);
  await app.listen(0);
  const url = await app.getUrl();
  const db = app.get(DatabaseService).db;
  const config = app.get(ConfigService);

  const provedor = config.get<string>('llm.provider');
  if (provedor === 'mock' && !argumentos['permitir-mock']) {
    console.error(
      'O LLM configurado é o mock. Configure LLM_PROVIDER e LLM_API_KEY no .env ' +
        '(ou rode com --permitir-mock só para testar o script).',
    );
    await app.close();
    process.exit(1);
  }

  let contador = 0;
  const enviar = async (telefone: string, texto: string) => {
    const resposta = await fetch(`${url}/webhook/mensagem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message_id: `aval.${Date.now()}.${++contador}`,
        tenant_id: TENANT,
        telefone,
        texto,
        timestamp: new Date().toISOString(),
        simulacao: true,
      }),
    });
    const corpo = await resposta.text();
    if (!resposta.ok) throw new Error(`HTTP ${resposta.status}: ${corpo}`);
    return corpo ? JSON.parse(corpo) : null;
  };
  const contar = (tabela: string, telefone: string) =>
    (db.prepare(`SELECT COUNT(*) AS n FROM ${tabela} WHERE telefone = ?`).get(telefone) as { n: number }).n;

  const conversas = CONVERSAS.filter((c) => !selecionadas || selecionadas.includes(c.id));
  const execucoes: Execucao[] = [];

  for (let repeticao = 1; repeticao <= repeticoes; repeticao++) {
    for (const [indice, conversa] of conversas.entries()) {
      const telefone = `55819${String(indice + 1).padStart(2, '0')}${String(repeticao).padStart(6, '0')}`;
      process.stdout.write(`${conversa.id} (repetição ${repeticao})... `);

      let primeiraResposta: any;
      let respostaAposTransferencia: any;
      let turnosAposTransferencia: number | undefined;
      let erro: string | undefined;

      try {
        if (conversa.rajada) {
          // Mensagens quase juntas, todas dentro da janela.
          const pendentes = conversa.mensagens.map(async (texto, i) => {
            await esperar(i * 600);
            return enviar(telefone, texto);
          });
          primeiraResposta = (await Promise.all(pendentes))[0];
        } else {
          for (const texto of conversa.mensagens) {
            const resposta = await enviar(telefone, texto);
            primeiraResposta ??= resposta;
          }
        }
        if (conversa.mensagemAposTransferencia) {
          respostaAposTransferencia = await enviar(telefone, conversa.mensagemAposTransferencia);
          turnosAposTransferencia = contar('turnos', telefone);
        }
      } catch (e) {
        erro = (e as Error).message;
      }

      const { lead, mensagens } = await (await fetch(`${url}/conversas/${TENANT}/${telefone}`)).json();
      const turnos = db
        .prepare(
          `SELECT modelo, custo_estimado, latencia_ms, tokens_entrada + tokens_saida AS tokens
           FROM turnos WHERE telefone = ? ORDER BY id`,
        )
        .all(telefone) as { modelo: string; custo_estimado: number; latencia_ms: number; tokens: number }[];

      const resultado: ResultadoConversa = {
        lead,
        respostasIa: mensagens.filter((m) => m.autor === 'ia').map((m) => m.texto),
        primeiraResposta,
        // Turnos antes da mensagem pós-transferência (C4 verifica que esse número não muda).
        turnos: turnosAposTransferencia ?? turnos.length,
        agendamentos: contar('agendamentos', telefone),
        notificacoes: contar('notificacoes', telefone),
        respostaAposTransferencia,
        turnosAposTransferencia: turnos.length,
      };

      const acoes = (
        db
          .prepare('SELECT nome, argumentos, sucesso FROM acoes WHERE telefone = ? ORDER BY id')
          .all(telefone) as { nome: string; argumentos: string; sucesso: number }[]
      ).map((a) => `${a.sucesso ? '✅' : '❌'} ${a.nome} ${a.argumentos}`);

      const verificacoes = erro
        ?[{ descricao: 'conversa executada sem erro', ok: false, detalhe: erro }]
        : conversa.verificar(resultado);

      execucoes.push({
        conversa,
        repeticao,
        verificacoes,
        transcricao: mensagens.map((m) => ({ autor: m.autor, texto: m.texto })),
        acoes,
        custo: turnos.reduce((s, t) => s + t.custo_estimado, 0),
        latenciaMediaMs: turnos.length ? turnos.reduce((s, t) => s + t.latencia_ms, 0) / turnos.length : 0,
        tokens: turnos.reduce((s, t) => s + t.tokens, 0),
        modelo: turnos[0]?.modelo ?? '-',
        erro,
      });

      const passou = verificacoes.filter((v) => v.ok).length;
      console.log(`${passou}/${verificacoes.length} verificações`);
      if (pausaMs) await esperar(pausaMs);
    }
  }

  const metricas = await (await fetch(`${url}/metricas/${TENANT}`)).json();
  const relatorio = gerarRelatorio(execucoes, metricas, provedor);
  const destino = resolve('avaliacao/relatorio.md');
  mkdirSync(resolve('avaliacao'), { recursive: true });
  writeFileSync(destino, relatorio);
  console.log(`\nRelatório salvo em ${destino}`);

  await app.close();
}

function gerarRelatorio(execucoes: Execucao[], metricas: any, provedor: string): string {
  const linhas: string[] = [];
  const modelo = execucoes.find((e) => e.modelo !== '-')?.modelo ?? '-';
  const usd = (v: number) => `US$ ${v.toFixed(4)}`;

  linhas.push('# Relatório da avaliação (Anexo C)', '');
  linhas.push(`- Data: ${new Date().toISOString()}`);
  linhas.push(`- Provedor: ${provedor} · Modelo: ${modelo}`);
  linhas.push(`- Repetições por conversa: ${repeticoes}`);
  linhas.push(`- Tenant: ${TENANT} (modo simulação)`, '');

  linhas.push('## Resumo', '');
  linhas.push('| Conversa | Esperado | Passou | Verificações | Custo | Latência média/turno |');
  linhas.push('|---|---|---|---|---|---|');
  for (const conversa of new Set(execucoes.map((e) => e.conversa))) {
    const daConversa = execucoes.filter((e) => e.conversa === conversa);
    const passaram = daConversa.filter((e) => e.verificacoes.every((v) => v.ok)).length;
    const ok = daConversa.reduce((s, e) => s + e.verificacoes.filter((v) => v.ok).length, 0);
    const total = daConversa.reduce((s, e) => s + e.verificacoes.length, 0);
    const custo = daConversa.reduce((s, e) => s + e.custo, 0) / daConversa.length;
    const latencia = daConversa.reduce((s, e) => s + e.latenciaMediaMs, 0) / daConversa.length;
    linhas.push(
      `| ${conversa.id} — ${conversa.titulo} | ${conversa.esperado} | ${passaram === daConversa.length ? '✅' : '❌'} ${passaram}/${daConversa.length} | ${ok}/${total} | ${usd(custo)} | ${Math.round(latencia)} ms |`,
    );
  }
  linhas.push('');
  linhas.push(
    `**Métricas do tenant** (\`GET /metricas/${TENANT}\`): ${metricas.total_conversas} conversas, ` +
      `custo médio ${usd(metricas.custo_medio_por_conversa)}, ` +
      `${metricas.percentual_qualificados.toFixed(0)}% qualificados, ` +
      `${metricas.percentual_transferidos_humano.toFixed(0)}% transferidos para humano.`,
    '',
  );

  linhas.push('## Detalhes', '');
  for (const e of execucoes) {
    linhas.push(`### ${e.conversa.id} — ${e.conversa.titulo} (repetição ${e.repeticao})`, '');
    for (const v of e.verificacoes) {
      linhas.push(`- ${v.ok ? '✅' : '❌'} ${v.descricao}${v.detalhe ? ` — ${v.detalhe}` : ''}`);
    }
    linhas.push('', `Custo: ${usd(e.custo)} · Tokens: ${e.tokens} · Latência média por turno: ${Math.round(e.latenciaMediaMs)} ms`, '');
    linhas.push('<details><summary>Ações executadas</summary>', '');
    for (const a of e.acoes) linhas.push(`- \`${a}\``);
    linhas.push('', '</details>', '');
    linhas.push('<details><summary>Transcrição</summary>', '');
    for (const m of e.transcricao) {
      const quem = m.autor === 'ia' ? '**IA**' : m.autor === 'humano' ? '**Humano**' : '**Lead**';
      linhas.push(`${quem}: ${m.texto.replace(/\n/g, ' ')}  `);
    }
    linhas.push('', '</details>', '');
  }

  linhas.push(
    '---',
    '',
    '_As verificações de texto (C2 "outra opção", C3 "não pergunta de novo" e C5 "não promete") são heurísticas ' +
      'por palavras-chave; a transcrição de cada conversa está acima para conferência manual._',
    '',
  );
  return linhas.join('\n');
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
