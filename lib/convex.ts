import { readFile } from 'node:fs/promises';
import { ConvexHttpClient } from 'convex/browser';
import { anyApi } from 'convex/server';
import type { InternalState, MediaAsset, SiteType } from '@/lib/types';

function optional<T>(value: T | null) {
  return value ?? undefined;
}

function convexMedia(asset: MediaAsset) {
  return {
    publicId: asset.publicId,
    digest: asset.digest,
    mediaType: asset.mediaType,
    byteSize: asset.byteSize,
    width: optional(asset.width),
    height: optional(asset.height),
    originalMediaType: asset.originalMediaType,
    originalByteSize: asset.originalByteSize,
    originalDigest: asset.originalDigest,
    compressed: asset.mediaType !== asset.originalMediaType || asset.byteSize !== asset.originalByteSize,
    status: asset.status,
    createdBy: asset.createdBy,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    ...(asset.storageId ? { storageId: asset.storageId } : {}),
  };
}

function convexState(state: InternalState, assets = state.media.map(convexMedia)) {
  return {
    site: state.site,
    users: state.users.map((user) => ({ ...user, avatarAssetId: optional(user.avatarAssetId) })),
    posts: state.posts.map((post) => ({ ...post, featuredAssetId: optional(post.featuredAssetId), publishedAt: optional(post.publishedAt), scheduledFor: optional(post.scheduledFor), deletedAt: optional(post.deletedAt) })),
    postRevisions: state.postRevisions,
    tags: state.tags,
    forumCategories: state.categories,
    threads: state.threads.map((thread) => ({ ...thread, lastPostPublicId: optional(thread.lastPostPublicId) })),
    forumPosts: state.replies.map((reply) => ({ ...reply, parentPostId: optional(reply.parentPostId), editedAt: optional(reply.editedAt), deletedAt: optional(reply.deletedAt) })),
    readStates: state.readStates,
    reports: state.reports.map((report) => ({ ...report, resolvedBy: optional(report.resolvedBy) })),
    reactions: state.reactions,
    moderationActions: state.moderationActions,
    projects: state.projects.map((project) => ({ ...project, publishedAt: optional(project.publishedAt) })),
    inquiries: state.inquiries.map((inquiry) => ({ ...inquiry, projectId: optional(inquiry.projectId) })),
    notifications: state.notifications.map((notification) => ({ ...notification, readAt: optional(notification.readAt) })),
    auditEvents: state.audit,
    assets,
  };
}

export async function initializeConvexSite(site: { name: string; type: SiteType; publicUrl: string }, setupToken: string) {
  const url = process.env.CONVEX_SELF_HOSTED_URL;
  if (!url) return false;
  if (!setupToken) throw new Error('PORTABLE_CORE_SETUP_TOKEN must be configured before Convex setup');
  const client = new ConvexHttpClient(url);
  await client.mutation(anyApi.bootstrap.initializeSite, { setupToken, siteName: site.name, siteType: site.type, publicUrl: site.publicUrl });
  return true;
}

async function syncMedia(client: ConvexHttpClient, internalKey: string, state: InternalState) {
  const assets: ReturnType<typeof convexMedia>[] = [];
  for (const asset of state.media) {
    if (!asset.storageId && asset.storagePath) {
      const bytes = await readFile(asset.storagePath);
      const result = await client.action(anyApi.portal.uploadCoreAsset, { internalKey, digest: asset.digest, mediaType: asset.mediaType, bytesBase64: bytes.toString('base64') });
      asset.storageId = result.storageId;
    }
    assets.push(convexMedia(asset));
  }
  return assets;
}

export async function syncConvexState(state: InternalState) {
  const url = process.env.CONVEX_SELF_HOSTED_URL;
  if (!url) return false;
  const internalKey = process.env.CONVEX_INTERNAL_KEY;
  if (!internalKey) throw new Error('CONVEX_INTERNAL_KEY must be configured before Convex synchronization');
  const client = new ConvexHttpClient(url);
  const assets = await syncMedia(client, internalKey, state);
  await client.mutation(anyApi.portal.syncCoreState, { internalKey, state: convexState(state, assets) });
  return true;
}
