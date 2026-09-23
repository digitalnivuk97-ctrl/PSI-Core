# Stage 3 — Forum and Showcase

Stage 3 adds the forum and showcase workflows on top of the Stage 2 blog and media foundation.

## Forum

Included:

- Forum categories with stable public IDs and ordering.
- Thread creation inside a category.
- Replies with parent-post relationships.
- Thread locking and unlocking.
- Soft deletion and moderator restoration.
- User-specific read state and unread indicators.
- Reports with open, reviewing, resolved, and dismissed states.
- Moderation action history.
- Reaction toggles for threads and replies.
- Reply, report, and reaction controls in the public thread view.
- Realtime refresh through the local reactive adapter.

A default `General` category is created automatically for new forum installations.

## Showcase

Included:

- Published project cards with project detail modal.
- Project images from the shared media library.
- Tags and custom-field validation at the backend boundary.
- Ordering and revision checks.
- Public inquiry form.
- Inquiry inbox status changes.
- Inquiry notifications for owners, administrators, and editors.

## Local testing

```bash
pnpm dev
```

Create a forum site from `/setup`, then open `/admin`:

```text
Admin → Forum → create thread
Admin → Moderation → manage categories/reports
Public site → open thread → reply/report/react
```

Create a showcase site from `/setup`, then:

```text
Admin → Showcase → create project
Admin → Settings → Media library → upload images
Public site → open project → send inquiry
Admin → Inquiries → update status
```

## Convex boundaries

The Stage 3 Convex functions are in:

- `convex/forum.ts`: categories, public threads, replies, read state, reports, and reactions.
- `convex/projects.ts`: public projects, project mutations, and inquiry creation.

The Convex identity mapping still requires production authentication provisioning. The local adapter remains the supported no-infrastructure test path.

## Verification

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

The current tests cover public-state privacy, media, Markdown, and pack behavior. The runtime smoke path additionally verifies forum category/thread/reply/read/report/reaction mutations.
