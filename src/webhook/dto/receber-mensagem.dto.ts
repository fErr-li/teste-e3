import { IsBoolean, IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches } from 'class-validator';

export class ReceberMensagemDto {
  @IsString()
  @IsNotEmpty()
  message_id: string;

  @IsString()
  @IsNotEmpty()
  tenant_id: string;

  @Matches(/^\d{10,15}$/, { message: 'telefone deve conter apenas dígitos (10 a 15)' })
  telefone: string;

  @IsString()
  @IsNotEmpty()
  texto: string;

  @IsISO8601()
  timestamp: string;

  /** Mensagens do atendente humano também chegam pelo webhook. */
  @IsOptional()
  @IsIn(['lead', 'humano'])
  autor?: 'lead' | 'humano';

  /** Em simulação, notificar_equipe só grava o que teria enviado. */
  @IsOptional()
  @IsBoolean()
  simulacao?: boolean;
}
