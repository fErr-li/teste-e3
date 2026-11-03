import { Controller, Get, Param } from '@nestjs/common';
import { ConversasService } from './conversas.service';

@Controller('conversas')
export class ConversasController {
  constructor(private readonly conversas: ConversasService) {}

  @Get(':tenantId/:telefone')
  obter(@Param('tenantId') tenantId: string, @Param('telefone') telefone: string) {
    return this.conversas.obter(tenantId, telefone);
  }
}
