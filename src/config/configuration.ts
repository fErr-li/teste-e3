import { resolve } from 'node:path';

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  database: {
    path: process.env.DATABASE_PATH ?? resolve('data/motor.db'),
  },
  tenants: {
    dir: process.env.TENANTS_DIR ?? resolve('config/tenants'),
  },
  rajada: {
    janelaMs: parseInt(process.env.BURST_WINDOW_MS ?? '8000', 10),
  },
  llm: {
    // 'openai-compatible' (Groq, OpenRouter, Gemini, Ollama) ou 'mock'
    provider: process.env.LLM_PROVIDER ?? 'mock',
    baseUrl: process.env.LLM_BASE_URL ?? 'https://api.groq.com/openai/v1',
    apiKey: process.env.LLM_API_KEY ?? '',
    model: process.env.LLM_MODEL ?? 'openai/gpt-oss-120b',
    maxIteracoes: parseInt(process.env.LLM_MAX_ITERACOES ?? '10', 10),
    maxTentativas: parseInt(process.env.LLM_MAX_TENTATIVAS ?? '4', 10),
    timeoutMs: parseInt(process.env.LLM_TIMEOUT_MS ?? '30000', 10),
  },
});
