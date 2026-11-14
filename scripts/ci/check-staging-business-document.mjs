import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { BUCKET, DOCUMENT, OWNER, PREFIX, WORKSPACE } from "../../supabase/functions/validate-business-document/scope.mjs";
import { normalizeStaticPdf } from "../../supabase/functions/validate-payment-proof/pdf.mjs";
import { pdf, receiptPdf } from "../fixtures/pdf-proof-tools/fixtures.mjs";

const AGENT = "Mushavo-Staging-FR3-Business-Document";
const NAME = "audit-fr3-logo-ingestion-20261112";
const one = r => r.status === 200 && r.data?.length === 1 ? r.data[0] : null;
const empty = r => r.status === 200 && r.data?.length === 0;
const denied = r => [401,403].includes(r.status) || r.status === 400 && [401,403].includes(Number(r.data?.statusCode));

async function exercise({ actors, evidence }, key, paidThrough) {
  const owner = actors.USER_A, other = actors.USER_B, admin = actors.ADMIN;
  need(owner.id === OWNER && other.id !== OWNER && admin.id !== OWNER, "EXACT_DOCUMENT_TEST_ACTORS");
  const input = await receiptPdf();
  const normalized = await normalizeStaticPdf(input, pdf);
  const hash = digest(normalized);
  const path = PREFIX + hash.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5") + ".pdf";
  const routes = {
    workspace: "/rest/v1/budget_workspaces?id=eq." + WORKSPACE + "&limit=2",
    subscription: "/rest/v1/workspace_subscriptions?workspace_id=eq." + WORKSPACE + "&limit=2",
    docs: "/rest/v1/business_documents?workspace_id=eq." + WORKSPACE + "&id=eq." + DOCUMENT + "&limit=2",
    status: "/rest/v1/rpc/admin_business_set_status",
    register: "/rest/v1/rpc/register_business_document",
    archive: "/rest/v1/rpc/archive_business_document",
    context: "/rest/v1/rpc/private_file_download_context",
    validate: "/functions/v1/validate-business-document",
    broker: "/functions/v1/get-private-file",
    direct: "/storage/v1/object/" + BUCKET + "/" + path,
    remove: "/storage/v1/object/" + BUCKET,
  };
  Object.assign(evidence, { checks: {}, requests: 0, cleanup: {} });
  const check = (name, ok) => {
    evidence.checks[name] = Boolean(ok);
    need(ok, name);
  };
  async function call(route, method, actor, body, type) {
    need(Object.hasOwn(routes, route) && ++evidence.requests <= 34, "BUSINESS_DOCUMENT_REQUEST_BOUND");
    const response = await fetch(API_ORIGIN + routes[route], {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: "Bearer " + actor.token, "user-agent": AGENT,
        "content-type": type || "application/json", origin: WEB_ORIGIN,
        ...(route === "direct" ? { "x-upsert": "false" } : {}) },
      ...(body === undefined ? {} : { body: type ? body : JSON.stringify(body) }),
    });
    let data;
    if (route === "broker" && response.status === 200) data = Buffer.from(await response.arrayBuffer());
    else try { data = await response.json(); } catch {}
    return { status: response.status, data, mime: response.headers.get("x-mushavo-media-type"),
      noStore: /private, no-store/.test(response.headers.get("cache-control") || "") };
  }
  const workspace = async () => one(await call("workspace", "GET", admin));
  const docs = () => call("docs", "GET", owner);
  const exactWorkspace = w => w?.id === WORKSPACE && w.owner_id === OWNER && w.name === NAME && w.workspace_type === "business";
  const status = (value, version) => call("status", "POST", admin, {
    p_workspace_id: WORKSPACE, p_status: value, p_expected_version: version, p_confirmation_name: NAME,
    p_reason: "Stage 4 isolated document acceptance", p_request_id: randomUUID(),
  });
  const register = (size, actor = owner) => call("register", "POST", actor, {
    p_document_id: DOCUMENT, p_workspace_id: WORKSPACE, p_parent_type: "workspace", p_parent_id: WORKSPACE,
    p_storage_path: path, p_original_name: "staging-document.pdf", p_mime_type: "application/pdf", p_size_bytes: size,
    p_checksum_sha256: null,
  });
  const context = () => call("context", "POST", owner, { p_bucket_id: BUCKET, p_object_name: path });
  const broker = actor => call("broker", "POST", actor, { bucket: BUCKET, path });
  const rejected = (r, code) => r.status >= 400 && r.data?.message === code;
  let fixtureBound = false, attemptedUpload = false, failure, cleanupFailure;
  try {
    const w = await workspace(), sub = one(await call("subscription", "GET", admin));
    check("EXACT_SUSPENDED_EMPTY_FIXTURE", exactWorkspace(w) && w.status === "suspended" && w.business_support_version === 22
      && sub?.workspace_id === WORKSPACE && sub.status === "active" && sub.version === 1 && sub.member_limit === 1
      && Date.parse(sub.paid_through_at) === Date.parse(paidThrough) && Date.parse(paidThrough) > Date.now());
    fixtureBound = true;
    const resumed = await status("active", 22);
    if (resumed.status !== 200 && /^[A-Z_]{4,100}$/.test(resumed.data?.message || "")) evidence.resume_error = resumed.data.message;
    check("EXACT_FIXTURE_RESUMED", resumed.status === 200);
    const active = await workspace();
    check("ACTIVE_FIXTURE_READBACK", exactWorkspace(active) && active.status === "active" && active.business_support_version === 23);
    check("EMPTY_DOCUMENT_AND_OBJECT", empty(await docs()) && empty(await context()));
    check("MISSING_OBJECT_REFUSED", rejected(await register(normalized.length), "BUSINESS_DOCUMENT_UPLOAD_NOT_FOUND"));
    check("DIRECT_RESERVED_UPLOAD_REFUSED", denied(await call("direct", "POST", owner, normalized, "application/pdf")));
    const foreign = await call("validate", "POST", other, input, "application/pdf");
    check("OUTSIDE_ACCOUNT_VALIDATION_DENIED", foreign.status === 403 && foreign.data?.error === "BUSINESS_DOCUMENT_FIXTURE_OWNER_REQUIRED");
    const bad = await call("validate", "POST", owner, input.slice(0, -12), "application/pdf");
    check("TRUNCATED_PDF_DENIED", bad.status === 422 && bad.data?.error === "INVALID_PROOF_PDF");
    attemptedUpload = true;
    const upload = await call("validate", "POST", owner, input, "application/pdf");
    evidence.validator_http_status = upload.status;
    if (upload.status !== 200 && /^[A-Z_]{4,100}$/.test(upload.data?.error || "")) evidence.validator_error = upload.data.error;
    check("VALIDATED_PDF_STORED", upload.status === 200 && upload.noStore && upload.data?.path === path
      && upload.data.type === "application/pdf" && upload.data.size === normalized.length);
    check("UNREGISTERED_PDF_HIDDEN", (await broker(owner)).status === 404);
    check("WRONG_SIZE_REFUSED", rejected(await register(normalized.length + 1), "BUSINESS_DOCUMENT_METADATA_MISMATCH"));
    check("OUTSIDE_ACCOUNT_REGISTER_DENIED", rejected(await register(normalized.length, other), "BUSINESS_DOCUMENT_ACCESS_REQUIRED"));
    const registered = await register(normalized.length);
    const row = one(await docs());
    check("EXACT_DOCUMENT_REGISTERED", registered.status === 200 && row?.id === DOCUMENT && row.workspace_id === WORKSPACE
      && row.parent_type === "workspace" && row.parent_id === WORKSPACE && row.uploaded_by === OWNER
      && row.storage_path === path && row.mime_type === "application/pdf" && row.size_bytes === normalized.length && row.status === "active");
    const opened = await broker(owner);
    check("BROKER_RETURNS_EXACT_PDF", opened.status === 200 && opened.mime === "application/pdf" && opened.noStore && digest(opened.data) === hash);
    check("OUTSIDE_ACCOUNT_DOWNLOAD_DENIED", (await broker(other)).status === 404);
  } catch (error) { failure = error; }
  finally {
    if (fixtureBound) try {
      const current = await workspace();
      need(exactWorkspace(current), "EXACT_DOCUMENT_CLEANUP_WORKSPACE");
      if (current.status === "active" && current.business_support_version === 23) {
        const listed = await docs();
        need(listed.status === 200 && [0,1].includes(listed.data?.length), "EXACT_DOCUMENT_CLEANUP_STATE");
        if (listed.data.length) {
          const row = listed.data[0];
          need(row.id === DOCUMENT && row.workspace_id === WORKSPACE && row.uploaded_by === OWNER
            && row.storage_path === path && row.status === "active", "EXACT_DOCUMENT_ARCHIVE_BINDING");
          const result = await call("archive", "POST", owner, {
            p_workspace_id: WORKSPACE, p_document_id: DOCUMENT, p_reason: "Archive isolated Stage 4 validation fixture",
          });
          need(result.status === 200 && result.data === path, "EXACT_DOCUMENT_ARCHIVE_ACK");
          check("ARCHIVED_PDF_BROKER_DENIED", (await broker(owner)).status === 404);
        }
        if (attemptedUpload) {
          const removal = await call("remove", "DELETE", owner, { prefixes: [path] });
          need(removal.status === 200 && Array.isArray(removal.data)
            && removal.data.every(row => row.name === path), "EXACT_DOCUMENT_DELETE_ACK");
        }
        need((await status("suspended", 23)).status === 200, "EXACT_DOCUMENT_SUSPEND_ACK");
        const closed = await workspace();
        need(exactWorkspace(closed) && closed.status === "suspended" && closed.business_support_version === 24,
          "EXACT_CLOSED_DOCUMENT_WORKSPACE_READBACK");
        evidence.cleanup.fixture_suspended = true;
      } else {
        need(current.status === "suspended" && current.business_support_version === 22 && !attemptedUpload,
          "EXACT_DOCUMENT_SCOPE_CLEANUP_REVIEW");
        evidence.cleanup.fixture_suspended = true;
      }
    } catch (error) { cleanupFailure = error; }
    if (failure instanceof Stop) evidence.failed_check = failure.code;
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}

async function main() {
  const p = JSON.parse(await readFile(new URL("./staging-business-document-run.json", import.meta.url), "utf8"));
  if (p.enabled === false) return { result: "BUSINESS_DOCUMENT_PLAN_ARCHIVED", exit_code: 0 };
  need(p.enabled === true && p.project === "dczlddwbtgvfdujgcitb" && p.workspace === WORKSPACE
    && p.document === DOCUMENT && p.status === "HOSTED_BUSINESS_DOCUMENT_ONCE" && Date.parse(p.paid_through) > Date.now(),
    "EXACT_BUSINESS_DOCUMENT_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization" && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_BRANCH_REQUIRED");
  const r = await fetch(WEB_ORIGIN + "/config.js?v=27", { redirect: "error", signal: AbortSignal.timeout(15000) });
  need(r.ok, "STAGING_CONFIGURATION_REQUIRED");
  const { key } = readPublicConfiguration(await r.text());
  const options = { accountScope: "standard" };
  const result = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    input => exercise(input, key, p.paid_through), options);
  return { ...result, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Business document", commit: process.env.GITHUB_SHA };
}

const report = await main().catch(error => ({
  progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Business document",
  result: "STAGING_BUSINESS_DOCUMENT_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "UNEXPECTED_BUSINESS_DOCUMENT_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
