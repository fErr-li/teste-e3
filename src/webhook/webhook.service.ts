import { Injectable } from '@nestjs/common';
import { MensagensRepository } from '../conversas/mensagens.repository';
import { EngineService } from '../engine/engine.service';
import { ResultadoTurno } from '../engine/interfaces/resultado-turno.interface';
import { LeadsService } from '../leads/leads.service';
import { TenantsService } from '../tenants/tenants.service';
import { ReceberMensagemDto } from './dto/receber-mensagem.dto';
import { chaveLead, RajadaService } from './rajada.service';

export type RespostaWebhook = ResultadoTurno | { message_id: string; status: 'registrada' | 'agrupada' };

@Injectable()
export class WebhookService {
  constructor(
    private readonly tenants: TenantsService,
    private readonly leads: LeadsService,
    private readonly mensagens: MensagensRepository,
    private readonly rajada: RajadaService,
    private readonly engine: EngineService,
  ) {}

  /** Retorna null quando o message_id já foi recebido (idempotência). */
  async receber(dto: ReceberMensagemDto): Promise<RespostaWebhook | null> {
    this.tenants.obter(dto.tenant_id);
    const lead = this.leads.garantir(dto.tenant_id, dto.telefone);
    const autor = dto.autor ?? 'lead';
    const simulacao = dto.simulacao ?? false;

    // Só mensagens do lead com a IA no controle aguardam resposta da IA.
    // As demais entram direto no histórico (a IA as lê quando voltar, após "religar").
    const aguardaIa = autor === 'lead' && lead.controle === 'ia';

    const inserida = this.mensagens.inserir({
      message_id: dto.message_id,
      tenant_id: dto.tenant_id,
      telefone: dto.telefone,
      texto: dto.texto,
      timestamp: dto.timestamp,
      autor,
      status: aguardaIa ? 'pendente' : 'processada',
      respondida_por: null,
      simulacao,
    });
    if (!inserida) return null;

    if (!aguardaIa) {
      return { message_id: dto.message_id, status: 'registrada' };
    }

    const turno = this.rajada.agendar(chaveLead(dto.tenant_id, dto.telefone), () =>
      this.engine.processarTurno(dto.tenant_id, dto.telefone, simulacao),
    );
    if (!turno) {
      // Já existe uma janela aberta: a resposta sai no request que a abriu.
      return { message_id: dto.message_id, status: 'agrupada' };
    }

    return (await turno) ?? { message_id: dto.message_id, status: 'registrada' };
  }
}
