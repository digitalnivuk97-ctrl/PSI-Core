import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

const editorRoles = ['owner', 'administrator', 'editor', 'author'];
type EditorUser = { publicId: string; role: string };
type EditorContext = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> }; db: { query: (table: 'users') => { withIndex: (name: string, range: (index: { eq: (field: string, value: string) => unknown }) => unknown) => { unique: () => Promise<EditorUser | null> } } } };

async function requireEditor(ctx: unknown) {
  const context = ctx as EditorContext;
  const identity = await context.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthorized');
  const user = await context.db.query('users').withIndex('byPublicId', (index) => index.eq('publicId', identity.subject)).unique();
  if (!user || !editorRoles.includes(user.role)) throw new Error('Forbidden');
  return user;
}

function withoutId(document: Record<string, unknown>) {
  const result = { ...document };
  delete result._id;
  return result;
}

export const publicPosts = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 50);
    const posts = await ctx.db.query('posts').withIndex('byStatus', (index) => index.eq('status', 'published')).order('desc').take(limit);
    return { items: posts.map(withoutId), nextCursor: null, generatedAt: Date.now() };
  },
});

export const publicPostBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db.query('posts').withIndex('bySlug', (index) => index.eq('slug', args.slug)).unique();
    if (!post || post.status !== 'published' || post.deletedAt) return null;
    return withoutId(post);
  },
});

export const adminPosts = query({
  args: { includeDrafts: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requireEditor(ctx);
    const posts = await ctx.db.query('posts').order('desc').take(50);
    return posts.filter((post) => args.includeDrafts !== false || post.status === 'published').map(withoutId);
  },
});

export const savePost = mutation({
  args: { publicId: v.optional(v.string()), title: v.string(), slug: v.string(), excerpt: v.string(), bodyMarkdown: v.string(), expectedRevision: v.number(), clientMutationId: v.string(), status: v.optional(v.union(v.literal('draft'), v.literal('published'))), featuredAssetId: v.optional(v.string()), tagIds: v.optional(v.array(v.string())) },
  handler: async (ctx, args) => {
    const user = await requireEditor(ctx);
    const key = await ctx.db.query('idempotencyKeys').withIndex('byKey', (index) => index.eq('actorId', user.publicId)).filter((filter) => filter.eq(filter.field('clientMutationId'), args.clientMutationId)).unique();
    if (key) return key.result;
    let existing = null;
    if (args.publicId) existing = await ctx.db.query('posts').withIndex('byPublicId', (index) => index.eq('publicId', args.publicId)).unique();
    if (existing && existing.revision !== args.expectedRevision) throw new Error('The post changed in another session');
    const duplicate = await ctx.db.query('posts').withIndex('bySlug', (index) => index.eq('slug', args.slug)).unique();
    if (duplicate && duplicate.publicId !== args.publicId) throw new Error('That slug is already in use');
    const now = Date.now();
    const publicId = args.publicId ?? crypto.randomUUID();
    const revision = (existing?.revision ?? 0) + 1;
    const document = { publicId, title: args.title, slug: args.slug, excerpt: args.excerpt, bodyMarkdown: args.bodyMarkdown, status: args.status ?? existing?.status ?? 'draft', authorId: existing?.authorId ?? user.publicId, featuredAssetId: args.featuredAssetId ?? existing?.featuredAssetId, tagIds: args.tagIds ?? existing?.tagIds ?? [], publishedAt: existing?.publishedAt, scheduledFor: existing?.scheduledFor, revision, createdAt: existing?.createdAt ?? now, updatedAt: now };
    const id = existing ? existing._id : await ctx.db.insert('posts', document);
    if (existing) await ctx.db.patch(existing._id, document);
    await ctx.db.insert('postRevisions', { publicId: crypto.randomUUID(), postId: publicId, revision, title: document.title, slug: document.slug, excerpt: document.excerpt, bodyMarkdown: document.bodyMarkdown, editorId: user.publicId, createdAt: now });
    const result = { publicId, revision, id };
    await ctx.db.insert('idempotencyKeys', { publicId: crypto.randomUUID(), actorId: user.publicId, clientMutationId: args.clientMutationId, result, createdAt: now, expiresAt: now + 1000 * 60 * 60 * 24 * 30 });
    return result;
  },
});

export const publishPost = mutation({
  args: { publicId: v.string(), expectedRevision: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireEditor(ctx);
    const post = await ctx.db.query('posts').withIndex('byPublicId', (index) => index.eq('publicId', args.publicId)).unique();
    if (!post) throw new Error('Post not found');
    if (args.expectedRevision !== undefined && post.revision !== args.expectedRevision) throw new Error('The post changed in another session');
    const publishedAt = post.publishedAt ?? Date.now();
    await ctx.db.patch(post._id, { status: 'published', publishedAt, scheduledFor: undefined, updatedAt: Date.now() });
    return { publicId: post.publicId, version: post.revision, actorId: user.publicId, publishedAt };
  },
});
