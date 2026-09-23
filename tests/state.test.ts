import { describe, expect, it } from 'vitest';
import { publicState } from '@/lib/store';
import type { InternalState } from '@/lib/types';

const state = (): InternalState => ({
  site: { publicId: 'site-1', name: 'Example', type: 'blog', status: 'active', locale: 'en', timezone: 'UTC', publicUrl: 'http://localhost', settingsVersion: 1, createdAt: 1, updatedAt: 1 },
  setupComplete: true,
  setupToken: '',
  users: [], credentials: [], sessions: [], posts: [], postRevisions: [], tags: [], categories: [], threads: [], replies: [], readStates: [], reports: [], reactions: [], moderationActions: [], projects: [], inquiries: [], notifications: [], audit: [], mutations: [], migrations: [{ publicId: 'migration-1', version: 1, appliedAt: 1 }],
  media: [{ publicId: 'asset-1', digest: 'digest', mediaType: 'image/webp', byteSize: 20, width: 100, height: 50, storageId: null, storagePath: '/tmp/asset.webp', originalMediaType: 'image/png', originalByteSize: 40, originalDigest: 'original', status: 'ready', createdBy: 'user-1', createdAt: 1, updatedAt: 1 }],
});

describe('public state media', () => {
  it('keeps forum moderation and read state private from anonymous visitors', () => {
    const source = state();
    source.site.type = 'forum';
    source.categories = [{ publicId: 'category-1', name: 'General', slug: 'general', description: 'General', sortOrder: 0, createdAt: 1, updatedAt: 1 }];
    source.readStates = [{ publicId: 'read-1', userId: 'user-1', threadId: 'thread-1', lastReadAt: 1, updatedAt: 1 }];
    source.reports = [{ publicId: 'report-1', reporterId: 'user-1', targetType: 'thread', targetId: 'thread-1', reason: 'Review', status: 'open', createdAt: 1, updatedAt: 1, resolvedBy: null }];
    const result = publicState(source, null);
    expect(result.categories).toHaveLength(1);
    expect(result.readStates).toHaveLength(0);
    expect(result.reports).toHaveLength(0);
  });
});
