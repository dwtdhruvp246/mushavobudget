import {readFile} from "node:fs/promises";
import {API_ORIGIN,WEB_ORIGIN,Stop,apiTransport,checkStagingAccess,digest,need,privateAccounts,readPublicConfiguration} from "./staging-access.mjs";
import {pdf} from "../fixtures/pdf-proof-tools/fixtures.mjs";
import {normalizeStaticPdf} from "../../supabase/functions/validate-payment-proof/pdf.mjs";
import {ORDINARY_PROOF_MAX_BYTES} from "../../supabase/functions/validate-payment-proof/handler.mjs";

const WORKSPACE = "017513c6-ce57-48af-b902-9552faeb83dd";
const OWNER = "ca7bdcf2-e69d-42e2-8ae8-79cac6de2184";
const fixtures = [
  {id:"0cb6d10e-8934-479c-a872-32f312b0bd19", subjectLength:900*1024},
  {id:"e93bc4a5-0f09-4bda-b26d-f820db26ba17", subjectLength:2559*1024},
];
const agent = "Mushavo-Staging-FR32-Managed-Subscription";

async function generate(fixture) {
  const receipt = await pdf.PDFDocument.create({updateMetadata:false});
  receipt.addPage().drawText("Synthetic payment proof");
  receipt.setSubject("A".repeat(fixture.subjectLength));
  const input = await receipt.save({useObjectStreams:false});
  const canonical = await normalizeStaticPdf(input,pdf,undefined,{maxBytes:ORDINARY_PROOF_MAX_BYTES});
  const sha = digest(canonical);
  const name = sha.slice(0,32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
  const path = ["workspaces",WORKSPACE,OWNER,"managed-proof-v1",fixture.id,name + ".pdf"].join("/");
  return {input,canonical,path,sha};
}

async function verify({actors,evidence},key) {
  const {USER_A:owner,USER_B:other} = actors;
  need(owner.id === OWNER && other.id !== OWNER,"EXACT_TEST_ACCOUNTS_REQUIRED");
  evidence.cases = [];
  async function call(actor,f,bytes) {
    const response = await fetch(API_ORIGIN + "/functions/v1/validate-managed-subscription-proof",{
      method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(40000),
      headers:{apikey:key,authorization:"Bearer " + actor.token,origin:WEB_ORIGIN,"user-agent":agent,
        "content-type":"application/pdf","x-mushavo-attachment":WORKSPACE + ":" + f.id},
      body:bytes,
    });
    let result;
    try { result = await response.json(); } catch {}
    return {status:response.status,result};
  }
  for (const fixture of fixtures) {
    const file=await generate(fixture);
    need(file.input.length>2097152 && file.input.length<=ORDINARY_PROOF_MAX_BYTES,"EXPECTED_LARGE_STATIC_PDF_FIXTURE");
    const item={input_bytes:file.input.length,canonical_bytes:file.canonical.length};
    evidence.cases.push(item);
    if (fixture===fixtures[0]) {
      const notOwner=await call(other,fixture,file.input.subarray(0,100));
      item.other_workspace_denied=notOwner.status===403 && notOwner.result?.error==="CURRENT_SUBSCRIPTION_WORKSPACE_OWNER_REQUIRED";
      need(item.other_workspace_denied,"UNRELATED_ACCOUNT_MUST_NOT_RESERVE_UPLOAD");
    }
    const upload=await call(owner,fixture,file.input);
    item.status=upload.status;
    if (/^[A-Z_]+$/.test(upload.result?.error || "")) item.safe_error=upload.result.error;
    need(upload.status===200 && upload.result?.path===file.path && upload.result?.type==="application/pdf"
      && upload.result?.size===file.canonical.length,"LARGE_CANONICAL_PROOF_MUST_BE_STORED");
    const verified = await fetch(API_ORIGIN + "/functions/v1/get-private-file",{
      method:"POST",redirect:"error",cache:"no-store",signal:AbortSignal.timeout(35000),
      headers:{apikey:key,authorization:"Bearer " + owner.token,origin:WEB_ORIGIN,"user-agent":agent,"content-type":"application/json"},
      body:JSON.stringify({bucket:"subscription-proofs",path:file.path}),
    });
    item.exact_readback=verified.status===200 && digest(Buffer.from(await verified.arrayBuffer()))===file.sha;
    if (verified.status!==200) await verified.body?.cancel();
    need(item.exact_readback,"EXACT_CANONICAL_PROOF_READBACK_REQUIRED");
  }
}

async function main() {
  const plan=JSON.parse(await readFile(new URL("./staging-managed-subscription-upload-run.json",import.meta.url),"utf8"));
  if (!plan.enabled) return {result:"MANAGED_SUBSCRIPTION_UPLOAD_TEST_ARCHIVED",exit_code:0};
  need(plan.project==="dczlddwbtgvfdujgcitb" && process.env.GITHUB_REPOSITORY==="dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF==="refs/heads/security/stage-3-authorization" && process.env.GITHUB_RUN_ATTEMPT==="1",
    "EXACT_STAGING_WORKFLOW_REQUIRED");
  const response=await fetch(WEB_ORIGIN+"/config.js?v=27",{redirect:"error",signal:AbortSignal.timeout(15000)});
  need(response.ok,"STAGING_CONFIG_REQUIRED");
  const {key}=readPublicConfiguration(await response.text());
  const options={accountScope:"ordinary"};
  const result=await checkStagingAccess(privateAccounts(process.env,options),apiTransport(key,agent),
    input=>verify(input,key),options);
  return {...result,progress_display:"Stage 4/10 | FR.3/8 | FR.3.2 managed subscription uploads",commit:process.env.GITHUB_SHA};
}
const report=await main().catch(error=>({result:"MANAGED_SUBSCRIPTION_UPLOAD_REVIEW_REQUIRED",
  problem_code:error instanceof Stop?error.code:"MANAGED_SUBSCRIPTION_UPLOAD_CHECK_ERROR",exit_code:1}));
console.log(JSON.stringify(report,null,2));
process.exitCode=report.exit_code;
