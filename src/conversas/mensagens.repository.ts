import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { Mensagem } from './interfaces/mensagem.interface';

@Injectable()
export class MensagensRepository {
  constructor(private readonly database: DatabaseService) {}

  /** 
   * Insere a mensagem. Retorna false se o message_id já existia (idempotência): a PK garante isso mesmo com duas requisições simultâneas.
   */
  inserir(mensagem: Mensagem): boolean {
    const resultado = this.database.db
      .prepare(
        `INSERT OR IGNORE INTO mensagens
           (message_id, tenant_id, telefone, texto, timestamp, autor, status, respondida_por, simulacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        mensagem.message_id,
        mensagem.tenant_id,
        mensagem.telefone,
        mensagem.texto,
        mensagem.timestamp,
        mensagem.autor,
        mensagem.status,
        mensagem.respondida_por,
        mensagem.simulacao ? 1 : 0,
      );
    return resultado.changes > 0;
  }

  pendentes(tenantId: string, telefone: string): Mensagem[] {
    return this.listar(
      `SELECT * FROM mensagens WHERE tenant_id = ? AND telefone = ? AND status = 'pendente'
       ORDER BY rowid`,
      tenantId,
      telefone,
    );
  }

  historico(tenantId: string, telefone: string): Mensagem[] {
    return this.listar(
      `SELECT * FROM mensagens WHERE tenant_id = ? AND telefone = ? AND status = 'processada'
       ORDER BY rowid`,
      tenantId,
      telefone,
    );
  }

  marcarProcessadas(messageIds: string[], respondidaPor: string | null) {
    const stmt = this.database.db.prepare(
      `UPDATE mensagens SET status = 'processada', respondida_por = ? WHERE message_id = ?`,
    );
    this.database.transacao(() => messageIds.forEach((id) => stmt.run(respondidaPor, id)));
  }

  private listar(sql: string, ...params: string[]): Mensagem[] {
    return (this.database.db.prepare(sql).all(...params) as Record<string, any>[]).map((linha) => ({
      ...linha,
      simulacao: linha.simulacao === 1,
    })) as Mensagem[];
  }
}
