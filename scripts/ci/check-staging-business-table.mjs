import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { BUCKET, OWNER, WORKSPACE, documentPrefix, tableDocuments } from "../../supabase/functions/validate-business-table/scope.mjs";
import { CSV_MIME, XLSX_MIME } from "../../supabase/functions/validate-business-table/table-files.mjs";
import { csvCanonical, csvFixture, formatExamples, xlsxFixture } from "../fixtures/business-table-tools/fixtures.mjs";

const AGENT = "Mushavo-Staging-FR3-Business-Table";
const NAME = "audit-fr3-logo-ingestion-20261112";
const initialVersion = 26;
const activeVersion = initialVersion + 1;
const closedVersion = activeVersion + 1;
const progress = "Stage 4/10 | FR.3/8 | FR.3.2 Business CSV and XLSX";
const one = r => r.status === 200 && r.data?.length === 1 ? r.data[0] : null;
const empty = r => r.status === 200 && r.data?.length === 0;
const denied = r => [401,403].includes(r.status) || r.status === 400 && [401,403].includes(Number(r.data?.statusCode));
const rejected = (r, code) => r.status >= 400 && r.data?.message === code;

function file(label, mime, input, canonical, invalid, invalidCode) {
  const id = tableDocuments.get(mime), hash = digest(canonical);
  const object = hash.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  return { label, mime, id, hash, input, canonical, invalid, invalidCode,
    path: documentPrefix(id) + object + "." + label.toLowerCase(), attempted: false };
}

async function exercise({ actors, evidence }, key, paidThrough) {
  const owner = actors.USER_A, other = actors.USER_B, admin = actors.ADMIN;
  need(owner.id === OWNER && other.id !== OWNER && admin.id !== OWNER, "EXACT_TABLE_TEST_ACTORS");
  const xlsx = xlsxFixture();
  const files = [
    file("CSV", CSV_MIME, csvFixture, csvCanonical, Buffer.from("Item,Amount\nTea,=1+1\n"), "PROOF_CSV_FORMULA_UNSUPPORTED"),
    file("XLSX", XLSX_MIME, xlsx, xlsx, xlsxFixture({cell:formatExamples.formula}), "PROOF_XLSX_ACTIVE_CONTENT_UNSUPPORTED"),
  ];
  Object.assign(evidence, { checks: {}, requests: 0, cleanup: {} });
  const check = (name, ok) => {
    evidence.checks[name] = Boolean(ok);
    need(ok, name);
  };
  async function call(route, method, actor, body, type) {
    need(++evidence.requests <= 55, "BUSINESS_TABLE_REQUEST_BOUND");
    const response = await fetch(API_ORIGIN + route, {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: "Bearer " + actor.token, "user-agent": AGENT,
        "content-type": type || "application/json", origin: WEB_ORIGIN,
        ...(route.startsWith("/storage/v1/object/") ? { "x-upsert": "false" } : {}) },
      ...(body === undefined ? {} : { body: type ? body : JSON.stringify(body) }),
    });
    let data;
    if (route.endsWith("/get-private-file") && response.status === 200) data = Buffer.from(await response.arrayBuffer());
    else try { data = await response.json(); } catch {}
    return { status: response.status, data, mime: response.headers.get("x-mushavo-media-type"),
      noStore: /private, no-store/.test(response.headers.get("cache-control") || "") };
  }
  const rpc = (name, actor, body) => call("/rest/v1/rpc/" + name, "POST", actor, body);
  const workspace = async () => one(await call("/rest/v1/budget_workspaces?id=eq." + WORKSPACE + "&limit=2", "GET", admin));
  const docs = f => call("/rest/v1/business_documents?workspace_id=eq." + WORKSPACE + "&id=eq." + f.id + "&limit=2", "GET", owner);
  const exactWorkspace = w => w?.id === WORKSPACE && w.owner_id === OWNER && w.name === NAME && w.workspace_type === "business";
  const status = (value, version) => rpc("admin_business_set_status", admin, {
    p_workspace_id: WORKSPACE, p_status: value, p_expected_version: version, p_confirmation_name: NAME,
    p_reason: "Stage 4 isolated spreadsheet acceptance", p_request_id: randomUUID(),
  });
  const register = (f, size, actor = owner) => rpc("register_business_document", actor, {
    p_document_id: f.id, p_workspace_id: WORKSPACE, p_parent_type: "workspace", p_parent_id: WORKSPACE,
    p_storage_path: f.path, p_original_name: "staging-table." + f.label.toLowerCase(),
    p_mime_type: f.mime, p_size_bytes: size, p_checksum_sha256: null,
  });
  const context = f => rpc("private_file_download_context", owner, { p_bucket_id: BUCKET, p_object_name: f.path });
  const broker = (actor, f) => call("/functions/v1/get-private-file", "POST", actor, { bucket: BUCKET, path: f.path });
  const validate = (actor, f, input) => call("/functions/v1/validate-business-table", "POST", actor, input, f.mime);
  let fixtureBound = false, failure, cleanupFailure;
  try {
    const w = await workspace();
    const sub = one(await call("/rest/v1/workspace_subscriptions?workspace_id=eq." + WORKSPACE + "&limit=2", "GET", admin));
    check("EXACT_SUSPENDED_TABLE_FIXTURE", exactWorkspace(w) && w.status === "suspended" && w.business_support_version === initialVersion
      && sub?.workspace_id === WORKSPACE && sub.status === "active" && sub.version === 1 && sub.member_limit === 1
      && Date.parse(sub.paid_through_at) === Date.parse(paidThrough) && Date.parse(paidThrough) > Date.now());
    fixtureBound = true;
    check("EXACT_TABLE_FIXTURE_RESUMED", (await status("active", initialVersion)).status === 200);
    const active = await workspace();
    check("ACTIVE_TABLE_FIXTURE_READBACK", exactWorkspace(active) && active.status === "active" && active.business_support_version === activeVersion);
    for (const f of files) {
      const mark = (name, ok) => check(f.label + "_" + name, ok);
      mark("DOCUMENT_ABSENT", empty(await docs(f)));
      mark("MISSING_OBJECT_REFUSED", rejected(await register(f, f.canonical.length), "BUSINESS_DOCUMENT_UPLOAD_NOT_FOUND"));
      f.attempted = true;
      mark("DIRECT_RESERVED_UPLOAD_REFUSED", denied(await call("/storage/v1/object/" + BUCKET + "/" + f.path, "POST", owner, f.canonical, f.mime)));
      const foreign = await validate(other, f, f.input);
      mark("OUTSIDE_ACCOUNT_VALIDATION_DENIED", foreign.status === 403 && foreign.data?.error === "BUSINESS_TABLE_FIXTURE_OWNER_REQUIRED");
      const invalid = await validate(owner, f, f.invalid);
      mark("FORMULA_REFUSED", invalid.status === 422 && invalid.data?.error === f.invalidCode);
      const upload = await validate(owner, f, f.input);
      evidence[f.label + "_validator_status"] = upload.status;
      if (upload.status !== 200 && /^[A-Z_]{4,100}$/.test(upload.data?.error || "")) evidence[f.label + "_validator_error"] = upload.data.error;
      mark("VALIDATED_TABLE_STORED", upload.status === 200 && upload.noStore && upload.data?.path === f.path
        && upload.data.type === f.mime && upload.data.size === f.canonical.length);
      mark("UNREGISTERED_FILE_HIDDEN", empty(await context(f)) && (await broker(owner, f)).status === 404);
      mark("WRONG_SIZE_REFUSED", rejected(await register(f, f.canonical.length + 1), "BUSINESS_DOCUMENT_METADATA_MISMATCH"));
      const registered = await register(f, f.canonical.length), row = one(await docs(f));
      mark("EXACT_DOCUMENT_REGISTERED", registered.status === 200 && row?.id === f.id && row.workspace_id === WORKSPACE
        && row.parent_type === "workspace" && row.parent_id === WORKSPACE && row.uploaded_by === OWNER
        && row.storage_path === f.path && row.mime_type === f.mime && row.size_bytes === f.canonical.length && row.status === "active");
      const opened = await broker(owner, f);
      mark("BROKER_RETURNS_EXACT_BYTES", opened.status === 200 && opened.mime === f.mime && opened.noStore && digest(opened.data) === f.hash);
      mark("OUTSIDE_ACCOUNT_DOWNLOAD_DENIED", (await broker(other, f)).status === 404);
    }
  } catch (error) { failure = error; }
  finally {
    if (fixtureBound) try {
      const current = await workspace();
      need(exactWorkspace(current), "EXACT_TABLE_CLEANUP_WORKSPACE");
      if (current.status === "active" && current.business_support_version === activeVersion) {
        for (const f of files) try {
          const listed = await docs(f);
          need(listed.status === 200 && [0,1].includes(listed.data?.length), "EXACT_TABLE_CLEANUP_STATE");
          if (listed.data.length) {
            const row = listed.data[0];
            need(row.id === f.id && row.workspace_id === WORKSPACE && row.uploaded_by === OWNER
              && row.storage_path === f.path && row.status === "active", "EXACT_TABLE_ARCHIVE_BINDING");
            const archived = await rpc("archive_business_document", owner, {
              p_workspace_id: WORKSPACE, p_document_id: f.id, p_reason: "Archive isolated spreadsheet validation fixture",
            });
            need(archived.status === 200 && archived.data === f.path, "EXACT_TABLE_ARCHIVE_ACK");
          }
          if (f.attempted) {
            const removal = await call("/storage/v1/object/" + BUCKET, "DELETE", owner, { prefixes: [f.path] });
            need(removal.status === 200 && Array.isArray(removal.data)
              && removal.data.every(row => row.name === f.path), "EXACT_TABLE_DELETE_ACK");
          }
          if (listed.data.length) check(f.label + "_ARCHIVED_BROKER_DENIED", (await broker(owner, f)).status === 404);
          evidence.cleanup[f.label] = true;
        } catch (error) { cleanupFailure ??= error; }
        need((await status("suspended", activeVersion)).status === 200, "EXACT_TABLE_SUSPEND_ACK");
        const closed = await workspace();
        need(exactWorkspace(closed) && closed.status === "suspended" && closed.business_support_version === closedVersion,
          "EXACT_CLOSED_TABLE_WORKSPACE_READBACK");
        evidence.cleanup.fixture_suspended = true;
      } else {
        need(current.status === "suspended" && current.business_support_version === initialVersion && files.every(f => !f.attempted),
          "EXACT_TABLE_SCOPE_CLEANUP_REVIEW");
        evidence.cleanup.fixture_suspended = true;
      }
    } catch (error) { cleanupFailure ??= error; }
    if (failure instanceof Stop) evidence.failed_check = failure.code;
    else if (failure) evidence.failed_check = "BUSINESS_TABLE_REQUEST_OR_RUNNER_FAILURE";
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}

async function main() {
  const plan = JSON.parse(await readFile(new URL("./staging-business-table-run.json", import.meta.url), "utf8"));
  if (plan.enabled === false) return { result: "BUSINESS_TABLE_PLAN_ARCHIVED", exit_code: 0 };
  need(plan.enabled === true && plan.project === "dczlddwbtgvfdujgcitb" && plan.workspace === WORKSPACE
    && plan.status === "HOSTED_BUSINESS_TABLE_ONCE" && Date.parse(plan.paid_through) > Date.now()
    && JSON.stringify(plan.documents) === JSON.stringify([...tableDocuments.values()]), "EXACT_BUSINESS_TABLE_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization" && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_BRANCH_REQUIRED");
  const r = await fetch(WEB_ORIGIN + "/config.js?v=27", { redirect: "error", signal: AbortSignal.timeout(15000) });
  need(r.ok, "STAGING_CONFIGURATION_REQUIRED");
  const { key } = readPublicConfiguration(await r.text());
  const options = { accountScope: "standard" };
  const result = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    input => exercise(input, key, plan.paid_through), options);
  return { ...result, progress_display: progress, commit: process.env.GITHUB_SHA };
}

const report = await main().catch(error => ({
  progress_display: progress, result: "STAGING_BUSINESS_TABLE_REVIEW_REQUIRED",
  problem_code: error instanceof Stop ? error.code : "UNEXPECTED_BUSINESS_TABLE_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
