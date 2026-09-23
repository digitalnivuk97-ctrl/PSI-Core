import { describe, expect, it } from 'vitest';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { createOperatorPack, createPublicPack, decryptOperatorPack, inspectPack, restoreOperatorPack, restorePublicPack } from '@/lib/pack';
import type { InternalState } from '@/lib/types';

const state = (): InternalState => ({
  site: { publicId: 'site-1', name: 'Example', type: 'blog', status: 'active', locale: 'en', timezone: 'UTC', publicUrl: 'http://localhost', settingsVersion: 1, createdAt: 1, updatedAt: 1 },
  setupComplete: true,
  setupToken: '',
  users: [{ publicId: 'user-1', emailNormalized: 'owner@example.test', displayName: 'Owner', avatarAssetId: null, status: 'active', role: 'owner', createdAt: 1, updatedAt: 1 }],
  credentials: [{ publicId: 'credential-1', userId: 'user-1', algorithm: 'scrypt', algorithmVersion: 1, salt: 'salt', hash: 'hash', updatedAt: 1 }],
  sessions: [],
  posts: [{ publicId: 'post-1', title: 'Hello', slug: 'hello', excerpt: 'A post', bodyMarkdown: '# Hello', status: 'published', authorId: 'user-1', featuredAssetId: null, tagIds: [], publishedAt: 2, scheduledFor: null, revision: 1, createdAt: 1, updatedAt: 1, deletedAt: null }],
  postRevisions: [], tags: [], categories: [],
  threads: [], replies: [], readStates: [], reports: [], reactions: [], moderationActions: [], projects: [], inquiries: [], notifications: [], audit: [], mutations: [], migrations: [{ publicId: 'migration-1', version: 1, appliedAt: 1 }], media: [],
});

describe('portable packs', () => {
  it('creates a public pack without credentials and restores stable IDs', async () => {
    const source = state();
    const pack = await createPublicPack(source);
    const { manifest } = inspectPack(pack);
    expect(manifest.packKind).toBe('public');
    expect(manifest.files.some((file) => file.path === 'records/credentials.jsonl')).toBe(false);
    const target = state();
    target.site.publicId = 'old-internal-id';
    await restorePublicPack(pack, target);
    expect(target.posts[0].publicId).toBe('post-1');
    expect(target.credentials).toHaveLength(0);
  });

  it('encrypts operator credentials and restores them without sessions', async () => {
    const source = state();
    const pack = await createOperatorPack(source, 'a sufficiently long operator passphrase');
    const inspected = decryptOperatorPack(pack, 'a sufficiently long operator passphrase');
    expect(inspected.manifest.packKind).toBe('operator');
    const target = state();
    await restoreOperatorPack(pack, 'a sufficiently long operator passphrase', target);
    expect(target.credentials).toHaveLength(1);
    expect(target.users[0].emailNormalized).toBe('owner@example.test');
    expect(target.sessions).toHaveLength(0);
  });

  it('rejects a tampered record', async () => {
    const pack = await createPublicPack(state());
    const files = unzipSync(pack);
    const record = strFromU8(files['records/blog-posts.jsonl']);
    files['records/blog-posts.jsonl'] = strToU8(record.replace('Hello', 'Tampered'));
    const tampered = zipSync(files, { level: 6 });
    expect(() => inspectPack(tampered)).toThrow();
  });
});
