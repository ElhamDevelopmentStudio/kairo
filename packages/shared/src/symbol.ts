import { z } from "zod";

export const SymbolKind = z.enum(["function", "class", "type", "component", "module", "unknown"]);
export type SymbolKind = z.infer<typeof SymbolKind>;

export const IndexedSymbol = z.object({
  name: z.string().min(1),
  kind: SymbolKind,
  file: z.string().min(1),
  signature: z.string().min(1).optional(),
  exported: z.boolean().default(false),
  introducedAt: z.string().datetime().optional(),
  lastChangedAt: z.string().datetime().optional(),
  commitShas: z.array(z.string()).default([]),
  eventIds: z.array(z.string()).default([]),
  aliases: z.array(z.string()).default([]),
});
export type IndexedSymbol = z.infer<typeof IndexedSymbol>;
