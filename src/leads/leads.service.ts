import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { CampoFicha, Controle, Lead } from './interfaces/lead.interface';

@Injectable()
export class LeadsService {
  constructor(private readonly database: DatabaseService) {}

  garantir(tenantId: string, telefone: string): Lead {
    const agora = new Date().toISOString();
    this.database.db
      .prepare(
        `INSERT OR IGNORE INTO leads (tenant_id, telefone, criado_em, atualizado_em)
         VALUES (?, ?, ?, ?)`,
      )
      .run(tenantId, telefone, agora, agora);
    return this.obter(tenantId, telefone);
  }

  obter(tenantId: string, telefone: string): Lead | null {
    const linha = this.database.db
      .prepare('SELECT * FROM leads WHERE tenant_id = ? AND telefone = ?')
      .get(tenantId, telefone) as Record<string, any> | undefined;
    if (!linha) return null;
    return {
      ...linha,
      tags: JSON.parse(linha.tags),
      houve_contato_humano: linha.houve_contato_humano === 1,
    } as Lead;
  }

  atualizarCampo(tenantId: string, telefone: string, campo: CampoFicha, valor: string | number) {
    // `campo` vem da lista fechada CAMPOS_FICHA (validada antes), por isso pode ir no SQL.
    this.atualizar(tenantId, telefone, `${campo} = ?`, valor);
  }

  adicionarTag(tenantId: string, telefone: string, tag: string) {
    const lead = this.obter(tenantId, telefone);
    if (lead.tags.includes(tag)) return;
    this.atualizar(tenantId, telefone, 'tags = ?', JSON.stringify([...lead.tags, tag]));
  }

  moverEstagio(tenantId: string, telefone: string, estagio: string) {
    this.atualizar(tenantId, telefone, 'estagio = ?', estagio);
  }

  definirControle(tenantId: string, telefone: string, controle: Controle) {
    if (controle === 'humano') {
      this.atualizar(tenantId, telefone, 'controle = ?, houve_contato_humano = 1', controle);
    } else {
      this.atualizar(tenantId, telefone, 'controle = ?', controle);
    }
  }

  private atualizar(tenantId: string, telefone: string, set: string, valor: string | number) {
    this.database.db
      .prepare(`UPDATE leads SET ${set}, atualizado_em = ? WHERE tenant_id = ? AND telefone = ?`)
      .run(valor, new Date().toISOString(), tenantId, telefone);
  }
}
