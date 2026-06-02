# Kairo

<p align="center">
  <img src="assets/readme-banner.png" alt="Kairo - Understand how your software evolved. Timeline intelligence, context preservation, architecture evolution, and automatic documentation." width="100%" />
</p>

Kairo is a local-first development intelligence system. It observes project
activity, stores it locally, and reconstructs useful project memory.

This README is only for setting up Kairo as a user.

## Requirements

- Node.js 22 or newer
- Git

## Install

```sh
npm install -g @kairohq/cli
```

## Initialize A Project

Run this inside the project you want Kairo to remember.

```sh
kairo init
```

Guided setup can import supported local assistant transcripts and configure an
optional AI provider. You can skip both and still use local project memory.

## Ingest Existing History

```sh
kairo sweep
```

This reads existing git history and writes local Kairo state under `.kairo/`.

## Check Setup

```sh
kairo doctor
```

## Ask From Project Memory

```sh
kairo ask "what changed in the dashboard data source?"
```

## Optional MCP Server

Install this only when an MCP-compatible assistant should query Kairo memory.

```sh
npm install -g @kairohq/mcp
kairo-mcp
```

## Where To Read More

- [apps/cli/README.md](apps/cli/README.md): CLI commands.
- [apps/mcp/README.md](apps/mcp/README.md): MCP server usage.
- [docs/README.md](docs/README.md): full documentation map.
- [docs/developer.md](docs/developer.md): local development setup.
- [SECURITY.md](SECURITY.md): security and privacy reporting.
