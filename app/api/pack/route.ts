import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createPublicPack, restoreOperatorPack, restorePublicPack } from '@/lib/pack';
import { incrementCounter } from '@/lib/metrics';
import { enforceRateLimit, rateLimitHeaders, requestFingerprint } from '@/lib/rate-limit';
import { currentUser, readState, writeState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const rate = enforceRateLimit(`pack-export:${requestFingerprint(request)}`, 5, 60_000);
    if (!rate.allowed) {
      incrementCounter('rateLimitRejections');
      return NextResponse.json({ error: 'Too many pack exports' }, { status: 429, headers: rateLimitHeaders(5, rate.remaining, rate.retryAfterSeconds) });
    }
    const cookieStore = await cookies();
    const state = await readState();
    const user = await currentUser(state, cookieStore.get('pc_session')?.value);
    if (!user || !['owner', 'administrator'].includes(user.role)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    const pack = await createPublicPack(state);
    return new NextResponse(Buffer.from(pack), { headers: { 'content-type': 'application/vnd.portable-core.pack+zip', 'content-disposition': `attachment; filename="${state.site.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'site'}.pcpack"`, 'cache-control': 'no-store' } });
  } catch (error) {
    console.error(JSON.stringify({ event: 'pack.export.failed', error: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pack export failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const origin = request.headers.get('origin');
    const host = request.headers.get('host');
    if (origin && host && new URL(origin).host !== host) throw new Error('Cross-origin request rejected');
    const rate = enforceRateLimit(`pack:${requestFingerprint(request)}`, 5, 60_000);
    if (!rate.allowed) {
      incrementCounter('rateLimitRejections');
      return NextResponse.json({ error: 'Too many pack operations' }, { status: 429, headers: rateLimitHeaders(5, rate.remaining, rate.retryAfterSeconds) });
    }
    const cookieStore = await cookies();
    const state = await readState();
    const user = await currentUser(state, cookieStore.get('pc_session')?.value);
    if (!user || !['owner', 'administrator'].includes(user.role)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    const pack = new Uint8Array(await request.arrayBuffer());
    const operatorPassphrase = request.headers.get('x-portable-core-operator-passphrase');
    if (operatorPassphrase) await restoreOperatorPack(pack, operatorPassphrase, state);
    else await restorePublicPack(pack, state);
    await writeState(state);
    return NextResponse.json({ ok: true, site: state.site });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pack restore failed' }, { status: 400 });
  }
}
