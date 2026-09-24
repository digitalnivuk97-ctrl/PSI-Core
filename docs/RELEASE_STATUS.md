# PSI Core release status

## Current status

The repository is a runnable local MVP with Stage 2–5 implementation slices, a fail-closed Convex function boundary, and hardened deployment configuration. Production release still requires a real Convex deployment, identity-provider provisioning, and a clean deployment verification run.

## Completed

- Blog: drafts, revisions, tags, scheduling, featured media, SSR pages, RSS, sitemap, and SEO metadata.
- Forum: categories, threads, replies, read state, reports, moderation, reactions, and realtime local updates.
- Showcase: projects, project media, detail views, inquiries, and notifications.
- Media: magic-byte validation, 10 MiB limit, dimension limits, WebP conversion, metadata stripping, and animated GIF preservation.
- Packs: public packs, media bytes, checksums, operator encryption, staged CLI restore, backups, and upgrade safeguards.
- Setup: browser-only three-step wizard handles template selection, owner creation, review, and launch; local loopback setup codes are auto-filled, while remote codes come from `PORTABLE_CORE_SETUP_TOKEN` and are not returned in public state.
- Security: CSP/security headers, same-origin checks, explicit secure-cookie configuration, rate limits, migration readiness, metrics, HSTS when HTTPS is enabled, and destructive-command safeguards.
- Convex: public snapshot query, private identity-gated admin snapshot, post/forum/showcase/media function boundaries, provider `publicId` claim enforcement, and short-lived media upload intents.
- Deployment: Docker build gets the public Convex URL at build time, the web container never receives the admin key, the `self-hosted` Compose profile runs a one-shot function deployment job, and readiness fails closed when required Convex/HTTPS configuration is absent.
- Convex bootstrap: the first-run setup token can initialize the Convex site record and default forum category without exposing the admin key.
- Convex parity bridge: server-side Core mutations mirror sanitized users, content, forum, showcase, tags, audit, and media records into Convex; media bytes use a server-only upload action.
- E2E: two isolated Playwright browser contexts verify draft privacy, realtime forum replies, idempotent retries, and reload convergence.

## Verification status

```text
pnpm typecheck   PASS
pnpm lint        PASS
pnpm test        PASS — 16 unit tests
pnpm build       PASS
pnpm test:e2e    PASS — 1 two-browser realtime test
```

The E2E suite uses the local adapter and an isolated `.portable-core-e2e` data directory. It is intentionally separate from Vitest.

## 1.0 definition of done

1. A new operator can open `/setup`, complete the browser wizard, create an owner, and reach `/admin` without CLI commands.
2. Local mode passes setup, authentication, content CRUD, media, forum/showcase workflows, backup, restore, and E2E tests.
3. Convex functions deploy from `convex.json` and pass public-data, draft-privacy, authorization, media-storage, and WebSocket tests.
4. The selected identity provider provisions `users.publicId` from authenticated claims and is covered by negative authorization tests.
5. Production deployment has HTTPS, secure cookies, private dashboard access, pinned images, protected secrets, readiness/liveness checks, metrics, backups, and a clean-machine restore test.
6. The release has no open critical/high security findings and has documented operator recovery procedures.

The local path satisfies the browser setup and local test portions. Items 3–6 remain deployment/infrastructure gates rather than hidden code claims.

## Remaining production gates

- Start self-hosted Convex from operator-selected digest-pinned backend and dashboard images.
- Deploy `convex.json` functions, commit generated Convex types, and configure the chosen identity provider to issue `publicId` claims mapped to active `users` rows.
- Run the same realtime, authorization, media, and pack-storage tests against Convex WebSockets and storage.
- Configure HTTPS termination, proxy headers, secret rotation, and a private dashboard network path.
- Complete clean-machine restore, load, accessibility, and external security audits.
- Run `pnpm release:check` against the real deployment environment; the repository intentionally ships no production secrets.

## Documentation map

- `docs/GETTING_STARTED.md`: installation and common workflows.
- `docs/SETUP_GUIDE.md`: beginner-friendly local and Docker setup.
- `docs/STAGE_2.md`: blog and media implementation.
- `docs/STAGE_3.md`: forum and showcase implementation.
- `docs/STAGE_4_5.md`: recovery, upgrade, security, and release controls.
- `docs/CONVEX.md`: Convex deployment and identity boundary.
- `docs/E2E.md`: two-browser realtime test execution.
- `SECURITY.md`: operator and vulnerability-reporting guidance.
