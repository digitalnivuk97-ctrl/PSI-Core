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
  return <div className="shell"><header className="topbar"><div className="topbar-inner"><Link className="brand" href="/"><span className="brand-mark">P</span><span>{state.site.name}<small>Journal</small></span></Link><nav className="site-nav"><Link className="active" href="/posts">All posts</Link><Link href="/">Home</Link></nav><div className="top-actions"><Link className="button secondary" href="/admin">Admin</Link></div></div></header><main className="container"><div className="section-head"><div><p className="eyebrow">Journal</p><h1 style={{ fontSize: 'clamp(42px, 7vw, 72px)' }}>Posts</h1><p>Notes, updates, and published work.</p></div><span className="badge">{posts.length} entries</span></div>{posts.length === 0 ? <div className="empty">No published posts yet.</div> : <div className="grid">{posts.map((post) => { const featured = state.media.find((asset) => asset.publicId === post.featuredAssetId && asset.status === 'ready'); return <article className="card content-card" key={post.publicId}>{featured && <div className="media-frame"><Image src={`/api/media/${featured.publicId}`} alt="" width={featured.width ?? 800} height={featured.height ?? 450} sizes="(max-width: 680px) 100vw, 33vw" /></div>}<div className="card-meta"><span>{new Date(post.publishedAt ?? post.createdAt).toLocaleDateString()}</span><span className="badge">published</span></div><h2 className="card-title"><Link href={`/posts/${post.slug}`}>{post.title}</Link></h2><p className="card-summary">{post.excerpt}</p><div className="card-footer"><span className="tiny">Read post →</span></div></article>; })}</div>}</main></div>;
}
