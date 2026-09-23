import { query } from './_generated/server';
import { v } from 'convex/values';

export const publicThreads = query({
  args: { cursor: v.optional(v.number()), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 50);
    const threads = await ctx.db.query('threads').order('desc').take(limit);
    return { items: threads.map((thread) => { const result = { ...thread } as Record<string, unknown>; delete result._id; return result; }), nextCursor: null, generatedAt: Date.now() };
  },
});

export const publicThread = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db.query('threads').withIndex('byPublicId', (index) => index.eq('publicId', args.publicId)).unique();
    if (!thread) return null;
    const posts = await ctx.db.query('forumPosts').withIndex('byThread', (index) => index.eq('threadId', thread.publicId)).take(50);
    return { thread: { publicId: thread.publicId, title: thread.title, locked: thread.locked, postCount: thread.postCount, lastPostAt: thread.lastPostAt }, posts: posts.map((post) => { const result = { ...post } as Record<string, unknown>; delete result._id; return result; }) };
  },
});
