'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRealtimeState } from '@/components/realtime';
import type { SiteType } from '@/lib/types';

const templates: { value: SiteType; label: string; description: string }[] = [
  { value: 'blog', label: 'Blog', description: 'Publish articles, updates, and media.' },
  { value: 'forum', label: 'Forum', description: 'Start conversations with threads and replies.' },
  { value: 'showcase', label: 'Showcase', description: 'Present projects, media, and inquiries.' },
];

export default function Setup() {
  const { state, act } = useRealtimeState();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ siteName: '', siteType: 'blog' as SiteType, convexMode: 'local' as 'local' | 'external', displayName: '', email: '', password: '', setupToken: '', publicUrl: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!state) return;
    if (state.setupComplete) {
      window.location.href = '/admin';
      return;
    }
    const publicUrl = window.location.origin;
    setForm((current) => {
      const nextSetupToken = current.setupToken || state.setupToken || '';
      const nextPublicUrl = current.publicUrl || publicUrl;
      return current.setupToken === nextSetupToken && current.publicUrl === nextPublicUrl ? current : { ...current, setupToken: nextSetupToken, publicUrl: nextPublicUrl };
    });
  }, [state]);

  if (!state) return <div className="setup"><div className="empty">Loading setup…</div></div>;
  if (state.setupComplete) return <div className="setup"><div className="card setup-card"><h1>Setup complete.</h1><Link className="button" href="/admin">Open your dashboard</Link></div></div>;

  function update<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  const goNext = () => {
    setError('');
    if (step === 1 && !form.siteName.trim()) {
      setError('Enter a site name to continue.');
      return;
    }
    if (step === 2 && (!form.displayName.trim() || !form.email.trim() || form.password.length < 10)) {
      setError('Enter your name, email, and a password with at least 10 characters.');
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };
  const goBack = () => {
    setError('');
    setStep((current) => Math.max(1, current - 1));
  };
  const submit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await act('setup.complete', form);
      window.location.href = '/admin';
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Setup failed');
      setBusy(false);
    }
  };

  return <div className="setup">
    <div className="brand"><span className="brand-mark">P</span><span>Portable Core<small>First-run setup</small></span></div>
    <div className="card setup-card">
      <div className="setup-progress"><span>Step {step} of 3</span><div className="setup-steps"><i className={step >= 1 ? 'active' : ''} /><i className={step >= 2 ? 'active' : ''} /><i className={step >= 3 ? 'active' : ''} /></div></div>
      {error && <div className="notice error">{error}</div>}
      {step === 1 && <section>
        <p className="eyebrow">Your site</p>
        <h1>What are you building?</h1>
        <p className="hero-copy">Choose a starting point. You can change the site name and public URL later from the dashboard.</p>
        <div className="form" style={{ marginTop: 26 }}>
          <label>Site name<input className="input" autoFocus required placeholder="My website" value={form.siteName} onChange={(event) => update('siteName', event.target.value)} /></label>
          <label>Starting template<div className="template-grid">{templates.map((template) => <button className={`template-option ${form.siteType === template.value ? 'selected' : ''}`} type="button" key={template.value} aria-pressed={form.siteType === template.value} onClick={() => update('siteType', template.value)}><strong>{template.label}</strong><span>{template.description}</span></button>)}</div></label>
          <label>Public URL <span className="tiny">(optional)</span><input className="input" type="url" value={form.publicUrl} onChange={(event) => update('publicUrl', event.target.value)} /></label>
          <label>Realtime backend<select className="input" value={form.convexMode} onChange={(event) => update('convexMode', event.target.value as 'local' | 'external')}><option value="local">Docker Convex on this server (recommended)</option><option value="external">External Convex service (preconfigured)</option></select></label>
          {form.convexMode === 'external' && <div className="notice">External mode requires the operator to set `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_SELF_HOSTED_URL`, and the server-only synchronization key before starting Core. The deployment admin key stays on the server and is never entered here.</div>}
        </div>
        <div className="setup-actions"><span className="tiny">No CLI required. Continue in this browser.</span><button className="button" type="button" onClick={goNext}>Continue</button></div>
      </section>}
      {step === 2 && <section>
        <p className="eyebrow">Owner account</p>
        <h1>Create your login.</h1>
        <p className="hero-copy">This account becomes the site owner. There are no default credentials.</p>
        <div className="form" style={{ marginTop: 26 }}>
          <div className="form-grid"><label>Your name<input className="input" autoFocus required value={form.displayName} onChange={(event) => update('displayName', event.target.value)} /></label><label>Email<input className="input" required type="email" value={form.email} onChange={(event) => update('email', event.target.value)} /></label></div>
          <label>Password<input className="input" required minLength={10} type="password" value={form.password} onChange={(event) => update('password', event.target.value)} /><span className="tiny">At least 10 characters, including a letter and a number.</span></label>
        </div>
        <div className="setup-actions"><button className="button secondary" type="button" onClick={goBack}>Back</button><button className="button" type="button" onClick={goNext}>Review setup</button></div>
      </section>}
      {step === 3 && <section>
        <p className="eyebrow">Final check</p>
        <h1>Ready to launch.</h1>
        <div className="setup-review"><div><span>Site</span><strong>{form.siteName}</strong></div><div><span>Template</span><strong>{templates.find((template) => template.value === form.siteType)?.label}</strong></div><div><span>Realtime</span><strong>{form.convexMode === 'local' ? 'Docker Convex on this server' : 'External Convex service'}</strong></div><div><span>Owner</span><strong>{form.displayName} · {form.email}</strong></div><div><span>URL</span><strong>{form.publicUrl || 'Will use this server address'}</strong></div></div>
        <div className="form" style={{ marginTop: 22 }}>
          <label>Setup code {state.setupToken && <span className="tiny">local setup code</span>}{!state.setupToken && <span className="tiny">configured by the operator</span>}<input className="input" required value={form.setupToken} onChange={(event) => update('setupToken', event.target.value)} placeholder="Enter setup code" />{state.setupToken && <span className="code">{state.setupToken}</span>}</label>
        </div>
        <div className="setup-actions"><button className="button secondary" type="button" onClick={goBack}>Back</button><button className="button" type="submit" disabled={busy} onClick={submit}>{busy ? 'Creating site…' : 'Create site'}</button></div>
      </section>}
    </div>
  </div>;
}
