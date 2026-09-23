# PSI Core contributor guide

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

Open `http://127.0.0.1:3000/setup`. The first-run screen displays the one-time setup token generated in `.portable-core/site.json`. Create the owner account before opening `/admin`.

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

## Back up and restore

```bash
pnpm cli pack create ./my-site ./my-site.pcpack
pnpm cli restore ./restored-site ./my-site.pcpack
```

Public packs contain site content and public identity records, but exclude credentials, sessions, signing keys, and environment secrets. Operator pack primitives are available in `lib/pack.ts` and use an encrypted AES-256-GCM container.

## Realtime testing

Open two browser windows at the public site. Publishing a post, creating a reply, or updating a project should appear in both windows without a manual refresh. The local adapter uses reactive refreshes and `BroadcastChannel`; a configured Convex deployment uses the provider boundary in `components/realtime-provider.tsx` and the functions in `convex/`.

## Docker deployment

Copy the environment template and replace image references with pinned digests before production use:

```bash
cp deployment/compose/.env.example deployment/compose/.env
```

The reference stack is in `deployment/compose/compose.yaml`. The Convex dashboard is a local administration tool and must not be exposed publicly.

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
