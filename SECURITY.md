# Security And Privacy

Kairo is local-first and handles development history, file paths, terminal
activity, and optional assistant transcripts. Treat that data as sensitive.

## Report A Security Issue

Do not open public issues for vulnerabilities or privacy leaks. Send the report
privately to the maintainer or repository owner with:

- affected command, package, or file;
- reproduction steps;
- expected and actual behavior;
- whether secrets, transcripts, or project files were exposed.

## Project Rules

- Kairo must not observe outside the target project root.
- Kairo must not log secrets, tokens, passwords, private keys, or environment files.
- Tests for source adapters and AI providers must use fixtures, not live external calls.
- Optional integrations must stay optional.

## Local Data

Project state is stored under `.kairo/` in the observed project. Global config,
when needed, belongs under `~/.kairo/`.
