import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { BUCKET, OWNER, PAYMENT_ITEM, PREFIX, WORKSPACE } from "../../supabase/functions/validate-payment-proof/handler.mjs";
import { normalizeLogoJpeg } from "../../supabase/functions/validate-business-logo/jpeg.mjs";
import { PROGRESSIVE_ROTATED_JPEG } from "../fixtures/logo-jpeg-tools/images.mjs";

const AGENT = "Mushavo-Staging-FR3-Personal-Proof-Browser-Readback";
const PREVIEW = "https://5edb0c6b.mushavo-budget-staging.pages.dev";
const PREVIEW_ID = "5edb0c6b-095d-4f8f-9a18-1bf166d784fd";
const STORAGE_KEY = "sb-dczlddwbtgvfdujgcitb-auth-token";
const PROOF_NAME = "synthetic-receipt.png";
const RPCS = new Set([
  "app_session_status", "my_account_suspended", "get_my_admin_user_invitation",
  "public_business_checkout_terms", "effective_workspace_entitlement",
  "personal_payment_plan_access", "workspace_billable_member_count", "workspace_member_usage", "exchange_rate_status",
]);
const NAME = "audit-fr3-personal-proof-20261113";
const one = r => r.status === 200 && r.data?.length === 1 ? r.data[0] : null;

async function browserFlow(chromium, owner, jpg, png, path, today, evidence) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block", userAgent: AGENT, timezoneId: "UTC" });
    context.setDefaultTimeout(18000);
    const calls = evidence.browser_requests = { permitted: 0, validator: 0, payment: 0, broker: 0, blocked: [] };
    const check = (name, condition) => {
      evidence.checks[name] = Boolean(condition);
      need(condition, name);
    };
    const session = { ...owner.session, expires_at: owner.session.expires_at ?? Math.floor(Date.now() / 1000) + owner.session.expires_in };
    await context.addInitScript(({ origin, storageKey, session }) => {
      if (location.origin === origin && !localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, JSON.stringify(session));
      }
    }, { origin: PREVIEW, storageKey: STORAGE_KEY, session });

    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method();
      const read = method === "GET" || method === "HEAD";
      let allow = read && (url.origin === PREVIEW || url.origin === "https://cdn.jsdelivr.net" && url.pathname.startsWith("/npm/"));
      if (url.origin === API_ORIGIN) {
        allow = method === "OPTIONS" || read && !url.pathname.startsWith("/storage/");
        if (method === "POST") {
          if (url.pathname === "/functions/v1/validate-payment-proof") {
            allow = ++calls.validator === 1 && req.headers()["content-type"] === "image/jpeg"
              && req.postDataBuffer()?.equals(jpg);
          } else if (url.pathname === "/rest/v1/payment_records") {
            const row = req.postDataJSON();
            allow = ++calls.payment === 1 && row?.payment_item_id === PAYMENT_ITEM
              && row.owner_id === OWNER && row.recorded_by === OWNER && row.family_id === null && row.visibility === "personal"
              && row.paid_by_member_id === null && (row.workspace_id === undefined || row.workspace_id === WORKSPACE)
              && row.amount === 1 && row.currency === "USD" && row.payment_date === today && row.due_date === today
              && row.period_start === today.slice(0, 7) + "-01" && row.payment_method === "Other"
              && row.proof_path === path && row.proof_name === PROOF_NAME && row.proof_mime_type === "image/png"
              && row.proof_size_bytes === png.length && row.reference_number === null && row.notes === null;
          } else if (url.pathname === "/functions/v1/get-private-file") {
            const payload = req.postDataJSON();
            allow = ++calls.broker === 1 && payload?.bucket === BUCKET && payload?.path === path;
          } else {
            allow = url.pathname.startsWith("/rest/v1/rpc/") && RPCS.has(url.pathname.split("/").at(-1));
          }
        }
      }
      if (allow && ++calls.permitted <= 220) return route.continue();
      if (calls.blocked.length < 20 && [PREVIEW, API_ORIGIN].includes(url.origin)) {
        calls.blocked.push({ method, path: url.pathname.replace(/[0-9a-f-]{36}/g, "[id]").slice(0, 110) });
      }
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    const isPost = endpoint => response => response.url() === API_ORIGIN + endpoint && response.request().method() === "POST";
    const card = page.locator(`[data-payment-item-id="${PAYMENT_ITEM}"]`).filter({ hasText: NAME });
    evidence.browser_stage = "OPEN_PERSONAL_PAYMENT";
    await page.goto(PREVIEW + "/app#personal/payments", { waitUntil: "domcontentloaded" });
    await card.getByRole("button", { name: "Record payment", exact: true }).click();
    const form = page.locator("#recordPaymentForm");
    await form.waitFor({ state: "visible" });
    check("BROWSER_EXACT_PERSONAL_ITEM_RENDERED", await page.locator("#recordItemId").inputValue() === PAYMENT_ITEM
      && await page.locator("#recordAmount").inputValue() === "1" && new URL(page.url()).hash === "#personal/payments");

    evidence.browser_stage = "ATTACH_AND_SAVE";
    await form.locator("#recordMethod").selectOption("Other");
    await form.locator("#recordProof").setInputFiles({ name: "synthetic-receipt.jpg", mimeType: "image/jpeg", buffer: jpg });
    const [validator, payment] = await Promise.all([
      page.waitForResponse(isPost("/functions/v1/validate-payment-proof")),
      page.waitForResponse(isPost("/rest/v1/payment_records")),
      form.getByRole("button", { name: "Save payment", exact: true }).click(),
    ]);
    evidence.browser_http = { validator: validator.status(), payment: payment.status() };
    const file = await validator.json();
    check("BROWSER_IMAGE_NORMALIZED", validator.status() === 200 && file?.path === path
      && file.type === "image/png" && file.size === png.length);
    check("BROWSER_PAYMENT_SAVED", payment.status() === 201 && calls.payment === 1);
    await page.getByText("Payment recorded as paid in full.", { exact: true }).waitFor({ state: "visible" });

    evidence.browser_stage = "RELOAD_AND_OPEN_HISTORY_PROOF";
    await page.reload({ waitUntil: "domcontentloaded" });
    await card.getByRole("button", { name: "History", exact: true }).click();
    const history = page.locator("#paymentHistoryDialog");
    await history.getByText("Proof: " + PROOF_NAME, { exact: false }).waitFor({ state: "visible" });
    const link = history.getByRole("button", { name: "View proof", exact: true });
    const recordId = await link.getAttribute("data-open-proof");
    check("BROWSER_RECORD_RESTORED", /^[a-f0-9-]{36}$/.test(recordId || "") && await history.locator("#paymentHistoryCount").textContent() === "1");
    const [response, preview] = await Promise.all([
      page.waitForResponse(isPost("/functions/v1/get-private-file")),
      context.waitForEvent("page", { predicate: candidate => candidate !== page }),
      link.click(),
    ]);
    evidence.browser_http.broker = response.status();
    const headers = await response.allHeaders();
    const mediaType = headers["x-mushavo-media-type"] || "";
    const directives = (headers["cache-control"] || "").toLowerCase().split(",").map(value => value.trim());
    const downloaded = await response.body();
    const brokerChecks = {
      BROWSER_BROKER_HTTP_OK: response.status() === 200,
      BROWSER_BROKER_MEDIA_TYPE: mediaType === "image/png",
      BROWSER_BROKER_CACHE_PRIVATE: directives.includes("private"),
      BROWSER_BROKER_CACHE_NO_STORE: directives.includes("no-store"),
      BROWSER_BROKER_RETURNS_EXACT_BYTES: digest(downloaded) === digest(png),
    };
    Object.assign(evidence.checks, brokerChecks);
    evidence.broker_readback = {
      media_type: /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mediaType) ? mediaType : null,
      cache_control: directives.filter(value => /^(private|public|no-store|no-cache|must-revalidate|max-age=\d+|s-maxage=\d+)$/.test(value)),
      cache_directive_count: directives.filter(Boolean).length,
      expected_bytes: png.length,
      received_bytes: downloaded.length,
    };
    evidence.browser_stage = "VERIFY_PROOF_IMAGE_RENDER";
    await preview.waitForURL(url => url.protocol === "blob:");
    await preview.waitForFunction(() => {
      const image = document.querySelector("img");
      return image?.complete && image.naturalWidth === 3 && image.naturalHeight === 4;
    });
    check("BROWSER_PROOF_IMAGE_RENDERED", preview.url().startsWith("blob:" + PREVIEW + "/"));
    for (const [name, passed] of Object.entries(brokerChecks)) need(passed, name);
    evidence.browser_stage = "COMPLETE";
    return recordId;
  } finally {
    await browser.close();
  }
}

async function exercise({ actors, evidence }, key, decoder, chromium) {
  const owner = actors.USER_A, foreign = actors.USER_B;
  need(owner.id === OWNER && foreign.id !== OWNER, "EXACT_PERSONAL_FIXTURE_ACTORS_REQUIRED");
  const jpg = Buffer.from(PROGRESSIVE_ROTATED_JPEG, "base64");
  const png = normalizeLogoJpeg(jpg, decoder);
  const hash = digest(png), uuid = hash.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  const path = PREFIX + uuid + ".png";
  const today = new Date().toISOString().slice(0, 10);
  const routes = {
    item: "/rest/v1/payment_items?id=eq." + PAYMENT_ITEM,
    item_create: "/rest/v1/payment_items",
    records: "/rest/v1/payment_records?payment_item_id=eq." + PAYMENT_ITEM + "&limit=2",
    workspace: "/rest/v1/budget_workspaces?select=id,owner_id,status,workspace_type&id=eq." + WORKSPACE + "&limit=2",
    context: "/rest/v1/rpc/private_file_download_context",
    remove: "/storage/v1/object/" + BUCKET,
  };
  evidence.checks = {};
  evidence.requests = 0;
  evidence.cleanup = {};
  const check = (k, ok) => {
    evidence.checks[k] = ok === true;
    need(ok === true, k);
  };
  async function call(name, method, actor, body) {
    need(Object.hasOwn(routes, name) && ++evidence.requests <= 20, "PERSONAL_PROOF_REQUEST_BOUND");
    const r = await fetch(API_ORIGIN + routes[name], {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: "Bearer " + actor.token, "user-agent": AGENT,
        "content-type": "application/json", origin: WEB_ORIGIN, prefer: "return=representation" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let data;
    try { data = await r.json(); } catch {}
    return { status: r.status, data };
  }
  const item = () => call("item", "GET", owner);
  const records = () => call("records", "GET", owner);
  const absent = r => r.status === 200 && r.data?.length === 0;
  const context = () => call("context", "POST", owner, { p_bucket_id: BUCKET, p_object_name: path });
  let bound = false, failed, cleanupFailed, recordId;
  try {
    const w = one(await call("workspace", "GET", owner));
    check("EXACT_PERSONAL_WORKSPACE", w?.id === WORKSPACE && w.owner_id === OWNER && w.status === "active" && w.workspace_type === "personal");
    check("EMPTY_TRIAL_BASELINE", absent(await item()) && absent(await records()) && absent(await context()));
    bound = true;
    const created = await call("item_create", "POST", owner, {
      id: PAYMENT_ITEM, workspace_id: WORKSPACE, owner_id: OWNER, created_by: OWNER, visibility: "personal", family_id: null,
      name: NAME, amount: 1, currency: "USD", category: "Other", recurrence_type: "once", due_day: Number(today.slice(-2)),
      start_date: today, reminder_days_before: 0, status: "active",
    });
    if (created.status !== 201 && /^[A-Z_]{4,100}$/.test(created.data?.message || "")) evidence.item_create_error = created.data.message;
    check("SYNTHETIC_ITEM_CREATED", created.status === 201 && created.data?.[0]?.id === PAYMENT_ITEM && created.data[0].workspace_id === WORKSPACE);
    recordId = await browserFlow(chromium, owner, jpg, png, path, today, evidence);
    const row = one(await records());
    check("EXACT_BROWSER_RECORD_READBACK", row?.id === recordId && row.owner_id === OWNER && row.recorded_by === OWNER
      && row.workspace_id === WORKSPACE && row.payment_item_id === PAYMENT_ITEM && row.proof_path === path
      && row.proof_mime_type === "image/png" && row.proof_size_bytes === png.length && row.proof_name === PROOF_NAME);
  } catch (e) { failed = e; }
  finally {
    if (bound) try {
      const current = await item();
      need(current.status === 200 && [0, 1].includes(current.data?.length), "EXACT_TRIAL_CLEANUP_READ_REQUIRED");
      if (current.data.length) {
        const row = current.data[0];
        need(row.id === PAYMENT_ITEM && row.name === NAME && row.workspace_id === WORKSPACE && row.owner_id === OWNER, "EXACT_ITEM_CLEANUP_BINDING");
        const related = await records();
        need(related.status === 200 && [0, 1].includes(related.data?.length), "EXACT_RECORD_CLEANUP_READ");
        if (related.data.length) {
          const record = related.data[0];
          need((!recordId || record.id === recordId) && record.payment_item_id === PAYMENT_ITEM && record.owner_id === OWNER
            && record.workspace_id === WORKSPACE && record.proof_path === path, "EXACT_RECORD_CLEANUP_BINDING");
        }
        const removed = await call("item", "DELETE", owner);
        need(removed.status === 200 && removed.data?.length === 1, "EXACT_ITEM_DELETE_REQUIRED");
      }
      need(absent(await item()) && absent(await records()), "FINANCE_FIXTURE_ABSENCE_REQUIRED");
      evidence.cleanup.payment_item_and_record_absent = true;
      const object = await context();
      need(object.status === 200 && [0, 1].includes(object.data?.length), "EXACT_PROOF_CLEANUP_STATE_REQUIRED");
      if (object.data.length) {
        need(object.data[0].object_name === path, "EXACT_PROOF_CLEANUP_PATH_REQUIRED");
        need((await call("remove", "DELETE", owner, { prefixes: [path] })).status === 200, "PROOF_OBJECT_DELETE_REQUIRED");
      }
      need(absent(await context()), "PROOF_OBJECT_ABSENCE_REQUIRED");
      evidence.cleanup.proof_object_absent = true;
    } catch (e) { cleanupFailed = e; }
    if (failed) evidence.browser_failure = failed instanceof Stop ? failed.code : failed.name === "TimeoutError" ? "BROWSER_TIMEOUT" : "BROWSER_REQUEST_OR_ASSERTION_FAILED";
  }
  if (cleanupFailed) throw cleanupFailed;
  if (failed) throw failed;
}

async function main() {
  const p = JSON.parse(await readFile(new URL("./staging-personal-proof-browser-run.json", import.meta.url), "utf8"));
  if (p.enabled === false) return { result: "PERSONAL_PROOF_PLAN_ARCHIVED", exit_code: 0 };
  need(p.enabled === true && p.project === "dczlddwbtgvfdujgcitb" && p.fixture_item === PAYMENT_ITEM
    && p.preview === PREVIEW && p.preview_id === PREVIEW_ID && p.status === "HOSTED_PERSONAL_PROOF_BROWSER_READBACK_ONCE", "EXACT_PERSONAL_PROOF_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization" && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_BRANCH_REQUIRED");
  const r = await fetch(PREVIEW + "/config.js?v=27", { redirect: "error", signal: AbortSignal.timeout(15000) });
  need(r.ok, "STAGING_CONFIGURATION_REQUIRED");
  for (const path of ["app.js", "app.html", "private-files.js"]) {
    const remote = await fetch(PREVIEW + "/" + path, { redirect: "error", signal: AbortSignal.timeout(15000) });
    const local = await readFile(new URL("../../" + path, import.meta.url));
    need(remote.ok && digest(Buffer.from(await remote.arrayBuffer())) === digest(local), "PINNED_PREVIEW_ASSETS_REQUIRED");
  }
  const { key } = readPublicConfiguration(await r.text());
  const { default: jpeg } = await import("../fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js");
  const { chromium } = await import("../fixtures/staging-browser-tools/node_modules/playwright/index.mjs");
  const options = { accountScope: "ordinary" };
  const result = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    input => exercise(input, key, jpeg.decode, chromium), options);
  return { ...result, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Personal proof browser", commit: process.env.GITHUB_SHA };
}
const report = await main().catch(error => ({
  progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Personal proof browser",
  result: "STAGING_PERSONAL_PROOF_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "UNEXPECTED_BROWSER_RUN_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
