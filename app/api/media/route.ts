import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { processImageUpload, extensionForMediaType } from '@/lib/media';
import { incrementCounter } from '@/lib/metrics';
import { enforceRateLimit, rateLimitHeaders, requestFingerprint } from '@/lib/rate-limit';
import { currentUser, hasRole, id, mediaDirectoryPath, publicState, readState, recordAudit, writeState } from '@/lib/store';
import type { MediaAsset } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) throw new Error('Cross-origin request rejected');
    const rate = enforceRateLimit(`media:${requestFingerprint(request)}`, 20, 60_000);
    if (!rate.allowed) {
      incrementCounter('rateLimitRejections');
      return NextResponse.json({ error: 'Too many upload requests' }, { status: 429, headers: rateLimitHeaders(20, rate.remaining, rate.retryAfterSeconds) });
    }
    incrementCounter('requests');
    const state = await readState();
    const user = await currentUser(state, request.headers.get('cookie')?.match(/(?:^|;\s*)pc_session=([^;]+)/)?.[1]);
    if (!user || !hasRole(user, ['owner', 'administrator', 'editor', 'author'])) return NextResponse.json({ error: 'You do not have permission to upload media' }, { status: 403 });
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return NextResponse.json({ error: 'A file is required' }, { status: 400 });
    const input = new Uint8Array(await file.arrayBuffer());
    const processed = await processImageUpload(input, file.type);
    const existing = state.media.find((asset) => asset.digest === processed.digest && asset.status === 'ready');
    if (existing) return NextResponse.json({ result: { ok: true, asset: publicAsset(existing) }, state: publicState(state, user) });
    await mkdir(mediaDirectoryPath, { recursive: true });
    const publicId = id();
    const storagePath = path.join(mediaDirectoryPath, `${publicId}.${extensionForMediaType(processed.mediaType)}`);
    await writeFile(storagePath, processed.bytes, { flag: 'wx', mode: 0o600 });
    const timestamp = Date.now();
    const asset: MediaAsset = { publicId, digest: processed.digest, mediaType: processed.mediaType, byteSize: processed.bytes.length, width: processed.width, height: processed.height, storageId: null, storagePath, originalMediaType: processed.originalMediaType, originalByteSize: processed.originalByteSize, originalDigest: processed.originalDigest, status: 'ready', createdBy: user.publicId, createdAt: timestamp, updatedAt: timestamp };
    state.media.push(asset);
    recordAudit(state, user.publicId, 'media.upload', 'asset', asset.publicId, { mediaType: asset.mediaType, byteSize: asset.byteSize, compressed: processed.compressed });
    await writeState(state);
    return NextResponse.json({ result: { ok: true, asset: publicAsset(asset) }, state: publicState(state, user) }, { status: 201 });
  } catch (error) {
    incrementCounter('storageErrors');
    const message = error instanceof Error ? error.message : 'Media upload failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function publicAsset(asset: MediaAsset) {
  return { publicId: asset.publicId, digest: asset.digest, mediaType: asset.mediaType, byteSize: asset.byteSize, url: `/api/media/${asset.publicId}`, width: asset.width, height: asset.height, status: asset.status, createdBy: asset.createdBy, createdAt: asset.createdAt, updatedAt: asset.updatedAt };
}
