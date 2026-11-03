import { Controller, Get, Param } from '@nestjs/common';
import { MetricasService } from './metricas.service';

@Controller('metricas')
export class MetricasController {
  constructor(private readonly metricas: MetricasService) {}

  @Get(':tenantId')
  obter(@Param('tenantId') tenantId: string) {
    return this.metricas.obter(tenantId);
  }
}
