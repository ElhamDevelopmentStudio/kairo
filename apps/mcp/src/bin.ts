#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createToolContext, registerTools } from "./tools/index.ts";

const server = new McpServer({
  name: "kairo",
  version: "0.0.0",
});

registerTools(server, createToolContext());

const transport = new StdioServerTransport();
await server.connect(transport);
