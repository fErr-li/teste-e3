import { Module } from '@nestjs/common';
import { TenantsModule } from '../tenants/tenants.module';
import { MetricasController } from './metricas.controller';
import { MetricasService } from './metricas.service';
import { TurnosRepository } from './turnos.repository';

@Module({
  imports: [TenantsModule],
  controllers: [MetricasController],
  providers: [MetricasService, TurnosRepository],
  exports: [TurnosRepository],
})
export class MetricasModule {}
