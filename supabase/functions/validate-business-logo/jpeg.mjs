import { LogoInputError, MAX_LOGO_BYTES, MAX_LOGO_SIDE, encodeLogoRgbaPng } from "./png.mjs";

import { exifOrientation, orientRgba } from "./orientation.mjs";

const MAX_SEGMENTS = 256;
const MAX_SCANS = 32;
const EXIF = [69, 120, 105, 102, 0, 0];

function invalid(reason) {
  return new LogoInputError(422, "INVALID_LOGO_JPEG", reason);
}

// Bound frame dimensions, component geometry and scan count before the decoder
// performs pixel work. Decoder validation still checks the compressed scan data.
function inspectJpeg(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 4
      || bytes[0] !== 255 || bytes[1] !== 216) throw invalid("jpeg_signature");
  if (bytes.length > MAX_LOGO_BYTES) throw new LogoInputError(413, "LOGO_TOO_LARGE");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let cursor = 2, frame, orientation, scans = 0, segments = 0;
  while (cursor < bytes.length) {
    if (++segments > MAX_SEGMENTS || bytes[cursor++] !== 255) throw invalid("jpeg_marker");
    while (bytes[cursor] === 255) cursor++;
    const marker = bytes[cursor++];
    if (marker === 217) {
      if (!frame || !scans || cursor !== bytes.length) throw invalid("jpeg_end");
      return { ...frame, orientation: orientation ?? 1 };
    }
    if (cursor + 2 > bytes.length) throw invalid("jpeg_segment_length");
    const length = view.getUint16(cursor);
    const start = cursor + 2, end = cursor + length;
    if (length < 2 || end > bytes.length) throw invalid("jpeg_segment_length");
    cursor = end;

    if (marker === 192 || marker === 194) {
      if (frame || length < 8 || scans) throw invalid("jpeg_frame");
      const height = view.getUint16(start + 1), width = view.getUint16(start + 3);
      const components = bytes[start + 5];
      if (!width || !height || length !== 8 + 3 * components) throw invalid("jpeg_frame");
      if (width > MAX_LOGO_SIDE || height > MAX_LOGO_SIDE) {
        throw new LogoInputError(413, "LOGO_DIMENSIONS_TOO_LARGE");
      }
      if (bytes[start] !== 8 || ![1, 3].includes(components)) {
        throw new LogoInputError(415, "UNSUPPORTED_LOGO_JPEG");
      }
      let blocks = 0;
      for (let i = 0; i < components; i++) {
        const sample = bytes[start + 7 + 3 * i];
        const h = sample >>> 4, v = sample & 15;
        if (h < 1 || h > 4 || v < 1 || v > 4) throw invalid("jpeg_sampling");
        blocks += h * v;
      }
      if (blocks > 10) throw invalid("jpeg_sampling");
      frame = { width, height, components };
    } else if (marker === 218) {
      const components = bytes[start];
      if (!frame || ++scans > MAX_SCANS || components < 1 || components > frame.components
          || length !== 6 + 2 * components) throw invalid("jpeg_scan");
      // FF00 is a stuffed byte. Restart markers are part of the scan.
      while (cursor < bytes.length) {
        if (bytes[cursor++] !== 255) continue;
        const prefix = cursor - 1;
        while (bytes[cursor] === 255) cursor++;
        const next = bytes[cursor++];
        if (next === 0 || (next >= 208 && next <= 215)) continue;
        cursor = prefix;
        break;
      }
    } else if (marker >= 224 && marker <= 239) {
      if (marker === 225 && end - start >= EXIF.length && EXIF.every((byte, i) => bytes[start + i] === byte)) {
        if (orientation !== undefined) throw invalid("jpeg_exif");
        orientation = exifOrientation(bytes.subarray(start + EXIF.length, end), () => invalid("jpeg_exif"));
      }
    } else if (![196, 219, 221, 254].includes(marker)) {
      throw new LogoInputError(415, "UNSUPPORTED_LOGO_JPEG");
    }
  }
  throw invalid("jpeg_end");
}

export function normalizeLogoJpeg(bytes, decode) {
  const frame = inspectJpeg(bytes);
  let decoded;
  try {
    decoded = decode(bytes, {
      useTArray: true, formatAsRGBA: true, tolerantDecoding: false,
      maxResolutionInMP: 1.049, maxMemoryUsageInMB: 32,
    });
  } catch {
    throw invalid("jpeg_decode");
  }
  if (decoded?.width !== frame.width || decoded.height !== frame.height
      || !(decoded.data instanceof Uint8Array) || decoded.data.length !== frame.width * frame.height * 4) {
    throw invalid("jpeg_pixels");
  }
  const image = orientRgba(decoded.data, frame.width, frame.height, frame.orientation);
  return encodeLogoRgbaPng(image.width, image.height, image.data);
}
