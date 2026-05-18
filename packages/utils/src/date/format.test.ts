import { describe, expect, it } from "vitest";
import { toIsoDate, toIsoDateTime } from "./format.ts";

describe("toIsoDate", () => {
  it("returns YYYY-MM-DD in UTC", () => {
    expect(toIsoDate(new Date("2026-05-18T11:34:56Z"))).toBe("2026-05-18");
  });

  it("normalizes timezone-shifted inputs to UTC date", () => {
    expect(toIsoDate(new Date("2026-05-18T23:30:00-08:00"))).toBe("2026-05-19");
  });

  it("handles epoch", () => {
    expect(toIsoDate(new Date(0))).toBe("1970-01-01");
  });
});

describe("toIsoDateTime", () => {
  it("returns full ISO string", () => {
    expect(toIsoDateTime(new Date("2026-05-18T11:34:56Z"))).toBe("2026-05-18T11:34:56.000Z");
  });
});
