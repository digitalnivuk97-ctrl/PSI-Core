import { NextResponse } from 'next/server';
import { readState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const state = await readState();
  const base = state.site.publicUrl.replace(/\/$/, '');
  const urls = state.posts.filter((post) => post.status === 'published' && !post.deletedAt).map((post) => `<url><loc>${base}/posts/${post.slug}</loc>${post.updatedAt ? `<lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>` : ''}</url>`).join('');
  return new NextResponse(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${base}</loc></url>${urls}</urlset>`, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'no-store' } });
}
