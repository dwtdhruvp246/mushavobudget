import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { API_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { FIXTURE_ID, LOGO_BUCKET } from "../../supabase/functions/validate-business-logo/handler.mjs";
import { normalizeLogoWebp } from "../../supabase/functions/validate-business-logo/webp.mjs";
import { LOSSY_ALPHA } from "../fixtures/logo-jpeg-tools/webp-images.mjs";

const NAME = "audit-fr3-logo-ingestion-20261112";
const PREVIEW = "https://13fc0c26.mushavo-budget-staging.pages.dev";
const PREVIEW_ID = "13fc0c26-df81-43b3-b6de-3b93e511d543";
const AGENT = "Mushavo-Staging-FR3-Logo-WebP-Browser";
const STORAGE_KEY = "sb-dczlddwbtgvfdujgcitb-auth-token";
const LOGO = Buffer.from(LOSSY_ALPHA, "base64");
const one = result => result.status === 200 && result.data?.length === 1 ? result.data[0] : null;

async function browserFlow(chromium, owner, path, evidence) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block", userAgent: AGENT });
  context.setDefaultTimeout(15000);
  const readRpcs = new Set(["app_session_status", "my_account_suspended", "get_my_business_invitations", "effective_workspace_entitlement",
    "business_team_snapshot", "business_effective_permissions", "business_claim_summary", "business_bill_summary",
    "business_billing_snapshot", "business_roles_snapshot", "business_payment_readiness"]);
  const calls = evidence.browser_requests = { permitted: 0, validator: 0, branding: 0, broker: 0, blocked: [] };
  try {
    const token = { ...owner.session, expires_at: owner.session.expires_at ?? Math.floor(Date.now() / 1000) + owner.session.expires_in };
    await context.addInitScript(({ origin, storageKey, session }) => {
      if (location.origin === origin && !localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(session));
    }, { origin: PREVIEW, storageKey: STORAGE_KEY, session: token });
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method();
      const read = ["GET", "HEAD"].includes(method);
      let allow = read && (url.origin === PREVIEW || url.origin === "https://cdn.jsdelivr.net" && url.pathname.startsWith("/npm/"));
      if (url.origin === API_ORIGIN) {
        allow = read || method === "OPTIONS";
        if (method === "POST" && url.pathname === "/functions/v1/validate-business-logo") {
          allow = req.headers()["content-type"] === "image/webp" && ++calls.validator === 1;
          if (allow) calls.upload_type = "image/webp";
        }
        if (method === "POST" && url.pathname === "/functions/v1/get-private-file") {
          const payload = req.postDataJSON();
          allow = payload?.bucket === LOGO_BUCKET && payload?.path === path && ++calls.broker <= 4;
        }
        if (method === "POST" && url.pathname.startsWith("/rest/v1/rpc/")) {
          const rpc = url.pathname.split("/").at(-1);
          allow = readRpcs.has(rpc);
          if (rpc === "save_business_setup_with_branding") {
            const body = req.postDataJSON();
            allow = body?.p_workspace_id === FIXTURE_ID && body?.p_trading_name === NAME
              && body?.p_logo_path === path && ++calls.branding === 1;
          }
        }
      }
      if (allow && ++calls.permitted <= 180) return route.continue();
      if (calls.blocked.length < 20 && [PREVIEW, API_ORIGIN].includes(url.origin)) {
        calls.blocked.push({ method, path: url.pathname.replace(/[0-9a-f-]{36}/g, "[id]").slice(0, 100) });
      }
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    evidence.browser_stage = "BUSINESS_SETUP_RENDER";
    await page.goto(PREVIEW + "/business?workspace=" + FIXTURE_ID + "#business/overview", { waitUntil: "domcontentloaded" });
    const file = page.locator("#setupBusinessLogo");
    const name = page.locator("#setupBusinessName");
    await file.waitFor({ state: "visible" });
    need(await name.inputValue() === NAME, "BROWSER_EXACT_WORKSPACE_REQUIRED");
    evidence.checks.browser_fixture_rendered = true;

    evidence.browser_stage = "SELECT_AND_SAVE_LOGO";
    await file.setInputFiles({ name: "fixture.webp", mimeType: "image/webp", buffer: LOGO });
    await page.getByText("Logo selected. Save your business details to apply it.", { exact: true }).waitFor({ state: "visible" });
    const uploaded = page.waitForResponse(r => r.url() === API_ORIGIN + "/functions/v1/validate-business-logo" && r.request().method() === "POST");
    const saved = page.waitForResponse(r => r.url() === API_ORIGIN + "/rest/v1/rpc/save_business_setup_with_branding" && r.request().method() === "POST");
    const [uploadResponse, saveResponse] = await Promise.all([uploaded, saved,
      page.locator("#businessBasicsForm").getByRole("button", { name: "Save and continue", exact: true }).click(),
    ]);
    evidence.browser_http = { upload: uploadResponse.status(), branding: saveResponse.status() };
    need(uploadResponse.status() === 200 && (await uploadResponse.json()).path === path, "BROWSER_LOGO_UPLOAD_REQUIRED");
    need(saveResponse.status() === 200 && (await saveResponse.json())?.profile?.logo_storage_path === path, "BROWSER_BRANDING_SAVE_REQUIRED");
    await page.getByText("Business details saved.", { exact: true }).waitFor({ state: "visible" });
    evidence.checks.browser_logo_saved = true;

    evidence.browser_stage = "RELOAD_AND_RENDER_STORED_LOGO";
    await page.reload({ waitUntil: "domcontentloaded" });
    await file.waitFor({ state: "visible" });
    await page.waitForFunction(() => {
      const img = document.querySelector('[data-logo-preview="setup"] img');
      return img?.complete && img.naturalWidth === 3 && img.naturalHeight === 4 && img.src.startsWith("blob:");
    });
    need(calls.broker > 0 && calls.upload_type === "image/webp", "BROWSER_WEBP_AND_PRIVATE_BROKER_REQUIRED");
    evidence.checks.browser_reload_renders_saved_logo = true;
  } finally {
    await browser.close();
  }
}

async function exercise({ actors, evidence }, key, chromium, decoder) {
  const owner = actors.USER_A, admin = actors.ADMIN;
  const hash = digest(normalizeLogoWebp(LOGO, decoder));
  const objectId = hash.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  const path = `${FIXTURE_ID}/${owner.id}/${objectId}.png`;
  const suspendedVersion = 20, activeVersion = 21, closedVersion = 22, profileVersion = 13;
  const routes = {
    workspace: "/rest/v1/budget_workspaces?select=id,owner_id,name,status,business_support_version&id=eq." + FIXTURE_ID + "&limit=2",
    subscription: "/rest/v1/workspace_subscriptions?select=status,member_limit,paid_through_at&workspace_id=eq." + FIXTURE_ID + "&limit=2",
    profile: "/rest/v1/business_profiles?select=trading_name,version,logo_storage_path&workspace_id=eq." + FIXTURE_ID + "&limit=2",
    status: "/rest/v1/rpc/admin_business_set_status",
    save: "/rest/v1/rpc/save_business_branding",
    context: "/rest/v1/rpc/private_file_download_context",
    remove: "/storage/v1/object/business-logos",
  };
  evidence.checks = {};
  evidence.cleanup = {};
  evidence.requests = 0;
  async function call(name, actor, body) {
    need(Object.hasOwn(routes, name) && ++evidence.requests <= 24, "BROWSER_FIXTURE_API_BOUND");
    const method = name === "remove" ? "DELETE" : body === undefined ? "GET" : "POST";
    const r = await fetch(API_ORIGIN + routes[name], { method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: "Bearer " + actor.token, "content-type": "application/json", "user-agent": AGENT },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    let data;
    try { data = await r.json(); } catch {}
    return { status: r.status, data };
  }
  const workspace = async () => one(await call("workspace", admin));
  const profile = async () => one(await call("profile", owner));
  const fileContext = () => call("context", owner, { p_bucket_id: LOGO_BUCKET, p_object_name: path });
  const setStatus = (status, version) => call("status", admin, {
    p_workspace_id: FIXTURE_ID, p_status: status, p_expected_version: version, p_confirmation_name: NAME,
    p_reason: "Isolated Business WebP logo browser acceptance", p_request_id: randomUUID(),
  });
  const sameWorkspace = row => row?.id === FIXTURE_ID && row.name === NAME && row.owner_id === owner.id;
  let resumed = false, failure, cleanupFailure;
  try {
    const w = await workspace(), s = one(await call("subscription", admin));
    need(sameWorkspace(w) && w.status === "suspended" && w.business_support_version === suspendedVersion
      && s?.status === "active" && s.member_limit === 1 && Date.parse(s.paid_through_at) > Date.now(), "EXACT_ARCHIVED_BROWSER_FIXTURE_REQUIRED");
    need((await setStatus("active", suspendedVersion)).status === 200, "BROWSER_FIXTURE_RESUME_REQUIRED");
    resumed = true;
    const active = await workspace(), p = await profile();
    need(sameWorkspace(active) && active.status === "active" && active.business_support_version === activeVersion
      && p?.version === profileVersion && p.logo_storage_path === null && p.trading_name === NAME, "EXACT_EMPTY_BROWSER_BRANDING_REQUIRED");
    evidence.reused_webp_api_run = 43469403167;
    await browserFlow(chromium, owner, path, evidence);
    need((await profile())?.logo_storage_path === path, "INDEPENDENT_BROWSER_SAVE_READBACK_REQUIRED");
    evidence.checks.independent_browser_save_readback = true;
  } catch (error) {
    failure = error instanceof Stop ? error : new Stop("BROWSER_CHECK_FAILED_" + (evidence.browser_stage || "SETUP"));
  } finally {
    if (resumed) try {
      const p = await profile();
      need(p?.trading_name === NAME && [null, path].includes(p.logo_storage_path), "EXACT_BROWSER_BRANDING_CLEANUP_REQUIRED");
      if (p.logo_storage_path === path) {
        need((await call("save", owner, { p_workspace_id: FIXTURE_ID, p_trading_name: NAME,
          p_logo_path: null, p_expected_version: p.version })).status === 200, "BROWSER_LOGO_UNLINK_REQUIRED");
      }
      need((await profile())?.logo_storage_path === null, "BROWSER_LOGO_UNLINK_READBACK_REQUIRED");
      evidence.cleanup.logo_unlinked = true;
      const file = await fileContext();
      need(file.status === 200 && [0, 1].includes(file.data?.length), "EXACT_BROWSER_FILE_STATE_REQUIRED");
      if (file.data.length) {
        need(file.data[0].object_name === path, "ONLY_EXACT_BROWSER_FILE_REMOVAL_ALLOWED");
        need((await call("remove", owner, { prefixes: [path] })).status === 200, "BROWSER_FILE_DELETE_ACK_REQUIRED");
      }
      const after = await fileContext();
      need(after.status === 200 && after.data?.length === 0, "BROWSER_FILE_ABSENCE_REQUIRED");
      evidence.cleanup.object_absent = true;
      const w = await workspace();
      need(sameWorkspace(w) && w.status === "active" && w.business_support_version === activeVersion
        && (await setStatus("suspended", activeVersion)).status === 200, "BROWSER_FIXTURE_CLOSE_REQUIRED");
      const closed = await workspace();
      need(sameWorkspace(closed) && closed.status === "suspended" && closed.business_support_version === closedVersion,
        "BROWSER_FIXTURE_CLOSE_READBACK_REQUIRED");
      evidence.cleanup.fixture_suspended = true;
    } catch (error) { cleanupFailure = error; }
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}

async function main() {
  const plan = JSON.parse(await readFile(new URL("./staging-logo-browser-run.json", import.meta.url), "utf8"));
  if (plan.enabled === false) return { result: "BROWSER_PLAN_ARCHIVED", exit_code: 0 };
  need(plan.enabled === true && plan.project === "dczlddwbtgvfdujgcitb" && plan.fixture_id === FIXTURE_ID
    && plan.preview_id === PREVIEW_ID && plan.preview_origin === PREVIEW && plan.status === "HOSTED_WEBP_BROWSER_ONCE"
    && plan.reuse_run === 43469403167, "EXACT_STAGING_WEBP_BROWSER_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization" && process.env.GITHUB_RUN_ATTEMPT === "1",
  "EXACT_STAGING_BROWSER_BRANCH_REQUIRED");
  const get = path => fetch(PREVIEW + path, { redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
  const [cfg, js, page] = await Promise.all([get("/config.js?v=27"), get("/business.js?v=25"), get("/business")]);
  need(cfg.ok && js.ok && page.ok && (await page.text()).includes('id="businessBasicsForm"'), "PREVIEW_PUBLIC_SOURCE_REQUIRED");
  const local = await readFile(new URL("../../business.js", import.meta.url));
  need(digest(await js.text()) === digest(local), "PREVIEW_BUSINESS_SOURCE_MISMATCH");
  const { key } = readPublicConfiguration(await cfg.text());
  const { chromium } = await import("../fixtures/staging-browser-tools/node_modules/playwright/index.mjs");
  const { decode } = await import("../fixtures/logo-jpeg-tools/node_modules/@stacksjs/ts-webp/dist/index.js");
  const options = { accountScope: "businessFixture" };
  const report = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    input => exercise(input, key, chromium, decode), options);
  return { ...report, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 WebP logo browser", preview: PREVIEW, source_matched: true };
}
const report = await main().catch(error => ({
  progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 WebP logo browser",
  result: "LOGO_BROWSER_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "BROWSER_PLAN_FAILED", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
