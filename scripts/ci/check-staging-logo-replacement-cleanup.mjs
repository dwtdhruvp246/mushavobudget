import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need,
  privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { encodeLogoRgbaPng, normalizeLogoPng } from "../../supabase/functions/validate-business-logo/png.mjs";

const AGENT = "Mushavo-Staging-FR32-Logo-Replacement";
const WORKSPACE = "8d9307e6-aada-4c9a-a8f5-43c57e0865e2";
const OWNER = "ca7bdcf2-e69d-42e2-8ae8-79cac6de2184";
const NAME = "audit-fr3-logo-ingestion-20261112";
const BUCKET = "business-logos";
const REASON = "Synthetic FR.3.2 logo replacement cleanup";
const one = response => response.status === 200 && response.data?.length === 1 ? response.data[0] : null;

async function sample(red, green, blue) {
  const bytes = encodeLogoRgbaPng(2, 2, new Uint8Array(Array.from({length: 4}, () => [red,green,blue,255]).flat()));
  const canonical = await normalizeLogoPng(bytes);
  const sha = digest(canonical);
  const name = sha.slice(0,32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  return {bytes, sha, path: WORKSPACE + "/" + OWNER + "/" + name + ".png"};
}

async function exercise({actors,evidence}, key, plan) {
  const {USER_A:owner,USER_B:other,ADMIN:admin} = actors;
  need(owner.id === OWNER && other.id !== OWNER && admin.id !== OWNER, "EXACT_LOGO_ACCOUNTS_REQUIRED");
  const [old, current] = await Promise.all([sample(184,60,196),sample(32,90,206)]);
  const startVersion = plan.support_version;
  evidence.checks = {};
  evidence.requests = 0;
  const check = (name, value) => {
    evidence.checks[name] = value === true;
    need(value === true, name);
  };

  async function call(actor, route, body, extra = {}) {
    need(++evidence.requests <= 75, "EXACT_LOGO_REQUEST_BOUND");
    const response = await fetch(API_ORIGIN + route,{
      method:body === undefined ? "GET" : "POST", redirect:"error", cache:"no-store", signal:AbortSignal.timeout(12000),
      headers:{apikey:key,authorization:"Bearer " + actor.token,origin:WEB_ORIGIN,"user-agent":AGENT,
        "content-type":"application/json",...extra},
      ...(body === undefined ? {} : {body:body instanceof Uint8Array ? body : JSON.stringify(body)}),
    });
    let data;
    if (route === "/functions/v1/get-private-file" && response.ok) data = Buffer.from(await response.arrayBuffer());
    else try { data = await response.json(); } catch {}
    return {status:response.status,data,media:response.headers.get("x-mushavo-media-type")};
  }
  const rpc = (actor, method, params) => call(actor,"/rest/v1/rpc/" + method,params);
  const workspace = async () => one(await call(admin,"/rest/v1/budget_workspaces?select=id,name,owner_id,status,business_support_version&id=eq." + WORKSPACE + "&limit=2"));
  const exact = row => row?.id === WORKSPACE && row.owner_id === OWNER && row.name === NAME;
  const profile = async () => one(await call(owner,"/rest/v1/business_profiles?select=trading_name,logo_storage_path,version&workspace_id=eq." + WORKSPACE + "&limit=2"));
  const businessStatus = (status, version) => rpc(admin,"admin_business_set_status",{
    p_workspace_id:WORKSPACE,p_status:status,p_expected_version:version,p_confirmation_name:NAME,p_reason:REASON,p_request_id:randomUUID(),
  });
  const save = (version, path) => rpc(owner,"save_business_branding",{
    p_workspace_id:WORKSPACE,p_expected_version:version,p_trading_name:NAME,p_logo_path:path,
  });
  const validate = file => call(owner,"/functions/v1/validate-business-logo",file.bytes,{"content-type":"image/png"});
  const context = file => rpc(owner,"private_file_download_context",{p_bucket_id:BUCKET,p_object_name:file.path});
  const broker = (actor, file) => call(actor,"/functions/v1/get-private-file",{bucket:BUCKET,path:file.path});
  const exactBytes = (response, file) => response.status === 200 && response.media === "image/png" && digest(response.data) === file.sha;
  const waitForRemoval = async file => {
    for (let poll = 0; poll < 14; poll++) {
      const answer = await context(file);
      need(answer.status === 200 && Array.isArray(answer.data) && answer.data.length <= 1, "EXACT_CLEANUP_CONTEXT_REQUIRED");
      if (!answer.data.length) return true;
      await delay(8000);
    }
    return false;
  };

  let resumed = false, failure, cleanupFailure;
  try {
    const start = await workspace();
    check("EXACT_SUSPENDED_LOGO_FIXTURE", exact(start) && start.status === "suspended" && start.business_support_version === startVersion);
    check("FIXTURE_ACTIVATED", (await businessStatus("active",startVersion)).status === 200);
    resumed = true;
    const initial = await profile();
    check("EXACT_EMPTY_BRANDING_FIXTURE", initial?.trading_name === NAME && initial.logo_storage_path === null && initial.version === plan.profile_version);
    const unsigned = await call(other,"/functions/v1/validate-business-lifecycle",{},{"x-mushavo-attachment":"scheduled-reconcile"});
    check("UNSIGNED_CLEANUP_DENIED", unsigned.status === 403);
    const first = await validate(old);
    evidence.first_upload_status = first.status;
    check("VALIDATED_FIRST_LOGO_WRITTEN", first.status === 200 && first.data?.path === old.path);
    check("FIRST_LOGO_SAVED", (await save(initial.version,old.path)).status === 200);
    check("FIRST_LOGO_RETRIEVED", exactBytes(await broker(owner,old),old));
    const replacement = await validate(current);
    check("VALIDATED_REPLACEMENT_WRITTEN", replacement.status === 200 && replacement.data?.path === current.path);
    const before = await profile();
    check("FIRST_LOGO_LINKED_BEFORE_REPLACEMENT", before?.logo_storage_path === old.path);
    check("REPLACEMENT_COMMITTED", (await save(before.version,current.path)).status === 200);
    check("PREVIOUS_LOGO_STILL_EXISTS_AFTER_REPLACEMENT", one(await context(old))?.object_name === old.path);
    check("REPLACEMENT_REMAINS_LINKED", (await profile())?.logo_storage_path === current.path);
    check("SCHEDULER_REMOVED_PREVIOUS_LOGO", await waitForRemoval(old));
    check("SCHEDULER_PRESERVED_CURRENT_LOGO", exactBytes(await broker(owner,current),current));
    check("UNRELATED_ACCOUNT_CANNOT_READ_CURRENT_LOGO", (await broker(other,current)).status === 404);
  } catch (error) { failure = error; }
  finally {
    if (resumed) {
      try {
        const currentProfile = await profile();
        need(currentProfile && [null,old.path,current.path].includes(currentProfile.logo_storage_path), "EXACT_RESTORE_LOGO_PROFILE_REQUIRED");
        const linked = [old,current].find(file => file.path === currentProfile.logo_storage_path);
        if (linked) {
          need((await save(currentProfile.version,null)).status === 200, "LOGO_UNLINK_ACKNOWLEDGEMENT_REQUIRED");
          check("SCHEDULER_REMOVED_FINAL_TEST_LOGO", await waitForRemoval(linked));
        }
        check("BRANDING_FIXTURE_RESTORED", (await profile())?.logo_storage_path === null);
      } catch (error) { cleanupFailure = error; }
      try {
        const active = await workspace();
        need(exact(active) && active.status === "active" && active.business_support_version === startVersion + 1, "EXACT_LOGO_FIXTURE_RESTORE_REQUIRED");
        check("BUSINESS_FIXTURE_RESUSPENDED", (await businessStatus("suspended",startVersion + 1)).status === 200);
        const final = await workspace();
        check("BUSINESS_SUSPENSION_READBACK", exact(final) && final.status === "suspended" && final.business_support_version === startVersion + 2);
      } catch (error) { cleanupFailure ??= error; }
    }
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}

async function main() {
  const plan = JSON.parse(await readFile(new URL("./staging-logo-replacement-cleanup-run.json",import.meta.url),"utf8"));
  if (plan.enabled === false) return {result:"STAGING_LOGO_REPLACEMENT_PLAN_ARCHIVED", exit_code:0};
  need(plan.enabled === true && plan.workspace === WORKSPACE && plan.project === "dczlddwbtgvfdujgcitb"
    && plan.support_version === 58 && plan.profile_version === 26
    && process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization"
    && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_LOGO_RUN_REQUIRED");
  const response = await fetch(WEB_ORIGIN + "/config.js?v=27",{redirect:"error",signal:AbortSignal.timeout(15000)});
  need(response.ok,"STAGING_CONFIGURATION_REQUIRED");
  const {key} = readPublicConfiguration(await response.text());
  const options = {accountScope:"standard"};
  const result = await checkStagingAccess(privateAccounts(process.env,options),apiTransport(key,AGENT),
    input => exercise(input,key,plan),options);
  return {...result,progress_display:"Stage 4/10 | FR.3/8 | FR.3.2 Business logo replacement cleanup",commit:process.env.GITHUB_SHA};
}

const report = await main().catch(error => ({result:"STAGING_LOGO_REPLACEMENT_REVIEW_REQUIRED",
  problem_code:error instanceof Stop ? error.code : "STAGING_LOGO_CLEANUP_ERROR",exit_code:1}));
console.log(JSON.stringify(report,null,2));
process.exitCode = report.exit_code;
