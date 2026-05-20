import { createHash } from "node:crypto";
import type { KairoEvent, Session } from "@kairo/shared";

export function buildSessionFromEvents(projectId: string, events: KairoEvent[]): Session {
  const first = events[0];
  const last = events[events.length - 1];
  if (!first || !last) {
    throw new Error("buildSessionFromEvents received an empty event list");
  }
  const start = first.occurredAt;
  const end = last.occurredAt;
  const files = new Set<string>();
  const commits: string[] = [];

  for (const ev of events) {
    if (ev.kind === "git.commit") {
      commits.push(ev.payload.sha);
      for (const f of ev.payload.files) files.add(f.path);
    } else if (ev.kind === "fs.change") {
      files.add(ev.payload.path);
    }
  }

  const date = start.slice(0, 10);
  const slug = `${date}-session-${first.id.slice(0, 6)}`;
  const eventIds = events.map((e) => e.id);

  return {
    id: deterministicSessionId(projectId, eventIds),
    projectId,
    title: `Session ${slug}`,
    slug,
    startedAt: start,
    endedAt: end,
    intent: "unknown",
    themes: [],
    affectedAreas: [],
    commitShas: commits,
    files: [...files],
    summary: null,
    architectureImpact: null,
    eventIds,
  };
}

function deterministicSessionId(projectId: string, eventIds: string[]): string {
  const hash = createHash("sha256")
    .update(projectId)
    .update("\0")
    .update(eventIds.join("\0"))
    .digest();
  const versionByte = hash[6];
  const variantByte = hash[8];
  if (versionByte === undefined || variantByte === undefined) {
    throw new Error("sha256 digest was shorter than expected");
  }
  hash[6] = (versionByte & 0x0f) | 0x50;
  hash[8] = (variantByte & 0x3f) | 0x80;
  const hex = hash.toString("hex").slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}
