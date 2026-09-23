import { describe, expect, it } from 'vitest';
import { enforceRateLimit } from '@/lib/rate-limit';
import { renderPrometheus } from '@/lib/metrics';

describe('release security primitives', () => {
  it('enforces bounded request buckets', () => {
    const first = enforceRateLimit('test', 2, 1000, 100);
    const second = enforceRateLimit('test', 2, 1000, 101);
    const third = enforceRateLimit('test', 2, 1000, 102);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(third.allowed).toBe(false);
    expect(third.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('renders Prometheus counters without user content', () => {
    expect(renderPrometheus()).toContain('psi_core_mutation_failures');
  });
});
