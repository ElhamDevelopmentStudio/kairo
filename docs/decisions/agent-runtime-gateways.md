# Agent Runtime Gateways

## Decision

Kairo keeps AI provider APIs and agent runtime gateways as separate integration
layers.

Provider APIs live in `@kairo/ai` provider modules and use explicit API-key or
local-provider configuration for summarization and embeddings. Agent runtime
gateways live in `@kairo/ai/gateway` and reuse authentication that already
belongs to an installed tool, such as the local Codex CLI login.

## Rationale

Agent runtimes are not model providers. They are user-facing tools with their
own auth, policy, config, prompts, and execution boundaries. Mixing them into
provider API-key config would make Kairo responsible for credentials it should
not own and would blur the difference between direct inference calls and bounded
tool execution.

The gateway layer therefore:

- stores no tokens;
- checks readiness through local CLI boundaries;
- builds explicit bounded commands;
- treats gateways as optional;
- leaves provider config unchanged.

## Current Scope

Codex is the first supported gateway. Readiness is checked with
`codex login status`, and bounded execution commands are constructed through
`codex exec` with read-only sandboxing by default.

Claude Code and Cursor remain planned gateway extension points until their local
auth and non-interactive execution boundaries are added deliberately.

## Consequences

`kairo doctor` can report whether Codex is installed and authenticated without
requiring or storing any Codex token. Future gateway work should add new runtime
checks under `@kairo/ai/gateway` instead of extending provider setup tables.
