export type Controle = 'ia' | 'humano';

// Campos da ficha que a IA pode gravar via atualizar_ficha.
export const CAMPOS_FICHA = [
  'nome',
  'cidade',
  'situacao_imovel',
  'tipo_imovel',
  'valor_conta_luz',
  'tipo_pagamento',
] as const;
export type CampoFicha = (typeof CAMPOS_FICHA)[number];

export interface Lead {
  tenant_id: string;
  telefone: string;
  nome: string | null;
  cidade: string | null;
  situacao_imovel: string | null;
  tipo_imovel: string | null;
  valor_conta_luz: number | null;
  tipo_pagamento: string | null;
  estagio: string;
  tags: string[];
  controle: Controle;
  houve_contato_humano: boolean;
  criado_em: string;
  atualizado_em: string;
}
