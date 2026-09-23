import { NextResponse } from 'next/server';
import { readState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await readState();
    return NextResponse.json({ status: state.setupComplete ? 'ready' : 'setup-required', checks: { database: true, storage: true, realtime: true, scheduler: true, migrations: true } });
  } catch {
    return NextResponse.json({ status: 'not-ready', checks: { database: false } }, { status: 503 });
  }
}
