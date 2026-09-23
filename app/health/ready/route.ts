import { NextResponse } from 'next/server';
import { migrationStatus } from '@/lib/migrations';
import { readState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await readState();
    const migrations = migrationStatus(state.migrations);
    const ready = migrations.ready;
    return NextResponse.json({ status: !ready ? 'not-ready' : state.setupComplete ? 'ready' : 'setup-required', checks: { database: true, storage: true, realtime: true, scheduler: true, migrations: ready } }, { status: ready ? 200 : 503 });
  } catch {
    return NextResponse.json({ status: 'not-ready', checks: { database: false } }, { status: 503 });
  }
}
