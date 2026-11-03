import { Injectable } from '@nestjs/common';
import { AcoesService } from '../acoes/acoes.service';
import { MensagensRepository } from '../conversas/mensagens.repository';
import { LeadsService } from '../leads/leads.service';
import { TenantsService } from '../tenants/tenants.service';
import { chaveLead, RajadaService } from '../webhook/rajada.service';
import { IntervencaoDto } from './dto/intervencao.dto';

@Injectable()
export class IntervencaoService {
  constructor(
    private readonly tenants: TenantsService,
    private readonly leads: LeadsService,
    private readonly mensagens: MensagensRepository,
    private readonly rajada: RajadaService,
    private readonly acoes: AcoesService,
  ) {}

  executar({ tenant_id, telefone, acao }: IntervencaoDto): boolean {
    this.tenants.obter(tenant_id);
    this.leads.garantir(tenant_id, telefone);

    if (acao === 'assumir') {
      this.leads.definirControle(tenant_id, telefone, 'humano');
      // A IA não deve responder o que estava na janela de rajada: vira histórico para o humano.
      this.rajada.cancelar(chaveLead(tenant_id, telefone));
      const pendentes = this.mensagens.pendentes(tenant_id, telefone).map((m) => m.message_id);
      this.mensagens.marcarProcessadas(pendentes, null);
    } else {
      // O histórico (inclusive as mensagens do humano) é lido pelo motor no próximo turno.
      this.leads.definirControle(tenant_id, telefone, 'ia');
    }

    this.acoes.registrar(tenant_id, telefone, `intervencao_${acao}`, { acao }, { sucesso: true });
    return true;
  }
}
