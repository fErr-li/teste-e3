import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface Janela {
  timer: NodeJS.Timeout;
  resolver: (valor: null) => void;
}

/**
 * Agrupa mensagens em rajada por lead (tenant:telefone).
 * A primeira mensagem abre a janela; as seguintes, enquanto ela estiver aberta, só são gravadas.
 * No fim da janela o processamento roda uma vez, em série com outros turnos do mesmo lead.
 *
 * Fica em memória: não funciona com mais de uma instância (ver README, limitações).
 */
@Injectable()
export class RajadaService {
  private readonly janelaMs: number;
  private readonly janelas = new Map<string, Janela>();
  private readonly filas = new Map<string, Promise<unknown>>();

  constructor(config: ConfigService) {
    this.janelaMs = config.get<number>('rajada.janelaMs');
  }

  /**
   * Retorna a promise do processamento se esta chamada abriu a janela,
   * ou null se já havia uma janela aberta para o lead.
   */
  agendar<T>(chave: string, processar: () => Promise<T>): Promise<T | null> | null {
    if (this.janelas.has(chave)) return null;

    return new Promise<T | null>((resolve, reject) => {
      const timer = setTimeout(() => {
        // Sai do mapa antes de processar: mensagem que chegar durante o processamento abre nova janela.
        this.janelas.delete(chave);
        this.emSerie(chave, processar).then(resolve, reject);
      }, this.janelaMs);
      this.janelas.set(chave, { timer, resolver: resolve });
    });
  }

  /** Cancela a janela aberta (ex.: humano assumiu a conversa). */
  cancelar(chave: string) {
    const janela = this.janelas.get(chave);
    if (!janela) return;
    clearTimeout(janela.timer);
    this.janelas.delete(chave);
    janela.resolver(null);
  }

  private emSerie<T>(chave: string, fn: () => Promise<T>): Promise<T> {
    const anterior = this.filas.get(chave) ?? Promise.resolve();
    const atual = anterior.catch(() => undefined).then(fn);
    this.filas.set(chave, atual);
    atual
      .finally(() => {
        if (this.filas.get(chave) === atual) this.filas.delete(chave);
      })
      .catch(() => undefined);
    return atual;
  }
}

export const chaveLead = (tenantId: string, telefone: string) => `${tenantId}:${telefone}`;
