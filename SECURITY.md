# Security policy

## Reporting

Do not open a public issue for a suspected vulnerability. Report security issues privately to the repository owner with:

- affected version or commit;
- reproduction steps;
- expected and actual behavior;
- impact and affected data.

## Runtime controls

- Sessions use opaque tokens in `HttpOnly`, `SameSite=Lax` cookies.
- Passwords are stored using Node.js scrypt with per-user salts.
- State-changing browser requests validate same-origin headers.
- Public queries do not return drafts, credentials, filesystem paths, or internal storage IDs.
- Public packs reject secret fields and validate every declared checksum.
- Operator packs are encrypted as a whole with AES-256-GCM and a scrypt-derived key.
- Image uploads validate magic bytes, MIME type, dimensions, and byte size.
- SVG, executables, archives, PDFs, video, and audio are rejected.
- API action, inquiry, media, and pack routes are rate limited.
- Security headers include CSP, frame denial, MIME sniffing protection, referrer policy, and permissions policy.
- Logs must never contain passwords, tokens, signing secrets, full bodies, or raw uploads.

## Operator responsibilities

- Put the gateway behind HTTPS.
- Set secure cookies in HTTPS deployments.
- Keep the Convex dashboard private.
- Pin container images by digest.
- Protect `.portable-core`, environment files, backups, and operator packs.
- Rotate instance secrets when moving an installation.
- Run restore and authorization tests before production cutover.

## Supported versions

The current MVP release is the only supported development version until a release policy is published.
