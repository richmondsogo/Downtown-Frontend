/**
 * Client-side image pre-compression utility complying with ADR 0007.
 * - Uses createImageBitmap with imageOrientation: "from-image" to respect EXIF orientation.
 * - Scales down to max edge 1000px to respect display needs and save cellular upload bandwidth.
 * - Encodes to WebP targeting <= 150 KB to comfortably fit under Vercel's 4.5 MB request limit.
 */

export interface CompressionResult {
  file: File;
  previewUrl: string;
  width: number;
  height: number;
}

export async function compressImage(
  file: File,
  maxEdge: number = 1000,
  targetQuality: number = 0.80
): Promise<CompressionResult> {
  let sourceWidth = 0;
  let sourceHeight = 0;
  let drawSource: CanvasImageSource;

  if (typeof window !== "undefined" && "createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      });
      sourceWidth = bitmap.width;
      sourceHeight = bitmap.height;
      drawSource = bitmap;
    } catch {
      // Fallback to HTMLImageElement
      const img = await loadImageElement(file);
      sourceWidth = img.naturalWidth || img.width;
      sourceHeight = img.naturalHeight || img.height;
      drawSource = img;
    }
  } else {
    const img = await loadImageElement(file);
    sourceWidth = img.naturalWidth || img.width;
    sourceHeight = img.naturalHeight || img.height;
    drawSource = img;
  }

  // Calculate target dimensions keeping aspect ratio
  let targetWidth = sourceWidth;
  let targetHeight = sourceHeight;

  if (sourceWidth > maxEdge || sourceHeight > maxEdge) {
    if (sourceWidth >= sourceHeight) {
      targetWidth = maxEdge;
      targetHeight = Math.round((sourceHeight * maxEdge) / sourceWidth);
    } else {
      targetHeight = maxEdge;
      targetWidth = Math.round((sourceWidth * maxEdge) / sourceHeight);
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to create canvas rendering context");
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(drawSource, 0, 0, targetWidth, targetHeight);

  // Close bitmap if applicable
  if ("close" in drawSource && typeof (drawSource as any).close === "function") {
    (drawSource as any).close();
  }

  // Convert to WebP blob
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("Canvas toBlob failed"));
      },
      "image/webp",
      targetQuality
    );
  });

  const baseName = file.name.replace(/\.[^/.]+$/, "");
  const compressedFile = new File([blob], `${baseName}.webp`, {
    type: "image/webp",
    lastModified: Date.now(),
  });

  const previewUrl = URL.createObjectURL(blob);

  return {
    file: compressedFile,
    previewUrl,
    width: targetWidth,
    height: targetHeight,
  };
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (err) => {
      URL.revokeObjectURL(url);
      reject(err);
    };
    img.src = url;
  });
}
