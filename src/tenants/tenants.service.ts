import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TenantConfig } from './interfaces/tenant-config.interface';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);
  private readonly tenants = new Map<string, TenantConfig>();

  constructor(config: ConfigService) {
    const dir = config.get<string>('tenants.dir');
    for (const arquivo of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const tenant = JSON.parse(readFileSync(join(dir, arquivo), 'utf-8')) as TenantConfig;
      // TODO: validar o schema do arquivo (campos obrigatórios, tipos)
      this.tenants.set(tenant.tenant_id, tenant);
    }
    this.logger.log(`Tenants carregados: ${[...this.tenants.keys()].join(', ')}`);
  }

  obter(tenantId: string): TenantConfig {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) {
      throw new NotFoundException(`Tenant '${tenantId}' não encontrado`);
    }
    return tenant;
  }
}
