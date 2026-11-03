import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

// Agenda mockada: próximos 5 dias úteis (uma semana), às 9h e às 14h (horário de Brasília).
@Injectable()
export class AgendaService {
  constructor(private readonly database: DatabaseService) {}

  horariosLivres(tenantId: string, agora = new Date()): string[] {
    const ocupados = new Set(
      (
        this.database.db.prepare('SELECT horario FROM agendamentos WHERE tenant_id = ?').all(tenantId) as {
          horario: string;
        }[]
      ).map((a) => a.horario),
    );

    const horarios: string[] = [];
    const dia = new Date(agora);
    while (horarios.length < 10) {
      dia.setUTCDate(dia.getUTCDate() + 1);
      if (dia.getUTCDay() === 0 || dia.getUTCDay() === 6) continue;
      const data = dia.toISOString().slice(0, 10);
      horarios.push(`${data}T09:00:00-03:00`, `${data}T14:00:00-03:00`);
    }
    return horarios.filter((h) => !ocupados.has(h));
  }

  /** Ex.: "quinta-feira, 05/11, 09:00" — para a IA entender "quinta de manhã". */
  descrever(horario: string): string {
    return new Intl.DateTimeFormat('pt-BR', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Sao_Paulo',
    }).format(new Date(horario));
  }

  marcar(tenantId: string, telefone: string, horario: string): boolean {
    if (!this.horariosLivres(tenantId).includes(horario)) return false;
    this.database.db
      .prepare('INSERT INTO agendamentos (tenant_id, telefone, horario, timestamp) VALUES (?, ?, ?, ?)')
      .run(tenantId, telefone, horario, new Date().toISOString());
    return true;
  }
}
