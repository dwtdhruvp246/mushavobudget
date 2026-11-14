import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";
import test from "node:test";
import jpeg from "../scripts/fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js";
import { GRAYSCALE_JPEG, PROGRESSIVE_ROTATED_JPEG } from "../scripts/fixtures/logo-jpeg-tools/images.mjs";
import { normalizeLogoJpeg } from "../supabase/functions/validate-business-logo/jpeg.mjs";
import { createLogoUploadHandler, FIXTURE_ID } from "../supabase/functions/validate-business-logo/handler.mjs";

const source = Buffer.from(PROGRESSIVE_ROTATED_JPEG, "base64");

function pixelsOf(bytes) {
  const png = Buffer.from(bytes);
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  assert.equal(png.toString("ascii", 37, 41), "IDAT");
  const length = png.readUInt32BE(33);
  assert.equal(png.toString("ascii", 49 + length, 53 + length), "IEND");
  assert.equal(png.length, 57 + length);
  const scan = inflateSync(png.subarray(41, 41 + length));
  const rowLength = width * 4;
  const pixels = Buffer.alloc(rowLength * height);
  for (let y = 0; y < height; y++) {
    const offset = y * (rowLength + 1);
    assert.equal(scan[offset], 0);
    pixels.set(scan.subarray(offset + 1, offset + 1 + rowLength), y * rowLength);
  }
  return { width, height, pixels };
}

test("rotates progressive JPEG pixels according to EXIF and saves only PNG pixels", () => {
  const normalized = pixelsOf(normalizeLogoJpeg(source, jpeg.decode));
  assert.deepEqual([normalized.width, normalized.height], [3, 4]);
  const original = jpeg.decode(source, { useTArray: true });
  for (let y = 0; y < original.height; y++) {
    for (let x = 0; x < original.width; x++) {
      const from = (y * original.width + x) * 4;
      const to = (x * normalized.width + original.height - 1 - y) * 4;
      assert.deepEqual(normalized.pixels.subarray(to, to + 4), Buffer.from(original.data.subarray(from, from + 4)));
    }
  }
});

test("accepts grayscale and baseline JPEGs through the same bounded decoder", () => {
  const gray = pixelsOf(normalizeLogoJpeg(Buffer.from(GRAYSCALE_JPEG, "base64"), jpeg.decode));
  assert.deepEqual([gray.width, gray.height], [4, 3]);
  for (let i = 0; i < gray.pixels.length; i += 4) {
    assert.equal(gray.pixels[i], gray.pixels[i + 1]);
    assert.equal(gray.pixels[i], gray.pixels[i + 2]);
    assert.equal(gray.pixels[i + 3], 255);
  }
  const baseline = jpeg.encode({ width: 2, height: 3, data: Buffer.alloc(24, 190) }, 90).data;
  const decoded = pixelsOf(normalizeLogoJpeg(baseline, jpeg.decode));
  assert.deepEqual([decoded.width, decoded.height], [2, 3]);
});

test("rejects mislabeled, truncated, trailing and oversized JPEGs before decoding", () => {
  let calls = 0;
  const spy = (...args) => { calls++; return jpeg.decode(...args); };
  for (const bytes of [Buffer.from("not an image"), source.subarray(0, -2), Buffer.concat([source, Buffer.from([0])])]) {
    assert.throws(() => normalizeLogoJpeg(bytes, spy), { message: "INVALID_LOGO_JPEG" });
  }
  const tooWide = jpeg.encode({ width: 1025, height: 1, data: Buffer.alloc(1025 * 4, 100) }, 70).data;
  assert.throws(() => normalizeLogoJpeg(tooWide, spy), { message: "LOGO_DIMENSIONS_TOO_LARGE" });
  assert.equal(calls, 0);
});

test("validates the decoder result before publishing pixels", () => {
  assert.throws(() => normalizeLogoJpeg(source, () => { throw new Error("decode error"); }), { message: "INVALID_LOGO_JPEG" });
  assert.throws(() => normalizeLogoJpeg(source, () => ({ width: 4, height: 3, data: new Uint8Array(12) })), { message: "INVALID_LOGO_JPEG" });
});

test("JPEG upload returns an immutable PNG path and rejects mislabeled bytes without writing", async () => {
  const user = "11111111-1111-4111-8111-111111111111", objects = new Map();
  const handle = createLogoUploadHandler({
    configured: () => true, allowedOrigin: () => true, gateReady: () => true, decodeJpeg: jpeg.decode,
    createUserClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: user } } }) },
      rpc: async name => ({ data: name === "app_session_status" ? { session_valid: true } : true }),
    }),
    storeLogo: async (path, bytes) => {
      if (objects.has(path)) throw Error("already stored");
      objects.set(path, new Blob([bytes], { type: "image/png" }));
    },
    readLogo: async path => objects.get(path),
  });
  const send = bytes => handle(new Request("https://logo-test.invalid", {
    method: "POST", headers: { "content-type": "image/jpeg", authorization: "Bearer " + "a".repeat(32) }, body: bytes,
  }));
  const mismatch = await send(Buffer.from("not a JPEG"));
  assert.equal(mismatch.status, 422);
  assert.deepEqual(await mismatch.json(), { error: "INVALID_LOGO_JPEG" });
  assert.equal(objects.size, 0);
  const response = await send(source);
  assert.equal(response.status, 200);
  const { path } = await response.json();
  assert.ok(path.startsWith(FIXTURE_ID + "/" + user + "/") && path.endsWith(".png"));
  assert.deepEqual(await (await send(source)).json(), { path });
  assert.equal(objects.size, 1);
  assert.deepEqual(new Uint8Array(await objects.get(path).arrayBuffer()), normalizeLogoJpeg(source, jpeg.decode));
});
