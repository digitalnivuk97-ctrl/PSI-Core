import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { renderMarkdown } from '@/lib/markdown';
import { readState } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const state = await readState();
  const post = state.posts.find((candidate) => candidate.slug === slug && candidate.status === 'published' && !candidate.deletedAt);
  if (!post) return { title: state.site.name };
  return { title: `${post.title} · ${state.site.name}`, description: post.excerpt || undefined, alternates: { canonical: `/posts/${post.slug}` }, openGraph: { title: post.title, description: post.excerpt, type: 'article', publishedTime: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined, url: `/posts/${post.slug}` } };
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const state = await readState();
  const post = state.posts.find((candidate) => candidate.slug === slug && candidate.status === 'published' && !candidate.deletedAt);
  if (!post) notFound();
  const author = state.users.find((user) => user.publicId === post.authorId);
  const featured = state.media.find((asset) => asset.publicId === post.featuredAssetId && asset.status === 'ready');
  const tags = state.tags.filter((tag) => post.tagIds.includes(tag.publicId));
  return <div className="shell"><header className="topbar"><div className="topbar-inner"><Link className="brand" href="/"><span className="brand-mark">P</span><span>{state.site.name}<small>Journal</small></span></Link><nav className="site-nav"><Link className="active" href="/posts">All posts</Link><Link href="/">Home</Link></nav><div className="top-actions"><Link className="button secondary" href="/admin">Admin</Link></div></div></header><main className="container"><p className="eyebrow"><Link href="/posts">← Back to all posts</Link></p><article className="card panel" style={{ maxWidth: 820, margin: '0 auto' }}>{featured && <div className="media-frame" style={{ marginBottom: 24 }}><Image src={`/api/media/${featured.publicId}`} alt="" width={featured.width ?? 1200} height={featured.height ?? 675} sizes="(max-width: 800px) 100vw, 820px" priority /></div>}<span className="badge">{post.status}</span><h1 style={{ fontSize: 'clamp(38px, 7vw, 68px)', marginTop: 18 }}>{post.title}</h1><p className="hero-copy">{post.excerpt}</p><div className="row tiny" style={{ marginTop: 16 }}><span>{author?.displayName ?? 'Portable Core'}</span><span>·</span><span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ''}</span></div><div className="row" style={{ marginTop: 12 }}>{tags.map((tag) => <span className="badge muted" key={tag.publicId}>{tag.name}</span>)}</div><div className="markdown" style={{ marginTop: 30 }} dangerouslySetInnerHTML={{ __html: renderMarkdown(post.bodyMarkdown) }} /></article></main></div>;
}
