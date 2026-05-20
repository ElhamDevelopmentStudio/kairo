const REDACTED = "<REDACTED>";

const PATTERNS: RegExp[] = [
  /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----[\s\S]+?-----END (?:[A-Z]+ )?PRIVATE KEY-----/g,
  /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g,
  /\bsk-ant-[A-Za-z0-9_-]{20,}/g,
  /\bsk-[A-Za-z0-9_-]{20,}/g,
  /\bghp_[A-Za-z0-9]{30,}/g,
  /\bgho_[A-Za-z0-9]{30,}/g,
  /\bghs_[A-Za-z0-9]{30,}/g,
  /\bghu_[A-Za-z0-9]{30,}/g,
  /\bghr_[A-Za-z0-9]{30,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{50,}/g,
  /\bglpat-[A-Za-z0-9_-]{20,}/g,
  /\bxoxb-[A-Za-z0-9-]{20,}/g,
  /\bxoxp-[A-Za-z0-9-]{20,}/g,
  /\bxoxa-[A-Za-z0-9-]{20,}/g,
  /\bxoxs-[A-Za-z0-9-]{20,}/g,
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bASIA[0-9A-Z]{16}\b/g,
  /\bAIza[A-Za-z0-9_-]{35}\b/g,
];

const ASSIGNMENT_PATTERN =
  /\b((?:[A-Z][A-Z0-9_]*)?(?:KEY|TOKEN|SECRET|PASSWORD|PASS|AUTH|API|PRIVATE|CREDENTIAL)(?:[A-Z0-9_]*)?)\s*[:=]\s*['"]?([^\s'"]{6,})['"]?/g;

export function redactString(input: string): string {
  let out = input;
  for (const pattern of PATTERNS) {
    out = out.replace(pattern, REDACTED);
  }
  out = out.replace(ASSIGNMENT_PATTERN, (_match, key) => `${key}=${REDACTED}`);
  return out;
}

export function redactSecrets<T>(value: T): T {
  if (typeof value === "string") {
    return redactString(value) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => redactSecrets(item)) as T;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).map(([k, v]) => [
      k,
      redactSecrets(v),
    ]);
    return Object.fromEntries(entries) as T;
  }
  return value;
}
