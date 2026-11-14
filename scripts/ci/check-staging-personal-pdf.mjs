import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { BUCKET, OWNER, PAYMENT_ITEM, PREFIX, WORKSPACE } from "../../supabase/functions/validate-payment-proof/handler.mjs";
import { normalizeStaticPdf } from "../../supabase/functions/validate-payment-proof/pdf.mjs";
import { pdf, receiptPdf } from "../fixtures/pdf-proof-tools/fixtures.mjs";

const AGENT = "Mushavo-Staging-FR3-Personal-PDF";
const NAME = "audit-fr3-personal-pdf-20261113";
const RECORD = "38f426b0-7c60-4b16-ad10-c8c9a669defd";
const one = r => r.status === 200 && r.data?.length === 1 ? r.data[0] : null;

async function exercise({ actors, evidence }, key, decoder) {
  const owner = actors.USER_A, foreign = actors.USER_B;
  need(owner.id === OWNER && foreign.id !== OWNER, "EXACT_PERSONAL_FIXTURE_ACTORS_REQUIRED");
  const input = await receiptPdf();
  const canonical = await normalizeStaticPdf(input, pdf, decoder);
  const hash = digest(canonical), uuid = hash.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  const path = PREFIX + uuid + ".pdf";
  const today = new Date().toISOString().slice(0, 10), period = today.slice(0, 7) + "-01";
  const routes = {
    item: "/rest/v1/payment_items?id=eq." + PAYMENT_ITEM,
    item_create: "/rest/v1/payment_items",
    record: "/rest/v1/payment_records?id=eq." + RECORD,
    record_create: "/rest/v1/payment_records",
    workspace: "/rest/v1/budget_workspaces?select=id,owner_id,status,workspace_type&id=eq." + WORKSPACE + "&limit=2",
    validate: "/functions/v1/validate-payment-proof",
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
  const item = () => call("item", "GET", owner);
  const record = () => call("record", "GET", owner);
  const context = () => call("context", "POST", owner, { p_bucket_id: BUCKET, p_object_name: path });
  const upload = (actor, bytes, type) => call("validate", "POST", actor, bytes, type);
  const broker = actor => call("broker", "POST", actor, { bucket: BUCKET, path });
  const createRecord = size => call("record_create", "POST", owner, {
    id: RECORD, owner_id: OWNER, recorded_by: OWNER, workspace_id: WORKSPACE, visibility: "personal", family_id: null,
    payment_item_id: PAYMENT_ITEM, period_start: period, due_date: today, amount: 1, currency: "USD",
    payment_date: today, payment_method: "Other", proof_path: path, proof_name: "audit-fr3-proof.pdf",
    proof_mime_type: "application/pdf", proof_size_bytes: size,
  });
  let bound = false, failed, cleanupFailed;
  try {
    const w = one(await call("workspace", "GET", owner));
    check("EXACT_PERSONAL_WORKSPACE", w?.id === WORKSPACE && w.owner_id === OWNER && w.status === "active" && w.workspace_type === "personal");
    check("EMPTY_TRIAL_BASELINE", (await item()).data?.length === 0 && (await record()).data?.length === 0
      && (await context()).data?.length === 0);
    bound = true;
    const created = await call("item_create", "POST", owner, {
      id: PAYMENT_ITEM, workspace_id: WORKSPACE, owner_id: OWNER, created_by: OWNER, visibility: "personal", family_id: null,
      name: NAME, amount: 1, currency: "USD", category: "Other", recurrence_type: "once", due_day: Number(today.slice(-2)),
      start_date: today, reminder_days_before: 0, status: "active",
    });
    if (created.status !== 201 && /^[A-Z_]{4,100}$/.test(created.data?.message || "")) evidence.item_create_error = created.data.message;
    check("SYNTHETIC_ITEM_CREATED", created.status === 201 && created.data?.[0]?.id === PAYMENT_ITEM && created.data[0].workspace_id === WORKSPACE);
    const unauthorized = await upload(foreign, input, "application/pdf");
    check("OTHER_ACCOUNT_UPLOAD_DENIED", unauthorized.status === 403 && unauthorized.data?.error === "PROOF_FIXTURE_OWNER_REQUIRED");
    const direct = await call("direct", "POST", owner, canonical, "application/pdf");
    evidence.direct_upload_status = direct.status;
    check("DIRECT_RESERVED_UPLOAD_DENIED", [401, 403].includes(direct.status) || direct.status === 400 && [401, 403].includes(Number(direct.data?.statusCode)));
    const missing = await createRecord(canonical.length);
    check("MISSING_OBJECT_LINK_DENIED", missing.status >= 400 && missing.data?.message === "FR3_PROOF_STORAGE_METADATA_MISMATCH");
    const malformed = await upload(owner, input.slice(0, -12), "application/pdf");
    check("TRUNCATED_PDF_DENIED", malformed.status === 422 && malformed.data?.error === "INVALID_PROOF_PDF");
    const unsupported = await upload(owner, await receiptPdf({ objectStreams: true }), "application/pdf");
    check("UNSUPPORTED_PDF_VARIANT_DENIED", unsupported.status === 422 && unsupported.data?.error === "UNSUPPORTED_PROOF_PDF_STRUCTURE");
    const tooLarge = await upload(owner, new Uint8Array(2097153), "application/pdf");
    check("OVERSIZED_PDF_DENIED", tooLarge.status === 413 && tooLarge.data?.error === "PROOF_TOO_LARGE");
    check("REJECTED_FILES_LEFT_NO_OBJECT", (await context()).data?.length === 0);
    const result = await upload(owner, input, "application/pdf");
    evidence.valid_upload_status = result.status;
    if (result.status !== 200 && /^[A-Z_]{4,100}$/.test(result.data?.error || "")) evidence.valid_upload_error = result.data.error;
    check("VALIDATED_PROOF_PERSISTED", result.status === 200 && result.noStore && result.data?.path === path
      && result.data.type === "application/pdf" && result.data.size === canonical.length);
    const before = (await context()).data?.[0];
    const retry = await upload(owner, input, "application/pdf");
    const after = (await context()).data?.[0];
    check("IDENTICAL_UPLOAD_REUSED", retry.status === 200 && retry.data?.path === path && before?.object_id
      && before.object_id === after?.object_id && before.object_version === after.object_version);
    const forged = await createRecord(canonical.length + 1);
    check("INCORRECT_RECORDED_SIZE_DENIED", forged.status >= 400 && forged.data?.message === "FR3_PROOF_STORAGE_METADATA_MISMATCH");
    const saved = await createRecord(canonical.length);
    const row = one(await record());
    check("PAYMENT_RECORD_LINKS_VALIDATED_FILE", saved.status === 201 && row?.id === RECORD && row.payment_item_id === PAYMENT_ITEM
      && row.workspace_id === WORKSPACE && row.proof_path === path && row.proof_size_bytes === canonical.length && row.proof_mime_type === "application/pdf");
    const readback = await broker(owner);
    check("BROKER_RETURNS_NORMALIZED_PROOF", readback.status === 200 && readback.noStore && readback.mediaType === "application/pdf" && digest(readback.data) === hash);
    check("OTHER_ACCOUNT_DOWNLOAD_DENIED", (await broker(foreign)).status === 404);
  } catch (e) { failed = e; }
  finally {
    if (bound) try {
      const current = await item();
      need(current.status === 200 && [0, 1].includes(current.data?.length), "EXACT_TRIAL_CLEANUP_READ_REQUIRED");
      if (current.data.length) {
        const row = current.data[0];
        need(row.id === PAYMENT_ITEM && row.name === NAME && row.workspace_id === WORKSPACE && row.owner_id === OWNER, "EXACT_ITEM_CLEANUP_BINDING");
        const related = one(await record());
        if (related) need(related.payment_item_id === PAYMENT_ITEM && related.owner_id === OWNER && related.proof_path === path, "EXACT_RECORD_CLEANUP_BINDING");
        const removed = await call("item", "DELETE", owner);
        need(removed.status === 200 && removed.data?.length === 1, "EXACT_ITEM_DELETE_REQUIRED");
      }
      need((await item()).data?.length === 0 && (await record()).data?.length === 0, "FINANCE_FIXTURE_ABSENCE_REQUIRED");
      evidence.cleanup.payment_item_and_record_absent = true;
      const object = await context();
      need(object.status === 200 && [0, 1].includes(object.data?.length), "EXACT_PROOF_CLEANUP_STATE_REQUIRED");
      if (object.data.length) {
        need(object.data[0].object_name === path, "EXACT_PROOF_CLEANUP_PATH_REQUIRED");
        need((await call("remove", "DELETE", owner, { prefixes: [path] })).status === 200, "PROOF_OBJECT_DELETE_REQUIRED");
      }
      need((await context()).data?.length === 0, "PROOF_OBJECT_ABSENCE_REQUIRED");
      evidence.cleanup.proof_object_absent = true;
    } catch (e) { cleanupFailed = e; }
  }
  if (cleanupFailed) throw cleanupFailed;
  if (failed) throw failed;
}

async function main() {
  const p = JSON.parse(await readFile(new URL("./staging-personal-pdf-run.json", import.meta.url), "utf8"));
  if (p.enabled === false) return { result: "PERSONAL_PROOF_PLAN_ARCHIVED", exit_code: 0 };
  need(p.enabled === true && p.project === "dczlddwbtgvfdujgcitb" && p.fixture_item === PAYMENT_ITEM
    && p.status === "HOSTED_PERSONAL_PDF_ONCE", "EXACT_PERSONAL_PROOF_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization" && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_BRANCH_REQUIRED");
  const r = await fetch(WEB_ORIGIN + "/config.js?v=27", { redirect: "error", signal: AbortSignal.timeout(15000) });
  need(r.ok, "STAGING_CONFIGURATION_REQUIRED");
  const { key } = readPublicConfiguration(await r.text());
  const { default: jpeg } = await import("../fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js");
  const options = { accountScope: "ordinary" };
  const result = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    input => exercise(input, key, jpeg.decode), options);
  return { ...result, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Personal PDF proof", commit: process.env.GITHUB_SHA };
}
const report = await main().catch(error => ({
  progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Personal PDF proof",
  result: "STAGING_PERSONAL_PROOF_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "UNEXPECTED_PROOF_RUN_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
