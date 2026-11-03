// Precisa ser importado antes do AppModule: a configuração é lida quando o módulo carrega.
process.env.DATABASE_PATH = ':memory:';
process.env.LLM_PROVIDER = 'mock';
process.env.BURST_WINDOW_MS = '300';
process.env.LLM_MAX_ITERACOES = '3';
