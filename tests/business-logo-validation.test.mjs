import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { crc32, deflateSync } from "node:zlib";
import test from "node:test";
import { createLogoUploadHandler, FIXTURE_ID } from "../supabase/functions/validate-business-logo/handler.mjs";
import { MAX_LOGO_BYTES, normalizeLogoPng } from "../supabase/functions/validate-business-logo/png.mjs";

function pngChunk(type, data = Buffer.alloc(0)) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  const size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([size, payload, crc]);
}

function png({ width = 1, pixels = [0, 200, 50, 100, 255], extra = [], compressedSuffix = [], color = 6 } = {}) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width);
  header.writeUInt32BE(1, 4);
  header[8] = 8;
  header[9] = color;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk("IHDR", header), ...extra,
    pngChunk("IDAT", Buffer.concat([deflateSync(Buffer.from(pixels)), Buffer.from(compressedSuffix)])),
    pngChunk("IEND"),
  ]);
}

test("static RGB and RGBA PNGs pass and private metadata is removed", () => {
  const rgba = png({ extra: [pngChunk("tEXt", Buffer.from("Comment\0internal note"))] });
  const normalized = normalizeLogoPng(rgba);
  assert.deepEqual(normalized, normalizeLogoPng(png()));
  assert.deepEqual(normalized, normalizeLogoPng(normalized));
  assert.equal(Buffer.from(normalized).includes("internal note"), false);
  assert.ok(normalizeLogoPng(png({ color: 2, pixels: [0, 22, 33, 44] })).length > 0);
});

test("rejects a type mismatch, bad checksum, and truncated image", () => {
  const invalid = png();
  invalid[29] ^= 1;
  for (const bytes of [Buffer.alloc(68, 32), invalid, png().subarray(0, -1)]) {
    assert.throws(() => normalizeLogoPng(bytes), { message: "INVALID_LOGO_PNG" });
  }
});

test("rejects invalid scanlines, trailing compressed data and extra decoded bytes", () => {
  for (const bytes of [
    png({ pixels: [5, 1, 2, 3, 4] }),
    png({ pixels: [0, 1, 2, 3, 4, 5] }),
    png({ pixels: [0, 1, 2] }),
    png({ compressedSuffix: [0] }),
  ]) assert.throws(() => normalizeLogoPng(bytes), { message: "INVALID_LOGO_PNG" });
});

test("enforces dimension, input and supported encoding limits", () => {
  assert.throws(() => normalizeLogoPng(png({ width: 1025 })), { message: "LOGO_DIMENSIONS_TOO_LARGE" });
  assert.throws(() => normalizeLogoPng(Buffer.alloc(MAX_LOGO_BYTES + 1)), { message: "LOGO_TOO_LARGE" });
  assert.throws(() => normalizeLogoPng(png({ extra: [pngChunk("acTL", Buffer.alloc(8))] })), { message: "UNSUPPORTED_LOGO_PNG" });
  assert.throws(() => normalizeLogoPng(png({ color: 3 })), { message: "UNSUPPORTED_LOGO_PNG" });
});

const user = "11111111-1111-4111-8111-111111111111";
const url = "https://local.invalid/validate-business-logo";
const auth = "Bearer " + "a".repeat(32);
function request(body = png(), headers = {}) {
  return new Request(url, { method: "POST", headers: { "content-type": "image/png", authorization: auth, ...headers }, body });
}
function fixture({ owner = () => true, session = true, enabled = true, gate = () => true, dropAcknowledgement = false, wrongBytes = false } = {}) {
  const objects = new Map();
  let writes = 0, ownerChecks = 0, gateChecks = 0;
  const handle = createLogoUploadHandler({
    configured: () => enabled,
    gateReady: () => gate(++gateChecks),
    allowedOrigin: origin => origin === "https://staging.invalid",
    createUserClient: token => {
      assert.equal("Bearer " + token, auth);
      return {
        auth: { getUser: async () => ({ data: { user: { id: user } } }) },
        rpc: async (name, args) => {
          if (name === "app_session_status") return { data: { session_valid: session } };
          assert.equal(name, "business_logo_owner");
          assert.ok(args.p_name.startsWith(FIXTURE_ID + "/" + user + "/"));
          return { data: owner(++ownerChecks) };
        },
      };
    },
    storeLogo: async (path, bytes) => {
      if (objects.has(path)) throw Error("already stored");
      writes++;
      objects.set(path, new Blob([wrongBytes ? new Uint8Array(bytes.length) : bytes]));
      if (dropAcknowledgement) throw Error("response lost");
    },
    readLogo: async path => objects.get(path),
  });
  return { handle, objects, writes: () => writes };
}

test("auth, origin, configuration and owner checks prevent writes", async () => {
  for (const [flags, headers, status] of [
    [{}, { authorization: "" }, 401],
    [{}, { origin: "https://elsewhere.invalid" }, 403],
    [{ enabled: false }, {}, 503],
    [{ gate: () => false }, {}, 503],
    [{ gate: check => check === 1 }, {}, 503],
    [{ owner: () => false }, {}, 403],
    [{ session: false }, {}, 403],
    [{ owner: check => check === 1 }, {}, 403],
  ]) {
    const f = fixture(flags);
    assert.equal((await f.handle(request(png(), headers))).status, status);
    assert.equal(f.writes(), 0);
  }
});

test("declared type, malformed bytes and streaming size refusals leave storage empty", async () => {
  const f = fixture();
  assert.equal((await f.handle(request(png(), { "content-type": "image/jpeg" }))).status, 415);
  assert.equal((await f.handle(request(Buffer.alloc(68)))).status, 422);
  assert.equal((await f.handle(request(Buffer.alloc(MAX_LOGO_BYTES + 1)))).status, 413);
  assert.equal(f.writes(), 0);
});

test("accepted bytes are normalized and retry after a lost acknowledgement returns the same path", async () => {
  const f = fixture({ dropAcknowledgement: true });
  const first = await f.handle(request(png({ extra: [pngChunk("tEXt", Buffer.from("x\0private"))] })));
  assert.equal(first.status, 200);
  assert.equal(first.headers.get("cache-control"), "private, no-store");
  const { path } = await first.json();
  const retry = await f.handle(request());
  assert.equal(retry.status, 200);
  assert.deepEqual(await retry.json(), { path });
  assert.equal(f.writes(), 1);
  assert.deepEqual(new Uint8Array(await f.objects.get(path).arrayBuffer()), normalizeLogoPng(png()));
});

test("mismatched persisted bytes and late owner removal withhold the path", async () => {
  const mismatch = fixture({ wrongBytes: true });
  assert.deepEqual(await (await mismatch.handle(request())).json(), { error: "LOGO_WRITE_UNCONFIRMED" });
  const changed = fixture({ owner: check => check <= 2 });
  const response = await changed.handle(request());
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "CURRENT_BUSINESS_OWNER_REQUIRED" });
});
