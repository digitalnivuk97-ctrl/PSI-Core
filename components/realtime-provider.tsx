'use client';

import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { useMemo, type ReactNode } from 'react';

export function RealtimeProvider({ children, url }: { children: ReactNode; url?: string }) {
  const client = useMemo(() => url ? new ConvexReactClient(url) : null, [url]);
  if (!client) return children;
  return <ConvexProvider client={client}>{children}</ConvexProvider>;
}
