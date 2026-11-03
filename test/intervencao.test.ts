import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { AppDeTeste, criarApp, enviar, esperar, intervir, obterConversa } from './helpers';

describe('Intervenção humana', () => {
  let ctx: AppDeTeste;
  beforeEach(async () => (ctx = await criarApp()));
  afterEach(() => ctx.app.close());

  it('com o humano no controle a IA não responde; ao religar, ela lê o que o humano disse', async () => {
    assert.equal(await intervir(ctx, 'assumir'), true);

    const doLead = await enviar(ctx, 'tem alguém aí?');
    await enviar(ctx, 'Oi! Aqui é o Pedro, da equipe', { autor: 'humano' });

    assert.equal(doLead.corpo.status, 'registrada');
    assert.equal(ctx.llm.chamadas.length, 0, 'a IA não pode ser chamada com o humano no controle');

    assert.equal(await intervir(ctx, 'religar'), true);
    const depois = await enviar(ctx, 'ok, obrigado');

    assert.ok(depois.corpo.answered_messages, 'a IA volta a responder');
    assert.equal(ctx.llm.chamadas.length, 1);
    const contexto = ctx.llm.chamadas[0].mensagens.map((m) => m.content).join('\n');
    assert.ok(contexto.includes('[Atendente humano] Oi! Aqui é o Pedro'), 'a IA recebe a fala do humano');
    assert.ok(contexto.includes('tem alguém aí?'), 'a IA recebe o que o lead disse enquanto o humano atendia');

    const { lead } = await obterConversa(ctx);
    assert.equal(lead.controle, 'ia');
    assert.equal(lead.houve_contato_humano, true);
  });

  it('assumir durante a janela de rajada cancela a resposta da IA', async () => {
    const pendente = enviar(ctx, 'oi');
    await esperar(50);
    await intervir(ctx, 'assumir');

    const resposta = await pendente;
    assert.equal(resposta.corpo.status, 'registrada');
    assert.equal(ctx.llm.chamadas.length, 0);
  });
});
