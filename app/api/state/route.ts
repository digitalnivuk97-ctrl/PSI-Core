import { NextResponse } from 'next/server';
import { currentUser, publicState, readState, writeState } from '@/lib/store';
import { cookies } from 'next/headers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const state = await readState();
    const duePosts = state.posts.filter((post) => post.status === 'draft' && post.scheduledFor && post.scheduledFor <= Date.now());
    if (duePosts.length > 0) {
      for (const post of duePosts) { post.status = 'published'; post.publishedAt ??= Date.now(); post.scheduledFor = null; post.updatedAt = Date.now(); }
      await writeState(state);
    }
    const user = await currentUser(state, cookieStore.get('pc_session')?.value);
    return NextResponse.json(publicState(state, user));
  } catch (error) {
    console.error(JSON.stringify({ event: 'state.read.failed', error: error instanceof Error ? error.message : 'unknown' }));
    return NextResponse.json({ error: 'Unable to read site state' }, { status: 500 });
  }
}
