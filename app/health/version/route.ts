import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export function GET() {
  return NextResponse.json({ service: 'portable-core', version: '0.1.0', contentSchemaVersion: 1, packFormatVersions: [1], backend: { type: 'convex', mode: process.env.NEXT_PUBLIC_CONVEX_URL ? 'self-hosted' : 'local-adapter' } });
}
