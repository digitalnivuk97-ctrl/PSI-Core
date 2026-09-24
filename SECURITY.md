# Security policy

## Reporting

Do not open a public issue for a suspected vulnerability. Report security issues privately to the repository owner with:

- affected version or commit;
- reproduction steps;
- expected and actual behavior;
- impact and affected data.

## Runtime controls

- Sessions use opaque tokens in `HttpOnly`, `SameSite=Lax` cookies; `COOKIE_SECURE=true` is required behind HTTPS.
- The first-run setup code is returned only to loopback requests; remote deployments must provide `PORTABLE_CORE_SETUP_TOKEN` through protected environment configuration.
- Passwords are stored using Node.js scrypt with per-user salts.
- State-changing browser requests validate same-origin headers.
- Public queries do not return drafts, credentials, filesystem paths, or internal storage IDs.
- Public packs reject secret fields and validate every declared checksum.
- Operator packs are encrypted as a whole with AES-256-GCM and a scrypt-derived key.
- Image uploads validate magic bytes, MIME type, dimensions, and byte size.
- Convex media confirmation binds a short-lived upload intent to the authenticated `publicId` and verifies Convex storage metadata and digest.
- The Convex internal synchronization key is server-only, must match the Convex function environment, and is never sent to the browser.
- SVG, executables, archives, PDFs, video, and audio are rejected.
- API action, inquiry, media, and pack routes are rate limited.
- Security headers include CSP, frame denial, MIME sniffing protection, referrer policy, permissions policy, and HSTS when secure cookies are enabled.
- Logs must never contain passwords, tokens, signing secrets, full bodies, or raw uploads.

## Operator responsibilities

- Put the gateway behind HTTPS and set `COOKIE_SECURE=true` and `PORTABLE_CORE_REQUIRE_HTTPS=true` when the application is directly exposed.
- Keep the Convex dashboard private; the self-hosted Compose profile creates the admin key inside a protected Docker volume and never passes it to the web container or browser.
- Pin container images by digest and run `pnpm release:check` before cutover.
- Configure the identity provider to issue a `publicId` claim; the provider subject alone is not accepted by Convex functions.
- Protect `.portable-core`, environment files, backups, and operator packs.
- Rotate instance secrets when moving an installation.
- Run restore, media-storage, and authorization tests before production cutover.

## Supported versions

The current MVP release is the only supported development version until a release policy is published.
