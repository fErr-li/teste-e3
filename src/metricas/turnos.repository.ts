import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface Turno {
  tenant_id: string;
  telefone: string;
  modelo: string;
  tokens_entrada: number;
  tokens_saida: number;
  custo_estimado: number;
  latencia_ms: number;
  acoes: string[];
  simulacao: boolean;
}

@Injectable()
export class TurnosRepository {
  constructor(private readonly database: DatabaseService) {}

  registrar(turno: Turno) {
    this.database.db
      .prepare(
        `INSERT INTO turnos
           (tenant_id, telefone, modelo, tokens_entrada, tokens_saida, custo_estimado,
            latencia_ms, acoes, simulacao, timestamp)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        turno.tenant_id,
        turno.telefone,
        turno.modelo,
        turno.tokens_entrada,
        turno.tokens_saida,
        turno.custo_estimado,
        turno.latencia_ms,
        JSON.stringify(turno.acoes),
        turno.simulacao ? 1 : 0,
        new Date().toISOString(),
      );
  }
}
