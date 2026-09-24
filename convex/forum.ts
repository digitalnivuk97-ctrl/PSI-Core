import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { identityPublicId } from './_lib/identity';

type UserRecord = { publicId: string; role: string; status: string };
type UserContext = { auth: { getUserIdentity: () => Promise<unknown> }; db: { query: (table: 'users') => { withIndex: (name: string, range: (index: { eq: (field: string, value: string) => unknown }) => unknown) => { unique: () => Promise<UserRecord | null> } } } };
const moderatorRoles = ['owner', 'administrator', 'moderator'];

async function requireUser(ctx: unknown) {
  const context = ctx as UserContext;
  const identity = await context.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthorized');
  const user = await context.db.query('users').withIndex('byPublicId', (index) => index.eq('publicId', identityPublicId(identity))).unique();
  if (!user || user.status !== 'active') throw new Error('Unauthorized');
  return user;
}

async function requireModerator(ctx: unknown) {
  const user = await requireUser(ctx);
  if (!moderatorRoles.includes(user.role)) throw new Error('Forbidden');
  return user;
}

function withoutId(document: Record<string, unknown>) {
  const result = { ...document };
  delete result._id;
  return result;
}

export const publicCategories = query({
  handler: async (ctx) => {
    const categories = await ctx.db.query('forumCategories').order('asc').take(50);
    return categories.map(withoutId);
  },
});

export const publicThreads = query({
  args: { limit: v.optional(v.number()), categoryId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 50);
    const threads = await ctx.db.query('threads').withIndex('byLastPostAt').order('desc').take(limit);
    const items = args.categoryId ? threads.filter((thread) => thread.categoryId === args.categoryId) : threads;
    return { items: items.map(withoutId), nextCursor: null, generatedAt: Date.now() };
  },
});

export const publicThread = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const thread = await ctx.db.query('threads').withIndex('byPublicId', (index) => index.eq('publicId', args.publicId)).unique();
    if (!thread) return null;
    const posts = await ctx.db.query('forumPosts').withIndex('byThread', (index) => index.eq('threadId', thread.publicId)).take(50);
    return { thread: withoutId(thread), posts: posts.filter((post) => !post.deletedAt && post.moderationState === 'visible').map(withoutId) };
  },
});

export const createThread = mutation({
  args: { categoryId: v.string(), title: v.string(), bodyMarkdown: v.string(), clientMutationId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const key = await ctx.db.query('idempotencyKeys').withIndex('byKey', (index) => index.eq('actorId', user.publicId)).filter((filter) => filter.eq(filter.field('clientMutationId'), args.clientMutationId)).unique();
    if (key) return key.result;
    const category = await ctx.db.query('forumCategories').withIndex('byPublicId', (index) => index.eq('publicId', args.categoryId)).unique();
    if (!category) throw new Error('Forum category not found');
    const now = Date.now();
    const thread = { publicId: crypto.randomUUID(), categoryId: category.publicId, authorId: user.publicId, title: args.title, status: 'open', pinned: false, locked: false, postCount: 1, lastPostAt: now, createdAt: now, updatedAt: now };
    const threadId = await ctx.db.insert('threads', thread);
    const post = { publicId: crypto.randomUUID(), threadId: thread.publicId, authorId: user.publicId, bodyMarkdown: args.bodyMarkdown, revision: 1, createdAt: now, moderationState: 'visible' };
    const postId = await ctx.db.insert('forumPosts', post);
    await ctx.db.patch(threadId, { lastPostPublicId: post.publicId });
    const result = { publicId: thread.publicId, threadId, postId, postPublicId: post.publicId };
    await ctx.db.insert('idempotencyKeys', { publicId: crypto.randomUUID(), actorId: user.publicId, clientMutationId: args.clientMutationId, result, createdAt: now, expiresAt: now + 1000 * 60 * 60 * 24 * 30 });
    return result;
  },
});

export const createReply = mutation({
  args: { threadId: v.string(), parentPostId: v.optional(v.string()), bodyMarkdown: v.string(), clientMutationId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const key = await ctx.db.query('idempotencyKeys').withIndex('byKey', (index) => index.eq('actorId', user.publicId)).filter((filter) => filter.eq(filter.field('clientMutationId'), args.clientMutationId)).unique();
    if (key) return key.result;
    const thread = await ctx.db.query('threads').withIndex('byPublicId', (index) => index.eq('publicId', args.threadId)).unique();
    if (!thread || thread.locked) throw new Error('Thread not found or locked');
    const now = Date.now();
    const post = { publicId: crypto.randomUUID(), threadId: thread.publicId, parentPostId: args.parentPostId, authorId: user.publicId, bodyMarkdown: args.bodyMarkdown, revision: 1, createdAt: now, moderationState: 'visible' };
    const postId = await ctx.db.insert('forumPosts', post);
    await ctx.db.patch(thread._id, { postCount: thread.postCount + 1, lastPostAt: now, lastPostPublicId: post.publicId, updatedAt: now });
    if (thread.authorId !== user.publicId) await ctx.db.insert('notifications', { publicId: crypto.randomUUID(), userId: thread.authorId, kind: 'reply', targetType: 'thread', targetId: thread.publicId, body: `New reply in ${thread.title}`, createdAt: now });
    const result = { publicId: post.publicId, postId };
    await ctx.db.insert('idempotencyKeys', { publicId: crypto.randomUUID(), actorId: user.publicId, clientMutationId: args.clientMutationId, result, createdAt: now, expiresAt: now + 1000 * 60 * 60 * 24 * 30 });
    return result;
  },
});

export const markThreadRead = mutation({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const now = Date.now();
    const existing = await ctx.db.query('readStates').withIndex('byUserThread', (index) => index.eq('userId', user.publicId)).filter((filter) => filter.eq(filter.field('threadId'), args.threadId)).unique();
    if (existing) await ctx.db.patch(existing._id, { lastReadAt: now, updatedAt: now });
    else await ctx.db.insert('readStates', { publicId: crypto.randomUUID(), userId: user.publicId, threadId: args.threadId, lastReadAt: now, updatedAt: now });
    return { ok: true };
  },
});

export const createReport = mutation({
  args: { targetType: v.string(), targetId: v.string(), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    if (args.reason.trim().length < 3) throw new Error('A report reason is required');
    const now = Date.now();
    const report = { publicId: crypto.randomUUID(), reporterId: user.publicId, targetType: args.targetType, targetId: args.targetId, reason: args.reason.trim().slice(0, 1000), status: 'open', createdAt: now, updatedAt: now };
    await ctx.db.insert('reports', report);
    return withoutId(report);
  },
});

export const toggleReaction = mutation({
  args: { targetType: v.string(), targetId: v.string(), kind: v.string() },
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const existing = await ctx.db.query('reactions').withIndex('byTarget', (index) => index.eq('targetType', args.targetType)).filter((filter) => filter.eq(filter.field('targetId'), args.targetId)).filter((filter) => filter.eq(filter.field('userId'), user.publicId)).filter((filter) => filter.eq(filter.field('kind'), args.kind)).unique();
    if (existing) await ctx.db.delete(existing._id);
    else await ctx.db.insert('reactions', { publicId: crypto.randomUUID(), userId: user.publicId, targetType: args.targetType, targetId: args.targetId, kind: args.kind, createdAt: Date.now() });
    return { active: !existing };
  },
});

export const updateReport = mutation({
  args: { publicId: v.string(), status: v.string() },
  handler: async (ctx, args) => {
    const moderator = await requireModerator(ctx);
    const report = await ctx.db.query('reports').withIndex('byPublicId', (index) => index.eq('publicId', args.publicId)).unique();
    if (!report) throw new Error('Report not found');
    const now = Date.now();
    await ctx.db.patch(report._id, { status: args.status, updatedAt: now, resolvedBy: ['resolved', 'dismissed'].includes(args.status) ? moderator.publicId : undefined });
    await ctx.db.insert('moderationActions', { publicId: crypto.randomUUID(), moderatorId: moderator.publicId, action: args.status === 'dismissed' ? 'dismiss_report' : 'resolve_report', targetType: 'report', targetId: report.publicId, reason: 'Report review', createdAt: now });
    return { publicId: report.publicId, status: args.status };
  },
});
