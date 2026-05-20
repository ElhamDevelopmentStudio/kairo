import { createHash } from "node:crypto";

export class ResponseCache<T> {
  private readonly entries = new Map<string, T>();

  get(keyParts: unknown[]): T | null {
    return this.entries.get(cacheKey(keyParts)) ?? null;
  }

  set(keyParts: unknown[], value: T): void {
    this.entries.set(cacheKey(keyParts), value);
  }
}

export function cacheKey(keyParts: unknown[]): string {
  return createHash("sha256").update(JSON.stringify(keyParts)).digest("hex");
}
