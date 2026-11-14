import { Buffer } from "node:buffer";
import { readFile } from "node:fs/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { BUCKET, OWNER, PREFIX, WORKSPACE } from "../../supabase/functions/validate-subscription-proof/scope.mjs";
import { normalizeStaticPdf } from "../../supabase/functions/validate-payment-proof/pdf.mjs";
import { pdf, receiptPdf } from "../fixtures/pdf-proof-tools/fixtures.mjs";

const AGENT = "Mushavo-Staging-FR3-Subscription-Browser";
const PREVIEW = "https://5edb0c6b.mushavo-budget-staging.pages.dev";
const PREVIEW_ID = "5edb0c6b-095d-4f8f-9a18-1bf166d784fd";
const STORAGE_KEY = "sb-dczlddwbtgvfdujgcitb-auth-token";
const PROOF_NAME = "synthetic-subscription-proof.pdf";
const RPCS = new Set([
  "app_session_status", "my_account_suspended", "get_my_admin_user_invitation",
  "public_business_checkout_terms", "effective_workspace_entitlement",
  "personal_payment_plan_access", "workspace_billable_member_count", "workspace_member_usage", "exchange_rate_status",
]);
const PLAN = "audit_fr3_subscription_proof";
const WITNESS = "/rest/v1/rpc/fr3_subscription_proof_browser_witness";
const VALIDATOR = "/functions/v1/validate-subscription-proof";
const REFERENCE = "AUDIT-FR3-SUBSCRIPTION-BROWSER-20261114";

async function browserFlow(chromium, owner, input, canonical, path, evidence, key) {
  const browser = await chromium.launch({ channel: "chromium", headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: "block", userAgent: AGENT, timezoneId: "UTC" });
    context.setDefaultTimeout(18000);
    const candidate = await readFile(new URL("../../app.js", import.meta.url));
    const calls = evidence.browser_requests = { permitted: 0, validator: 0, witness: 0, config: 0, broker: 0, blocked: [] };
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
          if (url.pathname === VALIDATOR) {
            allow = ++calls.validator === 1 && req.headers()["content-type"] === "application/pdf"
              && req.postDataBuffer()?.equals(input);
          } else if (url.pathname === WITNESS) {
            const row = req.postDataJSON();
            if (row?.p_path === null && row.p_name === null && row.p_size === null) {
              allow = ++calls.config <= 3;
            } else {
              allow = ++calls.witness === 1 && row?.p_path === path && row.p_name === PROOF_NAME
                && row.p_size === canonical.length && Object.keys(row).length === 3;
            }
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
    const isPost = endpoint => response => new URL(response.url()).origin === API_ORIGIN
      && new URL(response.url()).pathname === endpoint && response.request().method() === "POST";
    evidence.browser_stage = "OPEN_PERSONAL_SUBSCRIPTION";
    await page.goto(PREVIEW + "/app#personal/subscription", { waitUntil: "domcontentloaded" });
    await page.locator("#openRenewalButton").click();
    const form = page.locator("#renewalForm");
    await form.waitFor({ state: "visible" });
    await form.locator("#renewalPlan").selectOption(PLAN);
    await form.locator("#renewalPeriod").selectOption("monthly");
    check("EXACT_FIXTURE_PLAN_AND_PRICE_VISIBLE", await form.locator("#renewalCurrency").inputValue() === "USD"
      && Number(await form.locator("#renewalAmount").inputValue()) === 1);
    await form.locator("#renewalMethod").selectOption("Other");
    await form.locator("#renewalReference").fill(REFERENCE);
    await form.locator("#renewalProof").setInputFiles({ name: PROOF_NAME, mimeType: "application/pdf", buffer: input });
    evidence.browser_stage = "VALIDATE_AND_SUBMIT_TEST_RENEWAL";
    const [validated, submitted] = await Promise.all([
      page.waitForResponse(isPost(VALIDATOR)),
      page.waitForResponse(r => isPost(WITNESS)(r) && r.request().postDataJSON()?.p_path === path),
      form.locator("#renewalSubmitButton").click(),
    ]);
    evidence.browser_http = { validator: validated.status(), witness: submitted.status() };
    const metadata = await validated.json();
    check("BROWSER_UPLOADED_CANONICAL_PDF", validated.ok() && metadata?.path === path
      && metadata.type === "application/pdf" && metadata.size === canonical.length);
    const witness = await submitted.json();
    if (!submitted.ok() && /^[A-Z_]{4,100}$/.test(witness?.message || "")) evidence.witness_error = witness.message;
    check("GENUINE_RENEWAL_AND_LINK_VERIFIED", submitted.ok() && witness?.payment_linked === true
      && witness.proof_size === canonical.length && witness.proof_mime === "application/pdf");
    check("RENEWAL_AND_NOTIFICATION_ROLLED_BACK", witness.rolled_back === true && witness.notification_rows_before_rollback === 1);
    await form.waitFor({ state: "hidden" });
    await page.getByText("Staging payment proof verified. The test renewal was rolled back.", { exact: true }).waitFor({ state: "visible" });

    evidence.browser_stage = "VERIFY_PRIVATE_FILE";
    const opened = await page.evaluate(async ({ origin, key, token, bucket, path, expectedSize }) => {
      const response = await fetch(origin + "/functions/v1/get-private-file", {
        method: "POST", headers: { apikey: key, authorization: "Bearer " + token, "content-type": "application/json" },
        body: JSON.stringify({ bucket, path }),
      });
      const bytes = await response.blob();
      return { status: response.status, type: response.headers.get("x-mushavo-media-type"),
        bytes: bytes.size === expectedSize ? [...new Uint8Array(await bytes.arrayBuffer())] : [] };
    }, { origin: API_ORIGIN, key,
      token: owner.token, bucket: BUCKET, path, expectedSize: canonical.length });
    check("SAME_BROWSER_SESSION_READS_EXACT_PRIVATE_PDF", opened.status === 200 && opened.type === "application/pdf"
      && digest(Buffer.from(opened.bytes)) === digest(canonical));
    check("PINNED_CANDIDATE_AND_BOUNDED_WRITES", calls.candidate_app === 1 && calls.validator === 1 && calls.witness === 1 && calls.broker === 1);
    evidence.browser_stage = "COMPLETE";
  } finally {
    await browser.close();
  }
}

async function exercise({ actors, evidence }, key, decoder, chromium) {
  const owner = actors.USER_A;
  need(owner.id === OWNER, "EXACT_SUBSCRIPTION_OWNER_REQUIRED");
  const input = Buffer.from(await receiptPdf());
  const canonical = await normalizeStaticPdf(input, pdf, decoder);
  const hash = digest(canonical), uuid = hash.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  const path = PREFIX + uuid + ".pdf";
  evidence.checks = {};
  evidence.cleanup = {};
  const call = async (route, method, body) => {
    const response = await fetch(API_ORIGIN + route, {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: "Bearer " + owner.token, "user-agent": AGENT,
        "content-type": "application/json", origin: WEB_ORIGIN },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    let data;
    try { data = await response.json(); } catch {}
    return { status: response.status, data };
  };
  const context = () => call("/rest/v1/rpc/private_file_download_context", "POST", { p_bucket_id: BUCKET, p_object_name: path });
  const absent = r => r.status === 200 && r.data?.length === 0;
  need(absent(await context()), "EXACT_EMPTY_SUBSCRIPTION_OBJECT_SCOPE_REQUIRED");
  evidence.checks.empty_subscription_object_scope = true;
  let failure, cleanupFailure;
  try {
    await browserFlow(chromium, owner, input, canonical, path, evidence, key);
  } catch (error) {
    failure = error;
    evidence.browser_failure = error instanceof Stop ? error.code : error.name === "TimeoutError" ? "BROWSER_TIMEOUT" : "BROWSER_CHECK_FAILED";
  } finally {
    try {
      const read = await context();
      need(read.status === 200 && [0,1].includes(read.data?.length), "EXACT_BROWSER_CLEANUP_READ_REQUIRED");
      if (read.data.length) {
        need(read.data[0].object_name === path, "EXACT_BROWSER_CLEANUP_PATH_REQUIRED");
        need((await call("/storage/v1/object/" + BUCKET, "DELETE", { prefixes: [path] })).status === 200,
          "EXACT_BROWSER_OBJECT_DELETE_REQUIRED");
      }
      need(absent(await context()), "SUBSCRIPTION_BROWSER_OBJECT_ABSENCE_REQUIRED");
      evidence.cleanup.proof_object_absent = true;
    } catch (error) { cleanupFailure = error; }
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}

async function main() {
  const p = JSON.parse(await readFile(new URL("./staging-subscription-proof-browser-run.json", import.meta.url), "utf8"));
  if (p.enabled === false) return { result: "SUBSCRIPTION_BROWSER_PLAN_ARCHIVED", exit_code: 0 };
  need(p.enabled === true && p.project === "dczlddwbtgvfdujgcitb" && p.workspace === WORKSPACE
    && p.preview === PREVIEW && p.preview_id === PREVIEW_ID && p.status === "HOSTED_SUBSCRIPTION_PROOF_BROWSER_ONCE", "EXACT_SUBSCRIPTION_BROWSER_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization" && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_BRANCH_REQUIRED");
  const r = await fetch(PREVIEW + "/config.js?v=27", { redirect: "error", signal: AbortSignal.timeout(15000) });
  need(r.ok, "STAGING_CONFIGURATION_REQUIRED");
  for (const path of ["app.html", "private-files.js"]) {
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
  return { ...result, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Subscription proof browser", commit: process.env.GITHUB_SHA };
}
const report = await main().catch(error => ({
  progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Subscription proof browser",
  result: "STAGING_SUBSCRIPTION_BROWSER_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "UNEXPECTED_BROWSER_RUN_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
