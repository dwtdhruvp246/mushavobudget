import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { FIXTURE_ID, LOGO_BUCKET } from "../../supabase/functions/validate-business-logo/handler.mjs";
import { normalizeLogoJpeg } from "../../supabase/functions/validate-business-logo/jpeg.mjs";
import { PROGRESSIVE_ROTATED_JPEG } from "../fixtures/logo-jpeg-tools/images.mjs";

const NAME = "audit-fr3-logo-ingestion-20261112";
const AGENT = "Mushavo-Staging-FR3-Logo-JPEG";
const one = result => result.status === 200 && result.data?.length === 1 ? result.data[0] : null;

const upload = Buffer.from(PROGRESSIVE_ROTATED_JPEG, "base64");

async function exercise({ actors, evidence }, key, decoder) {
  const normalized = normalizeLogoJpeg(upload, decoder);
  const owner = actors.USER_A, admin = actors.ADMIN;
  const fingerprint = digest(normalized);
  const id = fingerprint.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  const path = `${FIXTURE_ID}/${owner.id}/${id}.png`;
  const routes = {
    workspace: "/rest/v1/budget_workspaces?select=id,owner_id,name,status,business_support_version&id=eq." + FIXTURE_ID + "&limit=2",
    subscription: "/rest/v1/workspace_subscriptions?select=status,member_limit,paid_through_at&workspace_id=eq." + FIXTURE_ID + "&limit=2",
    profile: "/rest/v1/business_profiles?select=trading_name,version,logo_storage_path&workspace_id=eq." + FIXTURE_ID + "&limit=2",
    save: "/rest/v1/rpc/save_business_branding",
    suspend: "/rest/v1/rpc/admin_business_set_status",
    context: "/rest/v1/rpc/private_file_download_context",
    validate: "/functions/v1/validate-business-logo",
    broker: "/functions/v1/get-private-file",
    remove: "/storage/v1/object/business-logos",
  };
  const verbs = { workspace: "GET", subscription: "GET", profile: "GET", remove: "DELETE" };
  evidence.checks = {};
  evidence.requests = 0;
  evidence.cleanup = {};
  evidence.reused_png_closeout = "b09a5b2b7f41652f65a90b62b3c43b5816a78b1a";
  const check = (name, ok) => {
    evidence.checks[name] = ok === true;
    need(ok === true, name);
  };
  async function call(name, actor, body, contentType = "application/json") {
    need(Object.hasOwn(routes, name) && ++evidence.requests <= 26, "LOGO_REQUEST_BOUND_REACHED");
    const raw = name === "validate";
    const response = await fetch(API_ORIGIN + routes[name], {
      method: verbs[name] || "POST", cache: "no-store", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: "Bearer " + actor.token, "user-agent": AGENT, "content-type": contentType, origin: WEB_ORIGIN },
      ...(body === undefined ? {} : { body: raw ? body : JSON.stringify(body) }),
    });
    let data = null;
    if (name === "broker" && response.status === 200) data = Buffer.from(await response.arrayBuffer());
    else try { data = await response.json(); } catch {}
    return { status: response.status, data, noStore: /private, no-store/.test(response.headers.get("cache-control") || "") };
  }
  const context = () => call("context", owner, { p_bucket_id: LOGO_BUCKET, p_object_name: path });
  const branding = (version, logo) => call("save", owner, {
    p_workspace_id: FIXTURE_ID, p_trading_name: NAME, p_logo_path: logo, p_expected_version: version,
  });
  const uploadLogo = (actor, bytes = upload, type = "image/jpeg") => call("validate", actor, bytes, type);
  const workspace = () => call("workspace", admin);
  const profile = () => call("profile", owner);
  const setStatus = (status, version, reason) => call("suspend", admin, {
    p_workspace_id: FIXTURE_ID, p_status: status, p_expected_version: version,
    p_confirmation_name: NAME, p_reason: reason, p_request_id: randomUUID(),
  });
  let bound = false, failure, cleanupFailure;
  try {
    const w = one(await workspace()), s = one(await call("subscription", admin));
    check("EXACT_SUSPENDED_LOGO_FIXTURE_REQUIRED", w?.owner_id === owner.id && w?.id === FIXTURE_ID
      && w.name === NAME && w.status === "suspended" && w.business_support_version === 14
      && s?.status === "active" && s.member_limit === 1 && Date.parse(s.paid_through_at) > Date.now());
    const resumed = await setStatus("active", 14, "Verify the isolated JPEG logo path");
    check("SCOPED_RESUME_ACK_REQUIRED", resumed.status === 200);
    bound = true;
    const active = one(await workspace());
    check("RESUMED_FIXTURE_READBACK_REQUIRED", active?.id === FIXTURE_ID && active.status === "active"
      && active.business_support_version === 15 && active.owner_id === owner.id);
    const p = one(await profile());
    check("EXACT_EMPTY_BRANDING_REQUIRED", p?.trading_name === NAME && p.version === 6 && p.logo_storage_path === null);
    check("INITIAL_LOGO_ABSENCE_REQUIRED", (await context()).data?.length === 0);
    const mismatch = await uploadLogo(owner, normalized);
    check("PNG_DECLARED_AS_JPEG_REJECTED", mismatch.status === 422 && mismatch.data?.error === "INVALID_LOGO_JPEG");
    check("JPEG_MISMATCH_LEFT_STORAGE_EMPTY", (await context()).data?.length === 0);
    const created = await uploadLogo(owner);
    evidence.valid_upload_status = created.status;
    if (created.status >= 400 && /^[A-Z_]{3,70}$/.test(created.data?.error || "")) evidence.valid_upload_error = created.data.error;
    check("NORMALIZED_LOGO_PERSISTED", created.status === 200 && created.data?.path === path && created.noStore);
    const stored = await context();
    check("EXACT_STORAGE_METADATA_REQUIRED", stored.status === 200 && stored.data?.length === 1
      && stored.data[0].object_name === path && stored.data[0].size_bytes === normalized.length && stored.data[0].mime_type === "image/png");
    const retry = await uploadLogo(owner);
    const same = await context();
    check("SAME_CONTENT_RETRY_REUSES_OBJECT", retry.status === 200 && retry.data?.path === path
      && same.data?.[0]?.object_id === stored.data[0].object_id && same.data?.[0]?.object_version === stored.data[0].object_version);
    check("BUSINESS_BRANDING_LINK_SAVED", (await branding(p.version, path)).status === 200
      && (await profile()).data?.[0]?.logo_storage_path === path);
    const retrieved = await call("broker", owner, { bucket: LOGO_BUCKET, path });
    check("BROKER_RETURNS_NORMALIZED_LOGO", retrieved.status === 200 && retrieved.noStore && digest(retrieved.data) === fingerprint);
    check("JPEG_ORIENTATION_PRESERVED", retrieved.data.readUInt32BE(16) === 3 && retrieved.data.readUInt32BE(20) === 4);
  } catch (error) {
    failure = error;
  } finally {
    if (bound) {
      try {
        const p = one(await profile());
        need(p?.trading_name === NAME && [null, path].includes(p.logo_storage_path), "EXACT_BRANDING_RESTORE_REQUIRED");
        if (p.logo_storage_path === path) {
          need((await branding(p.version, null)).status === 200, "UNLINK_LOGO_ACK_REQUIRED");
        }
        need(one(await profile())?.logo_storage_path === null, "BRANDING_RESTORE_READBACK_REQUIRED");
        evidence.cleanup.logo_unlinked = true;
        const before = await context();
        need(before.status === 200 && [0, 1].includes(before.data?.length), "EXACT_OBJECT_CLEANUP_STATE_REQUIRED");
        if (before.data.length === 1) {
          need(before.data[0].object_name === path, "ONLY_SYNTHETIC_OBJECT_DELETE_ALLOWED");
          need((await call("remove", owner, { prefixes: [path] })).status === 200, "EXACT_OBJECT_DELETE_ACK_REQUIRED");
        }
        const after = await context();
        need(after.status === 200 && after.data?.length === 0, "OBJECT_ABSENCE_READBACK_REQUIRED");
        evidence.cleanup.object_absent = true;
        const w = one(await workspace());
        need(w?.owner_id === owner.id && w.name === NAME && w.status === "active" && w.business_support_version === 15,
          "EXACT_WORKSPACE_SUSPEND_REQUIRED");
        const suspend = await setStatus("suspended", 15, "Close the isolated staging JPEG trial");
        need(suspend.status === 200, "FIXTURE_SUSPEND_ACK_REQUIRED");
        const closed = one(await workspace());
        need(closed?.status === "suspended" && closed.business_support_version === 16, "FIXTURE_SUSPEND_READBACK_REQUIRED");
        evidence.cleanup.fixture_suspended = true;
      } catch (error) { cleanupFailure = error; }
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}

async function main() {
  const p = JSON.parse(await readFile(new URL("./staging-logo-run.json", import.meta.url), "utf8"));
  if (p.enabled === false) return { result: "LOGO_PLAN_ARCHIVED", exit_code: 0 };
  need(p.enabled === true && p.project === "dczlddwbtgvfdujgcitb" && p.scope === "fr3-2-business-logo"
    && p.fixture_id === FIXTURE_ID && p.status === "HOSTED_LOGO_JPEG_ONCE"
    && p.reuse_browser_run === 43287931911 && p.reuse_byte_run === 43289536159, "EXACT_JPEG_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization"
    && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_RUN_REQUIRED");
  const configuration = await fetch(WEB_ORIGIN + "/config.js?v=27", { redirect: "error", signal: AbortSignal.timeout(15000) });
  need(configuration.ok, "STAGING_PUBLIC_CONFIGURATION_REQUIRED");
  const { key } = readPublicConfiguration(await configuration.text());
  const options = { accountScope: "businessFixture" };
  const { default: jpeg } = await import("../fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js");
  const report = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    input => exercise(input, key, jpeg.decode), options);
  return { ...report, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 JPEG logos", commit: process.env.GITHUB_SHA };
}

const report = await main().catch(error => ({
  result: "LOGO_STAGING_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "UNEXPECTED_RUN_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
