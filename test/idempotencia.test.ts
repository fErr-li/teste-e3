import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { AppDeTeste, criarApp, enviar, obterConversa } from './helpers';

describe('Idempotência', () => {
  let ctx: AppDeTeste;
  beforeEach(async () => (ctx = await criarApp()));
  afterEach(() => ctx.app.close());

  it('o mesmo message_id duas vezes gera uma resposta só', async () => {
    const primeira = await enviar(ctx, 'oi', { message_id: 'wamid.repetido' });
    const segunda = await enviar(ctx, 'oi', { message_id: 'wamid.repetido' });

    assert.equal(primeira.status, 200);
    assert.deepEqual(primeira.corpo.answered_messages, [{ message_id: 'wamid.repetido' }]);
    assert.equal(segunda.status, 200);
    assert.equal(segunda.corpo, null, 'duplicada deve voltar com corpo vazio');
    assert.equal(ctx.llm.chamadas.length, 1, 'o LLM deve ser chamado uma vez só');

    const { mensagens } = await obterConversa(ctx);
    assert.equal(mensagens.filter((m) => m.autor === 'lead').length, 1);
  });

  it('duas requisições iguais ao mesmo tempo também geram uma resposta só', async () => {
    const respostas = await Promise.all([
      enviar(ctx, 'oi', { message_id: 'wamid.simultaneo' }),
      enviar(ctx, 'oi', { message_id: 'wamid.simultaneo' }),
    ]);

    assert.equal(respostas.filter((r) => r.corpo === null).length, 1);
    assert.equal(ctx.llm.chamadas.length, 1);
  });
});
