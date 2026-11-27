import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { BUCKET, OWNER, PREFIX, WORKSPACE } from "../../supabase/functions/validate-subscription-proof/scope.mjs";
import { normalizeStaticPdf } from "../../supabase/functions/validate-payment-proof/pdf.mjs";
import { normalizeLogoJpeg } from "../../supabase/functions/validate-business-logo/jpeg.mjs";
import { PROGRESSIVE_ROTATED_JPEG } from "../fixtures/logo-jpeg-tools/images.mjs";
import { pdf, receiptPdf } from "../fixtures/pdf-proof-tools/fixtures.mjs";

const AGENT = "Mushavo-Staging-FR3-Subscription-Proof";
const one = result => result.status === 200 && result.data?.length === 1 ? result.data[0] : null;
const empty = result => result.status === 200 && result.data?.length === 0;
const objectName = (bytes, suffix) => PREFIX + digest(bytes).slice(0, 32)
  .replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5") + suffix;

async function exercise({ actors, evidence }, key, decoder, phase) {
  const owner = actors.USER_A, other = actors.USER_B;
  need(owner.id === OWNER && other.id !== OWNER, "EXACT_SUBSCRIPTION_TEST_ACCOUNTS_REQUIRED");
  const input = await receiptPdf();
  const canonical = await normalizeStaticPdf(input, pdf, decoder);
  const jpg = Buffer.from(PROGRESSIVE_ROTATED_JPEG, "base64");
  const png = normalizeLogoJpeg(jpg, decoder);
  const path = objectName(canonical, ".pdf");
  const pngPath = objectName(png, ".png");
  const routes = {
    workspace: "/rest/v1/budget_workspaces?select=id,owner_id,status,workspace_type&id=eq." + WORKSPACE + "&limit=2",
    validate: "/functions/v1/validate-subscription-proof",
    context: "/rest/v1/rpc/private_file_download_context",
    broker: "/functions/v1/get-private-file",
    direct: "/storage/v1/object/" + BUCKET + "/" + path,
    remove: "/storage/v1/object/" + BUCKET,
  };
  evidence.checks = {};
  evidence.requests = 0;
  evidence.cleanup = {};
  const check = (k, ok) => {
    evidence.checks[k] = ok === true;
    need(ok === true, k);
  };
  async function call(name, method, actor, body, media) {
    need(Object.hasOwn(routes, name) && ++evidence.requests <= 38, "PERSONAL_PROOF_REQUEST_BOUND");
    const r = await fetch(API_ORIGIN + routes[name], {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: "Bearer " + actor.token, "user-agent": AGENT,
        "content-type": media || "application/json", origin: WEB_ORIGIN, prefer: "return=representation",
        ...(name === "direct" ? { "x-upsert": "false" } : {}) },
      ...(body === undefined ? {} : { body: media ? body : JSON.stringify(body) }),
    });
    let data;
    if (name === "broker" && r.status === 200) data = Buffer.from(await r.arrayBuffer());
    else try { data = await r.json(); } catch {}
    return { status: r.status, data, mediaType: r.headers.get("x-mushavo-media-type"), noStore: /private, no-store/.test(r.headers.get("cache-control") || "") };
  }
  const context = name => call("context", "POST", owner, { p_bucket_id: BUCKET, p_object_name: name });
  const upload = (actor, bytes, type) => call("validate", "POST", actor, bytes, type);
  const broker = (actor, name) => call("broker", "POST", actor, { bucket: BUCKET, path: name });
  const valid = (r, name, type, size) => r.status === 200 && r.noStore && r.data?.path === name
    && r.data.type === type && r.data.size === size;
  const exact = (r, bytes, type) => r.status === 200 && r.noStore && r.mediaType === type && digest(r.data) === digest(bytes);
  let bound = false, failed, cleanupFailed, retained = false;
  try {
    const w = one(await call("workspace", "GET", owner));
    check("EXACT_SUBSCRIPTION_WORKSPACE", w?.id === WORKSPACE && w.owner_id === OWNER
      && w.status === "active" && w.workspace_type === "personal");
    if (phase === "cleanup") {
      bound = true;
      check("RETAINED_PDF_BYTES_VERIFIED", exact(await broker(owner, path), canonical, "application/pdf"));
    } else {
      check("EMPTY_TRIAL_BASELINE", empty(await context(path)) && empty(await context(pngPath)));
      bound = true;
      const foreign = await upload(other, input, "application/pdf");
      check("OTHER_ACCOUNT_UPLOAD_DENIED", foreign.status === 403 && foreign.data?.error === "SUBSCRIPTION_PROOF_FIXTURE_OWNER_REQUIRED");
      const direct = await call("direct", "POST", owner, canonical, "application/pdf");
      check("DIRECT_RESERVED_UPLOAD_DENIED", [401, 403].includes(direct.status)
        || direct.status === 400 && [401, 403].includes(Number(direct.data?.statusCode)));
      const malformed = await upload(owner, input.slice(0, -12), "application/pdf");
      check("TRUNCATED_PDF_DENIED", malformed.status === 422 && malformed.data?.error === "INVALID_PROOF_PDF");
      const mislabeled = await upload(owner, input, "image/jpeg");
      check("MISLABELED_IMAGE_DENIED", mislabeled.status === 422 && mislabeled.data?.error === "INVALID_PROOF_IMAGE");
      const tooLarge = await upload(owner, new Uint8Array(2097153), "application/pdf");
      check("OVERSIZED_PDF_DENIED", tooLarge.status === 413 && tooLarge.data?.error === "PROOF_TOO_LARGE");
      check("REJECTED_FILES_LEFT_NO_OBJECT", empty(await context(path)) && empty(await context(pngPath)));
      const result = await upload(owner, input, "application/pdf");
      evidence.valid_upload_status = result.status;
      if (result.status !== 200 && /^[A-Z_]{4,100}$/.test(result.data?.error || "")) evidence.valid_upload_error = result.data.error;
      check("VALIDATED_PDF_PERSISTED", valid(result, path, "application/pdf", canonical.length));
      const before = one(await context(path));
      const retry = await upload(owner, input, "application/pdf");
      const after = one(await context(path));
      check("IDENTICAL_UPLOAD_REUSED", valid(retry, path, "application/pdf", canonical.length) && before?.object_id
        && before.object_id === after?.object_id && before.object_version === after.object_version);
      check("VALIDATED_PNG_PERSISTED", valid(await upload(owner, jpg, "image/jpeg"), pngPath, "image/png", png.length));
      check("BROKER_RETURNS_NORMALIZED_PDF", exact(await broker(owner, path), canonical, "application/pdf"));
      check("BROKER_RETURNS_NORMALIZED_PNG", exact(await broker(owner, pngPath), png, "image/png"));
      check("OTHER_ACCOUNT_DOWNLOAD_DENIED", (await broker(other, path)).status === 404);
      retained = true;
      evidence.retained_pdf = { path, size: canonical.length, sha256: digest(canonical) };
    }
  } catch (e) { failed = e; }
  finally {
    if (bound) try {
      const present = [];
      const cleanupPaths = retained ? [pngPath] : [path, pngPath];
      for (const name of cleanupPaths) {
        const result = await context(name);
        need(result.status === 200 && [0, 1].includes(result.data?.length), "EXACT_SUBSCRIPTION_CLEANUP_STATE");
        if (result.data.length) {
          need(result.data[0].object_name === name, "EXACT_SUBSCRIPTION_CLEANUP_PATH");
          present.push(name);
        }
      }
      if (present.length) need((await call("remove", "DELETE", owner, { prefixes: present })).status === 200,
        "EXACT_SUBSCRIPTION_OBJECT_DELETE_REQUIRED");
      for (const name of cleanupPaths) need(empty(await context(name)), "SUBSCRIPTION_OBJECT_ABSENCE_REQUIRED");
      evidence.cleanup.removed_expected_files = true;
      evidence.cleanup.pdf_retained_for_rollback_probe = retained;
    } catch (e) { cleanupFailed = e; }
    if (failed instanceof Stop) evidence.failed_check = failed.code;
  }
  if (cleanupFailed) throw cleanupFailed;
  if (failed) throw failed;
}

async function main() {
  const p = JSON.parse(await readFile(new URL("./staging-subscription-proof-run.json", import.meta.url), "utf8"));
  if (p.enabled === false) return { result: "PERSONAL_PROOF_PLAN_ARCHIVED", exit_code: 0 };
  need(p.enabled === true && p.project === "dczlddwbtgvfdujgcitb" && p.workspace === WORKSPACE
    && ["HOSTED_SUBSCRIPTION_PROOF_ONCE", "HOSTED_SUBSCRIPTION_PROOF_CLEANUP_ONCE"].includes(p.status), "EXACT_SUBSCRIPTION_PROOF_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization" && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_BRANCH_REQUIRED");
  const r = await fetch(WEB_ORIGIN + "/config.js?v=27", { redirect: "error", signal: AbortSignal.timeout(15000) });
  need(r.ok, "STAGING_CONFIGURATION_REQUIRED");
  const { key } = readPublicConfiguration(await r.text());
  const { default: jpeg } = await import("../fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js");
  const options = { accountScope: "ordinary" };
  const result = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    input => exercise(input, key, jpeg.decode, p.status.endsWith("CLEANUP_ONCE") ? "cleanup" : "acceptance"), options);
  return { ...result, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Subscription proof", commit: process.env.GITHUB_SHA };
}
const report = await main().catch(error => ({
  progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Subscription proof",
  result: "STAGING_PERSONAL_PROOF_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "UNEXPECTED_PROOF_RUN_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
