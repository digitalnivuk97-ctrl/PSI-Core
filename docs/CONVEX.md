# Convex deployment

PSI Core can serve the public portal from Convex when `NEXT_PUBLIC_CONVEX_URL` is configured.

## Required environment

```text
NEXT_PUBLIC_CONVEX_URL=<browser-facing Convex URL>
CONVEX_SELF_HOSTED_URL=<backend URL>
CONVEX_SELF_HOSTED_ADMIN_KEY=<deployment-only admin key>
```

Never expose the admin key through a `NEXT_PUBLIC_` variable or ship it to the browser.

## Function deployment

The Convex boundary contains:

- `convex/schema.ts`
- `convex/portal.ts`
- `convex/posts.ts`
- `convex/forum.ts`
- `convex/projects.ts`
- `convex/media.ts`

Deploy the functions with the Convex CLI against the self-hosted backend, then set `NEXT_PUBLIC_CONVEX_URL` before building the Next.js application.

The public portal uses `convex/portal.ts:publicSnapshot`, which returns a public-only reactive snapshot. Drafts, credentials, sessions, reports, read state, and moderation data are not included.

## Authentication boundary

The Convex mutations resolve `ctx.auth.getUserIdentity()` and expect the authenticated subject to match a `users.publicId`. Configure Convex Auth or the chosen identity provider so this mapping is established before enabling private administration in production.

The current local adapter remains available when `NEXT_PUBLIC_CONVEX_URL` is empty so development and recovery tests do not require a running Convex deployment.

## Verification checklist

- [ ] Convex backend starts from pinned images.
- [ ] Dashboard is private.
- [ ] Functions deploy successfully.
- [ ] `publicSnapshot` returns published data only.
- [ ] Authenticated subject maps to a user record.
- [ ] Two browser contexts receive updates over Convex WebSockets.
- [ ] Draft leakage and authorization tests pass.
- [ ] Media upload and pack restore work against the deployment.
