import { NextResponse } from 'next/server';
import { migrationStatus } from '@/lib/migrations';
import { productionReadiness } from '@/lib/runtime';
import { readState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const state = await readState();
    const migrations = migrationStatus(state.migrations);
    const runtime = productionReadiness();
    const checks = { database: true, storage: true, realtime: !runtime.convexRequired || runtime.convex, scheduler: !runtime.convexRequired || runtime.convex, migrations: migrations.ready, https: !runtime.httpsRequired || runtime.https };
    const ready = Object.values(checks).every(Boolean);
    return NextResponse.json({ status: !ready ? 'not-ready' : state.setupComplete ? 'ready' : 'setup-required', checks }, { status: ready ? 200 : 503 });
  } catch {
    return NextResponse.json({ status: 'not-ready', checks: { database: false } }, { status: 503 });
  }
}
