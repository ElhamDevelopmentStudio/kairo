import { describe, expect, it } from "vitest";
import { createCodexProvider } from "./codex.ts";
import { AiProviderError } from "./provider.ts";

describe("Codex CLI provider", () => {
  it("answers through local codex exec and reads the last-message output file", async () => {
    const commands: string[][] = [];
    const provider = createCodexProvider({}, async (command) => {
      commands.push(command.args);
      const outputIndex = command.args.indexOf("--output-last-message");
      const outputPath = command.args[outputIndex + 1];
      if (typeof outputPath !== "string") throw new Error("missing output path");
      await import("node:fs").then((fs) => fs.writeFileSync(outputPath, "Codex answer\n"));
      return { exitCode: 0, stdout: "ignored stdout", stderr: "" };
    });

    await expect(provider.complete({ prompt: "Question" })).resolves.toEqual({
      text: "Codex answer",
      model: "codex",
      provider: "codex",
    });
    expect(commands[0]).toEqual(
      expect.arrayContaining([
        "exec",
        "--sandbox",
        "read-only",
        "--ephemeral",
        "--output-last-message",
      ]),
    );
  });

  it("reports codex failures as provider errors", async () => {
    const provider = createCodexProvider({}, async () => ({
      exitCode: 1,
      stdout: "",
      stderr: "Not logged in",
    }));

    await expect(provider.complete({ prompt: "Question" })).rejects.toThrow(AiProviderError);
  });
});
