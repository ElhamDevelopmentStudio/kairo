import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import type { IndexedSymbol } from "@kairohq/shared";

export function extractCurrentTypeScriptSymbols(projectRoot: string): IndexedSymbol[] {
  if (!existsSync(projectRoot)) return [];
  return sourceFiles(projectRoot).flatMap((file) =>
    extractSymbolsFromSource(relative(projectRoot, file), readFileSync(file, "utf8")),
  );
}

export function extractSymbolsFromSource(file: string, source: string): IndexedSymbol[] {
  const symbols: IndexedSymbol[] = [
    ...exportedDeclarationSymbols(file, source),
    ...exportedVariableSymbols(file, source),
  ];
  if (symbols.length === 0 && isTypeScriptSource(file)) {
    symbols.push(indexedSymbol({ name: file, kind: "module", file, exported: false }));
  }
  return dedupeIndexedSymbols(symbols);
}

function exportedDeclarationSymbols(file: string, source: string): IndexedSymbol[] {
  return Array.from(
    source.matchAll(
      /^\s*export\s+(?:default\s+)?(?:async\s+)?(function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)[^\n]*/gm,
    ),
  ).map((match) => {
    const rawKind = match[1] ?? "unknown";
    const name = match[2] ?? file;
    const signature = cleanSignature(match[0]);
    return indexedSymbol({
      name,
      kind: symbolKind(rawKind, name, file),
      file,
      ...(signature === undefined ? {} : { signature }),
      exported: true,
    });
  });
}

function exportedVariableSymbols(file: string, source: string): IndexedSymbol[] {
  return Array.from(
    source.matchAll(/^\s*export\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)[^\n]*/gm),
  ).map((match) => {
    const name = match[1] ?? file;
    const signature = cleanSignature(match[0]);
    return indexedSymbol({
      name,
      kind: /^[A-Z]/.test(name) && /\.(tsx|jsx)$/.test(file) ? "component" : "function",
      file,
      ...(signature === undefined ? {} : { signature }),
      exported: true,
    });
  });
}

function indexedSymbol(
  input: Omit<IndexedSymbol, "commitShas" | "eventIds" | "aliases">,
): IndexedSymbol {
  return {
    ...input,
    commitShas: [],
    eventIds: [],
    aliases: [],
  };
}

function sourceFiles(projectRoot: string): string[] {
  const files: string[] = [];
  const visit = (dir: string): void => {
    for (const entry of readdirSync(dir)) {
      if (IGNORED_DIRS.has(entry)) continue;
      const absolute = join(dir, entry);
      const stats = statSync(absolute);
      if (stats.isDirectory()) {
        visit(absolute);
      } else if (isTypeScriptSource(entry)) {
        files.push(absolute);
      }
    }
  };
  visit(projectRoot);
  return files;
}

function symbolKind(rawKind: string, name: string, file: string): IndexedSymbol["kind"] {
  if (rawKind === "interface" || rawKind === "type" || rawKind === "enum") return "type";
  if (rawKind === "class") return "class";
  if (rawKind === "function" && /^[A-Z]/.test(name) && /\.(tsx|jsx)$/.test(file))
    return "component";
  if (rawKind === "function") return "function";
  return "unknown";
}

function cleanSignature(value: string | undefined): string | undefined {
  const signature = value?.trim();
  if (signature === undefined || /[(=]\s*$/.test(signature)) return undefined;
  return signature;
}

function dedupeIndexedSymbols(symbols: IndexedSymbol[]): IndexedSymbol[] {
  const seen = new Set<string>();
  return symbols.filter((symbol) => {
    const key = `${symbol.file}:${symbol.name}:${symbol.kind}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isTypeScriptSource(file: string): boolean {
  return /\.(tsx?)$/.test(file) && !/\.d\.ts$/.test(file);
}

const IGNORED_DIRS = new Set([".git", ".kairo", "node_modules", "dist", "build", "coverage"]);
