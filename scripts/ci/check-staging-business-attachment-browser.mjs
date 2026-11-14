import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { BUCKET, OWNER, WORKSPACE, attachmentFixtures } from "../../supabase/functions/validate-business-attachment/scope.mjs";
import { normalizeStaticPdf } from "../../supabase/functions/validate-payment-proof/pdf.mjs";
import { pdf, receiptPdf } from "../fixtures/pdf-proof-tools/fixtures.mjs";

const AGENT = "Mushavo-Staging-FR3-Business-Attachment-Browser";
const PREVIEW = "https://13fc0c26.mushavo-budget-staging.pages.dev";
const initialVersion = 34;
const activeVersion = initialVersion + 1;
const closedVersion = activeVersion + 1;
const NAME = "audit-fr3-logo-ingestion-20261112";
const PROGRESS = "Stage 4/10 | FR.3/8 | FR.3.2 Business attachment browser";
const RPC_READS = new Set([
  "app_session_status", "my_account_suspended", "get_my_business_invitations", "effective_workspace_entitlement",
  "business_team_snapshot", "business_effective_permissions", "business_billing_snapshot", "business_claim_summary",
  "business_bill_summary", "business_transaction_feed", "business_claim_history", "business_request_feed",
  "business_budget_feed", "business_roles_snapshot", "business_payment_readiness",
]);

async function browserFlow(owner, files, input, report) {
  const require = createRequire(new URL("../fixtures/staging-browser-tools/package.json", import.meta.url));
  const { chromium } = require("playwright");
  const browser = await chromium.launch({headless: true});
  const calls = report.browser = { validator: 0, register: 0, broker: 0, reads: 0, blocked: [] };
  try {
    const context = await browser.newContext({ serviceWorkers: "block", userAgent: AGENT, timezoneId: "UTC" });
    context.setDefaultTimeout(14000);
    const candidate = await readFile(new URL("../../business.js", import.meta.url));
    const session = {...owner.session, expires_at: owner.session.expires_at ?? Math.floor(Date.now() / 1000) + owner.session.expires_in};
    await context.addInitScript(({origin, session}) => {
      if (location.origin === origin && !localStorage.getItem("sb-dczlddwbtgvfdujgcitb-auth-token")) {
        localStorage.setItem("sb-dczlddwbtgvfdujgcitb-auth-token", JSON.stringify(session));
      }
    }, {origin: PREVIEW, session});

    const validated = new Set(), registered = new Set(), opened = new Set();
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url()), method = req.method();
      const read = ["GET","HEAD"].includes(method);
      let allowed = read && (url.origin === PREVIEW || url.origin === "https://cdn.jsdelivr.net" && url.pathname.startsWith("/npm/"));
      if (url.origin === PREVIEW && url.pathname.endsWith("/business.js") && allowed) {
        return route.fulfill({status: 200, contentType: "application/javascript; charset=utf-8", body: candidate});
      }
      if (url.origin === API_ORIGIN) {
        allowed = method === "OPTIONS" || read && !url.pathname.startsWith("/storage/");
        if (method === "POST") {
          const body = req.postDataBuffer();
          if (url.pathname.endsWith("/validate-business-attachment")) {
            const lane = req.headers()["x-mushavo-attachment"];
            const f = files.find(item => item.lane === lane);
            const sample = lane === "expense-claim" && body?.equals(input.subarray(0,-12)) ? lane + ":truncated" : lane;
            allowed = f && !validated.has(sample) && req.headers()["content-type"] === "application/pdf"
              && (body?.equals(input) || sample === lane + ":truncated");
            if (allowed) { validated.add(sample); calls.validator++; }
          } else {
            let payload;
            try { payload = req.postDataJSON(); } catch {}
            if (url.pathname.endsWith("/register_business_document")) {
              const f = files.find(item => item.document === payload?.p_document_id);
              allowed = f && !registered.has(f.lane) && payload.p_workspace_id === WORKSPACE
                && payload.p_parent_type === f.type && payload.p_parent_id === f.parent && payload.p_storage_path === f.path
                && payload.p_original_name === f.filename && payload.p_mime_type === "application/pdf" && payload.p_size_bytes === f.size;
              if (allowed) { registered.add(f.lane); calls.register++; }
            } else if (url.pathname.endsWith("/get-private-file")) {
              const f = files.find(item => item.path === payload?.path);
              allowed = f && !opened.has(f.lane) && payload.bucket === BUCKET;
              if (allowed) { opened.add(f.lane); calls.broker++; }
            } else {
              allowed = url.pathname.startsWith("/rest/v1/rpc/") && RPC_READS.has(url.pathname.split("/").at(-1))
                && (!payload?.p_workspace_id || payload.p_workspace_id === WORKSPACE);
            }
          }
        }
      }
      if (allowed && ++calls.reads <= 320) return route.continue();
      if (calls.blocked.length < 18 && [PREVIEW, API_ORIGIN].includes(url.origin)) {
        calls.blocked.push([method, url.pathname.replace(/[0-9a-f-]{36}/g,"[id]").slice(0,100)]);
      }
      return route.abort("blockedbyclient");
    });
    const page = await context.newPage();
    const post = name => response => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/" + name);
    for (const f of files) {
      const claim = f.lane === "expense-claim";
      const mark = (name, value) => { report.checks[f.lane + "_" + name] = Boolean(value); need(value, "BROWSER_" + name); };
      report.browser_step = f.lane + ":OPEN";
      const main = await page.goto(PREVIEW + "/business?workspace=" + WORKSPACE + "#business/" + (claim ? "activity" : "bills"), {waitUntil:"domcontentloaded"});
      report.browser_navigation_status = main?.status();
      need(main?.ok() && new URL(page.url()).origin === PREVIEW, "EXACT_BUSINESS_PREVIEW_PAGE_REQUIRED");
      await page.locator("#businessApp").waitFor({state:"visible"});
      report.browser_step = f.lane + ":VERIFY_ACTIVE_TAB";
      await page.locator(`[data-business-panel="${claim ? "activity" : "bills"}"]`).waitFor({state:"visible"});
      report.browser_step = f.lane + ":OPEN_FIXTURE_RECORD";
      if (claim) {
        const card = page.locator("#businessClaimActivity .claim-row").filter({hasText:"FR3 synthetic claim receipt"});
        await card.locator("[data-transaction-key]").click();
      } else await page.locator(`#businessBillList [data-bill-id="${f.parent}"]`).click();
      const dialog = page.locator(claim ? "#businessClaimDetailDialog" : "#businessBillDetailDialog");
      await dialog.waitFor({state:"visible"});
      const picker = dialog.locator(claim ? "#claimReceiptFile" : "#billProofFile");
      if (claim) {
        report.browser_step = f.lane + ":REFUSE";
        const [result] = await Promise.all([
          page.waitForResponse(post("validate-business-attachment")),
          picker.setInputFiles({name:"incomplete-fixture.pdf",mimeType:"application/pdf",buffer:input.subarray(0,-12)}),
        ]);
        await dialog.locator("#claimDetailMessage").filter({hasText:"The file could not be validated."}).waitFor({state:"visible"});
        mark("TRUNCATED_REFUSED_BEFORE_REGISTRATION", result.status() === 422 && calls.register === 0);
      }
      report.browser_step = f.lane + ":ATTACH";
      const [validatedFile, row] = await Promise.all([
        page.waitForResponse(post("validate-business-attachment")),
        page.waitForResponse(post("register_business_document")),
        picker.setInputFiles({name:f.filename,mimeType:"application/pdf",buffer:input}),
      ]);
      const value = await validatedFile.json();
      mark("VALIDATED_METADATA_REGISTERED", validatedFile.status() === 200 && row.status() === 200
        && value.path === f.path && value.type === "application/pdf" && value.size === f.size);
      report.browser_step = f.lane + ":OPEN_FILE";
      const file = dialog.getByRole("button",{name:f.filename,exact:true});
      const [broker] = await Promise.all([page.waitForResponse(post("get-private-file")),file.click()]);
      mark("EXACT_PRIVATE_FILE_READ", broker.status() === 200 && broker.headers()["x-mushavo-media-type"] === "application/pdf"
        && digest(await broker.body()) === f.hash);
    }
    need(calls.validator === 3 && calls.register === 2 && calls.broker === 2
      && !calls.blocked.some(([method,path]) => ["POST","PUT","PATCH","DELETE"].includes(method) && path.startsWith("/storage/")),
      "EXACT_BROWSER_VALIDATION_ROUTING_REQUIRED");
  } finally { await browser.close(); }
}

async function exercise({ actors, evidence }, key, paidThrough) {
  const owner = actors.USER_A, outsider = actors.USER_B, admin = actors.ADMIN;
  need(owner.id === OWNER && outsider.id !== OWNER && admin.id !== OWNER, "EXACT_ATTACHMENT_ACTORS_REQUIRED");
  const input = await receiptPdf(), canonical = await normalizeStaticPdf(input,pdf), hash = digest(canonical);
  const object = hash.slice(0,32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,"$1-$2-$3-$4-$5");
  const files = [...attachmentFixtures].map(([lane,f]) => ({...f,lane,size:canonical.length,hash,
    filename:"synthetic-" + lane + ".pdf", path:`workspaces/${WORKSPACE}/${OWNER}/${f.document}/${object}.pdf`}));
  Object.assign(evidence,{checks:{},requests:0,cleanup:{}});
  async function call(path, method, actor, body, headers = {}) {
    need(++evidence.requests <= 40, "ATTACHMENT_REQUEST_BOUND");
    const response = await fetch(API_ORIGIN + path, {
      method, cache:"no-store", redirect:"error", signal:AbortSignal.timeout(15000),
      headers:{apikey:key,authorization:"Bearer " + actor.token,origin:WEB_ORIGIN,"content-type":"application/json","user-agent":AGENT,...headers},
      ...(body === undefined ? {} : {body: Buffer.isBuffer(body) ? body : JSON.stringify(body)}),
    });
    let data; try { data = await response.json(); } catch {}
    return {status:response.status,data};
  }
  const rpc = (name,actor,body) => call("/rest/v1/rpc/" + name,"POST",actor,body);
  const workspace = async () => (await call("/rest/v1/budget_workspaces?id=eq." + WORKSPACE,"GET",admin)).data?.[0];
  const docs = f => call("/rest/v1/business_documents?workspace_id=eq." + WORKSPACE + "&id=eq." + f.document,"GET",owner);
  const status = (value,version) => rpc("admin_business_set_status",admin,{
    p_workspace_id:WORKSPACE,p_status:value,p_expected_version:version,p_confirmation_name:NAME,
    p_reason:"Stage 4 isolated browser attachment validation",p_request_id:randomUUID(),
  });
  const bound = w => w?.id === WORKSPACE && w.owner_id === OWNER && w.name === NAME && w.workspace_type === "business";
  let confirmed = false, exerciseError, cleanupError;
  try {
    const w = await workspace(), sub = (await call("/rest/v1/workspace_subscriptions?workspace_id=eq." + WORKSPACE,"GET",admin)).data?.[0];
    need(bound(w) && w.status === "suspended" && w.business_support_version === initialVersion && sub?.version === 1
      && sub.member_limit === 1 && sub.status === "active" && Date.parse(sub.paid_through_at) === Date.parse(paidThrough),"EXACT_ATTACHMENT_FIXTURE_REQUIRED");
    confirmed = true;
    need((await status("active",initialVersion)).status === 200,"RESUME_ATTACHMENT_WORKSPACE");
    for (const f of files) {
      const existing = await docs(f);
      need(existing.status === 200 && existing.data?.length === 0,"ATTACHMENT_DOCUMENT_MUST_BE_ABSENT");
      const invalidOwner = await call("/functions/v1/validate-business-attachment","POST",outsider,input,{
        "content-type":"application/pdf","x-mushavo-attachment":f.lane,
      });
      need(invalidOwner.status === 403,"OUTSIDE_ATTACHMENT_ACCOUNT_DENIED");
      const direct = await call("/storage/v1/object/" + BUCKET + "/" + f.path,"POST",owner,canonical,{
        "content-type":"application/pdf","x-upsert":"false",
      });
      need([401,403].includes(direct.status) || direct.status === 400 && [401,403].includes(Number(direct.data?.statusCode)),"DIRECT_ATTACHMENT_WRITE_DENIED");
    }
    await browserFlow(owner,files,input,evidence);
    for (const f of files) {
      const list = await docs(f), row = list.data?.[0];
      need(list.status === 200 && list.data?.length === 1 && row.id === f.document && row.workspace_id === WORKSPACE
        && row.parent_type === f.type && row.parent_id === f.parent && row.status === "active" && row.uploaded_by === OWNER
        && row.storage_path === f.path && row.mime_type === "application/pdf" && row.size_bytes === f.size,"ATTACHMENT_REGISTRATION_READBACK");
      need((await call("/functions/v1/get-private-file","POST",outsider,{bucket:BUCKET,path:f.path})).status === 404,"OUTSIDE_ATTACHMENT_FILE_DENIED");
    }
  } catch (error) { exerciseError = error; }
  finally {
    if (confirmed) try {
      const w = await workspace(); need(bound(w),"ATTACHMENT_CLEANUP_WORKSPACE_BINDING");
      if (w.status === "active" && w.business_support_version === activeVersion) {
        for (const f of files) try {
          const list = await docs(f); need(list.status === 200 && [0,1].includes(list.data?.length),"ATTACHMENT_CLEANUP_READ");
          if (list.data.length) {
            const row = list.data[0];
            need(row.id === f.document && row.parent_id === f.parent && row.uploaded_by === OWNER && row.storage_path === f.path,"ATTACHMENT_ARCHIVE_BINDING");
            const out = await rpc("archive_business_document",owner,{p_workspace_id:WORKSPACE,p_document_id:f.document,p_reason:"Archive isolated browser test proof"});
            need(out.status === 200 && out.data === f.path,"ATTACHMENT_ARCHIVE_ACK");
          }
          const removed = await call("/storage/v1/object/" + BUCKET,"DELETE",owner,{prefixes:[f.path]});
          need(removed.status === 200 && Array.isArray(removed.data) && removed.data.every(x => x.name === f.path),"ATTACHMENT_OBJECT_DELETE_ACK");
          evidence.cleanup[f.lane] = true;
        } catch (error) { cleanupError ??= error; }
        need((await status("suspended",activeVersion)).status === 200,"ATTACHMENT_SUSPEND_ACK");
        const closed = await workspace();
        need(bound(closed) && closed.status === "suspended" && closed.business_support_version === closedVersion,"ATTACHMENT_CLOSED_READBACK");
        evidence.cleanup.suspended = true;
      } else need(w.status === "suspended" && w.business_support_version === initialVersion,"ATTACHMENT_CLEANUP_STATE_REQUIRED");
    } catch (error) { cleanupError ??= error; }
  }
  if (cleanupError) throw cleanupError;
  if (exerciseError) throw exerciseError;
}

async function main() {
  const plan = JSON.parse(await readFile(new URL("./staging-business-attachment-browser-run.json",import.meta.url),"utf8"));
  if (plan.enabled === false) return {result:"BUSINESS_ATTACHMENT_BROWSER_PLAN_ARCHIVED",exit_code:0};
  need(plan.enabled === true && plan.status === "HOSTED_BUSINESS_ATTACHMENT_BROWSER_ONCE" && plan.project === "dczlddwbtgvfdujgcitb"
    && plan.preview === PREVIEW && plan.workspace === WORKSPACE && Date.parse(plan.paid_through) > Date.now(),"ATTACHMENT_BROWSER_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization" && process.env.GITHUB_RUN_ATTEMPT === "1","ATTACHMENT_BRANCH_REQUIRED");
  const r = await fetch(WEB_ORIGIN + "/config.js?v=27",{redirect:"error",signal:AbortSignal.timeout(15000)});
  need(r.ok,"STAGING_CONFIGURATION_REQUIRED");
  const {key} = readPublicConfiguration(await r.text()), options = {accountScope:"standard"};
  return await checkStagingAccess(privateAccounts(process.env,options),apiTransport(key,AGENT),
    input => exercise(input,key,plan.paid_through),options);
}

const report = await main().catch(error => ({
  result:"STAGING_BUSINESS_ATTACHMENT_BROWSER_REVIEW_REQUIRED",
  problem_code:error instanceof Stop ? error.code : "UNEXPECTED_ATTACHMENT_BROWSER_ERROR",exit_code:1,
}));
console.log(JSON.stringify({...report,progress_display:PROGRESS,commit:process.env.GITHUB_SHA},null,2));
process.exitCode = report.exit_code;
