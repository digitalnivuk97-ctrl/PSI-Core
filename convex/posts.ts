import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

export const publicPosts = query({
  handler: async (ctx) => {
    const posts = await ctx.db.query('posts').withIndex('byStatus', (index) => index.eq('status', 'published')).take(50);
    return posts.map((post) => { const result = { ...post } as Record<string, unknown>; delete result._id; return result; });
  },
});

export const publicPostBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const post = await ctx.db.query('posts').withIndex('bySlug', (index) => index.eq('slug', args.slug)).unique();
    if (!post || post.status !== 'published') return null;
    const result = { ...post } as Record<string, unknown>;
    delete result._id;
    return result;
  },
});

export const savePost = mutation({
  args: { publicId: v.optional(v.string()), title: v.string(), slug: v.string(), excerpt: v.string(), bodyMarkdown: v.string(), expectedRevision: v.number(), clientMutationId: v.string() },
  handler: async (ctx, args) => {
    const actor = await ctx.auth.getUserIdentity();
    if (!actor) throw new Error('Unauthorized');
    const key = await ctx.db.query('idempotencyKeys').withIndex('byKey', (index) => index.eq('actorId', actor.subject)).filter((filter) => filter.eq(filter.field('clientMutationId'), args.clientMutationId)).unique();
    if (key) return key.result;
    let existing = null;
    if (args.publicId) existing = await ctx.db.query('posts').withIndex('byPublicId', (index) => index.eq('publicId', args.publicId)).unique();
    if (existing && existing.revision !== args.expectedRevision) throw new Error('The post changed in another session');
    const now = Date.now();
    const document = { publicId: args.publicId ?? crypto.randomUUID(), title: args.title, slug: args.slug, excerpt: args.excerpt, bodyMarkdown: args.bodyMarkdown, status: 'draft', authorId: actor.subject, tagIds: [], revision: (existing?.revision ?? 0) + 1, createdAt: existing?.createdAt ?? now, updatedAt: now };
    const result = existing ? existing._id : await ctx.db.insert('posts', document);
    if (existing) await ctx.db.patch(existing._id, document);
    await ctx.db.insert('idempotencyKeys', { publicId: crypto.randomUUID(), actorId: actor.subject, clientMutationId: args.clientMutationId, result: { id: result }, createdAt: now, expiresAt: now + 1000 * 60 * 60 * 24 * 30 });
    return { id: result };
  },
});

export const publishPost = mutation({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const actor = await ctx.auth.getUserIdentity();
    if (!actor) throw new Error('Unauthorized');
    const post = await ctx.db.query('posts').withIndex('byPublicId', (index) => index.eq('publicId', args.publicId)).unique();
    if (!post) throw new Error('Post not found');
    await ctx.db.patch(post._id, { status: 'published', publishedAt: post.publishedAt ?? Date.now(), updatedAt: Date.now() });
    return { publicId: post.publicId, version: post.revision + 1 };
  },
});
