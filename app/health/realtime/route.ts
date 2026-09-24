import { NextResponse } from 'next/server';
import { convexConfigured } from '@/lib/runtime';

export function GET() {
  return NextResponse.json({ status: 'ok', transport: convexConfigured() ? 'websocket' : 'local-refresh', provider: convexConfigured() ? 'convex' : 'local-broadcast', delivery: 'reactive-query' });
}
