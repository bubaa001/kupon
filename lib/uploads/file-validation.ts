const IMAGE_SIGNATURES = {
  'image/jpeg': (data: Uint8Array) =>
    data.length >= 4 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff &&
    data[data.length - 2] === 0xff && data[data.length - 1] === 0xd9,
  'image/png': (data: Uint8Array) =>
    data.length >= 20 &&
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
    data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a,
  'image/webp': (data: Uint8Array) =>
    data.length >= 16 &&
    data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46 &&
    data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50 &&
    new DataView(data.buffer, data.byteOffset, data.byteLength).getUint32(4, true) === data.length - 8,
} as const;

export type SafeImageContentType = keyof typeof IMAGE_SIGNATURES;
export type SafeDocumentContentType = SafeImageContentType | 'application/pdf';

/** Match client MIME metadata against the actual uploaded bytes. */
export function isSafeImageUpload(data: Uint8Array, contentType: string): contentType is SafeImageContentType {
  return Object.hasOwn(IMAGE_SIGNATURES, contentType) &&
    IMAGE_SIGNATURES[contentType as SafeImageContentType](data);
}

export function isSafeVendorDocument(data: Uint8Array, contentType: string): contentType is SafeDocumentContentType {
  if (contentType === 'application/pdf') {
    return data.length >= 8 &&
      data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46 && data[4] === 0x2d;
  }
  return isSafeImageUpload(data, contentType);
}
