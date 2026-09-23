import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { extensionForMediaType } from '@/lib/media';
import { currentUser, hasRole, mediaDirectoryPath, readState, recordAudit, writeState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function DELETE(request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (origin && host && new URL(origin).host !== host) return NextResponse.json({ error: 'Cross-origin request rejected' }, { status: 403 });
  const state = await readState();
  const token = request.headers.get('cookie')?.match(/(?:^|;\s*)pc_session=([^;]+)/)?.[1];
  const user = await currentUser(state, token);
  if (!user || !hasRole(user, ['owner', 'administrator', 'editor'])) return NextResponse.json({ error: 'You do not have permission to delete media' }, { status: 403 });
  const asset = state.media.find((candidate) => candidate.publicId === publicId);
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  asset.status = 'deleted';
  asset.updatedAt = Date.now();
  recordAudit(state, user.publicId, 'media.delete', 'asset', asset.publicId);
  await writeState(state);
  return NextResponse.json({ ok: true });
}

export async function GET(_request: Request, { params }: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await params;
  const state = await readState();
  const asset = state.media.find((candidate) => candidate.publicId === publicId && candidate.status === 'ready');
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  const candidates = [asset.storagePath, path.join(mediaDirectoryPath, `${asset.publicId}.${extensionForMediaType(asset.mediaType)}`)];
  for (const candidatePath of candidates) {
    if (!candidatePath) continue;
    const storagePath = path.resolve(candidatePath);
    if (!storagePath.startsWith(`${path.resolve(mediaDirectoryPath)}${path.sep}`)) continue;
    try {
      const bytes = await readFile(storagePath);
      return new NextResponse(bytes, { headers: { 'content-type': asset.mediaType, 'content-disposition': `inline; filename="${asset.publicId}.${extensionForMediaType(asset.mediaType)}"`, 'cache-control': 'public, max-age=31536000, immutable', 'x-content-type-options': 'nosniff' } });
    } catch {
      continue;
    }
  }
  return NextResponse.json({ error: 'Asset bytes are missing' }, { status: 404 });
}
