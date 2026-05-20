import type { ArchitectureShift } from "@kairo/shared";
import { detectDependencyShifts } from "./dependency-shift.ts";
import { detectDirectoryRestructures } from "./directory-restructure.ts";
import { detectFrameworkMigrations } from "./framework-migration.ts";
import { detectPackageExtractions } from "./package-extraction.ts";
import type { ArchitectureDetectorInput } from "./types.ts";

const DETECTORS = [
  detectPackageExtractions,
  detectFrameworkMigrations,
  detectDirectoryRestructures,
  detectDependencyShifts,
];

export function detectArchitectureShifts(input: ArchitectureDetectorInput): ArchitectureShift[] {
  const detected = DETECTORS.flatMap((detector) => detector(input));
  return dedupeShifts(detected).sort((a, b) => b.detectedAt.localeCompare(a.detectedAt));
}

function dedupeShifts(shifts: ArchitectureShift[]): ArchitectureShift[] {
  const byId = new Map<string, ArchitectureShift>();
  for (const shift of shifts) {
    byId.set(shift.id, shift);
  }
  return [...byId.values()];
}
