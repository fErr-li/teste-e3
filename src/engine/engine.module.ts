import { Module } from '@nestjs/common';
import { AcoesModule } from '../acoes/acoes.module';
import { ConversasModule } from '../conversas/conversas.module';
import { LeadsModule } from '../leads/leads.module';
import { LlmModule } from '../llm/llm.module';
import { MetricasModule } from '../metricas/metricas.module';
import { TenantsModule } from '../tenants/tenants.module';
import { EngineService } from './engine.service';

@Module({
  imports: [LlmModule, TenantsModule, LeadsModule, ConversasModule, AcoesModule, MetricasModule],
  providers: [EngineService],
  exports: [EngineService],
})
export class EngineModule {}
