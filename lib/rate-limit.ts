interface RateBucket { count: number; resetAt: number }
const buckets = new Map<string, RateBucket>();

export function requestFingerprint(request: Request) {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'local';
}

export function enforceRateLimit(key: string, limit: number, windowMs: number, now = Date.now()) {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }
  existing.count += 1;
  if (existing.count > limit) return { allowed: false, remaining: 0, retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  return { allowed: true, remaining: Math.max(0, limit - existing.count), retryAfterSeconds: 0 };
}

export function rateLimitHeaders(limit: number, remaining: number, retryAfterSeconds = 0) {
  return { 'x-ratelimit-limit': String(limit), 'x-ratelimit-remaining': String(remaining), ...(retryAfterSeconds ? { 'retry-after': String(retryAfterSeconds) } : {}) };
}
