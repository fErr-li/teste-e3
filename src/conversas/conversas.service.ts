import { Injectable, NotFoundException } from '@nestjs/common';
import { LeadsService } from '../leads/leads.service';
import { TenantsService } from '../tenants/tenants.service';
import { MensagensRepository } from './mensagens.repository';

@Injectable()
export class ConversasService {
  constructor(
    private readonly tenants: TenantsService,
    private readonly leads: LeadsService,
    private readonly mensagens: MensagensRepository,
  ) {}

  obter(tenantId: string, telefone: string) {
    this.tenants.obter(tenantId);
    const lead = this.leads.obter(tenantId, telefone);
    if (!lead) {
      throw new NotFoundException('Conversa não encontrada');
    }
    const mensagens = [
      ...this.mensagens.historico(tenantId, telefone),
      ...this.mensagens.pendentes(tenantId, telefone),
    ];
    return { lead, mensagens };
  }
}
