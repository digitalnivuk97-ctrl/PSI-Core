import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'node:crypto';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';
import type { InternalState, User } from './types';

const allowedRecordFiles = new Set(['records/site.json', 'records/settings.jsonl', 'records/users-public.jsonl', 'records/roles.jsonl', 'records/blog-posts.jsonl', 'records/blog-revisions.jsonl', 'records/forum-categories.jsonl', 'records/forum-threads.jsonl', 'records/forum-posts.jsonl', 'records/forum-reactions.jsonl', 'records/forum-read-state.jsonl', 'records/showcase-projects.jsonl', 'records/showcase-inquiries.jsonl', 'records/notifications.jsonl', 'records/moderation.jsonl', 'records/audit.jsonl', 'records/assets/index.jsonl', 'records/credentials.jsonl']);
const forbiddenPublicKeys = new Set(['password', 'passwordHash', 'hash', 'salt', 'token', 'sessionToken', 'secret', 'credentials', 'secrets']);

interface PackFile { path: string; size: number; sha256: string }
export interface PackManifest { format: 'portable-core.pack'; formatVersion: 1; contentSchemaVersion: 1; minimumReaderVersion: '0.1.0'; createdByVersion: '0.1.0'; createdAt: string; packKind: 'public' | 'operator'; site: { id: string; name: string; type: string }; core: { version: '0.1.0'; releaseDigest: string }; files: PackFile[] }

function bytes(value: string) { return strToU8(value); }
function text(value: Uint8Array) { return strFromU8(value); }
function digest(value: Uint8Array) { return createHash('sha256').update(value).digest('hex'); }
function jsonl(rows: unknown[]) { return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''); }
function userPublic(user: User) { return { publicId: user.publicId, displayName: user.displayName, avatarAssetId: user.avatarAssetId, status: user.status, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt }; }
function assertNoSecretFields(value: unknown, path = 'record') {
  if (!value || typeof value !== 'object') return;
  if (Array.isArray(value)) { value.forEach((item, index) => assertNoSecretFields(item, `${path}[${index}]`)); return; }
  for (const [key, child] of Object.entries(value)) {
    if (forbiddenPublicKeys.has(key)) throw new Error(`Secret field is not allowed: ${path}.${key}`);
    assertNoSecretFields(child, `${path}.${key}`);
  }
}
function assertNoSecretFieldsInFile(name: string, value: Uint8Array) {
  const decoded = text(value);
  const records = name.endsWith('.jsonl') ? decoded.split('\n').filter(Boolean).map((line) => JSON.parse(line)) : decoded ? [JSON.parse(decoded)] : [];
  assertNoSecretFields(records, name);
}

export function createPublicPack(state: InternalState) {
  const records: Record<string, Uint8Array> = {
    'records/site.json': bytes(JSON.stringify(state.site)),
    'records/settings.jsonl': bytes(jsonl([{ publicId: state.site.publicId, locale: state.site.locale, timezone: state.site.timezone, publicUrl: state.site.publicUrl, settingsVersion: state.site.settingsVersion }])),
    'records/users-public.jsonl': bytes(jsonl(state.users.map(userPublic))),
    'records/roles.jsonl': bytes(jsonl(state.users.map((user) => ({ publicId: user.publicId, role: user.role })))),
    'records/blog-posts.jsonl': bytes(jsonl(state.posts)),
    'records/forum-categories.jsonl': bytes(jsonl([])),
    'records/forum-threads.jsonl': bytes(jsonl(state.threads)),
    'records/forum-posts.jsonl': bytes(jsonl(state.replies)),
    'records/showcase-projects.jsonl': bytes(jsonl(state.projects)),
    'records/showcase-inquiries.jsonl': bytes(jsonl(state.inquiries)),
    'records/notifications.jsonl': bytes(jsonl(state.notifications)),
    'records/moderation.jsonl': bytes(jsonl([])),
    'records/audit.jsonl': bytes(jsonl(state.audit)),
    'records/assets/index.jsonl': bytes(jsonl(state.media)),
  };
  for (const [name, value] of Object.entries(records)) assertNoSecretFieldsInFile(name, value);
  const files = Object.entries(records).map(([filePath, value]) => ({ path: filePath, size: value.byteLength, sha256: digest(value) }));
  const manifest: PackManifest = { format: 'portable-core.pack', formatVersion: 1, contentSchemaVersion: 1, minimumReaderVersion: '0.1.0', createdByVersion: '0.1.0', createdAt: new Date().toISOString(), packKind: 'public', site: { id: state.site.publicId, name: state.site.name, type: state.site.type }, core: { version: '0.1.0', releaseDigest: 'sha256:local-development' }, files };
  return zipSync({ 'manifest.json': bytes(JSON.stringify(manifest, null, 2)), ...records }, { level: 6 });
}

export function createOperatorPack(state: InternalState, passphrase: string) {
  if (passphrase.length < 12) throw new Error('Operator pack passphrase must contain at least 12 characters');
  const publicPack = createPublicPack(state);
  const unzipped = unzipSync(publicPack);
  const manifest = JSON.parse(text(unzipped['manifest.json'])) as PackManifest;
  manifest.packKind = 'operator';
  const credentials = bytes(jsonl(state.credentials.map((credential) => ({ ...credential, userEmail: state.users.find((user) => user.publicId === credential.userId)?.emailNormalized ?? '' }))));
  manifest.files = [...manifest.files, { path: 'records/credentials.jsonl', size: credentials.byteLength, sha256: digest(credentials) }];
  const records = { ...unzipped, 'manifest.json': bytes(JSON.stringify(manifest, null, 2)), 'records/credentials.jsonl': credentials };
  const plain = zipSync(records, { level: 6 });
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', scryptSync(passphrase, salt, 32), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return new Uint8Array(Buffer.concat([Buffer.from('PCOP1'), salt, iv, cipher.getAuthTag(), encrypted]));
}

export function inspectPack(pack: Uint8Array) {
  if (text(pack.subarray(0, 5)) === 'PCOP1') throw new Error('Operator packs require decryptPackOperator before inspection');
  const files = unzipSync(pack);
  const manifestFile = files['manifest.json'];
  if (!manifestFile) throw new Error('Pack manifest is missing');
  const manifest = JSON.parse(text(manifestFile)) as PackManifest;
  if (manifest.format !== 'portable-core.pack' || manifest.formatVersion !== 1 || manifest.contentSchemaVersion !== 1) throw new Error('Unsupported pack version');
  if (manifest.files.length > 5000 || manifest.files.reduce((total, file) => total + file.size, 0) > 100 * 1024 * 1024 * 1024) throw new Error('Pack exceeds size limits');
  for (const file of manifest.files) {
    if (file.path.startsWith('/') || file.path.includes('..') || !allowedRecordFiles.has(file.path)) throw new Error(`Unsafe pack path: ${file.path}`);
    const value = files[file.path];
    if (!value || value.byteLength !== file.size || digest(value) !== file.sha256) throw new Error(`Pack checksum failed: ${file.path}`);
    if (manifest.packKind === 'public') {
      if (file.path === 'records/credentials.jsonl') throw new Error('Credentials are not allowed in a public pack');
      assertNoSecretFieldsInFile(file.path, value);
    }
  }
  return { manifest, files };
}

export function decryptOperatorPack(pack: Uint8Array, passphrase: string) {
  if (text(pack.subarray(0, 5)) !== 'PCOP1') throw new Error('Invalid operator pack');
  const salt = pack.subarray(5, 21); const iv = pack.subarray(21, 33); const authTag = pack.subarray(33, 49); const encrypted = pack.subarray(49);
  const decipher = createDecipheriv('aes-256-gcm', scryptSync(passphrase, salt, 32), iv); decipher.setAuthTag(authTag);
  const plain = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return inspectPack(new Uint8Array(plain));
}

export function restorePublicPack(pack: Uint8Array, target: InternalState) {
  const { manifest, files } = inspectPack(pack);
  if (manifest.packKind !== 'public') throw new Error('Use decryptOperatorPack before restoring an operator pack');
  const read = (path: string) => { const value = files[path]; return value ? text(value) : ''; };
  const rows = (path: string) => read(path).split('\n').filter(Boolean).map((line) => JSON.parse(line));
  target.site = JSON.parse(read('records/site.json'));
  target.setupComplete = true;
  target.users = rows('records/users-public.jsonl').map((record) => ({ ...record, emailNormalized: '', status: 'active' as const }));
  target.posts = rows('records/blog-posts.jsonl');
  target.threads = rows('records/forum-threads.jsonl');
  target.replies = rows('records/forum-posts.jsonl');
  target.projects = rows('records/showcase-projects.jsonl');
  target.inquiries = rows('records/showcase-inquiries.jsonl');
  target.notifications = rows('records/notifications.jsonl');
  target.audit = rows('records/audit.jsonl');
  target.media = rows('records/assets/index.jsonl');
  target.credentials = [];
  target.sessions = [];
  target.mutations = [];
  return target;
}

export function restoreOperatorPack(pack: Uint8Array, passphrase: string, target: InternalState) {
  const { manifest, files } = decryptOperatorPack(pack, passphrase);
  if (manifest.packKind !== 'operator') throw new Error('The decrypted pack is not an operator pack');
  const read = (path: string) => { const value = files[path]; return value ? text(value) : ''; };
  const rows = (path: string) => read(path).split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const credentials = rows('records/credentials.jsonl');
  target.site = JSON.parse(read('records/site.json'));
  target.setupComplete = true;
  target.users = rows('records/users-public.jsonl').map((record) => ({ ...record, emailNormalized: credentials.find((credential) => credential.userId === record.publicId)?.userEmail ?? '', status: 'active' as const }));
  target.credentials = credentials.map((credential) => { const restored = { ...credential } as Record<string, unknown>; delete restored.userEmail; return restored as unknown as typeof target.credentials[number]; });
  target.posts = rows('records/blog-posts.jsonl');
  target.threads = rows('records/forum-threads.jsonl');
  target.replies = rows('records/forum-posts.jsonl');
  target.projects = rows('records/showcase-projects.jsonl');
  target.inquiries = rows('records/showcase-inquiries.jsonl');
  target.notifications = rows('records/notifications.jsonl');
  target.audit = rows('records/audit.jsonl');
  target.media = rows('records/assets/index.jsonl');
  target.sessions = [];
  target.mutations = [];
  return target;
}
