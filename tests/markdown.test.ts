import { describe, expect, it } from 'vitest';
import { safeMarkdown } from '@/components/realtime';
import { renderMarkdown } from '@/lib/markdown';

describe('safe markdown', () => {
  it('escapes executable markup', () => {
    const html = safeMarkdown('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>');
  });

  it('sanitizes server-rendered markdown and unsafe links', () => {
    const html = renderMarkdown('[bad](javascript:alert(1))\n\n<script>alert(1)</script>');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('<script>');
  });
});
