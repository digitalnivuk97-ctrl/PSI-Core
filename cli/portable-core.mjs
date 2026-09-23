#!/usr/bin/env node
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
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
    await writeFile(statePath(instance), JSON.stringify({ site, setupComplete: false, setupToken: `${randomBytes(3).toString('hex').toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`, users: [], credentials: [], sessions: [], posts: [], threads: [], replies: [], projects: [], inquiries: [], notifications: [], audit: [], mutations: [], media: [] }, null, 2), { mode: 0o600 });
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

function makePublicPack(state) {
  const records = {
    'records/site.json': bytes(JSON.stringify(state.site)),
    'records/settings.jsonl': bytes(jsonl([{ publicId: state.site.publicId, locale: state.site.locale, timezone: state.site.timezone, publicUrl: state.site.publicUrl, settingsVersion: state.site.settingsVersion }])),
    'records/users-public.jsonl': bytes(jsonl(state.users.map((user) => ({ publicId: user.publicId, displayName: user.displayName, avatarAssetId: user.avatarAssetId, status: user.status, role: user.role, createdAt: user.createdAt, updatedAt: user.updatedAt })))),
    'records/roles.jsonl': bytes(jsonl(state.users.map((user) => ({ publicId: user.publicId, role: user.role })))),
    'records/blog-posts.jsonl': bytes(jsonl(state.posts)), 'records/forum-categories.jsonl': bytes(''), 'records/forum-threads.jsonl': bytes(jsonl(state.threads)), 'records/forum-posts.jsonl': bytes(jsonl(state.replies)), 'records/showcase-projects.jsonl': bytes(jsonl(state.projects)), 'records/showcase-inquiries.jsonl': bytes(jsonl(state.inquiries)), 'records/notifications.jsonl': bytes(jsonl(state.notifications)), 'records/moderation.jsonl': bytes(''), 'records/audit.jsonl': bytes(jsonl(state.audit)), 'records/assets/index.jsonl': bytes(jsonl(state.media)),
  };
  const files = Object.entries(records).map(([file, value]) => ({ path: file, size: value.byteLength, sha256: hash(value) }));
  const manifest = { format: 'portable-core.pack', formatVersion: 1, contentSchemaVersion: 1, minimumReaderVersion: version, createdByVersion: version, createdAt: new Date().toISOString(), packKind: 'public', site: { id: state.site.publicId, name: state.site.name, type: state.site.type }, core: { version, releaseDigest: 'sha256:local-development' }, files };
  return zipSync({ 'manifest.json': bytes(JSON.stringify(manifest, null, 2)), ...records }, { level: 6 });
}

async function pack(instance, output) { const state = await readState(instance); const destination = path.resolve(process.cwd(), output ?? path.join(dataPath(instance), 'packs', 'site.pcpack')); await mkdir(path.dirname(destination), { recursive: true }); await writeFile(destination, makePublicPack(state)); console.log(destination); }
async function restore(instance, packFile) {
  await ensureRuntime(instance);
  const source = path.resolve(process.cwd(), packFile);
  const files = unzipSync(new Uint8Array(await readFile(source)));
  if (!files['manifest.json']) throw new Error('Pack manifest is missing');
  const manifest = JSON.parse(text(files['manifest.json']));
  if (manifest.format !== 'portable-core.pack' || manifest.formatVersion !== 1 || manifest.packKind !== 'public') throw new Error('Unsupported public pack');
  const allowed = new Set(['records/site.json', 'records/settings.jsonl', 'records/users-public.jsonl', 'records/roles.jsonl', 'records/blog-posts.jsonl', 'records/blog-revisions.jsonl', 'records/forum-categories.jsonl', 'records/forum-threads.jsonl', 'records/forum-posts.jsonl', 'records/forum-reactions.jsonl', 'records/forum-read-state.jsonl', 'records/showcase-projects.jsonl', 'records/showcase-inquiries.jsonl', 'records/notifications.jsonl', 'records/moderation.jsonl', 'records/audit.jsonl', 'records/assets/index.jsonl']);
  for (const file of manifest.files) {
    const value = files[file.path];
    if (!allowed.has(file.path) || file.path.startsWith('/') || file.path.includes('..')) throw new Error(`Unsafe pack path: ${file.path}`);
    if (!value || hash(value) !== file.sha256 || value.byteLength !== file.size) throw new Error(`Checksum failed: ${file.path}`);
  }
  const rows = (name) => text(files[name] ?? bytes('')).split('\n').filter(Boolean).map((line) => JSON.parse(line));
  const current = await readState(instance).catch(() => ({ credentials: [], sessions: [], mutations: [] }));
  const state = { ...current, site: JSON.parse(text(files['records/site.json'])), setupComplete: true, users: rows('records/users-public.jsonl').map((user) => ({ ...user, emailNormalized: '', status: 'active' })), posts: rows('records/blog-posts.jsonl'), threads: rows('records/forum-threads.jsonl'), replies: rows('records/forum-posts.jsonl'), projects: rows('records/showcase-projects.jsonl'), inquiries: rows('records/showcase-inquiries.jsonl'), notifications: rows('records/notifications.jsonl'), audit: rows('records/audit.jsonl'), media: rows('records/assets/index.jsonl'), credentials: [], sessions: [], mutations: [] };
  await writeFile(statePath(instance), JSON.stringify(state, null, 2), { mode: 0o600 });
  console.log(`Restored ${state.site.name} into ${instance}.`);
}
async function destroy(instance) { if (!has('--confirm')) { fail('destroy requires --confirm'); return; } await rm(dataPath(instance), { recursive: true, force: true }); console.log(`Removed ${dataPath(instance)}`); }

function help() { console.log(`Portable Core ${version}\n\nCommands:\n  start <instance> --init --template blog|forum|showcase\n  status <instance>\n  stop <instance>\n  logs <instance>\n  backup create <instance>\n  pack create <instance> [output.pcpack]\n  restore <instance> <pack.pcpack>\n  destroy <instance> --confirm`); }

if (command === 'start') await start(instancePath(args.shift()));
else if (command === 'status') await status(instancePath(args.shift()));
else if (command === 'stop') await stop(instancePath(args.shift()));
else if (command === 'logs') await logs(instancePath(args.shift()));
else if (command === 'backup' && args.shift() === 'create') await backup(instancePath(args.shift()));
else if (command === 'pack' && args.shift() === 'create') await pack(instancePath(args.shift()), args.shift());
else if (command === 'restore') await restore(instancePath(args.shift()), args.shift());
else if (command === 'destroy') await destroy(instancePath(args.shift()));
else if (command === 'help' || !command) help();
else fail(`Unknown command: ${command}`);
