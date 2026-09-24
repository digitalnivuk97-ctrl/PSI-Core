import { afterEach, describe, expect, it } from 'vitest';
import { convexConfigured, isCookieSecure, isLoopbackRequest, productionReadiness, requiresConvex } from '@/lib/runtime';

const original = { ...process.env };

afterEach(() => {
  for (const key of ['NEXT_PUBLIC_CONVEX_URL', 'CONVEX_SELF_HOSTED_URL', 'COOKIE_SECURE', 'PORTABLE_CORE_HTTPS', 'PORTABLE_CORE_REQUIRE_CONVEX', 'PORTABLE_CORE_REQUIRE_HTTPS']) delete process.env[key];
  Object.assign(process.env, original);
});

describe('production runtime gates', () => {
  it('requires explicit secure cookies when requested', () => {
    expect(isCookieSecure()).toBe(false);
    process.env.COOKIE_SECURE = 'true';
    expect(isCookieSecure()).toBe(true);
  });

  it('fails readiness when required Convex configuration is absent', () => {
    process.env.PORTABLE_CORE_REQUIRE_CONVEX = 'true';
    expect(requiresConvex()).toBe(true);
    expect(convexConfigured()).toBe(false);
    expect(productionReadiness().convex).toBe(false);
  });

  it('recognizes a configured Convex deployment', () => {
    process.env.NEXT_PUBLIC_CONVEX_URL = 'https://convex.example.test';
    process.env.CONVEX_SELF_HOSTED_URL = 'http://127.0.0.1:3210';
    expect(convexConfigured()).toBe(true);
  });

  it('exposes the setup token only to loopback requests', () => {
    expect(isLoopbackRequest(new Request('http://127.0.0.1:3000/api/state'))).toBe(true);
    expect(isLoopbackRequest(new Request('https://example.com/api/state'))).toBe(false);
  });
});
