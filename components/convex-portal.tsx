'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from 'convex/react';
import { anyApi } from 'convex/server';
import type { PublicState } from '@/lib/types';
import { formatDate } from './realtime';

const convexApi = anyApi;

export default function ConvexPortal() {
  const state = useQuery(convexApi.portal.publicSnapshot) as PublicState | undefined;
  if (!state) return <div className="container"><div className="empty">Connecting to the Convex site…</div></div>;
  return <div className="shell"><header className="topbar"><Link className="brand" href="/"><span className="brand-mark">P</span><span>{state.site.name}<small>Convex realtime</small></span></Link><div className="top-actions"><span className="live-dot">live</span><Link className="button secondary" href="/admin">Admin</Link></div></header><main className="container"><section className="hero"><div><p className="eyebrow">{state.site.type} · Convex</p><h1>{state.site.name}</h1></div><div className="hero-copy"><p><strong>{state.site.name}</strong> is served by the configured Convex reactive query.</p><div className="hero-note">Connected clients receive the current authoritative view automatically.</div></div></section>{state.site.type === 'blog' && <div className="grid">{state.posts.map((post) => { const featured = state.media.find((asset) => asset.publicId === post.featuredAssetId); return <article className="card content-card" key={post.publicId}>{featured?.url && <Image src={featured.url} alt="" width={featured.width ?? 800} height={featured.height ?? 450} sizes="(max-width: 800px) 100vw, 33vw" style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 12, marginBottom: 18 }} />}<div className="card-meta"><span>{formatDate(post.publishedAt)}</span><span className="badge">live</span></div><h2 className="card-title">{post.title}</h2><p className="card-summary">{post.excerpt}</p></article>; })}</div>}{state.site.type === 'forum' && <div className="card panel">{state.threads.map((thread) => <div className="thread-row" key={thread.publicId}><div><div className="thread-title">{thread.title}</div><div className="thread-replies">{thread.postCount} posts · {formatDate(thread.lastPostAt)}</div></div><span className="badge">live</span></div>)}</div>}{state.site.type === 'showcase' && <div className="grid">{state.projects.map((project) => <article className="card content-card" key={project.publicId}><h2 className="card-title">{project.title}</h2><p className="card-summary">{project.summary}</p></article>)}</div>}</main></div>;
}
