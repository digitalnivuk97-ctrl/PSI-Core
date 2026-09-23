# Realtime E2E tests

The Playwright suite uses two isolated browser contexts and verifies:

- anonymous visitors do not receive draft content;
- a forum thread appears in a second browser without refresh;
- a reply appears in an open thread without refresh;
- retrying the same mutation ID does not duplicate the reply;
- reloading converges to the current authoritative state;
- private read state and moderation reports are not exposed publicly.

## Run

Install Chromium once if needed:

```bash
pnpm exec playwright install chromium
pnpm test:e2e
```

The test starts an isolated Next.js server on port `3101` and uses `.portable-core-e2e/`, which is ignored by Git. The local adapter is intentionally used for deterministic tests; the Convex deployment has a separate WebSocket conformance checklist in `docs/CONVEX.md`.

The test is separate from `pnpm test`; Vitest excludes `tests/e2e/` and Playwright owns that directory.
