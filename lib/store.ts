import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { applyMigrations } from './migrations';
import { promisify } from 'node:util';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Credential, InternalState, PublicState, Session, User } from './types';

const scrypt = promisify(scryptCallback);
const stateDirectory = process.env.PORTABLE_CORE_DATA_DIR ?? '.portable-core';
export const stateDirectoryPath = path.resolve(process.cwd(), stateDirectory);
export const mediaDirectoryPath = path.join(stateDirectoryPath, 'media');
const statePath = path.join(stateDirectoryPath, 'site.json');

const now = () => Date.now();
export const id = () => crypto.randomUUID();
const token = (bytes = 24) => randomBytes(bytes).toString('hex');
const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `item-${id().slice(0, 8)}`;

function initialState(): InternalState {
  const timestamp = now();
  return {
    site: {
      publicId: id(),
      name: 'Portable Core',
      type: 'blog',
      status: 'active',
      locale: 'en',
      timezone: 'UTC',
      publicUrl: 'http://127.0.0.1:3000',
      settingsVersion: 1,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    setupComplete: false,
    setupToken: process.env.PORTABLE_CORE_SETUP_TOKEN?.trim() || `${token(3).slice(0, 4).toUpperCase()}-${token(3).slice(0, 4).toUpperCase()}`,
    users: [],
    credentials: [],
    sessions: [],
    posts: [],
    postRevisions: [],
    tags: [],
    categories: [],
    threads: [],
    replies: [],
    readStates: [],
    reports: [],
    reactions: [],
    moderationActions: [],
    projects: [],
    inquiries: [],
    notifications: [],
    audit: [],
    mutations: [],
    migrations: [{ publicId: id(), version: 1, appliedAt: timestamp }],
    media: [],
  };
}

async function ensureState() {
  await mkdir(path.dirname(statePath), { recursive: true });
  try {
    await readFile(statePath, 'utf8');
  } catch {
    await writeState(initialState());
  }
}

export async function readState(): Promise<InternalState> {
  await ensureState();
  const state = JSON.parse(await readFile(statePath, 'utf8')) as Partial<InternalState>;
  state.postRevisions ??= [];
  state.tags ??= [];
  state.categories ??= [];
  state.readStates ??= [];
  state.reports ??= [];
  state.reactions ??= [];
  state.moderationActions ??= [];
  state.migrations ??= [];
  state.media = (state.media ?? []).map((asset) => ({
    ...asset,
    storagePath: asset.storagePath ?? '',
    originalMediaType: asset.originalMediaType ?? asset.mediaType,
    originalByteSize: asset.originalByteSize ?? asset.byteSize,
    originalDigest: asset.originalDigest ?? asset.digest,
  }));
  const normalized = state as InternalState;
  const categoryCount = normalized.categories.length;
  const migrationsApplied = applyMigrations(normalized, id, now);
  ensureForumDefaults(normalized);
  if ((normalized.site.type === 'forum' && categoryCount === 0) || migrationsApplied.length > 0) await writeState(normalized);
  return normalized;
}

export async function writeState(state: InternalState) {
  await mkdir(path.dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(temporaryPath, statePath);
}

export async function mutateState<T>(operation: (state: InternalState) => Promise<T> | T): Promise<T> {
  const state = await readState();
  const result = await operation(state);
  await writeState(state);
  return result;
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const derived = await scrypt(password, salt, 64) as Buffer;
  return { salt, hash: derived.toString('hex') };
}

export async function verifyPassword(password: string, credential: Credential) {
  const derived = await scrypt(password, credential.salt, 64) as Buffer;
  const expected = Buffer.from(credential.hash, 'hex');
  return expected.length === derived.length && timingSafeEqual(expected, derived);
}

export function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function newSession(userId: string): { session: Session; token: string } {
  const value = token(32);
  const timestamp = now();
  return {
    token: value,
    session: {
      publicId: id(),
      userId,
      tokenHash: hashToken(value),
      createdAt: timestamp,
      expiresAt: timestamp + 1000 * 60 * 60 * 24 * 14,
      revokedAt: null,
      lastSeenAt: timestamp,
    },
  };
}

export async function currentUser(state: InternalState, sessionToken: string | undefined) {
  if (!sessionToken) return null;
  const tokenHash = hashToken(sessionToken);
  const session = state.sessions.find((candidate) => candidate.tokenHash === tokenHash && !candidate.revokedAt && candidate.expiresAt > now());
  if (!session) return null;
  session.lastSeenAt = now();
  return state.users.find((user) => user.publicId === session.userId && user.status === 'active') ?? null;
}

export function ensureForumDefaults(state: InternalState) {
  if (state.site.type !== 'forum' || state.categories.length > 0) return;
  const timestamp = Date.now();
  state.categories.push({ publicId: id(), name: 'General', slug: 'general', description: 'General community conversations', sortOrder: 0, createdAt: timestamp, updatedAt: timestamp });
}

export function publicState(state: InternalState, user: User | null, realtime: PublicState['realtime'] = 'live', includeSetupToken = false): PublicState {
  const visibleUsers = user ? state.users : state.users.map((candidate) => ({ ...candidate, emailNormalized: '' }));
  const canManageContent = Boolean(user && ['owner', 'administrator', 'editor', 'author'].includes(user.role));
  const canModerate = Boolean(user && ['owner', 'administrator', 'moderator'].includes(user.role));
  const response: PublicState = {
    site: state.site,
    setupComplete: state.setupComplete,
    currentUser: user,
    users: visibleUsers,
    posts: canManageContent ? state.posts.filter((post) => !post.deletedAt) : state.posts.filter((post) => post.status === 'published' && !post.deletedAt),
    tags: state.tags,
    categories: [...(state.categories ?? [])].sort((left, right) => left.sortOrder - right.sortOrder),
    threads: state.threads,
    replies: state.replies.filter((reply) => !reply.deletedAt && reply.moderationState === 'visible'),
    readStates: user ? (state.readStates ?? []).filter((readState) => readState.userId === user.publicId) : [],
    reports: canModerate ? state.reports ?? [] : [],
    reactions: state.reactions ?? [],
    moderationActions: canModerate ? state.moderationActions ?? [] : [],
    projects: canManageContent ? state.projects : state.projects.filter((project) => project.status === 'published'),
    inquiries: user && ['owner', 'administrator', 'editor', 'moderator'].includes(user.role) ? state.inquiries : [],
    notifications: user ? state.notifications.filter((notification) => notification.userId === user.publicId) : [],
    audit: user && ['owner', 'administrator'].includes(user.role) ? state.audit : [],
    media: state.media.filter((asset) => asset.status === 'ready').map((asset) => ({ publicId: asset.publicId, digest: asset.digest, mediaType: asset.mediaType, byteSize: asset.byteSize, url: `/api/media/${asset.publicId}`, width: asset.width, height: asset.height, status: asset.status, createdBy: asset.createdBy, createdAt: asset.createdAt, updatedAt: asset.updatedAt })),
    realtime,
  };
  if (!state.setupComplete && includeSetupToken) response.setupToken = state.setupToken;
  return response;
}

export function hasRole(user: User | null, roles: User['role'][]) {
  return Boolean(user && roles.includes(user.role));
}

export function recordAudit(state: InternalState, actorId: string, action: string, targetType: string, targetId: string, metadata: Record<string, string | number | boolean> = {}) {
  state.audit.push({ publicId: id(), actorId, action, targetType, targetId, requestId: id(), metadata, createdAt: now() });
}

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function contentSlug(value: string) {
  return slugify(value);
}

export function hasMutation(state: InternalState, actorId: string, clientMutationId: string | undefined) {
  if (!clientMutationId) return null;
  return state.mutations.find((mutation) => mutation.key === `${actorId}:${clientMutationId}` && mutation.expiresAt > now()) ?? null;
}

export function rememberMutation(state: InternalState, actorId: string, clientMutationId: string | undefined, result: unknown) {
  if (!clientMutationId) return;
  state.mutations.push({ key: `${actorId}:${clientMutationId}`, actorId, result, createdAt: now(), expiresAt: now() + 1000 * 60 * 60 * 24 * 30 });
}

export function createCredential(userId: string, password: string) {
  return hashPassword(password).then(({ salt, hash }) => ({ publicId: id(), userId, algorithm: 'scrypt' as const, algorithmVersion: 1 as const, salt, hash, updatedAt: now() }));
}

export function isValidPassword(password: string) {
  return password.length >= 10 && /[a-z]/i.test(password) && /\d/.test(password);
}
