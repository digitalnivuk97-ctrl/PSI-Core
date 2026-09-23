'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import type { Post, Project, PublicState, Thread } from '@/lib/types';
import { formatDate, initials, safeMarkdown, useRealtimeState } from './realtime';

export default function Portal({ initialState }: { initialState?: PublicState }) {
  const { state, connection, error, act } = useRealtimeState(initialState);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [message, setMessage] = useState('');

  if (!state) return <div className="container"><div className="empty">Loading your site…</div></div>;
  if (!state.setupComplete) return <SetupRedirect />;

  const unread = state.notifications.filter((notification) => !notification.readAt).length;
  const user = state.currentUser;
  return (
    <div className="shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">P</span>
          <span>{state.site.name}<small>Portable Core</small></span>
        </Link>
        <div className="top-actions">
          <span className="live-dot" title={error || 'Connected'}>{connection}</span>
          {user ? <Link className="button secondary" href="/admin">Admin</Link> : <button className="button secondary" onClick={() => setShowLogin(true)}>Sign in</button>}
        </div>
      </header>
      <main className="container">
        <section className="hero">
          <div>
            <p className="eyebrow">{state.site.type} · {state.site.locale.toUpperCase()}</p>
            <h1>{heroTitle(state.site.name, state.site.type)}</h1>
          </div>
          <div className="hero-copy">
            <p><strong>{state.site.name}</strong> is a self-contained, realtime-first site powered by Portable Core.</p>
            <div className="hero-note">Every published change is delivered live to connected visitors. No refresh required.</div>
          </div>
        </section>

        {state.site.type === 'blog' && <BlogView posts={state.posts} tags={state.tags} media={state.media} onOpen={setSelectedPost} />}
        {state.site.type === 'forum' && <ForumView threads={state.threads} replies={state.replies} categories={state.categories} readStates={state.readStates} onOpen={(thread) => { setSelectedThread(thread); if (user) void act('forumPosts.markRead', { threadId: thread.publicId }); }} />}
        {state.site.type === 'showcase' && <ShowcaseView projects={state.projects} media={state.media} tags={state.tags} onOpen={setSelectedProject} onInquiry={async (payload) => { await act('inquiries.create', payload); setMessage('Thanks — your message is in the studio inbox.'); }} message={message} />}

        <section className="split" style={{ marginTop: 42 }}>
          <div className="card panel">
            <div className="row between"><div><h3>Live site stream</h3><p>Reactive state stays current across connected browsers.</p></div><span className="badge">WebSocket ready</span></div>
            <div className="stack" style={{ marginTop: 22 }}>
              <div className="notice">{state.site.type === 'forum' ? `${state.threads.length} conversations · ${state.replies.length} visible replies` : state.site.type === 'blog' ? `${state.posts.length} published entries` : `${state.projects.length} published projects`}</div>
              <p className="tiny muted">Connection: {connection} · IDs remain stable across portable exports · Last state refresh is automatic.</p>
            </div>
          </div>
          <div className="card panel">
            <div className="row between"><h3>{user ? `Hi, ${user.displayName}` : 'For operators'}</h3><span className="avatar">{user ? initials(user.displayName) : 'PC'}</span></div>
            {user ? <div className="stack" style={{ marginTop: 18 }}><p>{user.emailNormalized}</p><Link className="button" href="/admin">Open administration</Link></div> : <div className="stack" style={{ marginTop: 18 }}><p>Manage content, users, and portable backups from the secure workspace.</p><button className="button" onClick={() => setShowLogin(true)}>Sign in to continue</button></div>}
            {unread > 0 && <div className="notice" style={{ marginTop: 16 }}>{unread} unread notification{unread === 1 ? '' : 's'}</div>}
          </div>
        </section>
      </main>
      {selectedPost && <PostModal post={selectedPost} media={state.media} onClose={() => setSelectedPost(null)} />}
      {selectedProject && <ProjectModal project={selectedProject} media={state.media} onClose={() => setSelectedProject(null)} />}
      {selectedThread && <ThreadModal thread={selectedThread} state={state} onClose={() => setSelectedThread(null)} onReply={async (body, parentPostId) => { await act('forumPosts.create', { threadId: selectedThread.publicId, bodyMarkdown: body, parentPostId }); }} onReport={async (targetType, targetId) => { const reason = window.prompt('Why should moderators review this item?'); if (reason) await act('reports.create', { targetType, targetId, reason }); }} onReact={async (targetType, targetId) => { await act('reactions.toggle', { targetType, targetId, kind: 'like' }); }} user={user} />}
      {showLogin && <LoginModal onClose={() => setShowLogin(false)} onSuccess={() => setShowLogin(false)} />}
    </div>
  );
}

function heroTitle(name: string, type: 'blog' | 'forum' | 'showcase') {
  if (type === 'forum') return 'A better place to think out loud.';
  if (type === 'showcase') return 'Work with a point of view.';
  return `Notes from ${name}.`;
}

function SetupRedirect() {
  return <div className="setup"><div className="brand"><span className="brand-mark">P</span><span>Portable Core<small>First-run setup</small></span></div><div className="card setup-card"><p className="eyebrow">One more step</p><h1>Make this site yours.</h1><p className="hero-copy">This installation has not created its first administrator yet.</p><div style={{ marginTop: 24 }}><Link className="button" href="/setup">Open setup</Link></div></div></div>;
}

function BlogView({ posts, tags, media, onOpen }: { posts: Post[]; tags: PublicState['tags']; media: PublicState['media']; onOpen: (post: Post) => void }) {
  return <section><div className="section-head"><div><h2>Latest entries</h2><p>Published in {posts.length === 0 ? 'no entries yet' : 'your public journal'}.</p></div><span className="badge">Realtime</span></div>{posts.length === 0 ? <div className="empty">No published entries yet. Create the first one in Admin.</div> : <div className="grid">{posts.map((post) => { const featured = media.find((asset) => asset.publicId === post.featuredAssetId); return <article className="card content-card" key={post.publicId} onClick={() => onOpen(post)}>{featured && <Image src={featured.url} alt="" width={featured.width ?? 800} height={featured.height ?? 450} sizes="(max-width: 800px) 100vw, 33vw" style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 12, marginBottom: 18 }} />}<div className="card-meta"><span>{formatDate(post.publishedAt)}</span><span className="badge">{post.status}</span></div><h3 className="card-title">{post.title}</h3><p className="card-summary">{post.excerpt || 'Open this entry to read more.'}</p><div className="row" style={{ marginTop: 14 }}>{post.tagIds.slice(0, 3).map((tagId) => <span className="badge muted" key={tagId}>{tags.find((tag) => tag.publicId === tagId)?.name}</span>)}</div><div className="card-footer"><span className="tiny muted">Read entry →</span><span className="avatar">{initials(post.authorId.slice(0, 8))}</span></div></article>; })}</div>}</section>;
}

function ForumView({ threads, replies, categories, readStates, onOpen }: { threads: Thread[]; replies: { threadId: string; deletedAt: number | null; moderationState: string }[]; categories: PublicState['categories']; readStates: PublicState['readStates']; onOpen: (thread: Thread) => void }) {
  const groupedCategories = categories.length > 0 ? categories : [{ publicId: 'general', name: 'General', description: '', sortOrder: 0, createdAt: 0, updatedAt: 0 }];
  return <section><div className="section-head"><div><h2>Community board</h2><p>Replies appear in connected browsers as they arrive.</p></div><span className="badge">{threads.length} threads</span></div>{threads.length === 0 ? <div className="empty">No conversations yet.</div> : <div className="stack">{groupedCategories.map((category) => { const categoryThreads = threads.filter((thread) => thread.categoryId === category.publicId); if (categoryThreads.length === 0) return null; return <div className="card panel" key={category.publicId}><div className="row between" style={{ marginBottom: 8 }}><div><h3>{category.name}</h3><p>{category.description}</p></div><span className="badge">{categoryThreads.length} threads</span></div>{categoryThreads.map((thread) => { const readState = readStates.find((candidate) => candidate.threadId === thread.publicId); const unread = !readState || readState.lastReadAt < thread.lastPostAt; return <button className="thread-row" key={thread.publicId} onClick={() => onOpen(thread)} style={{ width: '100%', background: 'transparent', border: 0, textAlign: 'left' }}><div><div className="thread-title">{unread && <span className="badge" style={{ marginRight: 8 }}>new</span>}{thread.title}</div><div className="thread-replies">{replies.filter((reply) => reply.threadId === thread.publicId && !reply.deletedAt && reply.moderationState === 'visible').length} replies · {formatDate(thread.lastPostAt)}</div></div><span className="tiny muted">Open →</span></button>; })}</div>; })}</div>}</section>;
}

function ShowcaseView({ projects, media, tags, onOpen, onInquiry, message }: { projects: Project[]; media: PublicState['media']; tags: PublicState['tags']; onOpen: (project: Project) => void; onInquiry: (payload: Record<string, unknown>) => Promise<void>; message: string }) {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  return <section><div className="section-head"><div><h2>Selected work</h2><p>Projects, case studies, and useful things.</p></div><span className="badge">{projects.length} projects</span></div>{projects.length === 0 ? <div className="empty">No projects published yet.</div> : <div className="grid">{projects.map((project) => { const projectAssets = project.assetIds.map((assetId) => media.find((asset) => asset.publicId === assetId)).filter((asset): asset is PublicState['media'][number] => Boolean(asset)); return <article className="card content-card" key={project.publicId} onClick={() => onOpen(project)}>{projectAssets[0] && <Image src={projectAssets[0].url} alt="" width={projectAssets[0].width ?? 800} height={projectAssets[0].height ?? 450} sizes="(max-width: 800px) 100vw, 33vw" style={{ width: '100%', height: 170, objectFit: 'cover', borderRadius: 12, marginBottom: 18 }} />}<div className="card-meta"><span>{project.tagIds.map((tagId) => tags.find((tag) => tag.publicId === tagId)?.name).filter(Boolean).join(' · ') || 'Project'}</span><span>{formatDate(project.publishedAt)}</span></div><h3 className="card-title">{project.title}</h3><p className="card-summary">{project.summary}</p><div className="card-footer"><span className="tiny muted">View case study →</span></div></article>; })}</div>}<div className="card panel" style={{ marginTop: 18 }}><h3>Start a conversation</h3><p>Tell the studio about your next idea.</p>{message && <div className="notice" style={{ marginTop: 15 }}>{message}</div>}<form className="form" style={{ marginTop: 18 }} onSubmit={(event) => { event.preventDefault(); void onInquiry(form); setForm({ name: '', email: '', message: '' }); }}><div className="form-grid"><label>Name<input className="input" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><label>Email<input className="input" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div><label className="full">Message<textarea className="input" required value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /></label><div><button className="button" type="submit">Send inquiry</button></div></form></div></section>;
}

function PostModal({ post, media, onClose }: { post: Post; media: PublicState['media']; onClose: () => void }) {
  const featured = media.find((asset) => asset.publicId === post.featuredAssetId);
  return <div className="modal-backdrop" onClick={onClose}><article className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="badge">{post.status}</span><h2 style={{ marginTop: 12 }}>{post.title}</h2><p className="tiny muted" style={{ marginTop: 8 }}>{formatDate(post.publishedAt)}</p></div><button className="button ghost" onClick={onClose}>Close</button></div>{featured && <Image src={featured.url} alt="" width={featured.width ?? 1200} height={featured.height ?? 675} sizes="(max-width: 700px) 100vw, 660px" style={{ width: '100%', maxHeight: 420, objectFit: 'cover', borderRadius: 14, marginBottom: 20 }} />}<div className="markdown" dangerouslySetInnerHTML={{ __html: safeMarkdown(post.bodyMarkdown) }} /></article></div>;
}

function ProjectModal({ project, media, onClose }: { project: Project; media: PublicState['media']; onClose: () => void }) {
  const assets = project.assetIds.map((assetId) => media.find((asset) => asset.publicId === assetId)).filter((asset): asset is PublicState['media'][number] => Boolean(asset));
  return <div className="modal-backdrop" onClick={onClose}><article className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="badge">Case study</span><h2 style={{ marginTop: 12 }}>{project.title}</h2><p className="tiny muted" style={{ marginTop: 8 }}>{formatDate(project.publishedAt)}</p></div><button className="button ghost" onClick={onClose}>Close</button></div>{assets.length > 0 && <div className="stack">{assets.map((asset) => <Image key={asset.publicId} src={asset.url} alt="" width={asset.width ?? 1200} height={asset.height ?? 675} sizes="(max-width: 700px) 100vw, 660px" style={{ width: '100%', maxHeight: 360, objectFit: 'cover', borderRadius: 12 }} />)}</div>}<p className="hero-copy" style={{ marginTop: 20 }}>{project.summary}</p><div className="markdown" dangerouslySetInnerHTML={{ __html: safeMarkdown(project.bodyMarkdown) }} /></article></div>;
}

function ThreadModal({ thread, state, onClose, onReply, onReport, onReact, user }: { thread: Thread; state: NonNullable<ReturnType<typeof useRealtimeState>['state']>; onClose: () => void; onReply: (body: string, parentPostId?: string | null) => Promise<void>; onReport: (targetType: 'thread' | 'forumPost', targetId: string) => Promise<void>; onReact: (targetType: 'thread' | 'forumPost', targetId: string) => Promise<void>; user: PublicState['currentUser'] }) {
  const [body, setBody] = useState('');
  const [parentPostId, setParentPostId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const replies = state.replies.filter((reply) => reply.threadId === thread.publicId);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); if (!user) { setError('Sign in to reply.'); return; } try { await onReply(body, parentPostId); setBody(''); setParentPostId(null); setError(''); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Reply failed'); } };
  return <div className="modal-backdrop" onClick={onClose}><article className="modal" onClick={(event) => event.stopPropagation()}><div className="modal-head"><div><span className="badge">{thread.locked ? 'Locked' : 'Open thread'}</span><h2 style={{ marginTop: 12 }}>{thread.title}</h2></div><div className="row"><button className="button ghost" onClick={() => void onReact('thread', thread.publicId)}>♡ {state.reactions.filter((reaction) => reaction.targetType === 'thread' && reaction.targetId === thread.publicId).length}</button><button className="button ghost" onClick={() => { if (user) void onReport('thread', thread.publicId); }}>Report</button><button className="button ghost" onClick={onClose}>Close</button></div></div><div className="stack">{replies.map((reply) => <div className="card panel" key={reply.publicId}><div className="row between"><span className="tiny muted">{state.users.find((user) => user.publicId === reply.authorId)?.displayName ?? 'Community member'} · {formatDate(reply.createdAt)}</span><div className="row"><button className="button ghost" onClick={() => setParentPostId(reply.publicId)}>Reply</button><button className="button ghost" onClick={() => { if (user) void onReport('forumPost', reply.publicId); }}>Report</button><button className="button ghost" onClick={() => void onReact('forumPost', reply.publicId)}>♡ {state.reactions.filter((reaction) => reaction.targetType === 'forumPost' && reaction.targetId === reply.publicId).length}</button></div></div>{reply.parentPostId && <div className="tiny muted" style={{ marginTop: 8 }}>Replying to another post</div>}<div className="markdown" style={{ marginTop: 12 }} dangerouslySetInnerHTML={{ __html: safeMarkdown(reply.bodyMarkdown) }} /></div>)}</div>{!thread.locked && <form className="form" style={{ marginTop: 20 }} onSubmit={submit}>{error && <div className="notice error">{error}</div>}{parentPostId && <div className="notice row between">Replying to a specific post<button className="button ghost" type="button" onClick={() => setParentPostId(null)}>Clear</button></div>}<label>Reply<textarea className="input" required value={body} onChange={(event) => setBody(event.target.value)} placeholder="Add to the conversation…" /></label><button className="button" type="submit">Post reply</button></form>}</article></div>;
}

function LoginModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const { act } = useRealtimeState();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); try { await act('auth.signIn', { email, password }); onSuccess(); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Sign in failed'); } finally { setBusy(false); } };
  return <div className="modal-backdrop" onClick={onClose}><form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}><div className="modal-head"><div><p className="eyebrow">Secure access</p><h2>Welcome back</h2></div><button type="button" className="button ghost" onClick={onClose}>Close</button></div><div className="form">{error && <div className="notice error">{error}</div>}<label>Email<input className="input" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></label><label>Password<input className="input" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="button" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'}</button><Link className="tiny muted" href="/setup" onClick={onClose}>Need to finish first-run setup?</Link></div></form></div>;
}
