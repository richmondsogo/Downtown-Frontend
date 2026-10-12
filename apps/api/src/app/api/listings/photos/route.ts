import { NextRequest, NextResponse } from "next/server";
import { authorizeUser } from "../../../../services/auth-guard";
import { listingService, ApiError } from "../../../../services/listing.service";
import { checkRateLimit } from "../../../../services/rate-limit.service";
import { validateImageMagicBytes } from "../../../../services/image.service";

// Maximum upload payload size: 4.5 MB (Vercel serverless request body limit)
const MAX_UPLOAD_BYTES = 4.5 * 1024 * 1024;

/**
 * POST /api/listings/photos
 *
 * Multipart or binary photo upload for listing photos.
 * - Requires active session, verified email, active account, and canSell.
 * - Enforces per-user rate limit (10 uploads per minute).
 * - Enforces max payload size (4.5 MB).
 * - Validates file magic bytes (JPEG, PNG, WebP).
 * - Enforces quota of max 20 unattached photos.
 * - Re-encodes to WebP, strips all EXIF GPS metadata, generates 400px thumb and 1200px display variant.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await authorizeUser(req, { requireCanSell: true });
    if (auth.errorResponse) return auth.errorResponse;

    // Rate limit: 10 uploads per minute per user
    const rlKey = `photo_upload:${auth.user.id}`;
    const rl = await checkRateLimit(rlKey, 10, 60 * 1000);
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many photo uploads. Please wait a moment before uploading more." },
        { status: 429 }
      );
    }

    const contentType = req.headers.get("content-type") || "";
    let fileBuffer: Buffer | null = null;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json({ message: "No file provided in form data." }, { status: 400 });
      }

      if (file.size > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { message: "File exceeds the 4.5 MB size limit." },
          { status: 413 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
    } else {
      // Direct binary body
      const arrayBuffer = await req.arrayBuffer();
      if (arrayBuffer.byteLength > MAX_UPLOAD_BYTES) {
        return NextResponse.json(
          { message: "File exceeds the 4.5 MB size limit." },
          { status: 413 }
        );
      }
      fileBuffer = Buffer.from(arrayBuffer);
    }

    if (!fileBuffer || fileBuffer.length === 0) {
      return NextResponse.json({ message: "Empty file received." }, { status: 400 });
    }

    // Verify magic bytes before processing
    const magic = validateImageMagicBytes(fileBuffer);
    if (!magic.valid) {
      return NextResponse.json(
        { message: magic.error || "Invalid file format. Upload must be a valid image." },
        { status: 400 }
      );
    }

    const photo = await listingService.uploadPhoto(auth.user.id, fileBuffer);
    return NextResponse.json(photo, { status: 201 });
  } catch (error) {
    if (error instanceof ApiError) {
      return NextResponse.json({ message: error.message }, { status: error.statusCode });
    }
    console.error("Failed to upload listing photo:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
