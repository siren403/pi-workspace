import { $ } from "bun";

export interface Model {
  provider: string;
  id: string;
  context: string;
  maxOut: string;
  thinking: boolean;
  images: boolean;
}

/** pi --list-models 출력을 파싱 */
export async function listModels(): Promise<Model[]> {
  const r = await $`pi --list-models`.quiet().nothrow();
  if (r.exitCode !== 0) return [];

  // pi --list-models writes to stderr
  const lines = (r.stdout.toString() || r.stderr.toString()).split("\n");
  const models: Model[] = [];

  for (const line of lines) {
    const parts = line.trim().split(/\s{2,}/);
    if (parts.length < 6) continue;
    const [provider, id, context, maxOut, thinking, images] = parts;
    // 헤더 행 제외
    if (provider === "provider") continue;
    models.push({
      provider,
      id,
      context,
      maxOut,
      thinking: thinking === "yes",
      images: images === "yes",
    });
  }
  return models;
}

/** 인증된 프로바이더 목록 (모델이 하나라도 있는) */
export function getProviders(models: Model[]): string[] {
  return [...new Set(models.map((m) => m.provider))];
}

/** context 표기(1M, 272K 등)를 숫자(토큰 수)로 변환 */
export function parseContext(s: string): number {
  const n = parseFloat(s);
  if (s.endsWith("M")) return n * 1_000_000;
  if (s.endsWith("K")) return n * 1_000;
  return n;
}
