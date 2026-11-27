import {readFile} from "node:fs/promises";
import {API_ORIGIN,WEB_ORIGIN,Stop,apiTransport,checkStagingAccess,digest,need,privateAccounts,readPublicConfiguration} from "./staging-access.mjs";

const OWNER = "ca7bdcf2-e69d-42e2-8ae8-79cac6de2184";
const AGENT = "Mushavo-Staging-FR32-Shared-Download-Budget";
const FILES = [
  {
    "path": "workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr32-billing-business-purchase/e3ed1247-a347-1064-e02f-f45f417fec60.pdf",
    "size": 791
  },
  {
    "path": "workspaces/017513c6-ce57-48af-b902-9552faeb83dd/ca7bdcf2-e69d-42e2-8ae8-79cac6de2184/fr32-billing-personal/e3ed1247-a347-1064-e02f-f45f417fec60.pdf",
    "size": 791
  }
];
const SHA = "e3ed1247a3471064e02ff45f417fec60";
async function exercise({actors,evidence},key) {
  need(actors.USER_A.id === OWNER && actors.USER_B.id !== OWNER,"EXACT_DOWNLOAD_FIXTURE_ACCOUNTS_REQUIRED");
  async function get(actor,file) {
    return fetch(API_ORIGIN + "/functions/v1/get-private-file",{
      method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(15000),
      headers:{apikey:key,authorization:"Bearer " + actor.token,origin:WEB_ORIGIN,
        "user-agent":AGENT,"content-type":"application/json"},
      body:JSON.stringify({bucket:"subscription-proofs",path:file.path}),
    });
  }
  evidence.owner_downloads = 0;
  evidence.foreign_denials = 0;
  for (const file of FILES) {
    const denied = await get(actors.USER_B,file);
    await denied.body?.cancel();
    need(denied.status === 404,"CROSS_ACCOUNT_DOWNLOAD_MUST_STAY_DENIED");
    evidence.foreign_denials++;
    const allowed = await get(actors.USER_A,file);
    const bytes = Buffer.from(await allowed.arrayBuffer());
    need(allowed.status === 200 && allowed.headers.get("x-mushavo-media-type") === "application/pdf"
      && bytes.length === file.size && digest(bytes).startsWith(SHA),"NORMAL_RETAINED_PROOF_DOWNLOAD_REQUIRED");
    evidence.owner_downloads++;
  }
}
async function main() {
  const plan=JSON.parse(await readFile(new URL("./staging-private-download-budget-run.json",import.meta.url),"utf8"));
  if (plan.enabled === false) return {result:"STAGING_DOWNLOAD_BUDGET_PLAN_ARCHIVED",exit_code:0};
  need(plan.enabled === true && plan.project === "dczlddwbtgvfdujgcitb"
    && process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization"
    && process.env.GITHUB_RUN_ATTEMPT === "1","EXACT_STAGING_TEST_PLAN_REQUIRED");
  const response=await fetch(WEB_ORIGIN+"/config.js?v=27",{signal:AbortSignal.timeout(15000),redirect:"error"});
  need(response.ok,"EXACT_STAGING_CONFIGURATION_REQUIRED");
  const {key}=readPublicConfiguration(await response.text());
  const options={accountScope:"ordinary"};
  return checkStagingAccess(privateAccounts(process.env,options),apiTransport(key,AGENT),input=>exercise(input,key),options);
}
const report = await main().catch(error=>({result:"STAGING_DOWNLOAD_BUDGET_REVIEW_REQUIRED",problem_code:error instanceof Stop ? error.code : "PRIVATE_DOWNLOAD_TEST_ERROR",exit_code:1}));
console.log(JSON.stringify(report,null,2));
process.exitCode=report.exit_code;
