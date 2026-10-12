import { put, del } from "@vercel/blob";

export interface StorageService {
  upload(key: string, buffer: Buffer, contentType: string): Promise<string>;
  delete(keyOrUrl: string): Promise<void>;
  getPublicUrl(keyOrUrl: string): string;
}

/**
 * In-memory StorageService fake for automated testing and isolated development.
 */
export class InMemoryStorageService implements StorageService {
  private store = new Map<string, { buffer: Buffer; contentType: string }>();
  private baseUrl: string;

  constructor(baseUrl: string = "https://fake-blob.downtown.internal") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
  }

  private normalizeKey(keyOrUrl: string): string {
    if (keyOrUrl.startsWith(this.baseUrl)) {
      return keyOrUrl.slice(this.baseUrl.length).replace(/^\//, "");
    }
    return keyOrUrl.replace(/^\//, "");
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const cleanKey = this.normalizeKey(key);
    this.store.set(cleanKey, { buffer, contentType });
    return this.getPublicUrl(cleanKey);
  }

  async delete(keyOrUrl: string): Promise<void> {
    const cleanKey = this.normalizeKey(keyOrUrl);
    this.store.delete(cleanKey);
  }

  getPublicUrl(keyOrUrl: string): string {
    if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
      return keyOrUrl;
    }
    const cleanKey = this.normalizeKey(keyOrUrl);
    return `${this.baseUrl}/${cleanKey}`;
  }

  getStored(keyOrUrl: string): { buffer: Buffer; contentType: string } | undefined {
    return this.store.get(this.normalizeKey(keyOrUrl));
  }

  clear(): void {
    this.store.clear();
  }
}

/**
 * Resolves the appropriate Vercel Blob token based on environment:
 * - VERCEL_ENV === "production": reads BLOB_READ_WRITE_TOKEN. Fails closed with an error if missing (never falls back to DEV tokens).
 * - preview / development / local: reads DEV_READ_WRITE_TOKEN (falls back to BLOB_READ_WRITE_TOKEN).
 */
export function getBlobToken(): string {
  const vercelEnv = process.env.VERCEL_ENV;

  if (vercelEnv === "production") {
    const prodToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!prodToken) {
      throw new Error(
        "Production Vercel Blob token (BLOB_READ_WRITE_TOKEN) is not configured. Production uploads fail closed and will never fall back to DEV tokens."
      );
    }
    return prodToken;
  }

  const devToken = process.env.DEV_READ_WRITE_TOKEN || process.env.BLOB_READ_WRITE_TOKEN;
  if (!devToken) {
    throw new Error(
      "Vercel Blob token (DEV_READ_WRITE_TOKEN or BLOB_READ_WRITE_TOKEN) is not configured for non-production environment."
    );
  }
  return devToken;
}

/**
 * Vercel Blob adapter complying with Hobby tier constraints.
 * - Explicitly passes resolved token to SDK calls.
 * - Stores public blobs with immutable 1-year cacheControlMaxAge so CDN hits avoid data transfer fees.
 * - Free del() cleanup.
 */
export class VercelBlobStorageService implements StorageService {
  private tokenResolver: () => string;

  constructor(token?: string | (() => string)) {
    if (typeof token === "string") {
      this.tokenResolver = () => token;
    } else if (typeof token === "function") {
      this.tokenResolver = token;
    } else {
      this.tokenResolver = getBlobToken;
    }
  }

  async upload(key: string, buffer: Buffer, contentType: string): Promise<string> {
    const token = this.tokenResolver();
    const blob = await put(key, buffer, {
      access: "public",
      contentType,
      cacheControlMaxAge: 31536000, // 1 year immutable edge cache
      addRandomSuffix: false,
      token,
    });
    return blob.url;
  }

  async delete(keyOrUrl: string): Promise<void> {
    const token = this.tokenResolver();
    await del(keyOrUrl, { token });
  }

  getPublicUrl(keyOrUrl: string): string {
    return keyOrUrl;
  }
}

let activeStorageService: StorageService | null = null;

export function getStorageService(): StorageService {
  if (activeStorageService) return activeStorageService;

  if (
    process.env.STORAGE_PROVIDER === "vercel_blob" ||
    (Boolean(process.env.VERCEL) && process.env.STORAGE_PROVIDER !== "memory")
  ) {
    activeStorageService = new VercelBlobStorageService();
  } else {
    activeStorageService = new InMemoryStorageService();
  }
  return activeStorageService;
}

export function setStorageService(service: StorageService | null): void {
  activeStorageService = service;
}
