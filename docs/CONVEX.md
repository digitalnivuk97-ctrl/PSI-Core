# Convex deployment

PSI Core can serve the public portal from Convex when `NEXT_PUBLIC_CONVEX_URL` is configured.

## Required environment

```text
NEXT_PUBLIC_CONVEX_URL=<browser-facing Convex URL>
CONVEX_SELF_HOSTED_URL=<backend URL>
CONVEX_SELF_HOSTED_MODE=local|external
CONVEX_INTERNAL_KEY=<server-only state synchronization key>
PORTABLE_CORE_SETUP_TOKEN=<long random first-run code>
```

Never expose the admin key through a `NEXT_PUBLIC_` variable or ship it to the browser.

## Function deployment

The Convex boundary contains:

- `convex.json`
- `convex/schema.ts`
- `convex/portal.ts`
- `convex/posts.ts`
- `convex/forum.ts`
- `convex/projects.ts`
- `convex/media.ts`

Deploy the functions with the Convex CLI against the self-hosted backend, then set `NEXT_PUBLIC_CONVEX_URL` before building the Next.js application. The Dockerfile accepts that URL as a build argument because public Convex URLs are compiled into the browser bundle.

## Same-machine Docker setup

The default Compose profile is `self-hosted`. It starts Convex, waits for its health check, sets the Convex function environment, deploys `convex/`, and then starts Core:

```bash
docker compose --env-file deployment/compose/.env --profile self-hosted up -d --build
```

Set `NEXT_PUBLIC_CONVEX_URL` to the HTTPS reverse-proxy URL for the Convex endpoint, keep `CONVEX_SELF_HOSTED_URL=http://backend:3210` for container-to-container traffic, and expose `CONVEX_BACKEND_PORT` only to the reverse proxy. The `convex-keygen` service creates the Convex admin key inside a protected Docker volume, and the one-shot `convex-deploy` service reads it only inside the deployment network. The setup wizard never receives either secret. The web service receives only the internal synchronization key, which is used server-to-server to mirror Core content into the Convex public snapshot.

For an already-running external Convex service, set `CONVEX_SELF_HOSTED_MODE=external`, provide the two Convex URLs, and start Compose without the `self-hosted` profile. The wizard's external option explains this requirement and fails early if the URLs are not configured.

The public portal uses `convex/portal.ts:publicSnapshot`, which returns a public-only reactive snapshot. Drafts, credentials, sessions, reports, read state, and moderation data are not included. `convex/portal.ts:adminSnapshot` is a private query boundary that requires an authenticated `publicId` claim and returns only the current user's content and audit records.

## Authentication boundary

Every Convex mutation and private query resolves `ctx.auth.getUserIdentity()` and requires a `publicId` claim. Configure Convex Auth or the chosen identity provider to issue that claim and provision the matching `users.publicId` row. The provider subject is not accepted as an application ID, and a missing claim fails closed.

The admin key is deployment-only. It is required for function publishing and must not be passed to the web container, exposed as a `NEXT_PUBLIC_` variable, or committed to an instance.

## Media storage

`createUploadIntent` requires an editor identity and creates a ten-minute pending upload intent. The client posts the bytes to the short-lived Convex upload URL, then passes the returned storage ID to `confirmAsset`. Confirmation checks the pending intent, identity, expiry, Convex storage metadata, size, content type, and SHA-256 digest before creating an asset. Pack restore still requires a separate operator-controlled storage-byte export/import workflow.

## Release checks

Before deployment, run `pnpm convex:codegen` against a configured deployment, then `pnpm release:check` with the real `deployment/compose/.env`. The release check rejects floating `latest` tags, placeholder values, missing secrets, and accidental admin-key injection into the web service.

## Verification checklist

- [ ] Convex backend and dashboard start from digest-pinned images.
- [ ] Dashboard is private and the web container has no Convex admin key.
- [ ] `convex.json` and generated Convex types are committed.
- [ ] Functions deploy successfully and `publicSnapshot` returns published data only.
- [ ] Provider issues `publicId`, and that claim maps to an active user record.
- [ ] Private admin functions reject unauthenticated, unprovisioned, and cross-user access.
- [ ] Two browser contexts receive updates over Convex WebSockets.
- [ ] Draft leakage and authorization tests pass.
- [ ] Media upload intents, storage metadata checks, and pack storage restore pass against the deployment.
- [ ] `pnpm release:check` passes with deployment-only secrets supplied outside the web container.
