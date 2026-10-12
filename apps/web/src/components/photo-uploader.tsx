"use client";

import * as React from "react";
import {
  Camera,
  Image as ImageIcon,
  Trash2,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Loader2,
  Star,
} from "lucide-react";
import { Button } from "./ui/button";
import { compressImage } from "../utils/image-compression";
import { cn } from "@downtown/utils";

export interface UploadedPhoto {
  id: string;
  url: string;
  thumbUrl: string;
  width: number;
  height: number;
}

export interface UploadQueueItem {
  clientId: string;
  file: File;
  previewUrl: string;
  status: "compressing" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
  uploadedPhoto?: UploadedPhoto;
}

export interface PhotoUploaderProps {
  photos: UploadedPhoto[];
  onChange: (photos: UploadedPhoto[]) => void;
  maxPhotos?: number;
  className?: string;
}

export function PhotoUploader({
  photos,
  onChange,
  maxPhotos = 5,
  className,
}: PhotoUploaderProps) {
  const [queue, setQueue] = React.useState<UploadQueueItem[]>([]);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);

  const canAddMore = photos.length + queue.filter((q) => q.status !== "done" && q.status !== "error").length < maxPhotos;

  // Process upload queue with max 2 parallel uploads
  React.useEffect(() => {
    const activeUploads = queue.filter(
      (q) => q.status === "compressing" || q.status === "uploading"
    ).length;

    if (activeUploads >= 2) return;

    const nextItem = queue.find(
      (q) => q.status === "compressing" && q.progress === 0
    );

    if (!nextItem) return;

    processItem(nextItem);
  }, [queue]);

  const updateQueueItem = (
    clientId: string,
    updates: Partial<UploadQueueItem>
  ) => {
    setQueue((prev) =>
      prev.map((item) => (item.clientId === clientId ? { ...item, ...updates } : item))
    );
  };

  const processItem = async (item: UploadQueueItem) => {
    try {
      updateQueueItem(item.clientId, { status: "compressing", progress: 20 });

      // 1. Client-side compression
      const compressed = await compressImage(item.file);
      updateQueueItem(item.clientId, {
        previewUrl: compressed.previewUrl,
        status: "uploading",
        progress: 50,
      });

      // 2. Upload to server
      const formData = new FormData();
      formData.append("file", compressed.file);

      const res = await fetch("/api/listings/photos", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || "Upload failed");
      }

      const uploaded: UploadedPhoto = await res.json();

      updateQueueItem(item.clientId, {
        status: "done",
        progress: 100,
        uploadedPhoto: uploaded,
      });

      // Append to photos state
      onChange([...photos, uploaded]);

      // Remove from queue after brief delay
      setTimeout(() => {
        setQueue((prev) => prev.filter((q) => q.clientId !== item.clientId));
      }, 500);
    } catch (err: any) {
      updateQueueItem(item.clientId, {
        status: "error",
        error: err.message || "Failed to upload image",
        progress: 0,
      });
    }
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const availableSlots =
      maxPhotos - (photos.length + queue.filter((q) => q.status !== "done").length);
    const toProcess = Array.from(files).slice(0, Math.max(0, availableSlots));

    const newItems: UploadQueueItem[] = toProcess.map((file) => ({
      clientId: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      file,
      previewUrl: URL.createObjectURL(file),
      status: "compressing",
      progress: 0,
    }));

    setQueue((prev) => [...prev, ...newItems]);

    // Reset inputs
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  const handleRemovePhoto = async (index: number) => {
    const photoToRemove = photos[index];
    const newPhotos = photos.filter((_, i) => i !== index);
    onChange(newPhotos);

    // Call DELETE API in background (non-blocking)
    try {
      await fetch(`/api/listings/photos/${photoToRemove.id}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.warn("Background photo deletion failed:", e);
    }
  };

  const handleMovePhoto = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= photos.length) return;
    const reordered = [...photos];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    onChange(reordered);
  };

  const handleRetry = (clientId: string) => {
    const item = queue.find((q) => q.clientId === clientId);
    if (!item) return;
    updateQueueItem(clientId, { status: "compressing", progress: 0, error: undefined });
  };

  const handleCancelUpload = (clientId: string) => {
    setQueue((prev) => prev.filter((q) => q.clientId !== clientId));
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div>
          <label className="text-sm font-semibold text-foreground">
            Listing Photos ({photos.length}/{maxPhotos})
          </label>
          <p className="text-xs text-muted-foreground">
            First photo will be the cover image. Max {maxPhotos} photos.
          </p>
        </div>
      </div>

      {/* Grid of photos and upload triggers */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {/* Existing uploaded photos */}
        {photos.map((photo, index) => {
          const isCover = index === 0;
          return (
            <div
              key={photo.id}
              className="group relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/30 shadow-xs"
            >
              {/* Plain <img> strictly per ADR 0007 / instructions */}
              <img
                src={photo.thumbUrl || photo.url}
                alt={`Photo ${index + 1}`}
                width={photo.width}
                height={photo.height}
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover"
              />

              {/* Cover badge */}
              {isCover && (
                <div className="absolute top-1.5 left-1.5 bg-primary text-primary-foreground text-[10px] font-medium px-1.5 py-0.5 rounded-sm flex items-center gap-1 shadow-xs">
                  <Star className="h-3 w-3 fill-current" />
                  Cover
                </div>
              )}

              {/* Actions Overlay */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleRemovePhoto(index)}
                    aria-label={`Remove photo ${index + 1}`}
                    className="p-1 rounded bg-destructive/90 text-destructive-foreground hover:bg-destructive transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex justify-between items-center gap-1">
                  <button
                    type="button"
                    disabled={index === 0}
                    onClick={() => handleMovePhoto(index, index - 1)}
                    aria-label="Move photo left"
                    className="p-1 rounded bg-black/60 text-white disabled:opacity-30 hover:bg-black/80 transition-colors"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={index === photos.length - 1}
                    onClick={() => handleMovePhoto(index, index + 1)}
                    aria-label="Move photo right"
                    className="p-1 rounded bg-black/60 text-white disabled:opacity-30 hover:bg-black/80 transition-colors"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {/* In-progress Queue Items */}
        {queue.map((item) => (
          <div
            key={item.clientId}
            className="relative aspect-square rounded-lg overflow-hidden border border-border bg-muted/40 flex flex-col items-center justify-center p-2 text-center"
          >
            {item.previewUrl && (
              <img
                src={item.previewUrl}
                alt="Uploading preview"
                className="absolute inset-0 w-full h-full object-cover opacity-40 blur-xs"
              />
            )}

            <div className="relative z-10 flex flex-col items-center gap-1.5">
              {item.status === "error" ? (
                <>
                  <AlertCircle className="h-5 w-5 text-destructive" />
                  <span className="text-[10px] text-destructive font-medium line-clamp-1">
                    Failed
                  </span>
                  <div className="flex gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => handleRetry(item.clientId)}
                      className="p-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-[10px]"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCancelUpload(item.clientId)}
                      className="p-1 rounded bg-muted text-muted-foreground hover:text-foreground text-[10px]"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                  <span className="text-[10px] text-foreground font-medium">
                    {item.status === "compressing" ? "Optimizing..." : "Uploading..."}
                  </span>
                  {/* Progress bar */}
                  <div className="w-16 h-1 bg-muted rounded-full overflow-hidden mt-1">
                    <div
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        ))}

        {/* Upload Trigger Buttons (if under limit) */}
        {canAddMore && (
          <div className="aspect-square rounded-lg border-2 border-dashed border-border hover:border-primary/50 transition-colors bg-card flex flex-col items-center justify-center gap-2 p-2 text-muted-foreground">
            <span className="text-xs font-medium text-center">Add photo</span>
            <div className="flex gap-2">
              {/* Gallery Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 rounded-full bg-muted hover:bg-accent text-foreground transition-colors"
                title="Choose from files"
                aria-label="Choose image from device"
              >
                <ImageIcon className="h-4 w-4" />
              </button>

              {/* Camera Button */}
              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="p-2 rounded-full bg-muted hover:bg-accent text-foreground transition-colors"
                title="Take photo with camera"
                aria-label="Take photo with camera"
              >
                <Camera className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />
    </div>
  );
}
