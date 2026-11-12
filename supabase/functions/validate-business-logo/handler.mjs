import { LogoInputError, MAX_LOGO_BYTES, normalizeLogoPng } from "./png.mjs";

export const FIXTURE_ID = "dc22360d-4b49-4bd4-9131-8633f7e821ff";
export const LOGO_BUCKET = "business-logos";
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

async function readUpload(request) {
  if (Number(request.headers.get("content-length")) > MAX_LOGO_BYTES) {
    throw new LogoInputError(413, "LOGO_TOO_LARGE");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new LogoInputError(422, "INVALID_LOGO_PNG");
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 10000);
  const data = new Uint8Array(MAX_LOGO_BYTES);
  let length = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.byteLength > MAX_LOGO_BYTES) {
        void reader.cancel().catch(() => {});
        throw new LogoInputError(413, "LOGO_TOO_LARGE");
      }
      data.set(value, length);
      length += value.byteLength;
    }
    if (timedOut) throw new LogoInputError(408, "LOGO_UPLOAD_TIMEOUT");
    return data.subarray(0, length);
  } finally {
    clearTimeout(timeout);
    reader.releaseLock();
  }
}

async function fingerprint(bytes) {
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function createLogoUploadHandler({ configured, allowedOrigin, createUserClient, storeLogo, readLogo }) {
  return async request => {
    const origin = request.headers.get("origin");
    const allowed = !origin || allowedOrigin(origin);
    const headers = {
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Type": "application/json", Vary: "Origin, Authorization, apikey",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...(origin && allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    };
    const json = (status, value) => Response.json(value, { status, headers });
    const fail = (status, code) => json(status, { error: code });
    if (!allowed) return fail(403, "ORIGIN_NOT_ALLOWED");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED");
    if (!configured()) return fail(503, "LOGO_TRIAL_UNAVAILABLE");
    const token = /^Bearer ([A-Za-z0-9._-]{20,8192})$/i.exec(request.headers.get("authorization") || "")?.[1];
    if (!token) return fail(401, "AUTHENTICATION_REQUIRED");

    try {
      const client = createUserClient(token);
      const { data, error } = await client.auth.getUser();
      const userId = data?.user?.id;
      if (error || !UUID.test(userId || "")) return fail(401, "AUTHENTICATION_REQUIRED");
      const folder = `${FIXTURE_ID}/${userId}/`;
      const canWrite = async path => {
        const session = await client.rpc("app_session_status");
        if (session.error || session.data?.session_valid !== true) return false;
        const owner = await client.rpc("business_logo_owner", { p_name: path });
        return !owner.error && owner.data === true;
      };
      if (!await canWrite(folder + "00000000-0000-4000-8000-000000000000.png")) {
        return fail(403, "CURRENT_BUSINESS_OWNER_REQUIRED");
      }
      if (request.headers.get("content-type")?.toLowerCase() !== "image/png") {
        return fail(415, "PNG_REQUIRED_FOR_LOGO_TRIAL");
      }
      const png = normalizeLogoPng(await readUpload(request));
      const sha = await fingerprint(png);
      const objectId = sha.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
      const path = folder + objectId + ".png";
      if (!await canWrite(path)) return fail(403, "CURRENT_BUSINESS_OWNER_REQUIRED");

      // Reconcile a lost response or same-content retry against the actual bytes.
      // Store uses an immutable path. A different object is never overwritten.
      try { await storeLogo(path, png); } catch { /* Read back any committed result. */ }
      const stored = await readLogo(path, png.length);
      if (!(stored instanceof Blob) || stored.size !== png.length
          || await fingerprint(await stored.arrayBuffer()) !== sha) return fail(503, "LOGO_WRITE_UNCONFIRMED");
      if (!await canWrite(path)) return fail(403, "CURRENT_BUSINESS_OWNER_REQUIRED");
      return json(200, { path });
    } catch (error) {
      if (error instanceof LogoInputError) return fail(error.status, error.message);
      return fail(503, "LOGO_TRIAL_UNAVAILABLE");
    }
  };
}
