import { describe, it, expect, afterEach } from "vitest";
import sharp from "sharp";
import {
  validateImageMagicBytes,
  processListingPhoto,
} from "../services/image.service";
import {
  InMemoryStorageService,
  VercelBlobStorageService,
  getBlobToken,
} from "../services/storage.service";

describe("Image: validateImageMagicBytes", () => {
  it("detects valid JPEG magic bytes", async () => {
    const jpegBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    })
      .jpeg()
      .toBuffer();

    const res = validateImageMagicBytes(jpegBuffer);
    expect(res.valid).toBe(true);
    expect(res.format).toBe("jpeg");
  });

  it("detects valid PNG magic bytes", async () => {
    const pngBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const res = validateImageMagicBytes(pngBuffer);
    expect(res.valid).toBe(true);
    expect(res.format).toBe("png");
  });

  it("detects valid WebP magic bytes", async () => {
    const webpBuffer = await sharp({
      create: {
        width: 10,
        height: 10,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    })
      .webp()
      .toBuffer();

    const res = validateImageMagicBytes(webpBuffer);
    expect(res.valid).toBe(true);
    expect(res.format).toBe("webp");
  });

  it("rejects invalid files or fake extensions", () => {
    const textBuffer = Buffer.from("<html><body>Malicious payload</body></html>");
    const res = validateImageMagicBytes(textBuffer);
    expect(res.valid).toBe(false);

    const smallBuffer = Buffer.from([0x01, 0x02]);
    expect(validateImageMagicBytes(smallBuffer).valid).toBe(false);
  });
});

describe("Image: processListingPhoto & EXIF GPS stripping", () => {
  it("processes valid image into display and thumb WebP variants and strips EXIF GPS", async () => {
    // Create an image with simulated EXIF metadata including GPS
    const baseBuffer = await sharp({
      create: {
        width: 1600,
        height: 1200,
        channels: 3,
        background: { r: 100, g: 150, b: 200 },
      },
    })
      .withMetadata({
        exif: {
          IFD0: {
            Make: "DowntownTestCamera",
            Model: "CameraX",
          },
          GPSInfo: {
            GPSLatitudeRef: "N",
            GPSLatitude: "7/1 46/1 0/1",
            GPSLongitudeRef: "E",
            GPSLongitude: "4/1 34/1 0/1",
          },
        } as any,
      })
      .jpeg()
      .toBuffer();

    // Verify input had metadata
    const inputMeta = await sharp(baseBuffer).metadata();
    expect(inputMeta.exif).toBeDefined();

    // Process through our pipeline
    const processed = await processListingPhoto(baseBuffer, "user_seller_1", "photo_123");

    expect(processed.displayKey).toMatch(/^listings\/user_seller_1\/photo_123\/display-[a-f0-9]{12}\.webp$/);
    expect(processed.thumbKey).toMatch(/^listings\/user_seller_1\/photo_123\/thumb-[a-f0-9]{12}\.webp$/);
    expect(processed.width).toBeLessThanOrEqual(1000);
    expect(processed.bytes).toBeGreaterThan(0);
    expect(processed.bytes).toBe(processed.displayBuffer.length + processed.thumbBuffer.length);

    // Verify display variant has stripped EXIF GPS
    const displayMeta = await sharp(processed.displayBuffer).metadata();
    expect(displayMeta.format).toBe("webp");
    expect(displayMeta.exif).toBeUndefined(); // ALL EXIF stripped

    // Verify thumbnail variant dimensions and format
    const thumbMeta = await sharp(processed.thumbBuffer).metadata();
    expect(thumbMeta.format).toBe("webp");
    expect(thumbMeta.width).toBeLessThanOrEqual(400);
    expect(thumbMeta.height).toBeLessThanOrEqual(400);
    expect(thumbMeta.exif).toBeUndefined();
  });

  it("throws when processing invalid magic byte buffer", async () => {
    const fakePhoto = Buffer.from("NotAnImageAtAll");
    await expect(processListingPhoto(fakePhoto, "user_1", "photo_1")).rejects.toThrow(
      "Unsupported file signature"
    );
  });
});

describe("Storage: InMemoryStorageService", () => {
  const storage = new InMemoryStorageService("https://cdn.downtown.ng");

  it("uploads, retrieves public URL, and deletes objects", async () => {
    const buffer = Buffer.from("test image content");
    const key = "test/photo.webp";

    const url = await storage.upload(key, buffer, "image/webp");
    expect(url).toBe("https://cdn.downtown.ng/test/photo.webp");
    expect(storage.getStored(key)?.buffer).toEqual(buffer);

    await storage.delete(key);
    expect(storage.getStored(key)).toBeUndefined();
  });
});

describe("Storage: getBlobToken environment selection logic", () => {
  const origVercelEnv = process.env.VERCEL_ENV;
  const origProdToken = process.env.BLOB_READ_WRITE_TOKEN;
  const origDevToken = process.env.DEV_READ_WRITE_TOKEN;

  afterEach(() => {
    if (origVercelEnv !== undefined) process.env.VERCEL_ENV = origVercelEnv;
    else delete process.env.VERCEL_ENV;

    if (origProdToken !== undefined) process.env.BLOB_READ_WRITE_TOKEN = origProdToken;
    else delete process.env.BLOB_READ_WRITE_TOKEN;

    if (origDevToken !== undefined) process.env.DEV_READ_WRITE_TOKEN = origDevToken;
    else delete process.env.DEV_READ_WRITE_TOKEN;
  });

  it("reads BLOB_READ_WRITE_TOKEN in production environment", () => {
    process.env.VERCEL_ENV = "production";
    process.env.BLOB_READ_WRITE_TOKEN = "vercel_blob_rw_prod_secret_123";
    process.env.DEV_READ_WRITE_TOKEN = "vercel_blob_rw_dev_secret_456";

    expect(getBlobToken()).toBe("vercel_blob_rw_prod_secret_123");
  });

  it("fails closed in production if BLOB_READ_WRITE_TOKEN is missing (never falls back to DEV token)", () => {
    process.env.VERCEL_ENV = "production";
    delete process.env.BLOB_READ_WRITE_TOKEN;
    process.env.DEV_READ_WRITE_TOKEN = "vercel_blob_rw_dev_secret_456";

    expect(() => getBlobToken()).toThrow(
      "Production Vercel Blob token (BLOB_READ_WRITE_TOKEN) is not configured"
    );
  });

  it("reads DEV_READ_WRITE_TOKEN in preview environment", () => {
    process.env.VERCEL_ENV = "preview";
    process.env.DEV_READ_WRITE_TOKEN = "vercel_blob_rw_dev_secret_456";
    delete process.env.BLOB_READ_WRITE_TOKEN;

    expect(getBlobToken()).toBe("vercel_blob_rw_dev_secret_456");
  });

  it("reads DEV_READ_WRITE_TOKEN in development environment", () => {
    process.env.VERCEL_ENV = "development";
    process.env.DEV_READ_WRITE_TOKEN = "vercel_blob_rw_dev_secret_456";

    expect(getBlobToken()).toBe("vercel_blob_rw_dev_secret_456");
  });

  it("throws in non-production if no tokens are configured", () => {
    process.env.VERCEL_ENV = "preview";
    delete process.env.DEV_READ_WRITE_TOKEN;
    delete process.env.BLOB_READ_WRITE_TOKEN;

    expect(() => getBlobToken()).toThrow(
      "Vercel Blob token (DEV_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN) is not configured"
    );
  });
});

