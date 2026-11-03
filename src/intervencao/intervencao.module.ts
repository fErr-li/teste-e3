import { Module } from '@nestjs/common';
import { AcoesModule } from '../acoes/acoes.module';
import { ConversasModule } from '../conversas/conversas.module';
import { LeadsModule } from '../leads/leads.module';
import { TenantsModule } from '../tenants/tenants.module';
import { WebhookModule } from '../webhook/webhook.module';
import { IntervencaoController } from './intervencao.controller';
import { IntervencaoService } from './intervencao.service';

@Module({
  imports: [TenantsModule, LeadsModule, ConversasModule, AcoesModule, WebhookModule],
  controllers: [IntervencaoController],
  providers: [IntervencaoService],
})
export class IntervencaoModule {}
