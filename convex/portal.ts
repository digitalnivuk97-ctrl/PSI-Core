import { query } from './_generated/server';

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
    const posts = (await ctx.db.query('posts').withIndex('byStatus', (index) => index.eq('status', 'published')).order('desc').take(50)).map((post) => { const result = { ...post }; delete result._id; return result; });
    const categories = (await ctx.db.query('forumCategories').order('asc').take(50)).map((category) => { const result = { ...category }; delete result._id; return result; });
    const threads = (await ctx.db.query('threads').withIndex('byLastPostAt').order('desc').take(50)).map((thread) => { const result = { ...thread }; delete result._id; return result; });
    const replies = (await ctx.db.query('forumPosts').take(50)).filter((reply) => !reply.deletedAt && reply.moderationState === 'visible').map((reply) => { const result = { ...reply }; delete result._id; return result; });
    const projects = (await ctx.db.query('projects').withIndex('byStatus', (index) => index.eq('status', 'published')).order('asc').take(50)).map((project) => { const result = { ...project }; delete result._id; return result; });
    const media = (await ctx.db.query('assets').withIndex('byPublicId').take(50)).filter((asset) => asset.status === 'ready').map((asset) => ({ publicId: asset.publicId, digest: asset.digest, mediaType: asset.mediaType, byteSize: asset.byteSize, url: asset.storageId ? ctx.storage.getUrl(asset.storageId) : '', width: asset.width, height: asset.height, status: asset.status, createdBy: asset.createdBy, createdAt: asset.createdAt, updatedAt: asset.updatedAt }));
    return { site, setupComplete: true, currentUser: null, users, posts, tags: [], categories, threads, replies, readStates: [], reports: [], reactions: [], moderationActions: [], projects, inquiries: [], notifications: [], audit: [], media, realtime: 'live' as const };
  },
});
