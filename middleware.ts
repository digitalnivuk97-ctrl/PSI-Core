import { NextResponse } from 'next/server';

export function middleware() {
  const response = NextResponse.next();
  const convexOrigin = process.env.NEXT_PUBLIC_CONVEX_URL ?? '';
  const connectSources = ["'self'", 'wss:', convexOrigin].filter(Boolean).join(' ');
  const scriptSources = ["'self'", "'unsafe-inline'", ...(process.env.NODE_ENV === 'production' ? [] : ["'unsafe-eval'"])].join(' ');
  response.headers.set('Content-Security-Policy', `default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'; img-src 'self' data: blob: https:; font-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src ${scriptSources}; connect-src ${connectSources}`);
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('X-DNS-Prefetch-Control', 'off');
  if (process.env.COOKIE_SECURE === 'true' || process.env.PORTABLE_CORE_HTTPS === 'true') response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return response;
}

export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
