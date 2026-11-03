import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LlmFerramenta,
  LlmMensagem,
  LlmProvider,
  LlmResposta,
} from '../interfaces/llm-provider.interface';

// Groq, OpenRouter, Gemini (endpoint /openai) e Ollama expõem a API no formato
// OpenAI, então um único adaptador cobre todos; muda só LLM_BASE_URL/LLM_MODEL.
@Injectable()
export class OpenAiCompatibleProvider implements LlmProvider {
  private readonly logger = new Logger(OpenAiCompatibleProvider.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly maxTentativas: number;
  private readonly timeoutMs: number;

  constructor(config: ConfigService) {
    this.baseUrl = config.get<string>('llm.baseUrl');
    this.apiKey = config.get<string>('llm.apiKey');
    this.model = config.get<string>('llm.model');
    this.maxTentativas = config.get<number>('llm.maxTentativas');
    this.timeoutMs = config.get<number>('llm.timeoutMs');
  }

  async chat(params: { mensagens: LlmMensagem[]; ferramentas: LlmFerramenta[] }): Promise<LlmResposta> {
    const corpo = JSON.stringify({
      model: this.model,
      temperature: 0.2,
      messages: params.mensagens.map((m) => ({
        role: m.role,
        content: m.content,
        tool_call_id: m.toolCallId,
        tool_calls: m.toolCalls?.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.nome, arguments: JSON.stringify(c.argumentos) },
        })),
      })),
      tools: params.ferramentas.length
        ? params.ferramentas.map((f) => ({
            type: 'function',
            function: { name: f.nome, description: f.descricao, parameters: f.parametros },
          }))
        : undefined,
    });

    // Retry para erros temporários: 429 (limite do plano gratuito), 5xx e falha de rede/timeout.
    for (let tentativa = 1; ; tentativa++) {
      let resposta: Response;
      try {
        resposta = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: corpo,
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (erro) {
        if (tentativa >= this.maxTentativas) throw erro;
        await this.aguardar(tentativa, `falha de rede: ${(erro as Error).message}`);
        continue;
      }

      if (resposta.ok) {
        return this.converter(await resposta.json());
      }

      const temporario = resposta.status === 429 || resposta.status >= 500;
      if (!temporario || tentativa >= this.maxTentativas) {
        throw new Error(`LLM respondeu ${resposta.status}: ${await resposta.text()}`);
      }
      // Se o provedor disser quanto esperar (Retry-After, em segundos), respeita.
      const retryAfter = Number(resposta.headers.get('retry-after'));
      await this.aguardar(tentativa, `status ${resposta.status}`, retryAfter > 0 ? retryAfter * 1000 : undefined);
    }
  }

  private async aguardar(tentativa: number, motivo: string, esperaMs?: number) {
    // Backoff exponencial: 1s, 2s, 4s... até 60s.
    const ms = Math.min(esperaMs ?? 1000 * 2 ** (tentativa - 1), 60_000);
    this.logger.warn(`Tentativa ${tentativa} falhou (${motivo}). Nova tentativa em ${ms} ms.`);
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private converter(corpo: any): LlmResposta {
    const mensagem = corpo.choices[0].message;
    return {
      texto: mensagem.content ?? null,
      toolCalls: (mensagem.tool_calls ?? []).map((c) => ({
        id: c.id,
        nome: c.function.name,
        argumentos: JSON.parse(c.function.arguments || '{}'),
      })),
      tokensEntrada: corpo.usage?.prompt_tokens ?? 0,
      tokensSaida: corpo.usage?.completion_tokens ?? 0,
      modelo: corpo.model ?? this.model,
    };
  }
}
