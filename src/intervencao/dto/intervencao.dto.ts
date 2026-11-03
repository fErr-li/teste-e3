import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class IntervencaoDto {
  @IsString()
  @IsNotEmpty()
  tenant_id: string;

  @Matches(/^\d{10,15}$/, { message: 'telefone deve conter apenas dígitos (10 a 15)' })
  telefone: string;

  @IsIn(['assumir', 'religar'])
  acao: 'assumir' | 'religar';
}
