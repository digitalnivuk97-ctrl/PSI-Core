import { query } from './_generated/server';
import { v } from 'convex/values';

export const publicProjects = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 50);
    const projects = await ctx.db.query('projects').withIndex('byStatus', (index) => index.eq('status', 'published')).take(limit);
    return { items: projects.map((project) => { const result = { ...project } as Record<string, unknown>; delete result._id; return result; }), nextCursor: null, generatedAt: Date.now() };
  },
});

export const publicProjectBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db.query('projects').withIndex('bySlug', (index) => index.eq('slug', args.slug)).unique();
    if (!project || project.status !== 'published') return null;
    const result = { ...project } as Record<string, unknown>;
    delete result._id;
    return result;
  },
});
