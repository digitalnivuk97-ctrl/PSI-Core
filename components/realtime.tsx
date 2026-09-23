'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ActionName, PublicState } from '@/lib/types';

export function useRealtimeState(initialState?: PublicState | null) {
  const [state, setState] = useState<PublicState | null>(initialState ?? null);
  const [connection, setConnection] = useState<PublicState['realtime']>('reconnecting');
  const [error, setError] = useState('');
  const channelRef = useRef<BroadcastChannel | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch('/api/state', { cache: 'no-store' });
      if (!response.ok) throw new Error('State unavailable');
      const next = await response.json() as PublicState;
      setState(next);
      setConnection('live');
      setError('');
    } catch {
      setConnection('offline');
      setError('Reconnecting to the site state');
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel('portable-core-state');
      channel.onmessage = () => void refresh();
      channelRef.current = channel;
    }
    return () => {
      window.clearInterval(timer);
      channelRef.current?.close();
    };
  }, [refresh]);

  const act = useCallback(async (action: ActionName, payload: Record<string, unknown> = {}) => {
    const response = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, payload, clientMutationId: crypto.randomUUID() }),
    });
    const body = await response.json() as { state?: PublicState; error?: string };
    if (!response.ok || !body.state) throw new Error(body.error ?? 'Action failed');
    setState(body.state);
    channelRef.current?.postMessage('changed');
    return body;
  }, []);

  return { state, connection, error, refresh, act };
}

export function formatDate(timestamp: number | null) {
  if (!timestamp) return 'Not published';
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(timestamp));
}

export function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

export function safeMarkdown(markdown: string) {
  const escape = (value: string) => value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character);
  const blocks = escape(markdown).split(/\n{2,}/).filter(Boolean);
  return blocks.map((block) => {
    if (block.startsWith('### ')) return `<h3>${block.slice(4)}</h3>`;
    if (block.startsWith('## ')) return `<h2>${block.slice(3)}</h2>`;
    if (block.startsWith('# ')) return `<h2>${block.slice(2)}</h2>`;
    if (block.startsWith('&gt; ')) return `<blockquote>${block.slice(5)}</blockquote>`;
    return `<p>${block.replace(/\n/g, '<br>')}</p>`;
  }).join('');
}
