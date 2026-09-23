# Stage 2 — CMS and Blog

Stage 2 adds the blog domain and media pipeline to PSI Core.

## Included

- Post drafts, revisions, tags, featured images, and soft deletion.
- Expected-revision conflict checks.
- Transactional client mutation IDs.
- Scheduled publishing.
- Server-rendered public post pages.
- SEO metadata, RSS, and sitemap routes.
- Sanitized server-side Markdown using `marked` and `sanitize-html`.
- JPEG, PNG, WebP, AVIF, and GIF uploads up to 10 MiB.
- Magic-byte validation, dimension limits, metadata stripping, and WebP normalization.
- Convex schema and typed query/mutation boundaries for posts and media.
- Local media storage under `.portable-core/media` for the no-infrastructure test path.
- Media library and featured-image selection in administration.
- Pack records for tags and post revisions.

## Local testing

```bash
pnpm install
pnpm dev
```

Open `http://127.0.0.1:3000/setup`, create the owner account, then open `/admin`.

The local test adapter uses `.portable-core/site.json` and `.portable-core/media`. It provides the same public IDs and authorization boundaries as the Convex path.

## Blog workflow

1. Open `/admin`.
2. Create a draft.
3. Add comma-separated tags.
4. Upload an image in Settings → Media library.
5. Select the image as the post featured image.
6. Save the draft.
7. Publish the post or schedule it with `posts.schedule`.
8. Open the public post route at `/posts/<slug>`.

Each save increments the post revision and creates a `postRevisions` record. A save with a stale revision is rejected instead of overwriting newer content.

## Media policy

Accepted MIME types:

```text
image/jpeg
image/png
image/webp
image/avif
image/gif
```

The upload processor:

- checks the 10 MiB size limit;
- detects the format from magic bytes;
- rejects MIME/byte mismatches;
- rejects SVG and non-image content;
- limits dimensions and total pixels;
- rotates according to EXIF orientation;
- strips metadata;
- converts still images to WebP;
- preserves animated GIF bytes;
- deduplicates by optimized SHA-256 digest;
- returns metadata without exposing filesystem paths.

## Convex configuration

The browser provider is enabled when `NEXT_PUBLIC_CONVEX_URL` is set. The provider is in `components/realtime-provider.tsx` and the Stage 2 functions are in `convex/posts.ts` and `convex/media.ts`.

Self-hosted Convex functions still require the production identity integration to map the authenticated Convex subject to the local `users.publicId` record. The local adapter remains the supported development path until that identity mapping is configured.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Current unit coverage includes:

- Markdown sanitization;
- public pack round trips;
- operator pack encryption;
- image processing;
- image type and size rejection.

## Deferred to Stage 3

- Forum moderation and realtime thread updates.
- Showcase inquiries.
- Background notification delivery.
- Full browser-based realtime integration tests.
- Convex production identity provisioning.
