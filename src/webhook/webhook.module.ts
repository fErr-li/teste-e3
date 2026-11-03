import { Module } from '@nestjs/common';
import { ConversasModule } from '../conversas/conversas.module';
import { EngineModule } from '../engine/engine.module';
import { LeadsModule } from '../leads/leads.module';
import { TenantsModule } from '../tenants/tenants.module';
import { RajadaService } from './rajada.service';
import { WebhookController } from './webhook.controller';
import { WebhookService } from './webhook.service';

@Module({
  imports: [TenantsModule, LeadsModule, ConversasModule, EngineModule],
  controllers: [WebhookController],
  providers: [WebhookService, RajadaService],
  exports: [RajadaService],
})
export class WebhookModule {}
