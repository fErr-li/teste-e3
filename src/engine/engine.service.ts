import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'node:crypto';
import { AcoesService } from '../acoes/acoes.service';
import { FERRAMENTAS } from '../acoes/ferramentas';
import { ContextoAcao } from '../acoes/interfaces/contexto-acao.interface';
import { Mensagem } from '../conversas/interfaces/mensagem.interface';
import { MensagensRepository } from '../conversas/mensagens.repository';
import { LeadsService } from '../leads/leads.service';
import { LLM_PROVIDER, LlmMensagem, LlmProvider } from '../llm/interfaces/llm-provider.interface';
import { estimarCusto } from '../llm/precos';
import { TurnosRepository } from '../metricas/turnos.repository';
import { TenantsService } from '../tenants/tenants.service';
import { ResultadoTurno } from './interfaces/resultado-turno.interface';
import { montarPromptSistema } from './prompt.builder';

@Injectable()
export class EngineService {
  private readonly maxIteracoes: number;

  constructor(
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    private readonly tenants: TenantsService,
    private readonly leads: LeadsService,
    private readonly mensagens: MensagensRepository,
    private readonly acoes: AcoesService,
    private readonly turnos: TurnosRepository,
    config: ConfigService,
  ) {
    this.maxIteracoes = config.get<number>('llm.maxIteracoes');
  }

  /** Processa todas as mensagens pendentes do lead em um único turno da IA. */
  async processarTurno(tenantId: string, telefone: string, simulacao: boolean): Promise<ResultadoTurno | null> {
    const pendentes = this.mensagens.pendentes(tenantId, telefone);
    if (pendentes.length === 0) return null;

    const inicio = Date.now();
    const tenant = this.tenants.obter(tenantId);
    const lead = this.leads.obter(tenantId, telefone);
    const historico = this.mensagens.historico(tenantId, telefone);

    const conversa: LlmMensagem[] = [
      { role: 'system', content: montarPromptSistema(tenant, lead) },
      ...historico.map(paraLlm),
      { role: 'user', content: pendentes.map((m) => m.texto).join('\n') },
    ];

    const ctx: ContextoAcao = {
      tenant,
      telefone,
      simulacao,
      textosDoLead: [...historico, ...pendentes].filter((m) => m.autor === 'lead').map((m) => m.texto),
    };

    let texto: string | null = null;
    let modelo = '';
    let tokensEntrada = 0;
    let tokensSaida = 0;
    const acoesExecutadas: string[] = [];

    // Loop de tool calling: a resposta final só sai depois que todas as tools retornaram.
    for (let i = 0; i < this.maxIteracoes; i++) {
      const resposta = await this.llm.chat({ mensagens: conversa, ferramentas: FERRAMENTAS });
      modelo = resposta.modelo;
      tokensEntrada += resposta.tokensEntrada;
      tokensSaida += resposta.tokensSaida;

      if (resposta.toolCalls.length === 0) {
        texto = resposta.texto;
        break;
      }

      conversa.push({ role: 'assistant', content: resposta.texto, toolCalls: resposta.toolCalls });
      for (const chamada of resposta.toolCalls) {
        const resultado = this.acoes.executar(ctx, chamada);
        acoesExecutadas.push(chamada.nome);
        conversa.push({ role: 'tool', toolCallId: chamada.id, content: JSON.stringify(resultado) });
      }
    }

    acoesExecutadas.push(...this.garantirTagEEstagio(ctx));
    // Limite de iterações atingido ou LLM sem texto: o lead nunca fica sem resposta.
    texto ||= RESPOSTA_PADRAO;

    const timestamp = new Date().toISOString();
    const messageId = createHash('sha256').update(`${tenantId}:${telefone}:${timestamp}:${texto}`).digest('hex');

    this.mensagens.inserir({
      message_id: messageId,
      tenant_id: tenantId,
      telefone,
      texto,
      timestamp,
      autor: 'ia',
      status: 'processada',
      respondida_por: null,
      simulacao,
    });
    this.mensagens.marcarProcessadas(
      pendentes.map((m) => m.message_id),
      messageId,
    );

    this.turnos.registrar({
      tenant_id: tenantId,
      telefone,
      modelo,
      tokens_entrada: tokensEntrada,
      tokens_saida: tokensSaida,
      custo_estimado: estimarCusto(modelo, tokensEntrada, tokensSaida),
      latencia_ms: Date.now() - inicio,
      acoes: acoesExecutadas,
      simulacao,
    });

    return {
      message_id: messageId,
      answered_messages: pendentes.map((m) => ({ message_id: m.message_id })),
      tenant_id: tenantId,
      telefone,
      texto,
      timestamp,
    };
  }

  /**
   * "Nunca encerrar em silêncio": se a IA não deixou o lead com tag e estágio,
   * o servidor aplica um padrão. Passa pelo AcoesService, então fica na auditoria.
   */
  private garantirTagEEstagio(ctx: ContextoAcao): string[] {
    const lead = this.leads.obter(ctx.tenant.tenant_id, ctx.telefone);
    const transferido = lead.controle === 'humano';
    const aplicadas: string[] = [];

    if (lead.estagio === 'Novo') {
      const estagio = transferido ? 'Humano' : 'Qualificacao';
      this.acoes.executar(ctx, {
        id: 'fallback-estagio',
        nome: 'mover_estagio',
        argumentos: { estagio, origem: 'fallback' },
      });
      aplicadas.push('mover_estagio:fallback');
    }
    if (lead.tags.length === 0) {
      const tag = transferido ? 'transferido-humano' : 'em-qualificacao';
      this.acoes.executar(ctx, {
        id: 'fallback-tag',
        nome: 'adicionar_tag',
        argumentos: { tag, origem: 'fallback' },
      });
      aplicadas.push('adicionar_tag:fallback');
    }
    return aplicadas;
  }
}

const RESPOSTA_PADRAO = 'Desculpe, não consegui processar sua mensagem agora. Pode repetir, por favor?';

function paraLlm(mensagem: Mensagem): LlmMensagem {
  switch (mensagem.autor) {
    case 'lead':
      return { role: 'user', content: mensagem.texto };
    case 'humano':
      return { role: 'assistant', content: `[Atendente humano] ${mensagem.texto}` };
    case 'ia':
      return { role: 'assistant', content: mensagem.texto };
  }
}
