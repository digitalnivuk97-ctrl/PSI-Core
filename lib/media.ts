import { createHash } from 'node:crypto';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_IMAGE_PIXELS = 40_000_000;
export const MAX_IMAGE_DIMENSION = 12_000;
export const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif']);

export function digestBytes(value: Uint8Array) {
  return createHash('sha256').update(value).digest('hex');
}

export function detectImageType(value: Uint8Array) {
  if (value.length >= 3 && value[0] === 0xff && value[1] === 0xd8 && value[2] === 0xff) return 'image/jpeg';
  if (value.length >= 8 && value.subarray(0, 8).every((byte, index) => byte === [137, 80, 78, 71, 13, 10, 26, 10][index])) return 'image/png';
  if (value.length >= 6 && (text(value.subarray(0, 6)) === 'GIF87a' || text(value.subarray(0, 6)) === 'GIF89a')) return 'image/gif';
  if (value.length >= 12 && text(value.subarray(0, 4)) === 'RIFF' && text(value.subarray(8, 12)) === 'WEBP') return 'image/webp';
  if (value.length >= 12 && text(value.subarray(4, 8)) === 'ftyp' && ['avif', 'avis'].includes(text(value.subarray(8, 12)))) return 'image/avif';
  return null;
}

function text(value: Uint8Array) {
  return Buffer.from(value).toString('ascii');
}

export async function processImageUpload(input: Uint8Array, declaredType?: string) {
  if (input.length === 0) throw new Error('The uploaded file is empty');
  if (input.length > MAX_IMAGE_BYTES) throw new Error('Images must be 10 MiB or smaller');
  const detectedType = detectImageType(input);
  if (!detectedType || !allowedImageTypes.has(detectedType)) throw new Error('Only JPEG, PNG, WebP, AVIF, and GIF images are supported');
  if (declaredType && declaredType !== 'application/octet-stream' && declaredType !== detectedType) throw new Error('The file extension or MIME type does not match the image data');
  const metadata = await sharp(input).metadata();
  const width = metadata.width ?? 0;
  const height = metadata.height ?? 0;
  if (!width || !height) throw new Error('The image dimensions could not be read');
  if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION || width * height > MAX_IMAGE_PIXELS) throw new Error('The image dimensions exceed the safety limit');
  if (detectedType === 'image/gif' && metadata.pages && metadata.pages > 1) {
    return { bytes: Buffer.from(input), mediaType: detectedType, width, height, originalMediaType: detectedType, originalByteSize: input.length, originalDigest: digestBytes(input), digest: digestBytes(input), compressed: false };
  }
  const bytes = await sharp(input).rotate().webp({ quality: 82, effort: 4 }).toBuffer();
  return { bytes, mediaType: 'image/webp', width, height, originalMediaType: detectedType, originalByteSize: input.length, originalDigest: digestBytes(input), digest: digestBytes(bytes), compressed: true };
}

export function extensionForMediaType(mediaType: string) {
  if (mediaType === 'image/jpeg') return 'jpg';
  if (mediaType === 'image/png') return 'png';
  if (mediaType === 'image/webp') return 'webp';
  if (mediaType === 'image/avif') return 'avif';
  if (mediaType === 'image/gif') return 'gif';
  return 'bin';
}
