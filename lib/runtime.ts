export function isCookieSecure() {
  return process.env.COOKIE_SECURE === 'true' || process.env.PORTABLE_CORE_HTTPS === 'true';
}

export function requiresConvex() {
  return process.env.PORTABLE_CORE_REQUIRE_CONVEX === 'true';
}

export function convexConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_CONVEX_URL && process.env.CONVEX_SELF_HOSTED_URL);
}

export function isLoopbackRequest(request: Request) {
  const headerHost = request.headers.get('host')?.toLowerCase() ?? '';
  const urlHost = new URL(request.url).hostname.toLowerCase();
  const host = headerHost || urlHost;
  const hostname = host.startsWith('[') ? host.slice(1, host.indexOf(']')) : host.split(':')[0];
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

export function productionReadiness() {
  const convexRequired = requiresConvex();
  const httpsRequired = process.env.PORTABLE_CORE_REQUIRE_HTTPS === 'true';
  return {
    convexRequired,
    convex: convexConfigured(),
    https: isCookieSecure(),
    httpsRequired,
    migrations: true,
  };
}
