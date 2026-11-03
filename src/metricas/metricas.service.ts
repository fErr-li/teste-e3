import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { TenantsService } from '../tenants/tenants.service';

@Injectable()
export class MetricasService {
  constructor(
    private readonly database: DatabaseService,
    private readonly tenants: TenantsService,
  ) {}

  // Uma "conversa" = um lead (tenant + telefone) com pelo menos um turno da IA.
  // TODO: decidir se turnos em modo simulação entram nas métricas.
  obter(tenantId: string) {
    this.tenants.obter(tenantId);

    const { total_conversas, custo_total } = this.database.db
      .prepare(
        `SELECT COUNT(DISTINCT telefone) AS total_conversas, COALESCE(SUM(custo_estimado), 0) AS custo_total
         FROM turnos WHERE tenant_id = ?`,
      )
      .get(tenantId) as { total_conversas: number; custo_total: number };

    const { qualificados, transferidos } = this.database.db
      .prepare(
        `SELECT
           COALESCE(SUM(EXISTS (SELECT 1 FROM json_each(l.tags) WHERE value = 'qualificado')), 0) AS qualificados,
           COALESCE(SUM(l.houve_contato_humano), 0) AS transferidos
         FROM leads l
         WHERE l.tenant_id = ?
           AND EXISTS (SELECT 1 FROM turnos t WHERE t.tenant_id = l.tenant_id AND t.telefone = l.telefone)`,
      )
      .get(tenantId) as { qualificados: number; transferidos: number };

    const percentual = (n: number) => (total_conversas ? (n / total_conversas) * 100 : 0);

    return {
      tenant_id: tenantId,
      total_conversas,
      custo_medio_por_conversa: total_conversas ? custo_total / total_conversas : 0,
      percentual_qualificados: percentual(qualificados),
      percentual_transferidos_humano: percentual(transferidos),
    };
  }
}
