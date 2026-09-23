'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRealtimeState } from '@/components/realtime';
import type { SiteType } from '@/lib/types';

export default function Setup() {
  const { state, act } = useRealtimeState();
  const [form, setForm] = useState({ siteName: '', siteType: 'blog' as SiteType, displayName: '', email: '', password: '', setupToken: '', publicUrl: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (state?.setupComplete) window.location.href = '/'; }, [state]);
  if (!state) return <div className="setup"><div className="empty">Loading setup…</div></div>;
  if (state.setupComplete) return <div className="setup"><div className="card setup-card"><h1>Setup complete.</h1><Link className="button" href="/">Open your site</Link></div></div>;
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setBusy(true); setError(''); try { await act('setup.complete', form); window.location.href = '/'; } catch (caught) { setError(caught instanceof Error ? caught.message : 'Setup failed'); setBusy(false); } };
  return <div className="setup"><div className="brand"><span className="brand-mark">P</span><span>Portable Core<small>First-run setup</small></span></div><div className="card setup-card"><p className="eyebrow">Welcome</p><h1>Start with a strong foundation.</h1><p className="hero-copy">Create the first owner account. There are no default credentials and the setup page closes permanently after this step.</p><form className="form" style={{ marginTop: 28 }} onSubmit={submit}>{error && <div className="notice error">{error}</div>}<label>Site name<input className="input" required placeholder="My site" value={form.siteName} onChange={(event) => setForm({ ...form, siteName: event.target.value })} /></label><label>Template<select className="input" value={form.siteType} onChange={(event) => setForm({ ...form, siteType: event.target.value as SiteType })}><option value="blog">Blog</option><option value="forum">Forum</option><option value="showcase">Showcase</option></select></label><div className="form-grid"><label>Your name<input className="input" required value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} /></label><label>Email<input className="input" required type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label></div><label>Password<input className="input" required minLength={10} type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><span className="tiny">At least 10 characters, including a letter and a number.</span></label><label>One-time setup token<div className="code">{state.setupToken}</div><input className="input" required value={form.setupToken} onChange={(event) => setForm({ ...form, setupToken: event.target.value })} placeholder="Paste the token shown above" /></label><label>Public URL <span className="tiny">(optional)</span><input className="input" type="url" value={form.publicUrl} onChange={(event) => setForm({ ...form, publicUrl: event.target.value })} placeholder="https://example.test" /></label><button className="button" type="submit" disabled={busy}>{busy ? 'Creating owner…' : 'Create owner and finish setup'}</button></form></div><p className="tiny muted" style={{ textAlign: 'center', marginTop: 18 }}>Need a local run? Use <code className="code">pnpm dev</code>, then open <code className="code">/setup</code>.</p></div>;
}
