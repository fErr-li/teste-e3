import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AcoesModule } from './acoes/acoes.module';
import configuration from './config/configuration';
import { ConversasModule } from './conversas/conversas.module';
import { DatabaseModule } from './database/database.module';
import { EngineModule } from './engine/engine.module';
import { IntervencaoModule } from './intervencao/intervencao.module';
import { LeadsModule } from './leads/leads.module';
import { LlmModule } from './llm/llm.module';
import { MetricasModule } from './metricas/metricas.module';
import { TenantsModule } from './tenants/tenants.module';
import { WebhookModule } from './webhook/webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    DatabaseModule,
    TenantsModule,
    LlmModule,
    LeadsModule,
    ConversasModule,
    AcoesModule,
    MetricasModule,
    EngineModule,
    WebhookModule,
    IntervencaoModule,
  ],
})
export class AppModule {}
