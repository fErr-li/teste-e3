import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { TenantsModule } from '../tenants/tenants.module';
import { ConversasController } from './conversas.controller';
import { ConversasService } from './conversas.service';
import { MensagensRepository } from './mensagens.repository';

@Module({
  imports: [TenantsModule, LeadsModule],
  controllers: [ConversasController],
  providers: [ConversasService, MensagensRepository],
  exports: [MensagensRepository],
})
export class ConversasModule {}
