// Contrato que todo provedor de LLM implementa. O motor depende só disto,
// então trocar Groq por Gemini/Ollama/mock não muda o motor.
export const LLM_PROVIDER = Symbol('LLM_PROVIDER');

export interface LlmToolCall {
  id: string;
  nome: string;
  argumentos: Record<string, unknown>;
}

export interface LlmMensagem {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  toolCalls?: LlmToolCall[];
  toolCallId?: string;
}

export interface LlmFerramenta {
  nome: string;
  descricao: string;
  parametros: Record<string, unknown>; // JSON Schema
}

export interface LlmResposta {
  texto: string | null;
  toolCalls: LlmToolCall[];
  tokensEntrada: number;
  tokensSaida: number;
  modelo: string;
}

export interface LlmProvider {
  chat(params: { mensagens: LlmMensagem[]; ferramentas: LlmFerramenta[] }): Promise<LlmResposta>;
}
