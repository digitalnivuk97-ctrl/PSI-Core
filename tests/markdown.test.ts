import { describe, expect, it } from 'vitest';
import { safeMarkdown } from '@/components/realtime';

describe('safe markdown', () => {
  it('escapes executable markup', () => {
    const html = safeMarkdown('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });
});
