'use client';

import { useRef, useState } from 'react';
import { AlertTriangle, ImagePlus, Link2, Loader2, Upload, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { FOOD_IMAGE_URL_MAX, isPresetFoodPhoto } from './food-data';

/**
 * Vendor-owned food photo picker.
 *
 * The primary path is a real upload from the vendor's phone/camera roll. A
 * pasted HTTPS link remains as a fallback, but there is no emoji option: a dish
 * without a photo is not publishable.
 */
export function FoodPhotoPicker({
  imageUrl,
  onImageChange,
  name,
  error,
}: {
  imageUrl: string;
  onImageChange: (value: string) => void;
  name: string;
  error?: string;
}) {
  const trimmed = imageUrl.trim();
  const [showUrl, setShowUrl] = useState(
    Boolean(trimmed) && !isPresetFoodPhoto(trimmed),
  );
  const [brokenSrc, setBrokenSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const isCustomUrl = trimmed !== '' && !isPresetFoodPhoto(trimmed);
  const urlBroken = isCustomUrl && brokenSrc === trimmed;

  function choose(value: string) {
    setBrokenSrc(null);
    setUploadError(null);
    onImageChange(value);
  }

  async function preparePhoto(file: File): Promise<File> {
    if (!file.type.startsWith('image/')) {
      throw new Error('Choose a JPG, PNG, WebP or a photo from your gallery.');
    }

    // Phone cameras produce large JPEGs, HEIC/HEIF images and sometimes 8–12 MB
    // files. Normalise everything to a <=1600px JPEG in the browser so the
    // upload works across Android/iOS and stays under the server limit.
    const objectUrl = URL.createObjectURL(file);
    try {
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () => reject(new Error('This photo could not be opened. Try a JPG or PNG.'));
        element.src = objectUrl;
      });

      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(image.naturalWidth, image.naturalHeight));
      const width = Math.max(1, Math.round(image.naturalWidth * scale));
      const height = Math.max(1, Math.round(image.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('This browser cannot prepare the photo. Use a JPG or PNG.');
      context.drawImage(image, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/jpeg', 0.86),
      );
      if (!blob) throw new Error('This browser cannot prepare the photo. Use a JPG or PNG.');
      return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'dish'}.jpg`, {
        type: 'image/jpeg',
      });
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  async function upload(file: File) {
    setUploading(true);
    setUploadError(null);
    try {
      const prepared = await preparePhoto(file);
      const formData = new FormData();
      formData.append('file', prepared);
      const response = await fetch('/api/vendor/menu/upload', {
        method: 'POST',
        body: formData,
      });
      const payload = (await response.json().catch(() => null)) as
        | { ok: true; data: { url: string } }
        | { ok: false; error: { message: string } }
        | null;
      if (!response.ok || !payload || !payload.ok) {
        throw new Error(
          payload && !payload.ok ? payload.error.message : 'The photo could not be uploaded.',
        );
      }
      choose(payload.data.url);
    } catch (caught) {
      setUploadError(caught instanceof Error ? caught.message : 'The photo could not be uploaded.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <Label className="text-sm">Dish photo</Label>
        <span className="text-[10px] font-medium text-slate-400">
          {trimmed ? 'Photo ready for the menu' : 'Required — upload a real photo'}
        </span>
      </div>

      <div
        className={cn(
          'relative overflow-hidden rounded-xl border-2 border-dashed bg-[#FBF6EA]/70 transition-colors',
          error ? 'border-red-300' : trimmed ? 'border-emerald-300' : 'border-amber-900/15',
        )}
      >
        {trimmed ? (
          <div className="relative aspect-[16/9] w-full">
            <img
              src={trimmed}
              alt={name || 'Dish photo'}
              className="h-full w-full object-cover"
              onError={() => setBrokenSrc(trimmed)}
            />
            <button
              type="button"
              onClick={() => choose('')}
              aria-label="Remove photo"
              className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-slate-950/70 text-white backdrop-blur transition-colors hover:bg-red-600"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
            {urlBroken ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/90 p-4 text-center">
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-amber-700">
                  <AlertTriangle className="h-4 w-4" aria-hidden />
                  This image link does not load. Upload a photo or use another link.
                </p>
              </div>
            ) : null}
          </div>
        ) : (
          <button
            type="button"
            data-photo-upload
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="flex min-h-[148px] w-full flex-col items-center justify-center gap-2 p-5 text-center transition-colors hover:bg-white/60 disabled:opacity-60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-primary-600 shadow-sm ring-1 ring-amber-900/10">
              {uploading ? (
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="h-5 w-5" aria-hidden />
              )}
            </span>
            <span className="text-sm font-semibold text-slate-800">
              {uploading ? 'Uploading photo…' : 'Upload a food photo'}
            </span>
            <span className="text-[11px] text-slate-500">
              Choose from your gallery or camera. Large photos are resized automatically.
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void upload(file);
        }}
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="inline-flex min-h-[36px] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 transition-colors hover:border-primary-300 hover:text-primary-700 disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" aria-hidden />
          {trimmed ? 'Replace photo' : 'Choose photo'}
        </button>
        <button
          type="button"
          onClick={() => setShowUrl((current) => !current)}
          aria-expanded={showUrl}
          aria-controls="menu-image-url-field"
          className="inline-flex min-h-[36px] items-center gap-1 rounded-full px-2 text-[10px] font-semibold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <Link2 className="h-3 w-3" aria-hidden />
          {showUrl ? 'Hide image link' : 'Use an image link'}
        </button>
      </div>

      {showUrl ? (
        <div id="menu-image-url-field" className="space-y-1.5">
          <div className="relative">
            <Link2
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <Input
              id="menu-image-url"
              value={imageUrl}
              onChange={(event) => choose(event.target.value)}
              maxLength={FOOD_IMAGE_URL_MAX}
              placeholder="https://…"
              aria-label="Photo link"
              className="pl-9 pr-10 text-xs"
              error={Boolean(error)}
            />
            {trimmed ? (
              <button
                type="button"
                onClick={() => choose('')}
                aria-label="Remove photo"
                className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-red-500"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          <p className="text-[10px] text-slate-400">
            Use a secure https link. Uploading a photo is recommended.
          </p>
        </div>
      ) : null}

      {uploadError || error ? (
        <p className="flex items-center gap-1 text-[10px] font-medium text-red-600" role="alert">
          <AlertTriangle className="h-3 w-3" aria-hidden />
          {uploadError ?? error}
        </p>
      ) : null}
    </div>
  );
}
