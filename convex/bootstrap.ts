import { mutation } from './_generated/server';
import { v } from 'convex/values';

const siteTypes = new Set(['blog', 'forum', 'showcase']);

export const initializeSite = mutation({
  args: { setupToken: v.string(), siteName: v.string(), siteType: v.string(), publicUrl: v.string() },
  handler: async (ctx, args) => {
    const expectedToken = process.env.PORTABLE_CORE_SETUP_TOKEN;
    if (!expectedToken || args.setupToken !== expectedToken) throw new Error('Setup token is invalid');
    if (!siteTypes.has(args.siteType)) throw new Error('Unsupported site type');
    if (args.siteName.length < 1 || args.siteName.length > 160) throw new Error('Site name is invalid');
    if (args.publicUrl.length > 500) throw new Error('Public URL is invalid');
    const existing = await ctx.db.query('sites').first();
    if (existing) return { publicId: existing.publicId, created: false };
    const timestamp = Date.now();
    const site = { publicId: crypto.randomUUID(), name: args.siteName, type: args.siteType, status: 'active', locale: 'en', timezone: 'UTC', publicUrl: args.publicUrl, settingsVersion: 1, createdAt: timestamp, updatedAt: timestamp };
    await ctx.db.insert('sites', site);
    if (args.siteType === 'forum') await ctx.db.insert('forumCategories', { publicId: crypto.randomUUID(), name: 'General', slug: 'general', description: 'General community conversations', sortOrder: 0, createdAt: timestamp, updatedAt: timestamp });
    return { publicId: site.publicId, created: true };
  },
});
