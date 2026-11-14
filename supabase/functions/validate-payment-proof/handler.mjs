import { LogoInputError, MAX_LOGO_BYTES, normalizeLogoPng } from "../validate-business-logo/png.mjs";
import { normalizeLogoJpeg } from "../validate-business-logo/jpeg.mjs";
import { normalizeLogoWebp } from "../validate-business-logo/webp.mjs";

export const PAYMENT_ITEM = "97eaee71-6a2e-4653-8eb5-ca0653f101fa";
export const WORKSPACE = "017513c6-ce57-48af-b902-9552faeb83dd";
export const OWNER = "ca7bdcf2-e69d-42e2-8ae8-79cac6de2184";
export const BUCKET = "payment-proofs";
export const PREFIX = `personal/${OWNER}/fr3-proof/${PAYMENT_ITEM}/`;
const DRAIN_LIMIT = MAX_LOGO_BYTES + 64 * 1024;

async function readBoundedProof(request) {
  if (Number(request.headers.get("content-length")) > DRAIN_LIMIT) throw new LogoInputError(413, "PROOF_TOO_LARGE");
  const reader = request.body?.getReader();
  if (!reader) throw new LogoInputError(422, "INVALID_PROOF_IMAGE");
  let length = 0, timedOut = false;
  const bytes = new Uint8Array(MAX_LOGO_BYTES);
  const timer = setTimeout(() => {
    timedOut = true;
    void reader.cancel().catch(() => {});
  }, 10000);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const next = length + value.byteLength;
      if (next > DRAIN_LIMIT) {
        void reader.cancel().catch(() => {});
        throw new LogoInputError(413, "PROOF_TOO_LARGE");
      }
      if (next <= MAX_LOGO_BYTES) bytes.set(value, length);
      length = next;
    }
    if (timedOut) throw new LogoInputError(408, "PROOF_UPLOAD_TIMEOUT");
    if (length > MAX_LOGO_BYTES) throw new LogoInputError(413, "PROOF_TOO_LARGE");
    return bytes.subarray(0, length);
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
}

async function fingerprint(bytes) {
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, "0")).join("");
}

function bindPersonalProof(client, userId, _type = "", _request = /** @type {Request | undefined} */ (undefined)) {
  if (userId !== OWNER) return null;
  return {
    prefix: PREFIX,
    async canWrite() {
      const session = await client.rpc("app_session_status");
      if (session.error || session.data?.session_valid !== true) return false;
      const item = await client.from("payment_items").select("id,workspace_id,owner_id,visibility,family_id,status")
        .eq("id", PAYMENT_ITEM).maybeSingle();
      if (item.error || item.data?.id !== PAYMENT_ITEM || item.data.workspace_id !== WORKSPACE
          || item.data.owner_id !== OWNER || item.data.visibility !== "personal" || item.data.family_id !== null
          || item.data.status !== "active") return false;
      const entitlement = await client.rpc("effective_workspace_entitlement", { p_workspace_id: WORKSPACE });
      const e = entitlement.data?.[0];
      return !entitlement.error && e?.workspace_id === WORKSPACE && e.read_only === false && e.effective_status === "active";
    },
  };
}

/** @type {((bytes: Uint8Array) => Promise<Uint8Array>) | null} */
const noPdf = null;

/** @type {ReadonlyMap<string, {suffix: string, normalize: (bytes: Uint8Array) => Uint8Array | Promise<Uint8Array>}>} */
const defaultFormats = new Map();

export function createProofHandler({ configured, allowedOrigin, createUserClient, gateReady, store, read,
  decodeJpeg, decodeWebp, normalizePdf = noPdf, bind = bindPersonalProof, extraFormats = defaultFormats, standardFormats = true, attachmentHeader = false, denied = "PROOF_FIXTURE_OWNER_REQUIRED" }) {
  return async request => {
    const origin = request.headers.get("origin");
    const allowed = !origin || allowedOrigin(origin);
    const headers = {
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      Vary: "Origin, Authorization, apikey",
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info"
        + (attachmentHeader ? ", x-mushavo-attachment" : ""),
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      ...(origin && allowed ? { "Access-Control-Allow-Origin": origin } : {}),
    };
    const fail = (status, error) => Response.json({ error }, { status, headers });
    if (!allowed) return fail(403, "ORIGIN_NOT_ALLOWED");
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
    if (request.method !== "POST") return fail(405, "METHOD_NOT_ALLOWED");
    if (!configured()) return fail(503, "PROOF_TRIAL_UNAVAILABLE");
    const token = /^Bearer ([A-Za-z0-9._-]{20,8192})$/i.exec(request.headers.get("authorization") || "")?.[1];
    if (!token) return fail(401, "AUTHENTICATION_REQUIRED");
    const type = request.headers.get("content-type")?.toLowerCase() || "";
    const format = extraFormats.get(type);
    const normalize = format?.normalize ?? (!standardFormats ? null : type === "image/png" ? normalizeLogoPng
      : type === "image/jpeg" ? bytes => normalizeLogoJpeg(bytes, decodeJpeg)
      : type === "image/webp" ? bytes => normalizeLogoWebp(bytes, decodeWebp)
      : type === "application/pdf" ? normalizePdf : null);
    if (!normalize) return fail(415, "UNSUPPORTED_PROOF_TYPE");

    try {
      const client = createUserClient(token);
      const identity = await client.auth.getUser();
      if (identity.error || !identity.data?.user?.id) return fail(401, "AUTHENTICATION_REQUIRED");
      const binding = bind(client, identity.data.user.id, type, request);
      if (!binding) return fail(403, denied);
      const { prefix, canWrite } = binding;
      if (!await canWrite()) return fail(403, denied);
      if (!await gateReady(type)) return fail(503, "PROOF_TRIAL_UNAVAILABLE");
      const canonical = await normalize(await readBoundedProof(request));
      const isPdf = type === "application/pdf";
      const outputType = format ? type : isPdf ? "application/pdf" : "image/png";
      const hash = await fingerprint(canonical);
      const object = hash.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
      const path = prefix + object + (format?.suffix ?? (isPdf ? ".pdf" : ".png"));
      if (!await canWrite()) return fail(403, denied);
      if (!await gateReady(type)) return fail(503, "PROOF_TRIAL_UNAVAILABLE");
      try { await store(path, canonical, outputType); } catch { /* Read back an immutable retry or lost acknowledgement. */ }
      const stored = await read(path, canonical.length);
      if (!(stored instanceof Blob) || stored.size !== canonical.length || await fingerprint(await stored.arrayBuffer()) !== hash) {
        return fail(503, "PROOF_WRITE_UNCONFIRMED");
      }
      if (!await canWrite()) return fail(403, denied);
      return Response.json({ path, type: outputType, size: canonical.length }, { headers });
    } catch (error) {
      if (error instanceof LogoInputError) {
        if (error.status === 413) return fail(413, error.message === "LOGO_DIMENSIONS_TOO_LARGE" ? "PROOF_DIMENSIONS_TOO_LARGE"
          : ["PROOF_PDF_PROCESSING_LIMIT", "PROOF_TABLE_PROCESSING_LIMIT"].includes(error.message) ? error.message : "PROOF_TOO_LARGE");
        return fail(error.status, error.message.includes("PROOF_") ? error.message : "INVALID_PROOF_IMAGE");
      }
      return fail(503, "PROOF_TRIAL_UNAVAILABLE");
    }
  };
}
