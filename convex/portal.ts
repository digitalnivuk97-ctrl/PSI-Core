import { action, mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { identityPublicId } from './_lib/identity';

type ConvexMutationContext = { db: { query: (table: string) => { collect: () => Promise<{ _id: string }[]> }; delete: (id: string) => Promise<unknown>; insert: (table: string, row: Record<string, unknown>) => Promise<unknown> } };

async function replaceTable(ctx: unknown, table: string, rows: Record<string, unknown>[]) {
  const database = (ctx as ConvexMutationContext).db;
  const existing = await database.query(table).collect();
  for (const document of existing) await database.delete(document._id);
  for (const row of rows) await database.insert(table, row);
}

export const uploadCoreAsset = action({
  args: { internalKey: v.string(), digest: v.string(), mediaType: v.string(), bytesBase64: v.string() },
  handler: async (ctx, args) => {
    const expectedKey = process.env.CORE_INTERNAL_KEY;
    if (!expectedKey || args.internalKey !== expectedKey) throw new Error('Unauthorized');
    const bytes = Uint8Array.from(atob(args.bytesBase64), (character) => character.charCodeAt(0));
    const blob = new Blob([bytes.buffer], { type: args.mediaType });
    const storageId = await ctx.storage.store(blob, { sha256: args.digest });
    return { storageId };
  },
});

export const syncCoreState = mutation({
  args: { internalKey: v.string(), state: v.any() },
  handler: async (ctx, args) => {
    const expectedKey = process.env.CORE_INTERNAL_KEY;
    if (!expectedKey || args.internalKey !== expectedKey) throw new Error('Unauthorized');
    const state = args.state as Record<string, unknown>;
    await replaceTable(ctx, 'sites', [state.site as Record<string, unknown>]);
    await replaceTable(ctx, 'users', state.users as Record<string, unknown>[]);
    await replaceTable(ctx, 'posts', state.posts as Record<string, unknown>[]);
    await replaceTable(ctx, 'postRevisions', state.postRevisions as Record<string, unknown>[]);
    await replaceTable(ctx, 'tags', state.tags as Record<string, unknown>[]);
    await replaceTable(ctx, 'forumCategories', state.forumCategories as Record<string, unknown>[]);
    await replaceTable(ctx, 'threads', state.threads as Record<string, unknown>[]);
    await replaceTable(ctx, 'forumPosts', state.forumPosts as Record<string, unknown>[]);
    await replaceTable(ctx, 'readStates', state.readStates as Record<string, unknown>[]);
    await replaceTable(ctx, 'reports', state.reports as Record<string, unknown>[]);
    await replaceTable(ctx, 'reactions', state.reactions as Record<string, unknown>[]);
    await replaceTable(ctx, 'moderationActions', state.moderationActions as Record<string, unknown>[]);
    await replaceTable(ctx, 'projects', state.projects as Record<string, unknown>[]);
    await replaceTable(ctx, 'inquiries', state.inquiries as Record<string, unknown>[]);
    await replaceTable(ctx, 'notifications', state.notifications as Record<string, unknown>[]);
    await replaceTable(ctx, 'auditEvents', state.auditEvents as Record<string, unknown>[]);
    await replaceTable(ctx, 'assets', state.assets as Record<string, unknown>[]);
    return { syncedAt: Date.now() };
  },
});

export const publicSnapshot = query({
  handler: async (ctx) => {
    const siteDocument = await ctx.db.query('sites').first();
    if (!siteDocument) return null;
    const site = { ...siteDocument };
    delete site._id;
    const users = (await ctx.db.query('users').take(100)).map((user) => {
      const result = { publicId: user.publicId, emailNormalized: '', displayName: user.displayName, avatarAssetId: user.avatarAssetId, status: user.status, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt };
      return result;
    });
    const tags = (await ctx.db.query('tags').take(50)).map((tag) => { const result = { ...tag }; delete result._id; return result; });
    const posts = (await ctx.db.query('posts').withIndex('byStatus', (index) => index.eq('status', 'published')).order('desc').take(50)).map((post) => { const result = { ...post }; delete result._id; return result; });
    const categories = (await ctx.db.query('forumCategories').order('asc').take(50)).map((category) => { const result = { ...category }; delete result._id; return result; });
    const threads = (await ctx.db.query('threads').withIndex('byLastPostAt').order('desc').take(50)).map((thread) => { const result = { ...thread }; delete result._id; return result; });
    const replies = (await ctx.db.query('forumPosts').take(50)).filter((reply) => !reply.deletedAt && reply.moderationState === 'visible').map((reply) => { const result = { ...reply }; delete result._id; return result; });
    const projects = (await ctx.db.query('projects').withIndex('byStatus', (index) => index.eq('status', 'published')).order('asc').take(50)).map((project) => { const result = { ...project }; delete result._id; return result; });
    const media = await (await ctx.db.query('assets').withIndex('byPublicId').take(50)).filter((asset) => asset.status === 'ready').map(async (asset) => ({ publicId: asset.publicId, digest: asset.digest, mediaType: asset.mediaType, byteSize: asset.byteSize, url: asset.storageId ? await ctx.storage.getUrl(asset.storageId) : '', width: asset.width, height: asset.height, status: asset.status, createdBy: asset.createdBy, createdAt: asset.createdAt, updatedAt: asset.updatedAt }));
    return { site, setupComplete: true, currentUser: null, users, posts, tags, categories, threads, replies, readStates: [], reports: [], reactions: [], moderationActions: [], projects, inquiries: [], notifications: [], audit: [], media, realtime: 'live' as const };
  },
});

export const adminSnapshot = query({
  handler: async (ctx) => {
    const publicId = identityPublicId(await ctx.auth.getUserIdentity());
    const user = await ctx.db.query('users').withIndex('byPublicId', (index) => index.eq('publicId', publicId)).first();
    if (!user) throw new Error('Authenticated identity is not provisioned in this Core instance');
    const posts = await ctx.db.query('posts').withIndex('byAuthorId', (index) => index.eq('authorId', publicId)).order('desc').take(100);
    const projects = await ctx.db.query('projects').withIndex('byAuthorId', (index) => index.eq('authorId', publicId)).order('desc').take(100);
    const audit = await ctx.db.query('auditEvents').withIndex('byActorId', (index) => index.eq('actorId', publicId)).order('desc').take(100);
    return {
      user: { publicId: user.publicId, emailNormalized: user.emailNormalized, displayName: user.displayName, role: user.role, status: user.status },
      posts: posts.map((post) => ({ publicId: post.publicId, title: post.title, slug: post.slug, status: post.status, updatedAt: post.updatedAt })),
      projects: projects.map((project) => ({ publicId: project.publicId, title: project.title, slug: project.slug, status: project.status, updatedAt: project.updatedAt })),
      audit: audit.map((event) => ({ publicId: event.publicId, action: event.action, targetType: event.targetType, targetId: event.targetId, createdAt: event.createdAt })),
    };
  },
});
