import { describe, expect, it } from "vitest";
import { redactSecrets, redactString } from "./redact.ts";

describe("redactString", () => {
  it("redacts JWT-shaped tokens", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    expect(redactString(`token=${jwt} done`)).toBe("token=<REDACTED> done");
  });

  it("redacts SSH private key blocks", () => {
    const key =
      "-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAA...\n-----END OPENSSH PRIVATE KEY-----";
    expect(redactString(`my key:\n${key}\nend`)).toBe("my key:\n<REDACTED>\nend");
  });

  it("redacts common API key prefixes", () => {
    expect(redactString("export OPENAI=sk-1234567890abcdefghij1234")).toContain("<REDACTED>");
    expect(redactString("Authorization: ghp_1234567890abcdefghij1234567890")).toContain(
      "<REDACTED>",
    );
    expect(redactString("aws=AKIAIOSFODNN7EXAMPLE")).toContain("<REDACTED>");
    expect(redactString("slack=xoxb-1234567890-abcdef-ghijklmnopqrstuvwxyz")).toContain(
      "<REDACTED>",
    );
  });

  it("redacts secret-shaped env assignments", () => {
    expect(redactString("DATABASE_PASSWORD=hunter2supersecret")).toBe(
      "DATABASE_PASSWORD=<REDACTED>",
    );
    expect(redactString("API_TOKEN: 'abc123xyz789'")).toBe("API_TOKEN=<REDACTED>");
  });

  it("leaves non-secret strings untouched", () => {
    const harmless = "fix: refactor the auth middleware to use the new EventStore boundary";
    expect(redactString(harmless)).toBe(harmless);
  });
});

describe("redactSecrets (recursive)", () => {
  it("walks objects and arrays", () => {
    const input = {
      message: "merged PR #42",
      author: "test",
      env: ["NORMAL=ok", "API_KEY=sk-1234567890abcdefghij1234"],
      nested: { token: "ghp_abcdefghijklmnopqrstuvwxyz0123456789" },
    };
    const out = redactSecrets(input);
    expect(out.message).toBe("merged PR #42");
    expect(out.env[0]).toBe("NORMAL=ok");
    expect(out.env[1]).toContain("<REDACTED>");
    expect(out.nested.token).toBe("<REDACTED>");
  });

  it("passes through non-string/object scalars", () => {
    expect(redactSecrets(42)).toBe(42);
    expect(redactSecrets(true)).toBe(true);
    expect(redactSecrets(null)).toBe(null);
  });
});
