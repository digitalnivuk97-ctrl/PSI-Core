import { NextResponse } from 'next/server';
import { readState } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function escapeXml(value: string) {
  return value.replace(/[<>&'\"]/g, (character) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ?? character);
}

export async function GET() {
  const state = await readState();
  const posts = state.posts.filter((post) => post.status === 'published' && !post.deletedAt).sort((left, right) => (right.publishedAt ?? 0) - (left.publishedAt ?? 0));
  const base = state.site.publicUrl.replace(/\/$/, '');
  const items = posts.map((post) => `<item><title>${escapeXml(post.title)}</title><link>${base}/posts/${escapeXml(post.slug)}</link><guid>${base}/posts/${escapeXml(post.slug)}</guid><description>${escapeXml(post.excerpt)}</description><pubDate>${new Date(post.publishedAt ?? post.createdAt).toUTCString()}</pubDate></item>`).join('');
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(state.site.name)}</title><link>${base}</link><description>${escapeXml(state.site.name)}</description>${items}</channel></rss>`;
  return new NextResponse(xml, { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'no-store' } });
}
