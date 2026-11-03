import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CAMPOS_FICHA, CampoFicha } from '../leads/interfaces/lead.interface';
import { LeadsService } from '../leads/leads.service';
import { LlmToolCall } from '../llm/interfaces/llm-provider.interface';
import { AgendaService } from './agenda.service';
import { ContextoAcao, ResultadoAcao } from './interfaces/contexto-acao.interface';

@Injectable()
export class AcoesService {
  private readonly logger = new Logger(AcoesService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly leads: LeadsService,
    private readonly agenda: AgendaService,
  ) {}

  /** Executa uma tool pedida pelo LLM e grava na auditoria. Nunca lança: erros voltam para o LLM. */
  executar(ctx: ContextoAcao, chamada: LlmToolCall): ResultadoAcao {
    let resultado: ResultadoAcao;
    try {
      resultado = this.despachar(ctx, chamada.nome, chamada.argumentos as Record<string, any>);
    } catch (erro) {
      resultado = { sucesso: false, erro: (erro as Error).message };
    }
    this.registrar(ctx.tenant.tenant_id, ctx.telefone, chamada.nome, chamada.argumentos, resultado, ctx.simulacao);
    return resultado;
  }

  /** Auditoria de toda ação (também usada pela intervenção humana). */
  registrar(
    tenantId: string,
    telefone: string,
    nome: string,
    argumentos: unknown,
    resultado: ResultadoAcao,
    simulacao = false,
  ) {
    this.database.db
      .prepare(
        `INSERT INTO acoes (tenant_id, telefone, nome, argumentos, resultado, sucesso, simulacao, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        tenantId,
        telefone,
        nome,
        JSON.stringify(argumentos),
        JSON.stringify(resultado),
        resultado.sucesso ? 1 : 0,
        simulacao ? 1 : 0,
        new Date().toISOString(),
      );
  }

  private despachar(ctx: ContextoAcao, nome: string, args: Record<string, any>): ResultadoAcao {
    const tenantId = ctx.tenant.tenant_id;
    switch (nome) {
      case 'adicionar_tag':
        this.leads.adicionarTag(tenantId, ctx.telefone, args.tag);
        return { sucesso: true };

      case 'mover_estagio':
        if (!ctx.tenant.estagios.includes(args.estagio)) {
          return { sucesso: false, erro: `Estágio inválido. Use um de: ${ctx.tenant.estagios.join(', ')}` };
        }
        this.leads.moverEstagio(tenantId, ctx.telefone, args.estagio);
        return { sucesso: true };

      case 'atualizar_ficha':
        return this.atualizarFicha(ctx, args.campo, args.valor, args.evidencia);

      case 'notificar_equipe':
        this.database.db
          .prepare(
            `INSERT INTO notificacoes (tenant_id, telefone, destino, resumo, simulacao, timestamp)
             VALUES (?, ?, ?, ?, ?, ?)`,
          )
          .run(
            tenantId,
            ctx.telefone,
            ctx.tenant.telefone_notificacao,
            args.resumo,
            ctx.simulacao ? 1 : 0,
            new Date().toISOString(),
          );
        if (!ctx.simulacao) {
          // Envio "real" mockado: não há WhatsApp neste teste.
          this.logger.log(`Notificação para ${ctx.tenant.telefone_notificacao}: ${args.resumo}`);
        }
        return { sucesso: true, simulacao: ctx.simulacao };

      case 'transferir_humano':
        this.leads.definirControle(tenantId, ctx.telefone, 'humano');
        if (ctx.tenant.estagios.includes('Humano')) {
          this.leads.moverEstagio(tenantId, ctx.telefone, 'Humano');
        }
        return { sucesso: true };

      case 'consultar_agenda':
        return {
          sucesso: true,
          horarios: this.agenda
            .horariosLivres(tenantId)
            .map((horario) => ({ horario, descricao: this.agenda.descrever(horario) })),
        };

      case 'marcar_agenda':
        return this.agenda.marcar(tenantId, ctx.telefone, args.horario)
          ? { sucesso: true }
          : { sucesso: false, erro: 'Horário indisponível. Chame consultar_agenda novamente.' };

      default:
        return { sucesso: false, erro: `Ação desconhecida: ${nome}` };
    }
  }

  private atualizarFicha(ctx: ContextoAcao, campo: string, valor: unknown, evidencia: string): ResultadoAcao {
    if (!CAMPOS_FICHA.includes(campo as CampoFicha)) {
      return { sucesso: false, erro: `Campo inválido. Use um de: ${CAMPOS_FICHA.join(', ')}` };
    }
    // "Nunca inventar": o trecho citado precisa existir no que o lead escreveu.
    // TODO: comparação mais robusta (acentos, números por extenso, "480" vs "R$ 480").
    const normalizar = (s: string) => s.toLowerCase().trim();
    const comprovado =
      !!evidencia && ctx.textosDoLead.some((texto) => normalizar(texto).includes(normalizar(evidencia)));
    if (!comprovado) {
      return { sucesso: false, erro: 'Evidência não encontrada nas mensagens do lead. Campo não gravado.' };
    }
    this.leads.atualizarCampo(ctx.tenant.tenant_id, ctx.telefone, campo as CampoFicha, valor as string | number);
    return { sucesso: true };
  }
}
