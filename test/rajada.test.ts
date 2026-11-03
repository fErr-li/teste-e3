import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { AppDeTeste, criarApp, enviar, esperar } from './helpers';

describe('Rajada', () => {
  let ctx: AppDeTeste;
  beforeEach(async () => (ctx = await criarApp()));
  afterEach(() => ctx.app.close());

  it('3 mensagens dentro da janela geram um único turno que considera as três', async () => {
    const primeira = enviar(ctx, 'olá');
    await esperar(30);
    const segunda = enviar(ctx, 'sou Carlos Lima de Olinda, casa própria, conta de uns 600');
    await esperar(30);
    const terceira = enviar(ctx, 'queria saber como funciona');

    const [r1, r2, r3] = await Promise.all([primeira, segunda, terceira]);

    assert.equal(r1.corpo.answered_messages.length, 3, 'a resposta cobre as 3 mensagens');
    assert.equal(r2.corpo.status, 'agrupada');
    assert.equal(r3.corpo.status, 'agrupada');
    assert.equal(ctx.llm.chamadas.length, 1, 'um único turno da IA');

    const mensagens = ctx.llm.chamadas[0].mensagens;
    const ultimaDoLead = mensagens[mensagens.length - 1];
    assert.equal(ultimaDoLead.role, 'user');
    for (const trecho of ['olá', 'Carlos Lima', 'como funciona']) {
      assert.ok(ultimaDoLead.content.includes(trecho), `o LLM deve receber "${trecho}"`);
    }
  });

  it('mensagem depois da janela fechar abre um novo turno', async () => {
    await enviar(ctx, 'oi');
    await enviar(ctx, 'tudo bem?');

    assert.equal(ctx.llm.chamadas.length, 2);
  });
});
