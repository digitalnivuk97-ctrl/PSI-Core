import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { readState } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const state = await readState();
  return { title: `Posts · ${state.site.name}`, description: `Latest posts from ${state.site.name}.` };
}

export default async function PostsPage() {
  const state = await readState();
  const posts = state.posts.filter((post) => post.status === 'published' && !post.deletedAt).sort((left, right) => (right.publishedAt ?? right.createdAt) - (left.publishedAt ?? left.createdAt));
  return <main className="container"><p className="eyebrow"><Link href="/">← {state.site.name}</Link></p><div className="section-head"><div><h1>Posts</h1><p>Notes, updates, and published work.</p></div><span className="badge">{posts.length} entries</span></div>{posts.length === 0 ? <div className="empty">No published posts yet.</div> : <div className="grid">{posts.map((post) => { const featured = state.media.find((asset) => asset.publicId === post.featuredAssetId && asset.status === 'ready'); return <article className="card content-card" key={post.publicId}>{featured && <Image src={`/api/media/${featured.publicId}`} alt="" width={featured.width ?? 800} height={featured.height ?? 450} sizes="(max-width: 800px) 100vw, 33vw" style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 12, marginBottom: 18 }} />}<div className="card-meta"><span>{new Date(post.publishedAt ?? post.createdAt).toLocaleDateString()}</span><span className="badge">published</span></div><h2 className="card-title"><Link href={`/posts/${post.slug}`}>{post.title}</Link></h2><p className="card-summary">{post.excerpt}</p><div className="card-footer"><span className="tiny muted">Read post →</span></div></article>; })}</div>}</main>;
}
