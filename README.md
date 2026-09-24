# PSI Core

PSI Core (Performance Site Interface) is a self-hosted, realtime-first CMS prototype for blogs, forums, and showcases. This repository contains a runnable local MVP slice designed to exercise the release-critical loop:

- first-run setup with a generated owner account;
- authenticated administration;
- blog, forum, and showcase templates;
- live updates across connected browsers;
- revisions and client mutation IDs;
- public and encrypted operator pack primitives;
- Convex schema and reactive query boundaries;
- health endpoints and a Docker Compose reference deployment.

## Run locally

Requirements: Node.js 20+, pnpm 10+, and optionally Docker for the deployment stack.

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:3000/setup`. The local setup wizard detects a fresh instance, pre-fills the one-time setup code when opened from loopback, and guides you through site template selection, owner creation, and launch without CLI commands. For a remote first run, set `PORTABLE_CORE_SETUP_TOKEN` in the deployment environment and enter that code in the wizard.

To test realtime, open the public site in two browser windows. Publishing content or posting a reply updates both windows without a reload. The local adapter uses short-lived reactive refreshes and `BroadcastChannel`; the Convex boundary in `convex/` is a deployment-ready public/authenticated function boundary when `NEXT_PUBLIC_CONVEX_URL` and the self-hosted backend are configured.

## Commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm convex:codegen
pnpm release:check
pnpm cli help
pnpm cli start ./my-site --init --template blog
pnpm cli status ./my-site
pnpm cli pack create ./my-site ./my-site.pcpack
```

The CLI's `start` command runs the local Next.js gateway from this checkout and stores instance data beneath the requested instance directory. The reference Compose file is in `deployment/compose/compose.yaml`; `pnpm release:check` rejects missing configuration, floating image tags, placeholders, and accidental admin-key exposure before deployment. For same-machine Convex, use `docker compose --env-file deployment/compose/.env --profile self-hosted up -d --build`; the one-shot deployment service publishes the functions automatically.

To reset a local demo, stop the server and remove `.portable-core`; the next start creates a fresh setup token. CLI-managed instances can be reset with `pnpm cli destroy ./my-site --confirm`.

## Stage 2

Stage 2 adds the blog domain and media pipeline. See `docs/STAGE_2.md` for the implementation plan, local workflow, Convex configuration, media policy, and release checks.

## Stage 3

Stage 3 adds forum categories, read state, reports, moderation, reactions, showcase project media, and inquiry workflows. See `docs/STAGE_3.md` for the implementation and test workflow.

## Stages 4–5

Stages 4–5 add migrations, staged restore, pre-upgrade backups, upgrade safeguards, security headers, rate limits, metrics, and release documentation. See `docs/STAGE_4_5.md` and `SECURITY.md`.

Convex setup is documented in `docs/CONVEX.md`; the beginner-friendly server walkthrough is `docs/SETUP_GUIDE.md`; the two-browser realtime test is documented in `docs/E2E.md`. Current implementation and remaining release gates are tracked in `docs/RELEASE_STATUS.md`.

## Local limitations

The current testable path uses a filesystem-backed local adapter so the full workflow can be exercised without provisioning Convex first. It keeps the same public IDs, role checks, mutation idempotency, revision checks, media validation, and pack boundaries that the Convex adapter uses. Local two-browser E2E passes. Production must provision a Convex identity provider that issues the `publicId` claim, deploy `convex.json`, configure the authenticated admin surface, verify Convex WebSockets and media storage, and run the release check against a real deployment.

## Pack safety

Public packs are ZIP containers named `.pcpack` with a versioned manifest, SHA-256 checksums, JSONL records, and an allowlisted record layout. Credentials, sessions, mutations, and secrets are excluded. Operator packs are AES-256-GCM encrypted as a whole with a scrypt-derived key; live sessions remain excluded.

## Structure

- `app/`: Next.js public, setup, admin, health, and pack API routes.
- `components/`: browser portal, admin workspace, setup, and realtime hooks.
- `lib/`: backend validation, persistence, authentication, and pack codec.
- `convex/`: provider schema and typed reactive query/mutation examples.
- `cli/`: one-command local lifecycle and pack operations.
- `deployment/`: Docker Compose reference deployment.
