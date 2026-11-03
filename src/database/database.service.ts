import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { SCHEMA } from './schema';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  readonly db: DatabaseSync;

  constructor(config: ConfigService) {
    const path = config.get<string>('database.path');
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new DatabaseSync(path);
    this.db.exec(SCHEMA);
  }

  transacao<T>(fn: () => T): T {
    this.db.exec('BEGIN');
    try {
      const resultado = fn();
      this.db.exec('COMMIT');
      return resultado;
    } catch (erro) {
      this.db.exec('ROLLBACK');
      throw erro;
    }
  }

  onModuleDestroy() {
    this.db.close();
  }
}
