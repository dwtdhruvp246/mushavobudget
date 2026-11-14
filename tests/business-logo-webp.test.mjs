import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { inflateSync } from "node:zlib";
import test from "node:test";
import { decode } from "../scripts/fixtures/logo-jpeg-tools/node_modules/@stacksjs/ts-webp/dist/index.js";
import * as samples from "../scripts/fixtures/logo-jpeg-tools/webp-images.mjs";
import { normalizeLogoWebp } from "../supabase/functions/validate-business-logo/webp.mjs";
import { createLogoUploadHandler, FIXTURE_ID } from "../supabase/functions/validate-business-logo/handler.mjs";

const image = name => Buffer.from(samples[name], "base64");

test("accepts independently encoded lossy and lossless images", () => {
  for (const sample of ["LOSSY", "LOSSLESS_ALPHA"]) {
    const png = Buffer.from(normalizeLogoWebp(image(sample), decode));
    assert.equal(png.readUInt32BE(16), 4);
    assert.equal(png.readUInt32BE(20), 3);
    const scanlines = inflateSync(png.subarray(41, 41 + png.readUInt32BE(33)));
    const alphas = Array.from({ length: 12 }, (_, i) => scanlines[Math.floor(i / 4) * 17 + (i % 4) * 4 + 4]);
    assert.deepEqual(alphas, Array.from({ length: 12 }, (_, i) => sample === "LOSSY" ? 255 : (i + 1) * 19));
  }
});

test("keeps lossy WebP transparency and EXIF orientation while discarding metadata", () => {
  const png = Buffer.from(normalizeLogoWebp(image("LOSSY_ALPHA"), decode));
  assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [3, 4]);
  const scan = inflateSync(png.subarray(41, 41 + png.readUInt32BE(33)));
  assert.deepEqual([scan[4], scan[8], scan[12]], [171, 95, 19]);
  assert.equal(png.includes("EXIF"), false);
});

test("rejects mismatched RIFF length, truncation, animation and excessive dimensions before decoding", () => {
  const never = () => assert.fail("decoder was called");
  assert.throws(() => normalizeLogoWebp(image("ANIMATED"), never), { message: "UNSUPPORTED_LOGO_WEBP" });
  assert.throws(() => normalizeLogoWebp(image("WIDE"), never), { message: "LOGO_DIMENSIONS_TOO_LARGE" });
  for (const bad of [image("LOSSY").subarray(0, -1), Buffer.concat([image("LOSSY"), Buffer.alloc(2)]), Buffer.alloc(40)]) {
    assert.throws(() => normalizeLogoWebp(bad, never), { message: "INVALID_LOGO_WEBP" });
  }
});

test("rejects a container and decoder dimension mismatch", () => {
  assert.throws(() => normalizeLogoWebp(image("LOSSY"), () => ({ width: 3, height: 4, data: new Uint8Array(48) })),
    { message: "INVALID_LOGO_WEBP" });
  const wrongCanvas = image("LOSSY_ALPHA");
  wrongCanvas[24] ^= 1;
  assert.throws(() => normalizeLogoWebp(wrongCanvas, decode), { message: "INVALID_LOGO_WEBP" });
});

test("stores only the validated PNG and reuses its path on retry", async () => {
  const user = "11111111-1111-4111-8111-111111111111", files = new Map();
  const handler = createLogoUploadHandler({
    configured: () => true, allowedOrigin: () => true, gateReady: () => true, decodeWebp: decode,
    createUserClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: user } } }) },
      rpc: async name => ({ data: name === "app_session_status" ? { session_valid: true } : true }),
    }),
    storeLogo: async (path, bytes) => {
      if (files.has(path)) throw Error("exists");
      files.set(path, new Blob([bytes], { type: "image/png" }));
    },
    readLogo: async path => files.get(path),
  });
  const send = body => handler(new Request("https://webp-test.invalid", { method: "POST", body,
    headers: { "content-type": "image/webp", authorization: "Bearer " + "a".repeat(32) } }));
  assert.equal((await send(image("ANIMATED"))).status, 415);
  assert.equal(files.size, 0);
  const accepted = await send(image("LOSSY_ALPHA"));
  assert.equal(accepted.status, 200);
  const { path } = await accepted.json();
  assert.ok(path.startsWith(FIXTURE_ID + "/" + user + "/") && path.endsWith(".png"));
  assert.deepEqual(await (await send(image("LOSSY_ALPHA"))).json(), { path });
  assert.equal(files.size, 1);
  assert.deepEqual(new Uint8Array(await files.get(path).arrayBuffer()), normalizeLogoWebp(image("LOSSY_ALPHA"), decode));
});
