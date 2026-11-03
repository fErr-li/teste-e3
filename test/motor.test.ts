import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it } from 'node:test';
import { AppDeTeste, auditoria, criarApp, enviar, obterConversa } from './helpers';

describe('Motor', () => {
  let ctx: AppDeTeste;
  beforeEach(async () => (ctx = await criarApp()));
  afterEach(() => ctx.app.close());

  it('nunca encerra em silêncio: aplica tag e estágio se a IA esquecer', async () => {
    ctx.llm.enfileirar({ texto: 'Oi! Como posso ajudar?' }); // só texto, nenhuma ação

    await enviar(ctx, 'oi');

    const { lead } = await obterConversa(ctx);
    assert.equal(lead.estagio, 'Qualificacao');
    assert.deepEqual(lead.tags, ['em-qualificacao']);
    assert.match(auditoria(ctx, 'mover_estagio')[0].argumentos, /fallback/);
  });

  it('não aplica o fallback quando a IA já registrou tag e estágio', async () => {
    ctx.llm.enfileirar(
      {
        toolCalls: [
          { id: '1', nome: 'adicionar_tag', argumentos: { tag: 'qualificado' } },
          { id: '2', nome: 'mover_estagio', argumentos: { estagio: 'Qualificado' } },
        ],
      },
      { texto: 'Perfeito!' },
    );

    await enviar(ctx, 'oi');

    const { lead } = await obterConversa(ctx);
    assert.equal(lead.estagio, 'Qualificado');
    assert.deepEqual(lead.tags, ['qualificado']);
  });

  it('só responde depois de ter o resultado da agenda', async () => {
    ctx.llm.enfileirar(
      { toolCalls: [{ id: '1', nome: 'consultar_agenda', argumentos: {} }] },
      { texto: 'Tenho horários livres, qual prefere?' },
    );

    const resposta = await enviar(ctx, 'quero agendar');

    assert.equal(ctx.llm.chamadas.length, 2);
    const resultadoDaAgenda = ctx.llm.chamadas[1].mensagens.find((m) => m.role === 'tool');
    assert.ok(JSON.parse(resultadoDaAgenda.content).horarios.length > 0, 'o LLM recebe os horários');
    assert.equal(resposta.corpo.texto, 'Tenho horários livres, qual prefere?');
  });

  it('responde com mensagem padrão se o loop de ações atingir o limite', async () => {
    const semFim = { toolCalls: [{ id: '1', nome: 'consultar_agenda', argumentos: {} }] };
    ctx.llm.enfileirar(semFim, semFim, semFim); // LLM_MAX_ITERACOES=3 nos testes

    const resposta = await enviar(ctx, 'oi');

    assert.ok(resposta.corpo.texto.length > 0, 'o lead nunca fica sem resposta');
  });
});
