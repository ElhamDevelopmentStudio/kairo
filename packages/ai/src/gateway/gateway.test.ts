import { describe, expect, it } from "vitest";
import {
  type ProcessRunner,
  checkAgentGateways,
  checkCodexGateway,
  codexExecCommand,
  codexLoginStatusCommand,
  listAgentGateways,
} from "./index.ts";

describe("agent gateways", () => {
  it("lists Codex as supported while keeping other runtimes planned", () => {
    expect(listAgentGateways()).toEqual([
      expect.objectContaining({
        name: "codex",
        status: "supported",
        storesTokens: false,
      }),
      expect.objectContaining({
        name: "claude-code",
        status: "planned",
        storesTokens: false,
      }),
      expect.objectContaining({
        name: "cursor",
        status: "planned",
        storesTokens: false,
      }),
    ]);
  });

  it("builds Codex login and read-only exec commands without embedding credentials", () => {
    expect(codexLoginStatusCommand()).toMatchObject({
      command: "codex",
      args: ["login", "status"],
    });

    expect(
      codexExecCommand("Summarize recent Kairo sessions.", {
        cwd: "/repo",
        sandbox: "read-only",
      }),
    ).toEqual({
      command: "codex",
      args: [
        "exec",
        "--sandbox",
        "read-only",
        "--skip-git-repo-check",
        "--ephemeral",
        "--cd",
        "/repo",
        "Summarize recent Kairo sessions.",
      ],
      cwd: "/repo",
      timeoutMs: 5000,
    });
  });

  it("marks Codex ready from login status output", async () => {
    const runner: ProcessRunner = async () => ({
      exitCode: 0,
      stdout: "Logged in using ChatGPT\n",
      stderr: "",
    });

    await expect(checkCodexGateway(runner)).resolves.toMatchObject({
      name: "codex",
      readiness: "ready",
      detail: "Logged in using ChatGPT",
      checkedCommand: {
        command: "codex",
        args: ["login", "status"],
      },
      smokeCommand: {
        command: "codex",
        args: expect.arrayContaining(["exec", "--sandbox", "read-only"]),
      },
    });
  });

  it("distinguishes missing and unauthenticated Codex installations", async () => {
    await expect(
      checkCodexGateway(async () => ({
        exitCode: null,
        stdout: "",
        stderr: "spawn codex ENOENT",
        errorCode: "ENOENT",
      })),
    ).resolves.toMatchObject({
      readiness: "missing",
    });

    await expect(
      checkCodexGateway(async () => ({
        exitCode: 1,
        stdout: "",
        stderr: "Not logged in. Run codex login.",
      })),
    ).resolves.toMatchObject({
      readiness: "unauthenticated",
    });
  });

  it("checks supported gateways and reports planned ones without shelling out", async () => {
    const commands: string[] = [];
    const runner: ProcessRunner = async (command) => {
      commands.push(`${command.command} ${command.args.join(" ")}`);
      return { exitCode: 0, stdout: "Logged in\n", stderr: "" };
    };

    const checks = await checkAgentGateways(runner);

    expect(commands).toEqual(["codex login status"]);
    expect(checks.map((check) => [check.name, check.readiness])).toEqual([
      ["codex", "ready"],
      ["claude-code", "planned"],
      ["cursor", "planned"],
    ]);
  });
});
