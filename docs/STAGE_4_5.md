# Stages 4–5 — Recovery and Release Hardening

## Stage 4: recovery and upgrades

Implemented:

- Content migration records with readiness reporting.
- Public pack checksums and media-byte validation.
- Encrypted operator pack support.
- Staged CLI restore with atomic active-state promotion.
- Pre-upgrade JSON backup creation.
- `portable-core upgrade <instance> --to 0.1.0` compatibility check.
- `destroy` requires `--confirm` and a recent backup or `--confirm-destructive`.

Commands:

```bash
pnpm cli backup create ./my-site
pnpm cli pack create ./my-site ./my-site.pcpack
pnpm cli restore ./restored-site ./my-site.pcpack
pnpm cli upgrade ./my-site --to 0.1.0
pnpm cli destroy ./my-site --confirm
```

The local adapter is single-node. Production restore should run against an isolated staging deployment and switch traffic only after smoke tests.

## Stage 5: security and release hardening

Implemented:

- Content Security Policy and baseline security headers.
- Same-origin checks for state-changing pack and media requests.
- Rate limits for actions, inquiries, uploads, and pack operations.
- Prometheus-compatible `/metrics` endpoint.
- Media magic-byte, dimension, and size validation.
- No filesystem paths or internal storage IDs in public media state.
- Public pack secret-field rejection.
- Health readiness based on applied migrations.
- Destructive command safeguards.

Run verification:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

## Release checklist

Before a production release:

- Pin every Convex and web container image by digest.
- Configure HTTPS and `Secure` cookies at the reverse proxy.
- Replace the local adapter with the configured Convex deployment.
- Provision Convex identity-to-`users.publicId` mapping.
- Run clean-machine pack restore and realtime browser tests.
- Run upload polyglot, oversized, SVG, CSRF, and authorization tests.
- Review dependency and image licenses.
- Confirm logs and metrics contain no secrets or user content.

The remaining production gates are infrastructure and identity provisioning, not local MVP behavior.
