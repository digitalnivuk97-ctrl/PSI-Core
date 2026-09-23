import { NextResponse } from 'next/server';

export function GET() {
  return NextResponse.json({ status: 'ok', transport: 'websocket', provider: process.env.NEXT_PUBLIC_CONVEX_URL ? 'convex' : 'local-broadcast', delivery: 'reactive-query' });
}
