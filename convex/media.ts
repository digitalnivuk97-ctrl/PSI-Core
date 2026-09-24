import { mutation, query } from './_generated/server';
import { v } from 'convex/values';
import { identityPublicId } from './_lib/identity';

const editorRoles = ['owner', 'administrator', 'editor', 'author'];
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);
const maxBytes = 10 * 1024 * 1024;
type EditorUser = { publicId: string; role: string };
type EditorContext = { auth: { getUserIdentity: () => Promise<unknown> }; db: { query: (table: 'users') => { withIndex: (name: string, range: (index: { eq: (field: string, value: string) => unknown }) => unknown) => { unique: () => Promise<EditorUser | null> } } } };

async function requireEditor(ctx: unknown) {
  const context = ctx as EditorContext;
  const identity = await context.auth.getUserIdentity();
  if (!identity) throw new Error('Unauthorized');
  const user = await context.db.query('users').withIndex('byPublicId', (index) => index.eq('publicId', identityPublicId(identity))).unique();
  if (!user || !editorRoles.includes(user.role)) throw new Error('Forbidden');
  return user;
}

export const createUploadIntent = mutation({
  args: { mediaType: v.string(), byteSize: v.number() },
  handler: async (ctx, args) => {
    const user = await requireEditor(ctx);
    if (!allowedTypes.has(args.mediaType)) throw new Error('Unsupported image type');
    if (args.byteSize <= 0 || args.byteSize > maxBytes) throw new Error('Images must be 10 MiB or smaller');
    const publicId = crypto.randomUUID();
    const expiresAt = Date.now() + 1000 * 60 * 10;
    await ctx.db.insert('mediaUploads', { publicId, userId: user.publicId, mediaType: args.mediaType, byteSize: args.byteSize, status: 'pending', createdAt: Date.now(), expiresAt });
    return { publicId, uploadUrl: await ctx.storage.generateUploadUrl(), createdBy: user.publicId, expiresAt };
  },
});

export const confirmAsset = mutation({
  args: { uploadId: v.string(), storageId: v.string(), width: v.optional(v.number()), height: v.optional(v.number()), digest: v.string() },
  handler: async (ctx, args) => {
    const user = await requireEditor(ctx);
    const upload = await ctx.db.query('mediaUploads').withIndex('byPublicId', (index) => index.eq('publicId', args.uploadId)).unique();
    if (!upload || upload.userId !== user.publicId || upload.status !== 'pending' || upload.expiresAt < Date.now()) throw new Error('Upload intent is invalid or expired');
    const storageId = ctx.db.normalizeId('_storage', args.storageId);
    if (!storageId) throw new Error('Storage ID is invalid');
    const metadata = await ctx.db.system.get('_storage', storageId);
    if (!metadata) throw new Error('Uploaded file was not found');
    if (metadata.size > maxBytes) throw new Error('Images must be 10 MiB or smaller');
    if (metadata.contentType && !allowedTypes.has(metadata.contentType)) throw new Error('Unsupported image type');
    if (metadata.sha256 && metadata.sha256 !== args.digest) throw new Error('Upload digest does not match');
    const existing = await ctx.db.query('assets').withIndex('byDigest', (index) => index.eq('digest', args.digest)).unique();
    await ctx.db.patch(upload._id, { status: 'confirmed' });
    if (existing) return withoutStorageId(existing);
    const now = Date.now();
    const mediaType = metadata.contentType || upload.mediaType;
    const asset = { publicId: crypto.randomUUID(), digest: args.digest, mediaType, byteSize: metadata.size, width: args.width, height: args.height, storageId: args.storageId, originalMediaType: upload.mediaType, originalByteSize: upload.byteSize, originalDigest: args.digest, compressed: false, status: 'ready', createdBy: user.publicId, createdAt: now, updatedAt: now };
    await ctx.db.insert('assets', asset);
    return withoutStorageId(asset);
  },
});

export const publicAsset = query({
  args: { publicId: v.string() },
  handler: async (ctx, args) => {
    const asset = await ctx.db.query('assets').withIndex('byPublicId', (index) => index.eq('publicId', args.publicId)).unique();
    if (!asset || asset.status !== 'ready') return null;
    return { publicId: asset.publicId, digest: asset.digest, mediaType: asset.mediaType, byteSize: asset.byteSize, width: asset.width, height: asset.height, status: asset.status, createdAt: asset.createdAt, updatedAt: asset.updatedAt };
  },
});

function withoutStorageId(asset: Record<string, unknown>) {
  const result = { ...asset };
  delete result.storageId;
  return result;
}
