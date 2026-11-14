import { LogoInputError, MAX_LOGO_BYTES, MAX_LOGO_SIDE, encodeLogoRgbaPng } from "./png.mjs";
import { exifOrientation, orientRgba } from "./orientation.mjs";

const fourCC = (bytes, offset) => String.fromCharCode(...bytes.subarray(offset, offset + 4));
const le24 = (bytes, i) => bytes[i] | bytes[i + 1] << 8 | bytes[i + 2] << 16;
const invalid = () => new LogoInputError(422, "INVALID_LOGO_WEBP", "webp_container");
const unsupported = () => new LogoInputError(415, "UNSUPPORTED_LOGO_WEBP");

function checkDimensions(width, height) {
  if (!width || !height) throw invalid();
  if (width > MAX_LOGO_SIDE || height > MAX_LOGO_SIDE) {
    throw new LogoInputError(413, "LOGO_DIMENSIONS_TOO_LARGE");
  }
}

function imageDimensions(type, data) {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  if (type === "VP8L") {
    if (data.length < 6 || data[0] !== 47) throw invalid();
    const header = view.getUint32(1, true);
    if (header >>> 29) throw invalid();
    return { width: (header & 0x3fff) + 1, height: ((header >>> 14) & 0x3fff) + 1 };
  }
  if (data.length < 11 || (data[0] & 1) !== 0 || data[3] !== 157 || data[4] !== 1 || data[5] !== 42) throw invalid();
  return { width: view.getUint16(6, true) & 0x3fff, height: view.getUint16(8, true) & 0x3fff };
}

function inspectWebp(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 20 || fourCC(bytes, 0) !== "RIFF" || fourCC(bytes, 8) !== "WEBP") throw invalid();
  if (bytes.length > MAX_LOGO_BYTES) throw new LogoInputError(413, "LOGO_TOO_LARGE");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(4, true) + 8 !== bytes.length || bytes.length % 2) throw invalid();

  let flags, canvas, image, alpha = false, exif = false, xmp = false, orientation = 1;
  for (let i = 12, count = 0; i < bytes.length;) {
    if (i + 8 > bytes.length || ++count > 24) throw invalid();
    const type = fourCC(bytes, i), length = view.getUint32(i + 4, true);
    const end = i + 8 + length, next = end + length % 2;
    if (next > bytes.length || (next !== end && bytes[end] !== 0)) throw invalid();
    const data = bytes.subarray(i + 8, end);
    switch (type) {
      case "VP8X":
        if (i !== 12 || data.length !== 10 || (data[0] & 0xc1) || data[1] || data[2] || data[3]) throw invalid();
        flags = data[0];
        // Animation and color-managed files require a separate policy and decoder path.
        if (flags & 0x22) throw unsupported();
        canvas = { width: le24(data, 4) + 1, height: le24(data, 7) + 1 };
        checkDimensions(canvas.width, canvas.height);
        break;
      case "VP8 ":
      case "VP8L":
        if (image || (type === "VP8L" && alpha) || (!canvas && (i !== 12 || next !== bytes.length))) throw invalid();
        image = imageDimensions(type, data);
        checkDimensions(image.width, image.height);
        if (canvas && (image.width !== canvas.width || image.height !== canvas.height)) throw invalid();
        break;
      case "ALPH":
        if (!canvas || !(flags & 0x10) || alpha || image || !data.length) throw invalid();
        alpha = true;
        break;
      case "EXIF": {
        if (!canvas || !(flags & 0x08) || exif || !image) throw invalid();
        exif = true;
        const prefix = data.length >= 6 && fourCC(data, 0) === "Exif" && data[4] === 0 && data[5] === 0 ? 6 : 0;
        orientation = exifOrientation(data.subarray(prefix), invalid);
        break;
      }
      case "XMP ":
        if (!canvas || !(flags & 0x04) || xmp || !image) throw invalid();
        xmp = true;
        break;
      default:
        throw unsupported();
    }
    i = next;
  }
  if (!image || Boolean(flags & 0x08) !== exif || Boolean(flags & 0x04) !== xmp) throw invalid();
  return { ...image, orientation };
}

export function normalizeLogoWebp(bytes, decode) {
  const image = inspectWebp(bytes);
  let result;
  try {
    result = decode(bytes);
  } catch {
    throw new LogoInputError(422, "INVALID_LOGO_WEBP", "webp_decode");
  }
  if (result?.width !== image.width || result.height !== image.height
      || !(result.data instanceof Uint8Array || result.data instanceof Uint8ClampedArray)
      || result.data.length !== image.width * image.height * 4) {
    throw new LogoInputError(422, "INVALID_LOGO_WEBP", "webp_pixels");
  }
  const data = new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength);
  const oriented = orientRgba(data, image.width, image.height, image.orientation);
  return encodeLogoRgbaPng(oriented.width, oriented.height, oriented.data);
}
