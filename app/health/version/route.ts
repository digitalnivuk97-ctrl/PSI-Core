import { NextResponse } from 'next/server';
import { convexConfigured } from '@/lib/runtime';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ service: 'portable-core', version: '0.1.0', contentSchemaVersion: 1, packFormatVersions: [1], backend: { type: 'convex', mode: convexConfigured() ? 'self-hosted' : 'local-adapter' } });
}
