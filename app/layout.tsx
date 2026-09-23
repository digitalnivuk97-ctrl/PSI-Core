import type { Metadata } from 'next';
import { RealtimeProvider } from '@/components/realtime-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Portable Core',
  description: 'A portable, realtime-first CMS.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><RealtimeProvider url={process.env.NEXT_PUBLIC_CONVEX_URL}>{children}</RealtimeProvider></body>
    </html>
  );
}
