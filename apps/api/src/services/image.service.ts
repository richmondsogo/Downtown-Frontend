import sharp from "sharp";

export interface MagicBytesValidation {
  valid: boolean;
  format?: "jpeg" | "png" | "webp";
  error?: string;
}

/**
 * Validates actual binary file signatures (magic bytes) to guarantee image format.
 * Supports JPEG, PNG, and WebP.
 */
export function validateImageMagicBytes(buffer: Buffer): MagicBytesValidation {
  if (!buffer || buffer.length < 12) {
    return { valid: false, error: "File buffer is too small to be a valid image" };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { valid: true, format: "jpeg" };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return { valid: true, format: "png" };
  }

  // WebP: RIFF (bytes 0-3) + WEBP (bytes 8-11)
  if (
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return { valid: true, format: "webp" };
  }

  return {
    valid: false,
    error: "Unsupported file signature. Uploads must be valid JPEG, PNG, or WebP images.",
  };
}

export interface ProcessedPhotoResult {
  displayBuffer: Buffer;
  thumbBuffer: Buffer;
  displayKey: string;
  thumbKey: string;
  width: number;
  height: number;
  bytes: number;
}

/**
 * Strips all metadata (including EXIF GPS), resizes, and generates dual WebP variants:
 * - Display variant: max edge 1000px, WebP aiming <= 150 KB
 * - Thumbnail variant: max edge 400px, WebP aiming <= 25 KB
 * - Calculates stored bytes and content-hashed immutable pathnames.
 */
export async function processListingPhoto(
  inputBuffer: Buffer,
  ownerId: string,
  photoId: string
): Promise<ProcessedPhotoResult> {
  const magic = validateImageMagicBytes(inputBuffer);
  if (!magic.valid) {
    throw new Error(magic.error || "Invalid image magic bytes");
  }

  // Sharp strips all EXIF and GPS metadata by default unless .withMetadata() is explicitly invoked.
  // We rotate according to orientation tag before stripping orientation to preserve visual layout.
  const displayPipeline = sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .resize(1000, 1000, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 80 });

  const displayBuffer = await displayPipeline.toBuffer();
  const displayMetadata = await sharp(displayBuffer).metadata();

  const thumbPipeline = sharp(inputBuffer, { failOn: "none" })
    .rotate()
    .resize(400, 400, {
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: 75 });

  const thumbBuffer = await thumbPipeline.toBuffer();

  const width = displayMetadata.width || 800;
  const height = displayMetadata.height || 600;
  const bytes = displayBuffer.length + thumbBuffer.length;

  const crypto = await import("crypto");
  const contentHash = crypto
    .createHash("sha256")
    .update(displayBuffer)
    .digest("hex")
    .slice(0, 12);

  const displayKey = `listings/${ownerId}/${photoId}/display-${contentHash}.webp`;
  const thumbKey = `listings/${ownerId}/${photoId}/thumb-${contentHash}.webp`;

  return {
    displayBuffer,
    thumbBuffer,
    displayKey,
    thumbKey,
    width,
    height,
    bytes,
  };
}
