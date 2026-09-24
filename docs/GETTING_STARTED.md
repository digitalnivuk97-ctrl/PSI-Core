# PSI Core contributor guide

For a beginner-friendly Docker walkthrough, start with [`SETUP_GUIDE.md`](SETUP_GUIDE.md).

## Requirements

- Node.js 20 or newer
- pnpm 10 or newer
- Docker Engine and Docker Compose v2 for the reference deployment

## Install and verify

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Start a local site

```bash
pnpm dev
```

Open `http://127.0.0.1:3000/setup`. The browser wizard handles the fresh-instance flow: choose a template, create the owner, review the details, and launch into `/admin`. When opened from `localhost` or `127.0.0.1`, it fills the generated one-time setup code automatically. For a remote first run, set `PORTABLE_CORE_SETUP_TOKEN` in the deployment environment and enter that code; the code is not exposed to remote public state responses.

For a CLI-managed instance:

```bash
pnpm cli start ./my-site --init --template blog
pnpm cli status ./my-site
pnpm cli stop ./my-site
```

Choose `forum` or `showcase` with `--template` when initializing a new instance.

## Create a new instance

```bash
pnpm cli start ./my-new-site --init --template forum --port 3001
```

Each instance has its own data under `./my-new-site/.portable-core`. Never commit `.portable-core`, `.env*`, or `.pcpack` files.

## Reset a demo

Stop the development server, remove `.portable-core`, and start again. The next request creates a new setup token and an empty site.

```bash
rm -rf .portable-core
pnpm dev
```

For a CLI-managed instance, use `pnpm cli stop ./my-site` followed by `pnpm cli destroy ./my-site --confirm`. Runtime data, media, databases, logs, CLI manifests, and `.pcpack` files are ignored by Git.

## Back up and restore

```bash
pnpm cli pack create ./my-site ./my-site.pcpack
pnpm cli restore ./restored-site ./my-site.pcpack
```

Public packs contain site content and public identity records, but exclude credentials, sessions, signing keys, and environment secrets. Operator pack primitives are available in `lib/pack.ts` and use an encrypted AES-256-GCM container.

## Stage 2 blog workflow

Create and edit posts in `/admin`. Each saved post creates a revision, accepts comma-separated tags, and can use a featured image from the Media library. Drafts are visible only to content roles; public pages only render published posts.

```text
/admin → Posts → Create post
/admin → Settings → Media library
/posts
/posts/<slug>
/rss.xml
/sitemap.xml
```

Still images are normalized to WebP, animated GIFs are preserved, metadata is stripped, and uploads are limited to 10 MiB with magic-byte and dimension validation. See `docs/STAGE_2.md` for the complete Stage 2 workflow.

## Stage 3 forum and showcase workflow

Forum sites include a default General category, thread/reply relationships, read state, reports, moderation actions, reactions, and locking. Showcase sites include project media, project detail views, inquiries, and inquiry notifications. See `docs/STAGE_3.md`.

## Realtime testing

Open two browser windows at the public site. Publishing a post, creating a reply, or updating a project should appear in both windows without a manual refresh. The local adapter uses reactive refreshes and `BroadcastChannel`; a configured Convex deployment uses the provider boundary in `components/realtime-provider.tsx` and the functions in `convex/`.

## Docker deployment

Copy the environment template, replace every placeholder, pin both Convex images by digest, and keep the deployment admin key outside the web service:

```bash
cp deployment/compose/.env.example deployment/compose/.env
pnpm release:check
```

The reference stack is in `deployment/compose/compose.yaml`. The Convex dashboard is a local administration tool and must not be exposed publicly. Set `NEXT_PUBLIC_CONVEX_URL` before building because the browser bundle embeds it. The `PORTABLE_CORE_REQUIRE_CONVEX=true` setting makes readiness fail closed until the Convex URLs are configured. For same-machine Convex, use the `self-hosted` profile; it deploys the Convex functions before Core starts:

```bash
docker compose --env-file deployment/compose/.env --profile self-hosted up -d --build
```

For an external Convex service, set `CONVEX_SELF_HOSTED_MODE=external` and omit the `self-hosted` profile.

## Project layout

- `app/`: public, setup, administration, health, RSS, and pack routes.
- `components/`: browser UI and realtime hooks.
- `lib/`: validation, persistence, authentication, and pack format code.
- `convex/`: Convex schema and typed reactive functions.
- `cli/`: local lifecycle and pack commands.
- `deployment/`: Docker Compose reference deployment.
- `tests/`: unit and portability tests.

## License

PSI Core is distributed under GPL-3.0. See the repository license for the complete terms.
