// Schema do banco
// Ajustes em relação ao planejamento: ver context/tarefas.md, seção 0.
export const SCHEMA = `
CREATE TABLE IF NOT EXISTS mensagens (
  message_id    TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  telefone      TEXT NOT NULL,
  texto         TEXT NOT NULL,
  timestamp     TEXT NOT NULL,
  autor         TEXT NOT NULL,                -- 'lead' | 'humano' | 'ia'
  status        TEXT NOT NULL,                -- 'pendente' | 'processada'
  respondida_por TEXT,                        -- message_id da resposta da IA que agrupou a rajada
  simulacao     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_mensagens_lead ON mensagens (tenant_id, telefone);

CREATE TABLE IF NOT EXISTS leads (
  tenant_id            TEXT NOT NULL,
  telefone             TEXT NOT NULL,
  nome                 TEXT,
  cidade               TEXT,
  situacao_imovel      TEXT,                  -- 'proprio' | 'alugado'
  tipo_imovel          TEXT,                  -- 'casa' | 'apartamento'
  valor_conta_luz      REAL,
  tipo_pagamento       TEXT,                  -- 'financiado' | 'a_vista'
  estagio              TEXT NOT NULL DEFAULT 'Novo',
  tags                 TEXT NOT NULL DEFAULT '[]',
  controle             TEXT NOT NULL DEFAULT 'ia',   -- 'ia' | 'humano'
  houve_contato_humano INTEGER NOT NULL DEFAULT 0,
  criado_em            TEXT NOT NULL,
  atualizado_em        TEXT NOT NULL,
  PRIMARY KEY (tenant_id, telefone)
);

CREATE TABLE IF NOT EXISTS turnos (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id      TEXT NOT NULL,
  telefone       TEXT NOT NULL,
  modelo         TEXT NOT NULL,
  tokens_entrada INTEGER NOT NULL,
  tokens_saida   INTEGER NOT NULL,
  custo_estimado REAL NOT NULL,
  latencia_ms    INTEGER NOT NULL,
  acoes          TEXT NOT NULL,               -- JSON com os nomes das ações executadas
  simulacao      INTEGER NOT NULL DEFAULT 0,
  timestamp      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_turnos_tenant ON turnos (tenant_id);

CREATE TABLE IF NOT EXISTS acoes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id  TEXT NOT NULL,
  telefone   TEXT NOT NULL,
  nome       TEXT NOT NULL,
  argumentos TEXT NOT NULL,
  resultado  TEXT NOT NULL,
  sucesso    INTEGER NOT NULL,
  simulacao  INTEGER NOT NULL DEFAULT 0,
  timestamp  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_acoes_lead ON acoes (tenant_id, telefone);

CREATE TABLE IF NOT EXISTS notificacoes (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  telefone  TEXT NOT NULL,
  destino   TEXT NOT NULL,
  resumo    TEXT NOT NULL,
  simulacao INTEGER NOT NULL DEFAULT 0,
  timestamp TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agendamentos (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tenant_id TEXT NOT NULL,
  telefone  TEXT NOT NULL,
  horario   TEXT NOT NULL,
  timestamp TEXT NOT NULL
);
`;
