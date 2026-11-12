import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { crc32, deflateSync } from "node:zlib";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { FIXTURE_ID, LOGO_BUCKET } from "../../supabase/functions/validate-business-logo/handler.mjs";
import { normalizeLogoPng } from "../../supabase/functions/validate-business-logo/png.mjs";

const NAME = "audit-fr3-logo-ingestion-20261112";
const AGENT = "Mushavo-Staging-FR3-Logo-Acceptance";
const one = result => result.status === 200 && result.data?.length === 1 ? result.data[0] : null;

function pngChunk(type, bytes = Buffer.alloc(0)) {
  const payload = Buffer.concat([Buffer.from(type), bytes]);
  const size = Buffer.alloc(4), crc = Buffer.alloc(4);
  size.writeUInt32BE(bytes.length);
  crc.writeUInt32BE(crc32(payload));
  return Buffer.concat([size, payload, crc]);
}
const header = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0]);
const upload = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  pngChunk("IHDR", header), pngChunk("tEXt", Buffer.from("Comment\0Synthetic staging fixture")),
  pngChunk("IDAT", deflateSync(Buffer.from([0, 80, 100, 200, 255]))), pngChunk("IEND"),
]);
const normalized = normalizeLogoPng(upload);
const wideHeader = Buffer.from(header);
wideHeader.writeUInt32BE(1025, 0);
const widePng = Buffer.concat([
  upload.subarray(0, 8), pngChunk("IHDR", wideHeader),
  pngChunk("IDAT", deflateSync(Buffer.alloc(1025 * 4 + 1))), pngChunk("IEND"),
]);

async function provision({ actors, evidence }, key) {
  const owner = actors.USER_A, admin = actors.ADMIN;
  const fixtureRoute = "/rest/v1/budget_workspaces?select=id,owner_id,name,status,business_support_version&name=eq." + NAME + "&limit=2";
  const planRoute = "/rest/v1/plans?select=id,code,workspace_type,is_active&code=eq.business&workspace_type=eq.business&is_active=eq.true&limit=2";
  const grantRoute = "/rest/v1/rpc/admin_grant_manual_subscription";
  async function request(route, payload) {
    const response = await fetch(API_ORIGIN + route, {
      method: payload ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: "Bearer " + admin.token, "content-type": "application/json", "user-agent": AGENT },
      ...(payload ? { body: JSON.stringify(payload) } : {}),
    });
    let data = null;
    try { data = await response.json(); } catch {}
    return { status: response.status, data };
  }
  const existing = await request(fixtureRoute);
  need(existing.status === 200 && Array.isArray(existing.data) && existing.data.length === 0, "NEW_LOGO_FIXTURE_REQUIRED");
  const business = one(await request(planRoute));
  need(business?.is_active === true && business.code === "business" && business.workspace_type === "business", "EXACT_BUSINESS_PLAN_REQUIRED");
  const date = new Date(), tomorrow = new Date(date.getTime() + 86400000);
  const grant = await request(grantRoute, {
    p_owner_id: owner.id, p_workspace_id: null, p_plan_id: business.id, p_billing_period: "monthly",
    p_starts_on: date.toISOString().slice(0, 10), p_ends_on: tomorrow.toISOString().slice(0, 10),
    p_reason: "Isolated synthetic Business logo validation acceptance", p_new_business_name: NAME,
  });
  evidence.grant_status = grant.status;
  if (grant.status !== 200 && /^[A-Z_]{4,80}$/.test(grant.data?.message || "")) evidence.grant_error = grant.data.message;
  need(grant.status === 200 && /^[0-9a-f-]{36}$/.test(grant.data || ""), "LOGO_TEST_GRANT_ACK_REQUIRED");
  const bound = one(await request(fixtureRoute));
  need(bound?.id === grant.data && bound.owner_id === owner.id && bound.status === "active" && bound.name === NAME,
    "LOGO_TEST_GRANT_READBACK_REQUIRED");
  evidence.fixture_id = bound.id;
  evidence.fixture_provisioned = true;
}

async function exercise({ actors, evidence }, key) {
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
  evidence.reused_initial_run = 43281454455;
  evidence.initial_owner_denial_and_type_mismatch_repeated = false;
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
  const uploadLogo = (actor, bytes = upload, type = "image/png") => call("validate", actor, bytes, type);
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
      && w.name === NAME && w.status === "suspended" && w.business_support_version === 2
      && s?.status === "active" && s.member_limit === 1 && Date.parse(s.paid_through_at) > Date.now());
    const resumed = await setStatus("active", 2, "Resume the unfinished isolated logo acceptance");
    check("SCOPED_RESUME_ACK_REQUIRED", resumed.status === 200);
    bound = true;
    const active = one(await workspace());
    check("RESUMED_FIXTURE_READBACK_REQUIRED", active?.id === FIXTURE_ID && active.status === "active"
      && active.business_support_version === 3 && active.owner_id === owner.id);
    const p = one(await profile());
    check("EXACT_EMPTY_BRANDING_REQUIRED", p?.trading_name === NAME && p.version === 1 && p.logo_storage_path === null);
    check("INITIAL_LOGO_ABSENCE_REQUIRED", (await context()).data?.length === 0);
    const large = await uploadLogo(owner, widePng);
    check("DIMENSION_LIMIT_APPLIED", large.status === 413 && large.data?.error === "LOGO_DIMENSIONS_TOO_LARGE");
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
        need(w?.owner_id === owner.id && w.name === NAME && w.status === "active" && w.business_support_version === 3,
          "EXACT_WORKSPACE_SUSPEND_REQUIRED");
        const suspend = await setStatus("suspended", 3, "Close the isolated staging logo trial");
        need(suspend.status === 200, "FIXTURE_SUSPEND_ACK_REQUIRED");
        need(one(await workspace())?.status === "suspended", "FIXTURE_SUSPEND_READBACK_REQUIRED");
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
  const provisionOnly = p.status === "PROVISION_LOGO_FIXTURE_ONCE" && p.fixture_id === null;
  need(p.enabled === true && p.project === "dczlddwbtgvfdujgcitb" && p.scope === "fr3-2-business-logo"
    && (provisionOnly || p.fixture_id === FIXTURE_ID && p.status === "HOSTED_LOGO_REMAINDER_ONCE"
      && p.reuse_run === 43281454455), "EXACT_LOGO_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization"
    && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_RUN_REQUIRED");
  const configuration = await fetch(WEB_ORIGIN + "/config.js?v=27", { redirect: "error", signal: AbortSignal.timeout(15000) });
  need(configuration.ok, "STAGING_PUBLIC_CONFIGURATION_REQUIRED");
  const { key } = readPublicConfiguration(await configuration.text());
  const options = { accountScope: "businessFixture" };
  const report = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    async input => provisionOnly ? provision(input, key) : exercise(input, key), options);
  return { ...report, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Business logos", commit: process.env.GITHUB_SHA };
}

const report = await main().catch(error => ({
  result: "LOGO_STAGING_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "UNEXPECTED_RUN_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
