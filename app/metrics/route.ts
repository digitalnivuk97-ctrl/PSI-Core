import { NextResponse } from 'next/server';
import { renderPrometheus } from '@/lib/metrics';

export const dynamic = 'force-dynamic';

export function GET() {
  return new NextResponse(renderPrometheus(), { headers: { 'content-type': 'text/plain; version=0.0.4; charset=utf-8', 'cache-control': 'no-store' } });
}
