import { Buffer } from "node:buffer";
import { crc32, deflateSync, inflateSync } from "node:zlib";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 1024;
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export class LogoInputError extends Error {
  constructor(status, code) {
    super(code);
    this.status = status;
  }
}

function invalid() {
  return new LogoInputError(422, "INVALID_LOGO_PNG");
}

function chunk(type, data) {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length);
  bytes.write(type, 4, 4, "ascii");
  bytes.set(data, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)), bytes.length - 4);
  return bytes;
}

// This disposable trial handles static, non-interlaced, 8-bit RGB/RGBA PNG.
// Validate the entire image stream and emit only the pixel-bearing PNG chunks.
export function normalizeLogoPng(input) {
  if (!(input instanceof Uint8Array) || input.length < 57) throw invalid();
  if (input.length > MAX_LOGO_BYTES) throw new LogoInputError(413, "LOGO_TOO_LARGE");
  const bytes = Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  if (!SIGNATURE.equals(bytes.subarray(0, 8))) throw invalid();

  let header, rowBytes, height, closedData = false, ended = false;
  const compressed = [];
  for (let offset = 8, count = 0; offset < bytes.length;) {
    if (++count > 512 || offset + 12 > bytes.length) throw invalid();
    const size = bytes.readUInt32BE(offset);
    const end = offset + size + 12;
    if (end > bytes.length) throw invalid();
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    const data = bytes.subarray(offset + 8, end - 4);
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)
        || crc32(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw invalid();
    offset = end;

    if (!header) {
      if (type !== "IHDR" || size !== 13) throw invalid();
      const width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      if (!width || !height) throw invalid();
      if (width > MAX_SIDE || height > MAX_SIDE) throw new LogoInputError(413, "LOGO_DIMENSIONS_TOO_LARGE");
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[10] || data[11] || data[12]) {
        throw new LogoInputError(415, "UNSUPPORTED_LOGO_PNG");
      }
      rowBytes = width * (data[9] === 2 ? 3 : 4) + 1;
      header = data;
      continue;
    }
    if (type === "IDAT") {
      if (closedData) throw invalid();
      compressed.push(data);
    } else if (type === "IEND") {
      if (size || offset !== bytes.length || !compressed.length) throw invalid();
      ended = true;
    } else {
      if (/^[A-Z]/.test(type) || ["acTL", "fcTL", "fdAT", "tRNS", "eXIf"].includes(type)) {
        throw new LogoInputError(415, "UNSUPPORTED_LOGO_PNG");
      }
      if (compressed.length) closedData = true;
    }
  }
  if (!ended) throw invalid();
  const zlib = Buffer.concat(compressed);
  const expected = rowBytes * height;
  let pixels;
  try {
    const decoded = inflateSync(zlib, { maxOutputLength: expected, info: true });
    if (decoded.engine.bytesWritten !== zlib.length || decoded.buffer.length !== expected) throw invalid();
    pixels = decoded.buffer;
  } catch {
    throw invalid();
  }
  for (let offset = 0; offset < pixels.length; offset += rowBytes) {
    if (pixels[offset] > 4) throw invalid();
  }
  const normalized = Buffer.concat([
    SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(pixels, { level: 3 })), chunk("IEND", Buffer.alloc(0)),
  ]);
  if (normalized.length > MAX_LOGO_BYTES) throw new LogoInputError(413, "LOGO_TOO_LARGE");
  return new Uint8Array(normalized);
}
