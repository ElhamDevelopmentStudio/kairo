import { describe, expect, it } from "vitest";
import { slugify } from "./slugify.ts";

describe("slugify", () => {
  it("lowercases and replaces non-alphanumerics with hyphens", () => {
    expect(slugify("Auth Rewrite!")).toBe("auth-rewrite");
  });

  it("collapses runs of separators", () => {
    expect(slugify("hello   world__again")).toBe("hello-world-again");
  });

  it("strips diacritics", () => {
    expect(slugify("Café Crème")).toBe("cafe-creme");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("---foo bar---")).toBe("foo-bar");
  });

  it("returns empty string for unmappable input", () => {
    expect(slugify("???")).toBe("");
  });

  it("truncates to max length without trailing hyphen", () => {
    const long = `${"a".repeat(50)} ${"b".repeat(50)}`;
    const out = slugify(long, 30);
    expect(out.length).toBeLessThanOrEqual(30);
    expect(out.endsWith("-")).toBe(false);
  });
});
