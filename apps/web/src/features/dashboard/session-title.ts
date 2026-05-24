import type { Session } from "@kairo/shared";

export function displaySessionTitle(session: Session): string {
  if (!isGeneratedSessionTitle(session)) return session.title;

  const summary = firstSentence(session.summary);
  if (summary !== null) return summary;

  const impact = firstSentence(session.architectureImpact);
  if (impact !== null) return impact;

  const area = primaryArea(session);
  if (area !== null) return `Work in ${area}`;

  return "Captured work session";
}

function isGeneratedSessionTitle(session: Session): boolean {
  return (
    session.title === `Session ${session.slug}` ||
    /^Session \d{4}-\d{2}-\d{2}-session-[a-f0-9]+$/i.test(session.title)
  );
}

function firstSentence(value: string | null): string | null {
  const sentence = value?.split(/[.!?]\s/)[0]?.trim();
  if (sentence === undefined || sentence.length === 0) return null;
  return sentence.length > 72 ? `${sentence.slice(0, 69).trim()}...` : sentence;
}

function primaryArea(session: Session): string | null {
  const explicitArea = session.affectedAreas[0];
  if (explicitArea !== undefined) return readablePath(explicitArea);

  const file = session.files[0];
  if (file === undefined) return null;

  const [first, second] = file.split("/");
  if (first === undefined) return null;
  return readablePath(second === undefined ? first : `${first}/${second}`);
}

function readablePath(value: string): string {
  return value.replaceAll("-", " ");
}
