import { createHash } from "node:crypto";

const NAMESPACE_SEPARATOR = "\x1f";

export function deterministicUuid(...inputs: string[]): string {
  const h = createHash("sha256").update(inputs.join(NAMESPACE_SEPARATOR)).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
