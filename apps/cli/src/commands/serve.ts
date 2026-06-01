import { spawn } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { basename, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import {
  EventStore,
  Workspace,
  answerProjectMemory,
  extractDecisionMemories,
  renderSession,
} from "@kairo/core";
import type { KairoEvent, Session } from "@kairo/shared";
import { Command } from "commander";
import { Hono } from "hono";
import kleur from "kleur";

export interface ServeOptions {
  open: boolean;
  port: string;
}

export interface DashboardAppOptions {
  workspace: Workspace;
  webDistPath?: string;
}

export const serveCommand = new Command("serve")
  .description("Serve the local web dashboard")
  .option("--no-open", "do not open the dashboard in a browser")
  .option("--port <port>", "port", "4170")
  .action((opts: ServeOptions) => {
    const port = parsePort(opts.port);
    const url = `http://localhost:${port}`;
    const workspace = Workspace.find();
    const webDistPath = defaultWebDistPath();
    const app =
      webDistPath === undefined
        ? createDashboardApp({ workspace })
        : createDashboardApp({ workspace, webDistPath });

    serve({ fetch: app.fetch, port });
    console.log(kleur.green(`Kairo dashboard: ${url}`));
    if (opts.open) {
      openBrowser(url);
    }
  });

export function createDashboardApp({ workspace, webDistPath }: DashboardAppOptions): Hono {
  const app = new Hono();

  app.onError((error, c) => {
    const detail = dashboardErrorDetail(error);
    if (process.env.NODE_ENV !== "test") {
      console.error(`Dashboard API unavailable: ${detail}`);
    }
    return c.json(
      {
        error: "Dashboard data unavailable",
        detail,
      },
      503,
    );
  });

  app.get("/api/health", (c) => {
    const project = resolveDashboardProject(workspace);
    return c.json({
      ok: true,
      projectId: project.projectId,
      projectName: project.projectName,
    });
  });

  app.get("/api/timeline", (c) => {
    const { store, projectId } = openProjectStore(workspace);
    try {
      return c.json({
        sessions: store.recentSessions(projectId, parseLimit(c.req.query("limit"), 100)),
        architectureShifts: store.recentArchitectureShifts(projectId, 100),
      });
    } finally {
      store.close();
    }
  });

  app.get("/api/sessions", (c) => {
    const { store, projectId } = openProjectStore(workspace);
    try {
      return c.json({
        sessions: store.recentSessions(projectId, parseLimit(c.req.query("limit"), 100)),
      });
    } finally {
      store.close();
    }
  });

  app.get("/api/sessions/:slug", (c) => {
    const { store, projectId } = openProjectStore(workspace);
    try {
      const session = store.getSessionBySlug(projectId, c.req.param("slug"));
      if (session === null) {
        return c.json({ error: "Session not found" }, 404);
      }
      const events = eventsForSession(store, projectId, session);
      return c.json({
        session,
        events,
        markdown: renderSession(session, events),
      });
    } finally {
      store.close();
    }
  });

  app.get("/api/search", (c) => {
    const query = c.req.query("q")?.trim() ?? "";
    if (query.length === 0) {
      return c.json({ sessions: [] });
    }

    const { store, projectId } = openProjectStore(workspace);
    try {
      return c.json({
        sessions: store.searchSessions(projectId, query, parseLimit(c.req.query("limit"), 20)),
      });
    } finally {
      store.close();
    }
  });

  app.post("/api/ask", async (c) => {
    const body = await c.req.json().catch(() => null);
    const question =
      typeof body === "object" &&
      body !== null &&
      "question" in body &&
      typeof body.question === "string"
        ? body.question.trim()
        : "";
    if (question.length === 0) {
      return c.json({ error: "Question is required" }, 400);
    }

    const { store, projectId } = openProjectStore(workspace);
    try {
      const architectureShifts = store.recentArchitectureShifts(projectId, 200);
      return c.json(
        answerProjectMemory(store, projectId, question, {
          decisionMemories: extractDecisionMemories({
            projectId,
            architectureShifts,
            projectRoot: workspace.root,
          }),
          projectRoot: workspace.root,
        }),
      );
    } finally {
      store.close();
    }
  });

  app.get("/api/architecture-shifts", (c) => {
    const { store, projectId } = openProjectStore(workspace);
    try {
      return c.json({
        architectureShifts: store.recentArchitectureShifts(
          projectId,
          parseLimit(c.req.query("limit"), 50),
        ),
      });
    } finally {
      store.close();
    }
  });

  app.get("/*", (c) => {
    if (webDistPath === undefined) {
      return c.json({ error: "Web dashboard build not found" }, 404);
    }

    const asset = readStaticAsset(webDistPath, c.req.path);
    if (asset === null) {
      return c.json({ error: "Not found" }, 404);
    }
    return c.body(new Uint8Array(asset.content), 200, { "Content-Type": asset.contentType });
  });

  return app;
}

function dashboardErrorDetail(error: unknown): string {
  const message = error instanceof Error ? error.message : "Unknown dashboard API error";
  return message.split("\n")[0] ?? message;
}

function resolveDashboardProject(
  workspace: Workspace,
  existingStore?: EventStore,
): { projectId: string; projectName: string } {
  try {
    const config = workspace.readConfig();
    return {
      projectId: config.projectId,
      projectName: config.projectName,
    };
  } catch (configError) {
    const store = existingStore ?? new EventStore(workspace.dbPath);
    try {
      const projectId = store.projectIds()[0];
      if (projectId === undefined) {
        throw configError;
      }
      return {
        projectId,
        projectName: basename(workspace.root),
      };
    } finally {
      if (existingStore === undefined) {
        store.close();
      }
    }
  }
}

function openProjectStore(workspace: Workspace): { store: EventStore; projectId: string } {
  const store = new EventStore(workspace.dbPath);
  try {
    return {
      store,
      projectId: resolveDashboardProject(workspace, store).projectId,
    };
  } catch (error) {
    store.close();
    throw error;
  }
}

function eventsForSession(store: EventStore, projectId: string, session: Session): KairoEvent[] {
  const sessionEventIds = new Set(session.eventIds);
  if (sessionEventIds.size === 0) return [];

  return store.eventsForProject(projectId).filter((event) => sessionEventIds.has(event.id));
}

function parseLimit(value: string | undefined, defaultValue: number): number {
  if (value === undefined) return defaultValue;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) return defaultValue;
  return Math.min(parsed, 500);
}

function parsePort(value: string): number {
  const port = Number.parseInt(value, 10);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`Invalid port: ${value}`);
  }
  return port;
}

function openBrowser(url: string): void {
  const command =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "cmd" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

function defaultWebDistPath(): string | undefined {
  const cliDir = fileURLToPath(new URL(".", import.meta.url));
  const candidates = [
    resolve(cliDir, "../../../web/dist"),
    resolve(cliDir, "../../web/dist"),
    resolve(process.cwd(), "apps/web/dist"),
  ];
  return candidates.find((candidate) => existsSync(join(candidate, "index.html")));
}

function readStaticAsset(
  webDistPath: string,
  requestPath: string,
): { content: Buffer; contentType: string } | null {
  const relativePath = decodeAssetPath(requestPath);
  if (relativePath === null) return null;

  const filePath = resolve(webDistPath, normalize(relativePath));
  const root = resolve(webDistPath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return null;

  const finalPath = existsFile(filePath)
    ? filePath
    : extname(filePath) === ""
      ? join(root, "index.html")
      : null;
  if (finalPath === null) return null;
  if (!existsFile(finalPath)) return null;

  return {
    content: readFileSync(finalPath),
    contentType: contentTypeFor(finalPath),
  };
}

function decodeAssetPath(requestPath: string): string | null {
  if (requestPath === "/") return "index.html";

  try {
    return decodeURIComponent(requestPath.slice(1));
  } catch {
    return null;
  }
}

function existsFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile();
}

function contentTypeFor(path: string): string {
  switch (extname(path)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".html":
      return "text/html; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
}
