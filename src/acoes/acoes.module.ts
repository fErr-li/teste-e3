import { Module } from '@nestjs/common';
import { LeadsModule } from '../leads/leads.module';
import { AcoesService } from './acoes.service';
import { AgendaService } from './agenda.service';

@Module({
  imports: [LeadsModule],
  providers: [AcoesService, AgendaService],
  exports: [AcoesService],
})
export class AcoesModule {}
