// Precisa ser importado antes do AppModule: a configuração é lida quando o módulo carrega.
// O LLM (provedor, chave, modelo) continua vindo do .env; aqui só isolamos o banco e
// encurtamos a janela de rajada para a avaliação não demorar.
process.env.DATABASE_PATH = ':memory:';
process.env.BURST_WINDOW_MS = process.env.AVALIACAO_JANELA_MS ?? '3000';
