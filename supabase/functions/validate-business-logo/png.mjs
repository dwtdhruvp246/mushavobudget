import { deflateSync } from "node:zlib";

export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
const MAX_SIDE = 1024;
const SIGNATURE = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let i = 0; i < 8; i++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  return value;
});

export class LogoInputError extends Error {
  constructor(status, code, reason) {
    super(code);
    this.status = status;
    this.reason = reason;
  }
}

function invalid(reason) {
  return new LogoInputError(422, "INVALID_LOGO_PNG", reason);
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 255];
  return (crc ^ 0xffffffff) >>> 0;
}

function combine(parts) {
  const bytes = new Uint8Array(parts.reduce((length, part) => length + part.length, 0));
  let offset = 0;
  for (const part of parts) {
    bytes.set(part, offset);
    offset += part.length;
  }
  return bytes;
}

function chunk(type, data) {
  const bytes = new Uint8Array(data.length + 12);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) bytes[4 + i] = type.charCodeAt(i);
  bytes.set(data, 8);
  view.setUint32(bytes.length - 4, crc32(bytes.subarray(4, -4)));
  return bytes;
}

async function decodeScanlines(compressed, expected) {
  let cursor = 0;
  const input = new ReadableStream({
    pull(controller) {
      if (cursor === compressed.length) controller.close();
      else {
        const next = Math.min(cursor + 1024, compressed.length);
        controller.enqueue(compressed.subarray(cursor, next));
        cursor = next;
      }
    },
  });
  const reader = input.pipeThrough(new DecompressionStream("deflate")).getReader();
  const output = new Uint8Array(expected);
  let count = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (count + value.length > expected) {
        await reader.cancel();
        throw invalid("scanline_size");
      }
      output.set(value, count);
      count += value.length;
    }
    if (count !== expected) throw invalid("scanline_size");
    return output;
  } catch (error) {
    if (error instanceof LogoInputError) throw error;
    throw invalid("deflate_stream");
  } finally {
    reader.releaseLock();
  }
}

// This disposable trial handles static, non-interlaced, 8-bit RGB/RGBA PNG.
// Validate the entire image stream and emit only the pixel-bearing PNG chunks.
export async function normalizeLogoPng(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length < 57) throw invalid("input_size");
  if (bytes.length > MAX_LOGO_BYTES) throw new LogoInputError(413, "LOGO_TOO_LARGE");
  if (!SIGNATURE.every((byte, index) => bytes[index] === byte)) throw invalid("signature");
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  let header, rowBytes, height, closedData = false, ended = false;
  const compressed = [];
  for (let offset = 8, count = 0; offset < bytes.length;) {
    if (++count > 512 || offset + 12 > bytes.length) throw invalid("chunk_length");
    const size = view.getUint32(offset);
    const end = offset + size + 12;
    if (end > bytes.length) throw invalid("chunk_length");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    const data = bytes.subarray(offset + 8, end - 4);
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type)) throw invalid("chunk_type");
    if (crc32(bytes.subarray(offset + 4, end - 4)) !== view.getUint32(end - 4)) throw invalid("chunk_checksum");
    offset = end;

    if (!header) {
      if (type !== "IHDR" || size !== 13) throw invalid("header");
      const dimensions = new DataView(data.buffer, data.byteOffset, data.byteLength);
      const width = dimensions.getUint32(0);
      height = dimensions.getUint32(4);
      if (!width || !height) throw invalid("header");
      if (width > MAX_SIDE || height > MAX_SIDE) throw new LogoInputError(413, "LOGO_DIMENSIONS_TOO_LARGE");
      if (data[8] !== 8 || ![2, 6].includes(data[9]) || data[10] || data[11] || data[12]) {
        throw new LogoInputError(415, "UNSUPPORTED_LOGO_PNG");
      }
      rowBytes = width * (data[9] === 2 ? 3 : 4) + 1;
      header = data;
      continue;
    }
    if (type === "IDAT") {
      if (closedData) throw invalid("chunk_order");
      compressed.push(data);
    } else if (type === "IEND") {
      if (size || offset !== bytes.length || !compressed.length) throw invalid("chunk_order");
      ended = true;
    } else {
      if (/^[A-Z]/.test(type) || ["acTL", "fcTL", "fdAT", "tRNS", "eXIf"].includes(type)) {
        throw new LogoInputError(415, "UNSUPPORTED_LOGO_PNG");
      }
      if (compressed.length) closedData = true;
    }
  }
  if (!ended) throw invalid("chunk_order");
  const pixels = await decodeScanlines(combine(compressed), rowBytes * height);
  for (let offset = 0; offset < pixels.length; offset += rowBytes) {
    if (pixels[offset] > 4) throw invalid("scanline_filter");
  }
  const normalized = combine([
    SIGNATURE, chunk("IHDR", header), chunk("IDAT", deflateSync(pixels, { level: 3 })), chunk("IEND", new Uint8Array()),
  ]);
  if (normalized.length > MAX_LOGO_BYTES) throw new LogoInputError(413, "LOGO_TOO_LARGE");
  return normalized;
}
