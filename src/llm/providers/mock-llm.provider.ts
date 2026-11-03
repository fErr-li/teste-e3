import { Injectable } from '@nestjs/common';
import {
  LlmFerramenta,
  LlmMensagem,
  LlmProvider,
  LlmResposta,
} from '../interfaces/llm-provider.interface';

// LLM roteirizado para os testes: cada chamada consome a próxima resposta da fila.
@Injectable()
export class MockLlmProvider implements LlmProvider {
  private readonly fila: Partial<LlmResposta>[] = [];
  readonly chamadas: { mensagens: LlmMensagem[]; ferramentas: LlmFerramenta[] }[] = [];

  enfileirar(...respostas: Partial<LlmResposta>[]) {
    this.fila.push(...respostas);
  }

  async chat(params: { mensagens: LlmMensagem[]; ferramentas: LlmFerramenta[] }): Promise<LlmResposta> {
    this.chamadas.push(params);
    const proxima = this.fila.shift() ?? { texto: 'Resposta do mock' };
    return {
      texto: null,
      toolCalls: [],
      tokensEntrada: 0,
      tokensSaida: 0,
      modelo: 'mock',
      ...proxima,
    };
  }
}
