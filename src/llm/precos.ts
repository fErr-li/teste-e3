// Preço de referência em USD por 1 milhão de tokens [entrada, saída].
// Para modelos usados no plano gratuito, usamos o preço pago equivalente para estimar o custo.
// TODO: conferir os valores atuais no site de cada provedor e documentar no README.
const PRECOS: Record<string, [number, number]> = {
  'openai/gpt-oss-120b': [0.15, 0.6],
  'openai/gpt-oss-20b': [0.075, 0.3],
  'llama-3.3-70b-versatile': [0.59, 0.79],
  'llama-3.1-8b-instant': [0.05, 0.08],
  mock: [0, 0],
};

export function estimarCusto(modelo: string, tokensEntrada: number, tokensSaida: number): number {
  const [entrada, saida] = PRECOS[modelo] ?? [0, 0];
  return (tokensEntrada * entrada + tokensSaida * saida) / 1_000_000;
}
