import ConvexPortal from '@/components/convex-portal';
import Portal from '@/components/portal';
import { publicState, readState } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function Page() {
  if (process.env.NEXT_PUBLIC_CONVEX_URL) return <ConvexPortal />;
  const state = publicState(await readState(), null);
  if (!state.setupComplete) delete state.setupToken;
  return <Portal initialState={state} />;
}
