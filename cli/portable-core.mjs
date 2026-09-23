#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { unzipSync, zipSync, strFromU8, strToU8 } from 'fflate';

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const version = '0.1.0';
const args = process.argv.slice(2);
const command = args.shift();

function fail(message) { console.error(`Portable Core: ${message}`); process.exitCode = 1; }
function instancePath(value) { return path.resolve(process.cwd(), value ?? '.'); }
function dataPath(instance) { return path.join(instance, '.portable-core'); }
function statePath(instance) { return path.join(dataPath(instance), 'site.json'); }
function flag(name, fallback) { const index = args.indexOf(name); return index === -1 ? fallback : args[index + 1]; }
function has(name) { return args.includes(name); }
function text(value) { return strFromU8(value); }
function bytes(value) { return strToU8(value); }
function hash(value) { return createHash('sha256').update(value).digest('hex'); }
function jsonl(rows) { return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : ''); }

function readState(instance) { return readFile(statePath(instance), 'utf8').then((value) => JSON.parse(value)); }
async function ensureRuntime(instance) {
  await mkdir(path.join(dataPath(instance), 'runtime'), { recursive: true });
  await mkdir(path.join(dataPath(instance), 'backups'), { recursive: true });
  await mkdir(path.join(dataPath(instance), 'packs'), { recursive: true });
}

async function initialize(instance, template) {
  await ensureRuntime(instance);
  const instanceFile = path.join(instance, 'instance.json');
  try { await readFile(instanceFile, 'utf8'); } catch {
    const siteId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    await writeFile(instanceFile, JSON.stringify({ instanceId: crypto.randomUUID(), siteId, template, coreVersion: version, backend: 'convex', backendVersion: 'self-hosted', profile: 'local', createdAt: timestamp }, null, 2));
  }
  const lockFile = path.join(instance, 'core.lock');
  try { await readFile(lockFile, 'utf8'); } catch { await writeFile(lockFile, JSON.stringify({ coreVersion: version, releaseDigest: 'sha256:local-development', packFormatVersions: [1], minimumReaderVersion: version }, null, 2)); }
  const composeFile = path.join(instance, 'compose.yaml');
  try { await copyFile(path.join(repoRoot, 'deployment/compose/compose.yaml'), composeFile); } catch { await writeFile(composeFile, 'services: {}\n'); }
  const secretFile = path.join(dataPath(instance), 'runtime', 'secrets.env');
  try { await readFile(secretFile, 'utf8'); } catch { await writeFile(secretFile, `INSTANCE_SECRET=${randomBytes(32).toString('hex')}\n`, { mode: 0o600 }); }
  await writeFile(path.join(dataPath(instance), 'config.json'), JSON.stringify({ template, port: Number(flag('--port', '3000')), mode: 'local' }, null, 2));
  try { await readFile(statePath(instance), 'utf8'); } catch {
    const timestamp = Date.now();
    const site = { publicId: crypto.randomUUID(), name: 'Portable Core', type: template, status: 'active', locale: 'en', timezone: 'UTC', publicUrl: `http://127.0.0.1:${flag('--port', '3000')}`, settingsVersion: 1, createdAt: timestamp, updatedAt: timestamp };
    await writeFile(statePath(instance), JSON.stringify({ site, setupComplete: false, setupToken: `${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`, users: [], credentials: [], sessions: [], posts: [], postRevisions: [], tags: [], categories: [], threads: [], replies: [], readStates: [], reports: [], reactions: [], moderationActions: [], projects: [], inquiries: [], notifications: [], audit: [], mutations: [], migrations: [{ publicId: crypto.randomUUID(), version: 1, appliedAt: Date.now() }], media: [] }, null, 2), { mode: 0o600 });
  }
}

async function start(instance) {
  const template = flag('--template', 'blog');
  if (has('--init') || args.length === 0) await initialize(instance, template);
  await ensureRuntime(instance);
  const port = flag('--port', '3000');
  const env = { ...process.env, PORT: port, PORTABLE_CORE_DATA_DIR: path.relative(repoRoot, dataPath(instance)) };
  const child = spawn('pnpm', ['dev'], { cwd: repoRoot, env, stdio: 'inherit', detached: process.platform !== 'win32' });
  await writeFile(path.join(dataPath(instance), 'runtime', 'web.pid'), String(child.pid));
  console.log(`Portable Core is starting.\n\nSite:       http://127.0.0.1:${port}\nAdmin:      http://127.0.0.1:${port}/admin\nSetup page: http://127.0.0.1:${port}/setup\nData dir:   ${dataPath(instance)}\n`);
  child.on('exit', (code) => process.exitCode = code ?? 0);
}

async function status(instance) {
  try { const state = await readState(instance); console.log(JSON.stringify({ running: true, setupComplete: state.setupComplete, site: state.site.name, type: state.site.type, version }, null, 2)); } catch { console.log(JSON.stringify({ running: false, version }, null, 2)); }
}
async function stop(instance) { try { const pid = Number(await readFile(path.join(dataPath(instance), 'runtime', 'web.pid'), 'utf8')); process.kill(-pid, 'SIGTERM'); console.log('Portable Core stopped.'); } catch { console.log('Portable Core is not running.'); } }
async function logs(instance) { try { const value = await readFile(path.join(dataPath(instance), 'runtime', 'web.log'), 'utf8'); console.log(value.split('\n').slice(-40).join('\n')); } catch { console.log('No local runtime log found. Docker deployments use: docker compose logs -f web'); } }
async function backup(instance) { const source = statePath(instance); const target = path.join(dataPath(instance), 'backups', `site-${Date.now()}.json`); await copyFile(source, target); console.log(target); }
async function upgrade(instance, targetVersion) {
  const requestedVersion = targetVersion || version;
  if (requestedVersion !== version) throw new Error(`Unsupported upgrade target ${requestedVersion}; this checkout provides ${version}`);
  await ensureRuntime(instance);
  const state = await readState(instance);
  const backupTarget = path.join(dataPath(instance), 'backups', `pre-upgrade-${Date.now()}.json`);
  await copyFile(statePath(instance), backupTarget);
  state.migrations ??= [];
  if (!state.migrations.some((migration) => migration.version === 1)) state.migrations.push({ publicId: crypto.randomUUID(), version: 1, appliedAt: Date.now() });
  await writeFile(statePath(instance), JSON.stringify(state, null, 2), { mode: 0o600 });
  const lockFile = path.join(instance, 'core.lock');
  const lock = JSON.parse(await readFile(lockFile, 'utf8').catch(() => JSON.stringify({ coreVersion: version, releaseDigest: 'sha256:local-development', packFormatVersions: [1], minimumReaderVersion: version })));
  lock.coreVersion = version;
  lock.releaseDigest = 'sha256:local-development';
  await writeFile(lockFile, JSON.stringify(lock, null, 2));
  console.log(`Upgraded ${instance} to ${version}. Pre-upgrade backup: ${backupTarget}`);
}

function publicMedia(asset) { return { publicId: asset.publicId, digest: asset.digest, mediaType: asset.mediaType, byteSize: asset.byteSize, width: asset.width, height: asset.height, originalMediaType: asset.originalMediaType ?? asset.mediaType, originalByteSize: asset.originalByteSize ?? asset.byteSize, originalDigest: asset.originalDigest ?? asset.digest, status: asset.status, createdBy: asset.createdBy, createdAt: asset.createdAt, updatedAt: asset.updatedAt }; }
function extensionForMediaType(mediaType) { return mediaType === 'image/jpeg' ? 'jpg' : mediaType === 'image/avif' ? 'avif' : mediaType.split('/')[1] || 'bin'; }

async function makePublicPack(state, instance) {
  const records = {
    'records/site.json': bytes(JSON.stringify(state.site)),
    'records/settings.jsonl': bytes(jsonl([{ publicId: state.site.publicId, locale: state.site.locale, timezone: state.site.timezone, publicUrl: state.site.publicUrl, settingsVersion: state.site.settingsVersion }])),
    'records/migration.jsonl': bytes(jsonl(state.migrations ?? [])),
    'records/users-public.jsonl': bytes(jsonl(state.users.map((user) => ({ publicId: user.publicId, displayName: user.displayName, avatarAssetId: user.avatarAssetId, status: user.status, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt })))),
    'records/roles.jsonl': bytes(jsonl(state.users.map((user) => ({ publicId: user.publicId, role: user.role })))),
    'records/tags.jsonl': bytes(jsonl(state.tags ?? [])),
    'records/blog-posts.jsonl': bytes(jsonl(state.posts)), 'records/blog-revisions.jsonl': bytes(jsonl(state.postRevisions ?? [])), 'records/forum-categories.jsonl': bytes(jsonl(state.categories ?? [])), 'records/forum-threads.jsonl': bytes(jsonl(state.threads)), 'records/forum-posts.jsonl': bytes(jsonl(state.replies)), 'records/forum-reactions.jsonl': bytes(jsonl(state.reactions ?? [])), 'records/forum-read-state.jsonl': bytes(jsonl(state.readStates ?? [])), 'records/forum-reports.jsonl': bytes(jsonl(state.reports ?? [])), 'records/showcase-projects.jsonl': bytes(jsonl(state.projects)), 'records/showcase-inquiries.jsonl': bytes(jsonl(state.inquiries)), 'records/notifications.jsonl': bytes(jsonl(state.notifications)), 'records/moderation.jsonl': bytes(jsonl(state.moderationActions ?? [])), 'records/audit.jsonl': bytes(jsonl(state.audit)), 'records/assets/index.jsonl': bytes(jsonl((state.media ?? []).map(publicMedia))),
  };
  for (const asset of (state.media ?? []).filter((candidate) => candidate.status === 'ready')) {
    const source = asset.storagePath || path.join(dataPath(instance), 'media', `${asset.publicId}.${extensionForMediaType(asset.mediaType)}`);
    records[`assets/sha256/${asset.digest.slice(0, 2)}/${asset.digest}`] = new Uint8Array(await readFile(source));
  }
  const files = Object.entries(records).map(([file, value]) => ({ path: file, size: value.byteLength, sha256: hash(value) }));
  const manifest = { format: 'portable-core.pack', formatVersion: 1, contentSchemaVersion: 1, minimumReaderVersion: version, createdByVersion: version, createdAt: new Date().toISOString(), packKind: 'public', site: { id: state.site.publicId, name: state.site.name, type: state.site.type }, core: { version, releaseDigest: 'sha256:local-development' }, files };
  return zipSync({ 'manifest.json': bytes(JSON.stringify(manifest, null, 2)), ...records }, { level: 6 });
}

async function pack(instance, output) { const state = await readState(instance); const destination = path.resolve(process.cwd(), output ?? path.join(dataPath(instance), 'packs', 'site.pcpack')); await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, await makePublicPack(state, instance)); console.log(destination); }
async function restore(instance, packFile) {
  await ensureRuntime(instance);
  const source = path.resolve(process.cwd(), packFile);
  const files = unzipSync(new Uint8Array(await readFile(source)));
  if (!files['manifest.json']) throw new Error('Pack manifest is missing');
  const manifest = JSON.parse(text(files['manifest.json']));
  if (manifest.format !== 'portable-core.pack' || manifest.formatVersion !== 1 || manifest.packKind !== 'public') throw new Error('Unsupported public pack');
  const allowed = new Set(['records/site.json', 'records/settings.jsonl', 'records/migration.jsonl', 'records/users-public.jsonl', 'records/roles.jsonl', 'records/tags.jsonl', 'records/blog-posts.jsonl', 'records/blog-revisions.jsonl', 'records/forum-categories.jsonl', 'records/forum-threads.jsonl', 'records/forum-posts.jsonl', 'records/forum-reactions.jsonl', 'records/forum-read-state.jsonl', 'records/forum-reports.jsonl', 'records/showcase-projects.jsonl', 'records/showcase-inquiries.jsonl', 'records/notifications.jsonl', 'records/moderation.jsonl', 'records/audit.jsonl', 'records/assets/index.jsonl']);
  for (const file of manifest.files) {
    const value = files[file.path];
    const isAsset = /^assets\/sha256\/[0-9a-f]{2}\/[0-9a-f]{64}$/.test(file.path);
    if ((!allowed.has(file.path) && !isAsset) || file.path.startsWith('/') || file.path.includes('..')) throw new Error(`Unsafe pack path: ${file.path}`);
    if (!value || hash(value) !== file.sha256 || value.byteLength !== file.size) throw new Error(`Checksum failed: ${file.path}`);
  }
  const rows = (name) => text(files[name] ?? bytes('')).split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const current = await readState(instance).catch(() => ({ credentials: [], sessions: [], mutations: [] }));
  const state = { ...current, site: JSON.parse(text(files['records/site.json'])), setupComplete: true, users: rows('records/users-public.jsonl').map((user) => ({ ...user, emailNormalized: '', status: 'active' })), migrations: rows('records/migration.jsonl'), tags: rows('records/tags.jsonl'), posts: rows('records/blog-posts.jsonl'), postRevisions: rows('records/blog-revisions.jsonl'), categories: rows('records/forum-categories.jsonl'), threads: rows('records/forum-threads.jsonl'), replies: rows('records/forum-posts.jsonl'), readStates: rows('records/forum-read-state.jsonl'), reactions: rows('records/forum-reactions.jsonl'), reports: rows('records/forum-reports.jsonl'), moderationActions: rows('records/moderation.jsonl'), projects: rows('records/showcase-projects.jsonl'), inquiries: rows('records/showcase-inquiries.jsonl'), notifications: rows('records/notifications.jsonl'), audit: rows('records/audit.jsonl'), media: rows('records/assets/index.jsonl').map((asset) => ({ ...asset, storageId: null, storagePath: '' })), credentials: [], sessions: [], mutations: [] };
  await mkdir(path.join(dataPath(instance), 'media'), { recursive: true });
  for (const asset of state.media.filter((candidate) => candidate.status === 'ready')) {
    const content = files[`assets/sha256/${asset.digest.slice(0, 2)}/${asset.digest}`];
    if (!content) throw new Error(`Asset bytes are missing: ${asset.publicId}`);
    asset.storagePath = path.join(dataPath(instance), 'media', `${asset.publicId}.${extensionForMediaType(asset.mediaType)}`);
    await writeFile(asset.storagePath, content, { mode: 0o600 });
  }
  const stagingDirectory = path.join(dataPath(instance), 'staging', `restore-${Date.now()}`);
  await mkdir(stagingDirectory, { recursive: true });
  const stagedStatePath = path.join(stagingDirectory, 'site.json');
  await writeFile(stagedStatePath, JSON.stringify(state, null, 2), { mode: 0o600 });
  await rename(stagedStatePath, statePath(instance));
  await rm(stagingDirectory, { recursive: true, force: true });
  console.log(`Restored ${state.site.name} into ${instance} after staged validation.`);
}
async function destroy(instance) {
  if (!has('--confirm')) { fail('destroy requires --confirm'); return; }
  const backupDirectory = path.join(dataPath(instance), 'backups');
  const backups = await readdir(backupDirectory).catch(() => []);
  let recentBackup = false;
  for (const entry of backups) {
    const info = await stat(path.join(backupDirectory, entry)).catch(() => null);
    if (info?.isFile() && Date.now() - info.mtimeMs < 24 * 60 * 60 * 1000) recentBackup = true;
  }
  if (!recentBackup && !has('--confirm-destructive')) { fail('No recent backup found. Run backup create or add --confirm-destructive'); return; }
  await rm(dataPath(instance), { recursive: true, force: true });
  console.log(`Removed ${dataPath(instance)}`);
}

function help() { console.log(`Portable Core ${version}\n\nCommands:\n  start <instance> --init --template blog|forum|showcase\n  status <instance>\n  stop <instance>\n  logs <instance>\n  backup create <instance>\n  pack create <instance> [output.pcpack]\n  restore <instance> <pack.pcpack>\n  upgrade <instance> --to <version>\n  destroy <instance> --confirm [--confirm-destructive]`); }

if (command === 'start') await start(instancePath(args.shift()));
else if (command === 'status') await status(instancePath(args.shift()));
else if (command === 'stop') await stop(instancePath(args.shift()));
else if (command === 'logs') await logs(instancePath(args.shift()));
else if (command === 'backup' && args.shift() === 'create') await backup(instancePath(args.shift()));
else if (command === 'pack' && args.shift() === 'create') await pack(instancePath(args.shift()), args.shift());
else if (command === 'restore') await restore(instancePath(args.shift()), args.shift());
else if (command === 'upgrade') await upgrade(instancePath(args.shift()), flag('--to'));
else if (command === 'destroy') await destroy(instancePath(args.shift()));
else if (command === 'help' || !command) help();
else fail(`Unknown command: ${command}`);
