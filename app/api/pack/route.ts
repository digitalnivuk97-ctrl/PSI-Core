import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createPublicPack, restoreOperatorPack, restorePublicPack } from '@/lib/pack';
import { currentUser, readState, writeState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const state = await readState();
    const user = await currentUser(state, cookieStore.get('pc_session')?.value);
    if (!user || !['owner', 'administrator'].includes(user.role)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    const pack = createPublicPack(state);
    return new NextResponse(Buffer.from(pack), { headers: { 'content-type': 'application/vnd.portable-core.pack+zip', 'content-disposition': `attachment; filename="${state.site.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase() || 'site'}.pcpack"`, 'cache-control': 'no-store' } });
  } catch (error) {
    console.error(JSON.stringify({ event: 'pack.export.failed', error: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pack export failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const state = await readState();
    const user = await currentUser(state, cookieStore.get('pc_session')?.value);
    if (!user || !['owner', 'administrator'].includes(user.role)) return NextResponse.json({ error: 'Administrator access required' }, { status: 403 });
    const pack = new Uint8Array(await request.arrayBuffer());
    const operatorPassphrase = request.headers.get('x-portable-core-operator-passphrase');
    if (operatorPassphrase) restoreOperatorPack(pack, operatorPassphrase, state);
    else restorePublicPack(pack, state);
    await writeState(state);
    return NextResponse.json({ ok: true, site: state.site });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Pack restore failed' }, { status: 400 });
  }
}
