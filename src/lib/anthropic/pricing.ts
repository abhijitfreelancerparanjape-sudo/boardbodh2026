// Claude API pricing (USD per 1M tokens) and cost computation from a response's
// usage block. Cache writes cost 1.25x input (5-min TTL); cache reads 0.1x input.
// Source: claude-api skill model table (cached 2026-05).

interface Rate {
  input: number;
  output: number;
}

const PRICING: Record<string, Rate> = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

export function rateFor(model: string): Rate {
  return PRICING[model] ?? PRICING["claude-opus-4-8"];
}

export function computeCostUSD(model: string, usage: TokenUsage | undefined): number {
  if (!usage) return 0;
  const { input, output } = rateFor(model);
  const inRate = input / 1_000_000;
  const outRate = output / 1_000_000;
  const uncached = (usage.input_tokens ?? 0) * inRate;
  const cacheWrite = (usage.cache_creation_input_tokens ?? 0) * inRate * 1.25;
  const cacheRead = (usage.cache_read_input_tokens ?? 0) * inRate * 0.1;
  const out = (usage.output_tokens ?? 0) * outRate;
  return uncached + cacheWrite + cacheRead + out;
}
