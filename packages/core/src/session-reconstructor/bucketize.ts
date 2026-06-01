import type { KairoEvent } from "@kairohq/shared";

export function bucketize(sorted: KairoEvent[], idleGapMinutes: number): KairoEvent[][] {
  const gapMs = idleGapMinutes * 60_000;
  const buckets: KairoEvent[][] = [];
  const first = sorted[0];
  if (!first) return buckets;

  let current: KairoEvent[] = [first];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const next = sorted[i];
    if (!prev || !next) continue;
    const prevMs = new Date(prev.occurredAt).getTime();
    const nextMs = new Date(next.occurredAt).getTime();
    if (nextMs - prevMs > gapMs) {
      buckets.push(current);
      current = [];
    }
    current.push(next);
  }
  buckets.push(current);
  return buckets;
}
