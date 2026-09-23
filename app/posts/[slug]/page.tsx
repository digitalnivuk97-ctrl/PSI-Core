import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readState } from '@/lib/store';

export const dynamic = 'force-dynamic';

function escape(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
}

function markdown(value: string) {
  return escape(value).split(/\n{2,}/).map((block) => block.startsWith('# ') ? `<h1>${block.slice(2)}</h1>` : block.startsWith('## ') ? `<h2>${block.slice(3)}</h2>` : `<p>${block.replace(/\n/g, '<br>')}</p>`).join('');
}

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const state = await readState();
  const post = state.posts.find((candidate) => candidate.slug === slug && candidate.status === 'published' && !candidate.deletedAt);
  if (!post) notFound();
  return <main className="container"><p className="eyebrow"><Link href="/">← {state.site.name}</Link></p><article className="card panel" style={{ maxWidth: 780, margin: '0 auto' }}><span className="badge">{post.status}</span><h1 style={{ fontSize: 'clamp(38px, 7vw, 68px)', marginTop: 18 }}>{post.title}</h1><p className="hero-copy">{post.excerpt}</p><div className="markdown" style={{ marginTop: 30 }} dangerouslySetInnerHTML={{ __html: markdown(post.bodyMarkdown) }} /></article></main>;
}
