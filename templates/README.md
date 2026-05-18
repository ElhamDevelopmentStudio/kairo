# Kairo templates

Files dropped into a user's project by `kairo init`.

- `claude/hooks.json` — merged into `.claude/hooks.json` to fire Kairo on Claude Code events
- `codex/hooks.json` — same for Codex CLI
- `git-hooks/post-commit` — optional, augments observation with a guaranteed post-commit signal
- `kairo-workspace/` — example shape of the `.kairo/` directory after Kairo has reconstructed some sessions

These are reference templates. The init flow merges, never overwrites.
