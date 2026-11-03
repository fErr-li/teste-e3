import { TenantConfig } from '../../tenants/interfaces/tenant-config.interface';

export interface ContextoAcao {
  tenant: TenantConfig;
  telefone: string;
  simulacao: boolean;
  /** Textos que o lead enviou (histórico + rajada atual), usados para validar a evidência da ficha. */
  textosDoLead: string[];
}

export interface ResultadoAcao {
  sucesso: boolean;
  [chave: string]: unknown;
}
