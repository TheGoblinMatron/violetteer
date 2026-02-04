/**
 * Digital Ocean Spaces Helper
 *
 * Handles image uploads to DO Spaces with Sharp processing.
 * Creates two versions of each image:
 *   - Main (1024px max width) - for detail pages
 *   - Thumbnail (300x300px) - for catalog grid
 *
 * LEARNING NOTES:
 *   - DO Spaces is S3-compatible, so we use the AWS SDK
 *   - Sharp is a fast image processing library (much faster than ImageMagick)
 *   - We process images server-side before upload for consistent quality
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import sharp from 'sharp';

// Initialize S3 client for Digital Ocean Spaces
const s3Client = new S3Client({
  endpoint: `https://${process.env.DO_SPACES_ENDPOINT}`,
  region: process.env.DO_SPACES_REGION,
  credentials: {
    accessKeyId: process.env.DO_SPACES_ACCESS_KEY,
    secretAccessKey: process.env.DO_SPACES_SECRET_KEY,
  },
});

/**
 * Upload a single processed image to Spaces
 * @private
 */
async function uploadSingleImage(buffer, key, options = {}) {
  const { width, height, fit = 'cover', quality = 80 } = options;

  // Process with Sharp
  let processed = sharp(buffer);

  if (width || height) {
    processed = processed.resize({
      width,
      height,
      fit,
      // 'attention' focuses on the most interesting part of the image
      position: fit === 'cover' ? 'attention' : undefined,
    });
  }

  // Convert to WebP for ~25-35% smaller files than JPEG at same quality
  processed = processed.webp({ quality });

  const optimizedBuffer = await processed.toBuffer();

  // Upload to Spaces
  await s3Client.send(new PutObjectCommand({
    Bucket: process.env.DO_SPACES_BUCKET,
    Key: key,
    Body: optimizedBuffer,
    ContentType: 'image/webp',
    ACL: 'public-read',
    CacheControl: 'max-age=31536000', // Cache for 1 year
  }));

  return `${process.env.DO_SPACES_CDN_URL}/${key}`;
}

/**
 * Upload both main and thumbnail versions of an image
 *
 * @param {Buffer} buffer - Original image buffer from multer
 * @param {string} baseKey - Base path without suffix (e.g., 'catalog/123-b')
 * @returns {Promise<{ main: string, thumb: string }>} URLs for both versions
 *
 * @example
 * const urls = await uploadImageVersions(req.file.buffer, 'catalog/123-b');
 * // urls.main  = 'https://...cdn.../catalog/123-b-main.jpg'
 * // urls.thumb = 'https://...cdn.../catalog/123-b-thumb.jpg'
 */
export async function uploadImageVersions(buffer, baseKey) {
  const [mainUrl, thumbUrl] = await Promise.all([
    // Main image: max 1024px wide, preserve aspect ratio
    uploadSingleImage(buffer, `${baseKey}-main.webp`, {
      width: 1024,
      height: null,
      fit: 'inside', // Preserves aspect ratio, fits within dimensions
      quality: 80,
    }),
    // Thumbnail: 300x300, cropped to fill square
    uploadSingleImage(buffer, `${baseKey}-thumb.webp`, {
      width: 300,
      height: 300,
      fit: 'cover', // Crops to fill the dimensions
      quality: 70,
    }),
  ]);

  return { main: mainUrl, thumb: thumbUrl };
}

/**
 * Upload a single square avatar image
 *
 * @param {Buffer} buffer - Original image buffer from multer
 * @param {string} userId - User ID for the filename
 * @returns {Promise<string>} URL of the uploaded avatar
 */
export async function uploadAvatar(buffer, userId) {
  const key = `avatars/${userId}.webp`;
  return uploadSingleImage(buffer, key, {
    width: 200,
    height: 200,
    fit: 'cover',
    quality: 80,
  });
}

/**
 * Delete a single image from Spaces
 *
 * @param {string} key - The object key (path) to delete
 */
export async function deleteImage(key) {
  try {
    await s3Client.send(new DeleteObjectCommand({
      Bucket: process.env.DO_SPACES_BUCKET,
      Key: key,
    }));
  } catch (error) {
    // Ignore "not found" errors - the image might already be deleted
    if (error.name !== 'NoSuchKey') {
      throw error;
    }
  }
}

/**
 * Delete both main and thumbnail versions of an image
 *
 * @param {string} baseKey - Base path without suffix (e.g., 'catalog/123-b')
 */
export async function deleteImageVersions(baseKey) {
  await Promise.all([
    deleteImage(`${baseKey}-main.webp`),
    deleteImage(`${baseKey}-thumb.webp`),
  ]);
}

/**
 * Extract the key from a full Spaces CDN URL
 * Useful for deletion when you only have the URL
 *
 * @param {string} url - Full CDN URL
 * @returns {string} The object key
 *
 * @example
 * const key = getKeyFromUrl('https://bucket.nyc3.cdn.digitaloceanspaces.com/avatars/123.jpg');
 * // returns 'avatars/123.jpg'
 */
export function getKeyFromUrl(url) {
  if (!url) return null;
  const cdnUrl = process.env.DO_SPACES_CDN_URL;
  if (url.startsWith(cdnUrl)) {
    return url.slice(cdnUrl.length + 1); // +1 for the trailing slash
  }
  return null;
}
