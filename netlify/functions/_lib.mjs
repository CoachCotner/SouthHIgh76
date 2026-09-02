import { getStore } from "@netlify/blobs";

// Photos need to appear on the wall the instant they are uploaded, so the
// store is strongly consistent. The listing endpoint puts a short CDN cache
// in front of it to absorb the polling traffic that comes with that.
export const PHOTO_PREFIX = "photos/";

export function photoStore() {
  return getStore({ name: "reunion-photos", consistency: "strong" });
}

const ascii = (bytes, at, len) =>
  String.fromCharCode(...bytes.subarray(at, at + len));

// ISO base-media files (HEIC, HEIF, AVIF) all start with a `ftyp` box. The
// brand that follows says which flavour it is, and a file may also list
// compatible brands after it — a Samsung HEIC, for instance, often declares
// `mif1` as its major brand and `heic` only as a compatible one.
function isoBrands(bytes) {
  if (bytes.length < 12 || ascii(bytes, 4, 4) !== "ftyp") return [];
  const boxSize = Math.min(
    (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3],
    bytes.length
  );
  const brands = [ascii(bytes, 8, 4)];
  for (let at = 16; at + 4 <= boxSize; at += 4) brands.push(ascii(bytes, at, 4));
  return brands;
}

const hasBrand = (bytes, wanted) => isoBrands(bytes).some((b) => wanted.includes(b));

// Phones lie about MIME types — iOS hands over HEIC as "" or
// "application/octet-stream" often enough that trusting the browser loses real
// photos. The first bytes of the file are the one source of truth, so every
// upload is identified by content and the declared type is ignored.
export const FORMATS = [
  {
    ext: "jpg",
    mime: "image/jpeg",
    displayable: true,
    sniff: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    ext: "png",
    mime: "image/png",
    displayable: true,
    sniff: (b) => b[0] === 0x89 && ascii(b, 1, 3) === "PNG",
  },
  {
    ext: "gif",
    mime: "image/gif",
    displayable: true,
    sniff: (b) => ascii(b, 0, 3) === "GIF",
  },
  {
    ext: "webp",
    mime: "image/webp",
    displayable: true,
    sniff: (b) => ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP",
  },
  {
    ext: "avif",
    mime: "image/avif",
    displayable: true,
    sniff: (b) => hasBrand(b, ["avif", "avis"]),
  },
  {
    // iPhone "High Efficiency" photos, and Android phones set the same way.
    // Safari renders these; Chrome and Firefox do not — the upload page
    // converts them to JPEG in the browser, and this is the safety net for
    // any that arrive unconverted. Better a photo we keep than one we drop.
    ext: "heic",
    mime: "image/heic",
    displayable: false,
    sniff: (b) =>
      hasBrand(b, ["heic", "heix", "heim", "heis", "hevc", "hevx", "mif1", "msf1"]),
  },
];

export const TYPE_BY_EXT = Object.fromEntries(FORMATS.map((f) => [f.ext, f.mime]));

/**
 * Identify an image from its leading bytes. Returns null if it isn't one.
 * Accepts an ArrayBuffer or any typed-array view — a Node Buffer is a view
 * into a shared pool, so reading its `.buffer` directly would hand back the
 * whole pool rather than this file's bytes.
 */
export function detectFormat(input) {
  const bytes = ArrayBuffer.isView(input)
    ? new Uint8Array(input.buffer, input.byteOffset, input.byteLength).subarray(0, 64)
    : new Uint8Array(input, 0, Math.min(64, input.byteLength));
  if (bytes.length < 12) return null;
  return FORMATS.find((f) => f.sniff(bytes)) || null;
}

// Keys are `photos/<epoch millis>-<uuid>.<ext>`. Epoch millis are a fixed
// width for the next few centuries, so sorting keys as strings sorts them by
// time — which lets the listing endpoint page through newest-first without
// reading every photo's metadata.
export function photoId(key) {
  return key.startsWith(PHOTO_PREFIX) ? key.slice(PHOTO_PREFIX.length) : key;
}

export function isValidPhotoId(id) {
  return /^\d{13}-[0-9a-f-]{36}\.[a-z]{3,4}$/.test(id);
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...headers },
  });
}
