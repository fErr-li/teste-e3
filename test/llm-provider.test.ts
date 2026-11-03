import assert from 'node:assert/strict';
import { createServer, Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { afterEach, describe, it } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { OpenAiCompatibleProvider } from '../src/llm/providers/openai-compatible.provider';

const RESPOSTA_OK = {
  model: 'modelo-falso',
  choices: [{ message: { content: 'olá!' } }],
  usage: { prompt_tokens: 10, completion_tokens: 2 },
};

/** Servidor que imita o provedor: devolve os status da lista, um por requisição. */
async function provedorFalso(statusPorRequisicao: number[]) {
  const recebidas: number[] = [];
  const server = createServer((req, res) => {
    const status = statusPorRequisicao[recebidas.length] ?? 200;
    recebidas.push(status);
    res.writeHead(status, { 'Content-Type': 'application/json', 'Retry-After': '0' });
    res.end(JSON.stringify(status === 200 ? RESPOSTA_OK : { error: 'falhou' }));
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const url = `http://localhost:${(server.address() as AddressInfo).port}`;
  return { server, url, recebidas };
}

function criarProvider(baseUrl: string) {
  const valores = { 'llm.baseUrl': baseUrl, 'llm.apiKey': 'x', 'llm.model': 'modelo-falso', 'llm.maxTentativas': 3, 'llm.timeoutMs': 5000 };
  return new OpenAiCompatibleProvider({ get: (chave: string) => valores[chave] } as unknown as ConfigService);
}

describe('Adaptador do LLM: retry', () => {
  let server: Server;
  afterEach(() => server?.close());

  it('tenta de novo depois de um 429 e devolve a resposta', async () => {
    const falso = await provedorFalso([429, 200]);
    server = falso.server;

    const resposta = await criarProvider(falso.url).chat({ mensagens: [], ferramentas: [] });

    assert.deepEqual(falso.recebidas, [429, 200]);
    assert.equal(resposta.texto, 'olá!');
    assert.equal(resposta.tokensEntrada, 10);
  });

  it('não tenta de novo em erro que não é temporário (ex.: 400)', async () => {
    const falso = await provedorFalso([400]);
    server = falso.server;

    await assert.rejects(criarProvider(falso.url).chat({ mensagens: [], ferramentas: [] }), /400/);
    assert.equal(falso.recebidas.length, 1);
  });

  it('desiste depois do número máximo de tentativas', async () => {
    const falso = await provedorFalso([503, 503, 503]);
    server = falso.server;

    await assert.rejects(criarProvider(falso.url).chat({ mensagens: [], ferramentas: [] }), /503/);
    assert.equal(falso.recebidas.length, 3);
  });
});
