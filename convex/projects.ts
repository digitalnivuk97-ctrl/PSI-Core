import { mutation, query } from './_generated/server';
import { v } from 'convex/values';

type UserRecord = { publicId: string; role: string; status: string };
type UserContext = { auth: { getUserIdentity: () => Promise<{ subject: string } | null> }; db: { query: (table: 'users') => { withIndex: (name: string, range: (index: { eq: (field: string, value: string) => unknown }) => unknown) => { unique: () => Promise<UserRecord | null> } } } };
const editorRoles = ['owner', 'administrator', 'editor', 'author'];

async function requireEditor(ctx: unknown) {
  const context = ctx as UserContext;
  const identity = await context.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthorized');
  const user = await context.db.query('users').withIndex('byPublicId', (index) => index.eq('publicId', identity.subject)).unique();
  if (!user || user.status !== 'active' || !editorRoles.includes(user.role)) throw new Error('Forbidden');
  return user;
}

function withoutId(document: Record<string, unknown>) {
  const result = { ...document };
  delete result._id;
  return result;
}

export const publicProjects = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = Math.min(args.limit ?? 20, 50);
    const projects = await ctx.db.query('projects').withIndex('byStatus', (index) => index.eq('status', 'published')).order('asc').take(limit);
    return { items: projects.map(withoutId), nextCursor: null, generatedAt: Date.now() };
  },
});

export const publicProjectBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const project = await ctx.db.query('projects').withIndex('bySlug', (index) => index.eq('slug', args.slug)).unique();
    if (!project || project.status !== 'published') return null;
    return withoutId(project);
  },
});

export const saveProject = mutation({
  args: { publicId: v.optional(v.string()), title: v.string(), slug: v.string(), summary: v.string(), bodyMarkdown: v.string(), sortOrder: v.optional(v.number()), assetIds: v.optional(v.array(v.string())), tagIds: v.optional(v.array(v.string())), customFields: v.optional(v.any()), expectedRevision: v.number(), clientMutationId: v.string() },
  handler: async (ctx, args) => {
    const user = await requireEditor(ctx);
    const key = await ctx.db.query('idempotencyKeys').withIndex('byKey', (index) => index.eq('actorId', user.publicId)).filter((filter) => filter.eq(filter.field('clientMutationId'), args.clientMutationId)).unique();
    if (key) return key.result;
    const existing = args.publicId ? await ctx.db.query('projects').withIndex('byPublicId', (index) => index.eq('publicId', args.publicId)).unique() : null;
    if (existing && existing.revision !== args.expectedRevision) throw new Error('The project changed in another session');
    const duplicate = await ctx.db.query('projects').withIndex('bySlug', (index) => index.eq('slug', args.slug)).unique();
    if (duplicate && duplicate.publicId !== args.publicId) throw new Error('That slug is already in use');
    const now = Date.now();
    const publicId = args.publicId ?? crypto.randomUUID();
    const document = { publicId, title: args.title, slug: args.slug, summary: args.summary, bodyMarkdown: args.bodyMarkdown, status: existing?.status ?? 'draft', authorId: existing?.authorId ?? user.publicId, assetIds: args.assetIds ?? existing?.assetIds ?? [], tagIds: args.tagIds ?? existing?.tagIds ?? [], customFields: args.customFields ?? existing?.customFields ?? {}, sortOrder: args.sortOrder ?? existing?.sortOrder ?? 0, publishedAt: existing?.publishedAt, revision: (existing?.revision ?? 0) + 1, createdAt: existing?.createdAt ?? now, updatedAt: now };
    const id = existing ? existing._id : await ctx.db.insert('projects', document);
    if (existing) await ctx.db.patch(existing._id, document);
    const result = { publicId, revision: document.revision, id };
    await ctx.db.insert('idempotencyKeys', { publicId: crypto.randomUUID(), actorId: user.publicId, clientMutationId: args.clientMutationId, result, createdAt: now, expiresAt: now + 1000 * 60 * 60 * 24 * 30 });
    return result;
  },
});

export const publishProject = mutation({
  args: { publicId: v.string(), expectedRevision: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const user = await requireEditor(ctx);
    const project = await ctx.db.query('projects').withIndex('byPublicId', (index) => index.eq('publicId', args.publicId)).unique();
    if (!project) throw new Error('Project not found');
    if (args.expectedRevision !== undefined && project.revision !== args.expectedRevision) throw new Error('The project changed in another session');
    const now = Date.now();
    await ctx.db.patch(project._id, { status: 'published', publishedAt: project.publishedAt ?? now, updatedAt: now });
    return { publicId: project.publicId, actorId: user.publicId, publishedAt: project.publishedAt ?? now };
  },
});

export const createInquiry = mutation({
  args: { projectId: v.optional(v.string()), name: v.string(), email: v.string(), message: v.string() },
  handler: async (ctx, args) => {
    const now = Date.now();
    const inquiry = { publicId: crypto.randomUUID(), projectId: args.projectId, name: args.name.trim().slice(0, 120), email: args.email.trim().toLowerCase().slice(0, 320), message: args.message.trim().slice(0, 5000), status: 'new', createdAt: now, updatedAt: now };
    await ctx.db.insert('inquiries', inquiry);
    return withoutId(inquiry);
  },
});
