import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { AppDeTeste, auditoria, criarApp, enviar, obterConversa } from './helpers';

describe('Ficha do lead: não inventar campo', () => {
  let ctx: AppDeTeste;
  beforeEach(async () => (ctx = await criarApp()));
  afterEach(() => ctx.app.close());

  it('só grava o campo quando a evidência está no que o lead escreveu', async () => {
    ctx.llm.enfileirar(
      {
        toolCalls: [
          // O lead NÃO disse a cidade: o LLM está inventando.
          { id: '1', nome: 'atualizar_ficha', argumentos: { campo: 'cidade', valor: 'Recife', evidencia: 'moro em Recife' } },
          // O lead disse o nome.
          { id: '2', nome: 'atualizar_ficha', argumentos: { campo: 'nome', valor: 'Maria', evidencia: 'sou a Maria' } },
        ],
      },
      { texto: 'Prazer, Maria! De qual cidade você fala?' },
    );

    await enviar(ctx, 'oi, sou a Maria');

    const { lead } = await obterConversa(ctx);
    assert.equal(lead.cidade, null, 'campo inventado não pode ser gravado');
    assert.equal(lead.nome, 'Maria');

    const tentativas = auditoria(ctx, 'atualizar_ficha');
    assert.deepEqual(
      tentativas.map((a) => a.sucesso),
      [0, 1],
      'as duas tentativas ficam na auditoria, a inventada como falha',
    );

    const respostasDasTools = ctx.llm.chamadas[1].mensagens.filter((m) => m.role === 'tool');
    assert.ok(respostasDasTools[0].content.includes('Evidência não encontrada'), 'o LLM é avisado da recusa');
  });

  it('recusa campos fora da lista permitida', async () => {
    ctx.llm.enfileirar(
      { toolCalls: [{ id: '1', nome: 'atualizar_ficha', argumentos: { campo: 'cpf', valor: '123', evidencia: 'oi' } }] },
      { texto: 'Olá!' },
    );

    await enviar(ctx, 'oi');

    assert.equal(auditoria(ctx, 'atualizar_ficha')[0].sucesso, 0);
  });
});
