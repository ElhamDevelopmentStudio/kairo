# Memory checks in CI and reviews

`kairo check memory` is advisory. It exits successfully and prints warnings when
stored project memory suggests something reviewers should inspect.

Run it locally:

```sh
kairo check memory
kairo check memory --changed-files packages/core/src/memory/answer.ts,apps/cli/src/commands/ask.ts
kairo check memory --json
```

GitHub Actions example:

```yaml
name: Kairo memory checks

on:
  pull_request:

jobs:
  memory:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter @kairohq/cli exec tsx src/bin.ts check memory
```

The check currently flags repeated terminal errors, broad architecture shifts
without matching ADRs, repeatedly observed commands missing from setup docs, and
changed files that overlap known fragile areas.
