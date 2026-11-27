import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout as pause } from "node:timers/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { BUCKET, OWNER, WORKSPACE, DOCUMENTS, prefix } from "../../supabase/functions/validate-business-lifecycle/scope.mjs";
import { normalizeStaticPdf } from "../../supabase/functions/validate-payment-proof/pdf.mjs";
import { pdf, receiptPdf } from "../fixtures/pdf-proof-tools/fixtures.mjs";

const AGENT = "Mushavo-Staging-FR3-Scheduled-File-Lifecycle";
const NAME = "audit-fr3-logo-ingestion-20261112";
const PROGRESS = "Stage 4/10 | FR.3/8 | FR.3.2 Business upload lifecycle";
const PDF = "application/pdf";

const one = result => result.status === 200 && result.data?.length === 1 ? result.data[0] : null;
const deny = result => [401,403].includes(result.status)
  || result.status === 400 && [401,403].includes(Number(result.data?.statusCode));

async function exercise({ actors,evidence },key,term) {
  const {USER_A: owner, USER_B: outsider, ADMIN: admin} = actors;
  need(owner.id === OWNER && outsider.id !== OWNER && admin.id !== OWNER,"EXACT_LIFECYCLE_TEST_ACTORS");
  const input = Buffer.from(await receiptPdf()), canonical = Buffer.from(await normalizeStaticPdf(input,pdf));
  const hash = digest(canonical), object = hash.slice(0,32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/,"$1-$2-$3-$4-$5");
  const pathFor = lane => prefix(DOCUMENTS[lane]) + object + ".pdf";
  const urlFor = lane => "/storage/v1/object/" + BUCKET + "/" + pathFor(lane);
  const test = (name,value) => { evidence.checks[name] = Boolean(value); need(value,name); };
  Object.assign(evidence,{checks:{},requests:0,cleanup:{}});
  async function call(path,method,actor,body,headers = {}) {
    need(++evidence.requests <= 60, "LIFECYCLE_REQUEST_BOUND");
    const response = await fetch(API_ORIGIN + path,{
      method,cache:"no-store",redirect:"error",signal:AbortSignal.timeout(18000),
      headers:{apikey:key,authorization:"Bearer " + actor.token,origin:WEB_ORIGIN,
        "content-type":"application/json","user-agent":AGENT,...headers},
      ...(body === undefined ? {} : {body:Buffer.isBuffer(body) ? body : JSON.stringify(body)}),
    });
    let data;
    if (response.status === 200 && path === "/functions/v1/get-private-file") data = Buffer.from(await response.arrayBuffer());
    else try { data = await response.json(); } catch {}
    return {status:response.status,data,mime:response.headers.get("x-mushavo-media-type"),
      cache:response.headers.get("cache-control") || ""};
  }
  const rpc = (name,actor,body) => call("/rest/v1/rpc/" + name,"POST",actor,body);
  const workspace = async () => one(await call("/rest/v1/budget_workspaces?id=eq." + WORKSPACE + "&limit=2","GET",admin));
  const docs = lane => call("/rest/v1/business_documents?workspace_id=eq." + WORKSPACE + "&id=eq." + DOCUMENTS[lane] + "&limit=2","GET",owner);
  const status = (value,version) => rpc("admin_business_set_status",admin,{
    p_workspace_id:WORKSPACE,p_status:value,p_expected_version:version,p_confirmation_name:NAME,
    p_reason:"Stage 4 isolated Business upload lifecycle validation",p_request_id:randomUUID(),
  });
  const upload = (lane,actor = owner) => call("/functions/v1/validate-business-lifecycle","POST",actor,input,{
    "content-type":PDF,"x-mushavo-attachment":lane,
  });
  const scheduledState = (actor = owner) => call("/functions/v1/validate-business-lifecycle","POST",actor,{},{
    "x-mushavo-attachment":"status",
  });
  const unsignedCleanup = () => call("/functions/v1/validate-business-lifecycle","POST",owner,{},{
    "x-mushavo-attachment":"scheduled-reconcile",
  });
  const register = lane => rpc("register_business_document",owner,{
    p_document_id:DOCUMENTS[lane],p_workspace_id:WORKSPACE,p_parent_type:"workspace",p_parent_id:WORKSPACE,
    p_storage_path:pathFor(lane),p_original_name:"synthetic-lifecycle-receipt.pdf",p_mime_type:PDF,p_size_bytes:canonical.length,
  });
  const broker = (lane,actor = owner) => call("/functions/v1/get-private-file","POST",actor,{bucket:BUCKET,path:pathFor(lane)});
  const exactUpload = (result,lane) => result.status === 200 && result.data?.path === pathFor(lane)
    && result.data.type === PDF && result.data.size === canonical.length;
  const exactWorkspace = w => w?.id === WORKSPACE && w.owner_id === OWNER && w.name === NAME && w.workspace_type === "business";
  let confirmed = false, failure, cleanupFailure;
  try {
    const w = await workspace(), s = one(await call("/rest/v1/workspace_subscriptions?workspace_id=eq." + WORKSPACE + "&limit=2","GET",admin));
    test("EXACT_SUSPENDED_LIFECYCLE_FIXTURE",exactWorkspace(w) && w.status === "suspended" && w.business_support_version === 50
      && s?.workspace_id === WORKSPACE && s.status === "active" && s.version === 1 && s.member_limit === 1
      && Date.parse(s.paid_through_at) === Date.parse(term) && Date.parse(term) > Date.now());
    confirmed = true;
    test("EXACT_LIFECYCLE_FIXTURE_RESUMED",(await status("active",50)).status === 200);
    test("LIFECYCLE_ACTOR_BOUND", (await upload("orphan",outsider)).status === 403 && (await scheduledState(outsider)).status === 403);
    test("UNSIGNED_SCHEDULED_INVOCATION_DENIED",(await unsignedCleanup()).status === 403);
    const direct = await call(urlFor("orphan"),"POST",owner,canonical,{"content-type":PDF,"x-upsert":"false"});
    test("DIRECT_RESERVED_PATH_UPLOAD_DENIED",deny(direct));

    const orphan = await upload("orphan");
    evidence.first_upload_status = orphan.status;
    if (orphan.status !== 200 && /^[A-Z_]{4,100}$/.test(orphan.data?.error || "")) evidence.first_upload_error = orphan.data.error;
    test("VALIDATED_BUT_UNREGISTERED_UPLOAD",exactUpload(orphan,"orphan"));
    const invalid = await upload("committed");
    test("SECOND_UPLOAD_AT_CAPACITY_DENIED",invalid.status === 429 && invalid.data?.error === "PROOF_UPLOAD_CAPACITY_REACHED");
    test("UNREGISTERED_FILE_STAYS_PRIVATE",(await broker("orphan")).status === 404);
    const early = await scheduledState();
    test("UNEXPIRED_UPLOAD_PRESERVED",early.status === 200 && early.data?.removed === false);

    let removed = false;
    for (let attempt=0; attempt<31 && !removed; attempt++) {
      await pause(9000);
      const state = await scheduledState();
      need(state.status === 200 && typeof state.data?.removed === "boolean","AUTHORIZED_SCHEDULED_STATUS_REQUIRED");
      removed = state.data.removed;
      evidence.status_polls = attempt+1;
    }
    test("SCHEDULED_WORKER_REMOVED_EXPIRED_OBJECT",removed);
    const expired = await register("orphan");
    test("REMOVED_OBJECT_CANNOT_REGISTER",expired.status >= 400 && expired.data?.message === "BUSINESS_DOCUMENT_UPLOAD_NOT_FOUND");

  } catch (error) { failure = error; }
  finally {
    if (confirmed) try {
      const w = await workspace();
      need(exactWorkspace(w),"EXACT_LIFECYCLE_CLEANUP_WORKSPACE");
      if (w.status === "active" && w.business_support_version === 51) {
        for (const lane of Object.keys(DOCUMENTS)) try {
          const rows = await docs(lane);
          need(rows.status === 200 && [0,1].includes(rows.data?.length),"EXACT_LIFECYCLE_CLEANUP_READ");
          if (rows.data.length) {
            const d = rows.data[0];
            need(d.id === DOCUMENTS[lane] && d.workspace_id === WORKSPACE && d.uploaded_by === OWNER
              && d.storage_path === pathFor(lane) && d.status === "active","EXACT_LIFECYCLE_ARCHIVE_BINDING");
            const a = await rpc("archive_business_document",owner,{p_workspace_id:WORKSPACE,
              p_document_id:d.id,p_reason:"Archive isolated Stage 4 lifecycle fixture"});
            need(a.status === 200 && a.data === d.storage_path,"EXACT_LIFECYCLE_ARCHIVE_ACK");
          }
          const removal = await call("/storage/v1/object/" + BUCKET,"DELETE",owner,{prefixes:[pathFor(lane)]});
          need(removal.status === 200 && Array.isArray(removal.data)
            && removal.data.every(row => row.name === pathFor(lane)),"EXACT_LIFECYCLE_OBJECT_CLOSE_ACK");
          evidence.cleanup[lane] = true;
        } catch (error) { cleanupFailure ??= error; }
        need((await status("suspended",51)).status === 200,"EXACT_LIFECYCLE_SUSPEND_ACK");
        const closed = await workspace();
        need(exactWorkspace(closed) && closed.status === "suspended" && closed.business_support_version === 52,
          "EXACT_CLOSED_LIFECYCLE_WORKSPACE");
        evidence.cleanup.suspended = true;
      } else need(w.status === "suspended" && w.business_support_version === 50,"EXACT_LIFECYCLE_CLEANUP_STATE");
    } catch (error) { cleanupFailure ??= error; }
    if (failure instanceof Stop) evidence.first_failed_check = failure.code;
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}

async function main() {
  const plan = JSON.parse(await readFile(new URL("./staging-business-lifecycle-run.json",import.meta.url),"utf8"));
  if (plan.enabled === false) return {result:"BUSINESS_LIFECYCLE_PLAN_ARCHIVED",exit_code:0};
  need(plan.enabled === true && plan.project === "dczlddwbtgvfdujgcitb" && plan.workspace === WORKSPACE
    && plan.status === "HOSTED_BUSINESS_SCHEDULED_LIFECYCLE_ONCE" && Date.parse(plan.paid_through) > Date.now()
    && JSON.stringify(plan.documents) === JSON.stringify(Object.values(DOCUMENTS)),"EXACT_LIFECYCLE_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization" && process.env.GITHUB_RUN_ATTEMPT === "1","EXACT_LIFECYCLE_BRANCH_REQUIRED");
  const r = await fetch(WEB_ORIGIN + "/config.js?v=27",{redirect:"error",signal:AbortSignal.timeout(15000)});
  need(r.ok,"STAGING_CONFIGURATION_REQUIRED");
  const {key} = readPublicConfiguration(await r.text()), options = {accountScope:"standard"};
  return checkStagingAccess(privateAccounts(process.env,options),apiTransport(key,AGENT),
    input => exercise(input,key,plan.paid_through),options);
}
const report = await main().catch(error => ({
  result:"STAGING_BUSINESS_LIFECYCLE_REVIEW_REQUIRED",problem_code:error instanceof Stop ? error.code : "UNEXPECTED_LIFECYCLE_RUN_ERROR",exit_code:1,
}));
console.log(JSON.stringify({...report,progress_display:PROGRESS,commit:process.env.GITHUB_SHA},null,2));
process.exitCode = report.exit_code;
