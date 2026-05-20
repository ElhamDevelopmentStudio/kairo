import { describe, expect, it } from "vitest";
import { embedText } from "./embed-text.ts";

describe("embedText", () => {
  it("delegates to the selected provider", async () => {
    await expect(
      embedText("hello", {
        provider: {
          name: "ollama",
          async summarize() {
            return { text: "", model: "test", provider: "ollama" };
          },
          async embed(input) {
            expect(input.text).toBe("hello");
            return { embedding: [1, 2, 3], model: "test", provider: "ollama" };
          },
        },
      }),
    ).resolves.toEqual({ embedding: [1, 2, 3], model: "test", provider: "ollama" });
  });
});
