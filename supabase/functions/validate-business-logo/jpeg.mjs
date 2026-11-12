import { LogoInputError, MAX_LOGO_BYTES, MAX_LOGO_SIDE, encodeLogoRgbaPng } from "./png.mjs";

const MAX_SEGMENTS = 256;
const MAX_SCANS = 32;
const EXIF = [69, 120, 105, 102, 0, 0];

function invalid(reason) {
  return new LogoInputError(422, "INVALID_LOGO_JPEG", reason);
}

function exifOrientation(data) {
  const tiff = data.subarray(EXIF.length);
  if (tiff.length < 8) throw invalid("jpeg_exif");
  const little = tiff[0] === 73 && tiff[1] === 73;
  const big = tiff[0] === 77 && tiff[1] === 77;
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  if ((!little && !big) || view.getUint16(2, little) !== 42) throw invalid("jpeg_exif");
  const start = view.getUint32(4, little);
  if (start < 8 || start > tiff.length - 2) throw invalid("jpeg_exif");
  const entries = view.getUint16(start, little);
  if (entries > 1024 || start + 2 + entries * 12 + 4 > tiff.length) throw invalid("jpeg_exif");
  let orientation;
  for (let i = 0; i < entries; i++) {
    const at = start + 2 + 12 * i;
    if (view.getUint16(at, little) !== 0x0112) continue;
    if (orientation !== undefined || view.getUint16(at + 2, little) !== 3
        || view.getUint32(at + 4, little) !== 1) throw invalid("jpeg_exif");
    orientation = view.getUint16(at + 8, little);
    if (orientation < 1 || orientation > 8) throw invalid("jpeg_exif");
  }
  return orientation ?? 1;
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
        orientation = exifOrientation(bytes.subarray(start, end));
      }
    } else if (![196, 219, 221, 254].includes(marker)) {
      throw new LogoInputError(415, "UNSUPPORTED_LOGO_JPEG");
    }
  }
  throw invalid("jpeg_end");
}

function orient(data, width, height, orientation) {
  if (orientation === 1) return { data, width, height };
  const swapped = orientation >= 5;
  const outWidth = swapped ? height : width, outHeight = swapped ? width : height;
  const pixels = new Uint8Array(data.length);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let dx, dy;
      switch (orientation) {
        case 2: dx = width - 1 - x; dy = y; break;
        case 3: dx = width - 1 - x; dy = height - 1 - y; break;
        case 4: dx = x; dy = height - 1 - y; break;
        case 5: dx = y; dy = x; break;
        case 6: dx = height - 1 - y; dy = x; break;
        case 7: dx = height - 1 - y; dy = width - 1 - x; break;
        case 8: dx = y; dy = width - 1 - x; break;
      }
      const from = (y * width + x) * 4, to = (dy * outWidth + dx) * 4;
      for (let c = 0; c < 4; c++) pixels[to + c] = data[from + c];
    }
  }
  return { data: pixels, width: outWidth, height: outHeight };
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
  const image = orient(decoded.data, frame.width, frame.height, frame.orientation);
  return encodeLogoRgbaPng(image.width, image.height, image.data);
}
