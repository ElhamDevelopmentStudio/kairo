# Kairo Docs

This directory contains the project-specific docs beyond setup.

## Start Here

- [SRS.md](SRS.md): what Kairo must do, product scope, privacy, constraints.
- [SDD.md](SDD.md): how Kairo is designed, package responsibilities, data flow.
- [../AGENTS.md](../AGENTS.md): contributor and agent rules for code placement, tests, and boundaries.
- [../TASKS.md](../TASKS.md): phased implementation plan and current acceptance criteria.

## Decisions

Read `docs/decisions/` when changing architecture or revisiting a settled tradeoff.

- [decisions/0001-web-data-source.md](decisions/0001-web-data-source.md): dashboard data source.
- [decisions/0002-publish-source-packages.md](decisions/0002-publish-source-packages.md): npm package publishing shape.
- [decisions/agent-runtime-gateways.md](decisions/agent-runtime-gateways.md): AI gateway strategy.

## Implementation Guidance

- [sources/adapter-authoring.md](sources/adapter-authoring.md): adding memory source adapters.
- [intelligence/implementation-patterns.md](intelligence/implementation-patterns.md): memory and intelligence layer patterns.
- [checks/memory-ci.md](checks/memory-ci.md): memory checks for CI and review.
- [benchmarks/memory.md](benchmarks/memory.md): memory retrieval benchmark notes.

## Package Docs

- [../apps/cli/README.md](../apps/cli/README.md): CLI usage.
- [../apps/docs/README.md](../apps/docs/README.md): Astro Starlight docs site.
- [../apps/mcp/README.md](../apps/mcp/README.md): MCP server usage.
- [../apps/web/README.md](../apps/web/README.md): Vite dashboard.
- [../packages/core/README.md](../packages/core/README.md): core memory engine.
- [../packages/shared/README.md](../packages/shared/README.md): shared schemas and types.
- [../packages/utils/README.md](../packages/utils/README.md): shared pure helpers.
- [../packages/ai/README.md](../packages/ai/README.md): AI provider configuration.
