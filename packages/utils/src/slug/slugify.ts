const DEFAULT_MAX_LENGTH = 80;
const DIACRITIC_MARKS = /\p{M}/gu;

export function slugify(text: string, maxLength: number = DEFAULT_MAX_LENGTH): string {
  const stripped = text.normalize("NFKD").replace(DIACRITIC_MARKS, "");
  const slug = stripped
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (slug.length <= maxLength) return slug;
  return slug.slice(0, maxLength).replace(/-+$/, "");
}
