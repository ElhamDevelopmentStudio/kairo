export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function toIsoDateTime(date: Date): string {
  return date.toISOString();
}
