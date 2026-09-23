import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { MAX_IMAGE_BYTES, processImageUpload } from '@/lib/media';

describe('media processing', () => {
  it('normalizes a valid image to WebP and records dimensions', async () => {
    const input = await sharp({ create: { width: 32, height: 20, channels: 4, background: { r: 40, g: 120, b: 80, alpha: 1 } } }).png().toBuffer();
    const result = await processImageUpload(input, 'image/png');
    expect(result.mediaType).toBe('image/webp');
    expect(result.compressed).toBe(true);
    expect(result.width).toBe(32);
    expect(result.height).toBe(20);
    expect(result.digest).not.toBe(result.originalDigest);
  });

  it('rejects SVG and oversized input', async () => {
    await expect(processImageUpload(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'), 'image/svg+xml')).rejects.toThrow();
    await expect(processImageUpload(Buffer.alloc(MAX_IMAGE_BYTES + 1))).rejects.toThrow('10 MiB');
  });
});
