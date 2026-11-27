import { readFile } from "node:fs/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { FAMILY, ITEM, OWNER, MEMBER, prefixFor } from "../../supabase/functions/validate-family-proof/scope.mjs";
import { normalizeLogoJpeg } from "../../supabase/functions/validate-business-logo/jpeg.mjs";
import { PROGRESSIVE_ROTATED_JPEG } from "../fixtures/logo-jpeg-tools/images.mjs";

const AGENT = "Mushavo-Staging-FR3-Family-Proof-Browser";
const PREVIEW = "https://5edb0c6b.mushavo-budget-staging.pages.dev";
const PREVIEW_ID = "5edb0c6b-095d-4f8f-9a18-1bf166d784fd";
const STORAGE_KEY = "sb-dczlddwbtgvfdujgcitb-auth-token";
const PROOF_NAME = "synthetic-receipt.png";
const RPCS = new Set([
  "app_session_status", "my_account_suspended", "get_my_admin_user_invitation",
  "public_business_checkout_terms", "effective_workspace_entitlement",
  "personal_payment_plan_access", "workspace_billable_member_count", "workspace_member_usage", "exchange_rate_status",
]);

const NAME = "audit-fr3-family-proof-20261113";
const BUCKET = "payment-proofs";
const jpg = Buffer.from(PROGRESSIVE_ROTATED_JPEG, "base64");
const one = r => r.status === 200 && r.data?.length === 1 ? r.data[0] : null;
const empty = r => r.status === 200 && r.data?.length === 0;

async function browserFlow(chromium, member, payer, workspace, jpg, png, path, today, evidence) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block", userAgent: AGENT, timezoneId: "UTC" });
    context.setDefaultTimeout(18000);
    const candidate = await readFile(new URL("../../app.js", import.meta.url));
    const calls = evidence.browser_requests = { permitted: 0, validator: 0, payment: 0, broker: 0, blocked: [] };
    const check = (name, condition) => {
      evidence.checks[name] = Boolean(condition);
      need(condition, name);
    };
    const session = { ...member.session, expires_at: member.session.expires_at ?? Math.floor(Date.now() / 1000) + member.session.expires_in };
    await context.addInitScript(({ origin, storageKey, session, family }) => {
      if (location.origin === origin && !localStorage.getItem(storageKey)) {
        localStorage.setItem(storageKey, JSON.stringify(session));
        localStorage.setItem("mushavo-budget:selected-family:" + session.user.id, family);
      }
    }, { origin: PREVIEW, storageKey: STORAGE_KEY, session, family: FAMILY });

    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method();
      const read = method === "GET" || method === "HEAD";
      let allow = read && (url.origin === PREVIEW || url.origin === "https://cdn.jsdelivr.net" && url.pathname.startsWith("/npm/"));
      if (url.origin === API_ORIGIN) {
        allow = method === "OPTIONS" || read && !url.pathname.startsWith("/storage/");
        if (method === "POST") {
          if (url.pathname === "/functions/v1/validate-family-proof") {
            allow = ++calls.validator === 1 && req.headers()["content-type"] === "image/jpeg"
              && req.postDataBuffer()?.equals(jpg);
          } else if (url.pathname === "/rest/v1/payment_records") {
            const row = req.postDataJSON();
            allow = ++calls.payment === 1 && row?.payment_item_id === ITEM
              && row.owner_id === MEMBER && row.recorded_by === MEMBER && row.family_id === FAMILY && row.visibility === "family"
              && row.paid_by_member_id === payer && (row.workspace_id === undefined || row.workspace_id === workspace)
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
      if (allow && ++calls.permitted <= 220) {
        if (url.origin === PREVIEW && url.pathname === "/app.js" && read) {
          calls.candidate_app = (calls.candidate_app || 0) + 1;
          return route.fulfill({ status: 200, contentType: "application/javascript; charset=utf-8", body: candidate });
        }
        return route.continue();
      }
      if (calls.blocked.length < 20 && [PREVIEW, API_ORIGIN].includes(url.origin)) {
        calls.blocked.push({ method, path: url.pathname.replace(/[0-9a-f-]{36}/g, "[id]").slice(0, 110) });
      }
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    const isPost = endpoint => response => response.url() === API_ORIGIN + endpoint && response.request().method() === "POST";
    const card = page.locator(`[data-payment-item-id="${ITEM}"]`).filter({ hasText: NAME });
    evidence.browser_stage = "OPEN_FAMILY_PAYMENT";
    await page.goto(PREVIEW + "/app#family/payments", { waitUntil: "domcontentloaded" });
    await card.getByRole("button", { name: "Record payment", exact: true }).click();
    const form = page.locator("#recordPaymentForm");
    await form.waitFor({ state: "visible" });
    check("BROWSER_EXACT_FAMILY_ITEM_RENDERED", await page.locator("#recordItemId").inputValue() === ITEM
      && await page.locator("#recordAmount").inputValue() === "1" && new URL(page.url()).hash === "#family/payments");

    evidence.browser_stage = "ATTACH_AND_SAVE";
    await form.locator("#recordPaidBy").selectOption(payer);
    await form.locator("#recordMethod").selectOption("Other");
    await form.locator("#recordProof").setInputFiles({ name: "synthetic-receipt.jpg", mimeType: "image/jpeg", buffer: jpg });
    const [validator, payment] = await Promise.all([
      page.waitForResponse(isPost("/functions/v1/validate-family-proof")),
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
    const brokerChecks = {
      BROWSER_BROKER_HTTP_OK: response.status() === 200,
      BROWSER_BROKER_MEDIA_TYPE: mediaType === "image/png",
      BROWSER_BROKER_CACHE_PRIVATE: directives.includes("private"),
      BROWSER_BROKER_CACHE_NO_STORE: directives.includes("no-store"),
    };
    Object.assign(evidence.checks, brokerChecks);
    evidence.broker_readback = {
      media_type: /^[a-z0-9.+-]+\/[a-z0-9.+-]+$/.test(mediaType) ? mediaType : null,
      cache_control: directives.filter(value => /^(private|public|no-store|no-cache|must-revalidate|max-age=\d+|s-maxage=\d+)$/.test(value)),
      cache_directive_count: directives.filter(Boolean).length,
      expected_bytes: png.length,
    };
    evidence.browser_stage = "VERIFY_PROOF_IMAGE_RENDER";
    await preview.waitForURL(url => url.protocol === "blob:");
    await preview.waitForFunction(() => {
      const image = document.querySelector("img");
      return image?.complete && image.naturalWidth === 3 && image.naturalHeight === 4;
    });
    const proofUrl = preview.url();
    check("BROWSER_PROOF_IMAGE_RENDERED", proofUrl.startsWith("blob:" + PREVIEW + "/"));
    const image = await page.evaluate(async ({ url, limit }) => {
      const result = await fetch(url, { signal: AbortSignal.timeout(5000) });
      const blob = await result.blob();
      return { type: blob.type, size: blob.size,
        bytes: result.ok && blob.size === limit ? Array.from(new Uint8Array(await blob.arrayBuffer())) : [] };
    }, { url: proofUrl, limit: png.length });
    evidence.broker_readback.rendered_blob_type = image.type === "image/png" ? image.type : null;
    evidence.broker_readback.rendered_blob_bytes = image.size;
    check("BROWSER_RENDERED_BLOB_MATCHES_NORMALIZED_BYTES", image.type === "image/png"
      && digest(Buffer.from(image.bytes)) === digest(png));
    for (const [name, passed] of Object.entries(brokerChecks)) need(passed, name);
    check("PINNED_CANDIDATE_EXECUTED_ON_BOTH_LOADS", calls.candidate_app === 2);
    evidence.browser_stage = "COMPLETE";
    return recordId;
  } finally {
    await browser.close();
  }
}

async function exercise({ actors, evidence }, key, workspace, png, chromium) {
  const owner = actors.USER_A, member = actors.USER_B;
  need(owner.id === OWNER && member.id === MEMBER, "EXACT_FAMILY_ACTORS_REQUIRED");
  const hash = digest(png);
  const suffix = hash.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5") + ".png";
  const paths = Object.fromEntries([owner, member].map(actor => [actor.id, prefixFor(actor.id) + suffix]));
  const today = new Date().toISOString().slice(0, 10);
  const routes = {
    family: "/rest/v1/families?id=eq." + FAMILY,
    workspace: "/rest/v1/budget_workspaces?id=eq." + workspace,
    members: "/rest/v1/family_members?family_id=eq." + FAMILY + "&limit=3",
    item: "/rest/v1/payment_items?id=eq." + ITEM,
    create: "/rest/v1/payment_items",
    records: "/rest/v1/payment_records?payment_item_id=eq." + ITEM + "&limit=2",
    context: "/rest/v1/rpc/private_file_download_context",
    removeFamily: "/rest/v1/rpc/delete_family_workspace",
    remove: "/storage/v1/object/" + BUCKET,
  };
  Object.assign(evidence, { checks: {}, requests: 0, cleanup: {} });
  const check = (name, ok) => {
    evidence.checks[name] = Boolean(ok);
    need(ok, name);
  };
  async function call(route, method, actor, body) {
    need(Object.hasOwn(routes, route) && ++evidence.requests <= 45, "FAMILY_PROOF_REQUEST_BOUND");
    const r = await fetch(API_ORIGIN + routes[route], {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: "Bearer " + actor.token, "user-agent": AGENT,
        "content-type": "application/json", origin: WEB_ORIGIN, prefer: "return=representation" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let data;
    try { data = await r.json(); } catch {}
    return { status: r.status, data, noStore: /private, no-store/.test(r.headers.get("cache-control") || "") };
  }
  const item = () => call("item", "GET", owner);
  const records = () => call("records", "GET", owner);
  const context = path => call("context", "POST", owner, { p_bucket_id: BUCKET, p_object_name: path });
  let bound = false, failure, cleanupFailure, recordId;
  try {
    const f = one(await call("family", "GET", owner));
    const w = one(await call("workspace", "GET", owner));
    check("EXACT_FAMILY_FIXTURE", f?.id === FAMILY && f.owner_id === OWNER && f.name === NAME
      && w?.id === workspace && w.owner_id === OWNER && w.legacy_family_id === FAMILY && w.status === "active"
      && w.workspace_type === "household");
    bound = true;
    const members = await call("members", "GET", owner);
    const payer = members.data?.find?.(row => row.user_id === MEMBER && row.status === "active");
    check("EXACT_ACTIVE_MEMBERS", members.status === 200 && members.data?.length === 2 && payer?.family_id === FAMILY
      && members.data.some(row => row.user_id === OWNER && row.status === "active"));
    check("EMPTY_FAMILY_PROOF_BASELINE", empty(await item()) && empty(await records())
      && empty(await context(paths[OWNER])) && empty(await context(paths[MEMBER])));
    const created = await call("create", "POST", owner, {
      id: ITEM, workspace_id: workspace, owner_id: OWNER, created_by: OWNER, visibility: "family", family_id: FAMILY,
      name: NAME, amount: 1, currency: "USD", category: "Other", recurrence_type: "once",
      due_day: Number(today.slice(-2)), start_date: today, reminder_days_before: 0, status: "active",
    });
    check("EXACT_FAMILY_ITEM_CREATED", created.status === 201 && created.data?.[0]?.id === ITEM && created.data[0].workspace_id === workspace);
    recordId = await browserFlow(chromium, member, payer.id, workspace, jpg, png, paths[MEMBER], today, evidence);
    const row = one(await records());
    check("EXACT_BROWSER_RECORD_READBACK", row?.id === recordId && row.workspace_id === workspace
      && row.family_id === FAMILY && row.payment_item_id === ITEM && row.owner_id === MEMBER
      && row.recorded_by === MEMBER && row.paid_by_member_id === payer.id && row.proof_path === paths[MEMBER]
      && row.proof_name === PROOF_NAME && row.proof_mime_type === "image/png" && row.proof_size_bytes === png.length);
  } catch (error) { failure = error; }
  finally {
    if (bound) try {
      const current = await item(), linked = await records();
      need(current.status === 200 && linked.status === 200 && [0, 1].includes(current.data?.length)
        && [0, 1].includes(linked.data?.length), "EXACT_FINANCE_CLEANUP_READ_REQUIRED");
      if (linked.data.length) {
        const row = linked.data[0];
        need((!recordId || row.id === recordId) && row.workspace_id === workspace && row.family_id === FAMILY
          && row.payment_item_id === ITEM && row.owner_id === MEMBER && row.proof_path === paths[MEMBER], "EXACT_RECORD_CLEANUP_REQUIRED");
      }
      if (current.data.length) {
        const row = current.data[0];
        need(row.id === ITEM && row.name === NAME && row.workspace_id === workspace && row.family_id === FAMILY
          && row.owner_id === OWNER, "EXACT_ITEM_CLEANUP_REQUIRED");
        const deleted = await call("item", "DELETE", owner);
        need(deleted.status === 200 && deleted.data?.length === 1, "EXACT_ITEM_DELETE_REQUIRED");
      }
      need(empty(await item()) && empty(await records()), "EXACT_FINANCE_ABSENCE_REQUIRED");
      evidence.cleanup.finance_absent = true;
      const present = [];
      for (const path of Object.values(paths)) {
        const object = await context(path);
        need(object.status === 200 && [0, 1].includes(object.data?.length), "EXACT_OBJECT_CONTEXT_REQUIRED");
        if (object.data.length) {
          need(object.data[0].object_name === path, "EXACT_OBJECT_NAME_REQUIRED");
          present.push(path);
        }
      }
      if (present.length) need((await call("remove", "DELETE", owner, { prefixes: present })).status === 200, "EXACT_OBJECT_REMOVAL_REQUIRED");
      for (const path of Object.values(paths)) need(empty(await context(path)), "EXACT_OBJECT_ABSENCE_REQUIRED");
      evidence.cleanup.objects_absent = true;
      const deleted = await call("removeFamily", "POST", owner, { p_family_id: FAMILY });
      need(deleted.status === 200 && deleted.data === "deleted"
        && empty(await call("family", "GET", owner)) && empty(await call("workspace", "GET", owner)), "FAMILY_FIXTURE_ABSENCE_REQUIRED");
      evidence.cleanup.family_absent = true;
    } catch (error) { cleanupFailure = error; }
    if (failure) evidence.check_failure = failure instanceof Stop ? failure.code
      : failure.name === "TimeoutError" ? "BROWSER_TIMEOUT" : "BROWSER_REQUEST_OR_ASSERTION_FAILED";
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}

async function main() {
  const p = JSON.parse(await readFile(new URL("./staging-family-proof-browser-run.json", import.meta.url), "utf8"));
  if (p.enabled === false) return { result: "FAMILY_PROOF_PLAN_ARCHIVED", exit_code: 0 };
  need(p.enabled === true && p.project === "dczlddwbtgvfdujgcitb" && p.family === FAMILY && p.item === ITEM
    && /^[a-f0-9-]{36}$/.test(p.workspace || "") && p.preview === PREVIEW && p.preview_id === PREVIEW_ID && p.status === "HOSTED_FAMILY_PROOF_BROWSER_ONCE", "EXACT_FAMILY_PROOF_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization"
    && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_BRANCH_REQUIRED");
  const r = await fetch(PREVIEW + "/config.js?v=27", { redirect: "error", signal: AbortSignal.timeout(15000) });
  need(r.ok, "STAGING_CONFIGURATION_REQUIRED");
  const { key } = readPublicConfiguration(await r.text());
  const { default: jpeg } = await import("../fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js");
  const png = normalizeLogoJpeg(jpg, jpeg.decode);
  for (const path of ["app.html", "private-files.js"]) {
    const remote = await fetch(PREVIEW + "/" + path, { redirect: "error", signal: AbortSignal.timeout(15000) });
    const local = await readFile(new URL("../../" + path, import.meta.url));
    need(remote.ok && digest(Buffer.from(await remote.arrayBuffer())) === digest(local), "PINNED_PREVIEW_ASSETS_REQUIRED");
  }
  const { chromium } = await import("../fixtures/staging-browser-tools/node_modules/playwright/index.mjs");
  const options = { accountScope: "ordinary" };
  const report = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    input => exercise(input, key, p.workspace, png, chromium), options);
  return { ...report, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Family proof browser", commit: process.env.GITHUB_SHA };
}

const report = await main().catch(error => ({
  progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Family proof browser",
  result: "STAGING_FAMILY_PROOF_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "UNEXPECTED_FAMILY_PROOF_RUN_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
