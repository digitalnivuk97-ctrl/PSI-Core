# PSI Core release status

## Current status

The repository is a runnable local MVP with Stage 2–5 implementation slices and a Convex public-portal boundary.

## Completed

- Blog: drafts, revisions, tags, scheduling, featured media, SSR pages, RSS, sitemap, and SEO metadata.
- Forum: categories, threads, replies, read state, reports, moderation, reactions, and realtime local updates.
- Showcase: projects, project media, detail views, inquiries, and notifications.
- Media: magic-byte validation, 10 MiB limit, dimension limits, WebP conversion, metadata stripping, and animated GIF preservation.
- Packs: public packs, media bytes, checksums, operator encryption, staged CLI restore, backups, and upgrade safeguards.
- Security: CSP/security headers, same-origin checks, rate limits, migration readiness, metrics, and destructive-command safeguards.
- Convex: public snapshot query and post/forum/showcase/media function boundaries.
- E2E: two isolated Playwright browser contexts verify draft privacy, realtime forum replies, idempotent retries, and reload convergence.

## Verification status

```text
pnpm typecheck   PASS
pnpm lint        PASS
pnpm test        PASS — 11 unit tests
pnpm build       PASS
pnpm test:e2e    PASS — 1 two-browser realtime test
```

The E2E suite uses the local adapter and an isolated `.portable-core-e2e` data directory. It is intentionally separate from Vitest.

## Remaining production gates

- Start self-hosted Convex from digest-pinned images.
- Deploy the Convex functions and configure identity mapping to `users.publicId`.
- Run the same realtime and authorization tests against Convex WebSockets.
- Move production media storage and scheduled jobs to Convex services.
- Configure HTTPS, secure cookies, proxy headers, and secret rotation.
- Complete clean-machine restore, load, accessibility, and security audits.

## Documentation map

- `docs/GETTING_STARTED.md`: installation and common workflows.
- `docs/STAGE_2.md`: blog and media implementation.
- `docs/STAGE_3.md`: forum and showcase implementation.
- `docs/STAGE_4_5.md`: recovery, upgrade, security, and release controls.
- `docs/CONVEX.md`: Convex deployment and identity boundary.
- `docs/E2E.md`: two-browser realtime test execution.
- `SECURITY.md`: operator and vulnerability-reporting guidance.
