import {readFile} from "node:fs/promises";
import {randomUUID} from "node:crypto";
import {API_ORIGIN,WEB_ORIGIN,Stop,apiTransport,checkStagingAccess,need,privateAccounts,readPublicConfiguration} from "./staging-access.mjs";
import {encodeLogoRgbaPng} from "../../supabase/functions/validate-business-logo/png.mjs";
import {xlsxFixture} from "../fixtures/business-table-tools/fixtures.mjs";
import {CSV_MIME,XLSX_MIME} from "../../supabase/functions/validate-business-table/table-files.mjs";

const OWNER="ca7bdcf2-e69d-42e2-8ae8-79cac6de2184", PERSONAL="017513c6-ce57-48af-b902-9552faeb83dd";
const FAMILY="50e06a1d-734a-45d7-9d17-3bf46c8e9d71", FAMILY_MEMBER="613ddc14-0cf8-447c-a0b0-8799b1d31efc";
const BUSINESS="8d9307e6-aada-4c9a-a8f5-43c57e0865e2", NAME="audit-fr3-logo-ingestion-20261112";
const AGENT="Mushavo-Staging-FR32-Ordinary-Uploads";
const intents=["46357612-6d3f-494a-a788-b167ffe253d1","40065127-0825-443a-9a28-29e10dd221b0",
  "0072a5ad-4bb0-4315-bb02-0f2dc60a7920","7d899789-a33d-4da9-9dec-d00efc321e31",
  "2e54d921-7265-4db2-8b31-f95bfd7ce980","f3320000-9e41-45bc-bfe3-bf7c9f6e7260","f3be671d-a873-4986-bf9a-073be3ede41b"];
const image=encodeLogoRgbaPng(2,1,Uint8Array.from([10,120,20,255,5,80,15,255]));
const csv=new Uint8Array(Buffer.from("label,amount\nsynthetic,2\n"));
const unwrap=x=>Array.isArray(x)?x[0]:x;
const validId=x=>/^[a-f0-9-]{36}$/.test(x || "");

async function exercise({actors,evidence},key,plan) {
  const {USER_A:owner,USER_B:other,ADMIN:admin}=actors;
  need(owner.id===OWNER&&other.id!==OWNER&&admin.id!==OWNER,"EXACT_ORDINARY_STAGING_ACTORS");
  evidence.results={};
  evidence.requests=0;
  async function call(actor,route,body,add={},method=body===undefined?"GET":"POST") {
    need(++evidence.requests<=70,"ORDINARY_UPLOAD_REQUEST_BOUND");
    const r=await fetch(API_ORIGIN+route,{method,redirect:"error",cache:"no-store",signal:AbortSignal.timeout(20000),
      headers:{apikey:key,authorization:"Bearer "+actor.token,origin:WEB_ORIGIN,"user-agent":AGENT,
        "content-type":"application/json",...add},...(body===undefined?{}:{body:body instanceof Uint8Array?body:JSON.stringify(body)})});
    let data;
    if (route.endsWith("/get-private-file")&&r.status===200) data=Buffer.from(await r.arrayBuffer());
    else try {data=await r.json();}catch{}
    return {status:r.status,data};
  }
  const rpc=(actor,name,body)=>call(actor,"/rest/v1/rpc/"+name,body);
  const context=async (bucket,path)=>call(owner,"/functions/v1/get-private-file",{bucket,path});
  const upload=(actor,f,bytes=f.bytes)=>call(actor,
    "/functions/v1/"+(f.bucket==="subscription-proofs"?"validate-managed-subscription-proof":"validate-ordinary-private-upload"),
    bytes,{"content-type":f.type,"x-mushavo-attachment":f.bucket==="subscription-proofs"?f.workspace+":"+f.intent
      :[f.bucket,f.workspace,f.intent,...(f.parentType?[f.parentType,f.parent]:[])].join(":")});
  const setStatus=(status,version)=>rpc(admin,"admin_business_set_status",{p_workspace_id:BUSINESS,p_status:status,
    p_expected_version:version,p_confirmation_name:NAME,p_reason:"Isolated Stage 4 ordinary upload acceptance",p_request_id:randomUUID()});
  const businessRow=async()=>unwrap((await call(admin,"/rest/v1/budget_workspaces?select=id,name,owner_id,status,business_support_version&id=eq."+BUSINESS)).data);
  const profile=async()=>unwrap((await call(owner,"/rest/v1/business_profiles?select=workspace_id,logo_storage_path,version&workspace_id=eq."+BUSINESS)).data);
  const saveLogo=(path,version)=>rpc(owner,"save_business_branding",{p_workspace_id:BUSINESS,p_trading_name:NAME,p_logo_path:path,p_expected_version:version});
  async function normalPayment(f,receipt) {
    const r=await rpc(owner,"create_completed_one_time_payment",{
      p_workspace_id:f.workspace,p_name:"FR.3.2 synthetic upload witness "+f.label,p_category:"Other",p_amount:0.01,p_currency:"USD",
      p_payment_date:new Date().toISOString().slice(0,10),p_payment_method:"Cash",p_paid_by_member_id:f.workspace===FAMILY?FAMILY_MEMBER:null,
      p_reference_number:"FR32-"+f.intent,p_notes:null,
      p_proof_path:receipt.path,p_proof_name:"synthetic.png",p_proof_mime_type:receipt.type,p_proof_size_bytes:receipt.size,
    });
    const ids=unwrap(r.data);
    if(r.status!==200 || !validId(ids?.payment_item_id) || !validId(ids?.payment_record_id)) {
      if(/^[A-Z_]+$/.test(r.data?.message || "")) evidence.results[f.label].safe_link_error=r.data.message;
      return false;
    }
    const b=await context(f.bucket,receipt.path);
    const linkPassed=b.status===200 && b.data.length===receipt.size;
    const removed=await call(owner,"/rest/v1/payment_items?id=eq."+ids.payment_item_id,undefined,{},"DELETE");
    evidence.results[f.label].synthetic_payment_deleted=removed.status===204;
    return linkPassed && removed.status===204;
  }

  const cases=[
    {label:"personal",bucket:"payment-proofs",workspace:PERSONAL,intent:intents[0],type:"image/png",bytes:image},
    {label:"family",bucket:"payment-proofs",workspace:FAMILY,intent:intents[1],type:"image/png",bytes:image},
    {label:"subscription_image",bucket:"subscription-proofs",workspace:PERSONAL,intent:intents[2],type:"image/png",bytes:image},
    {label:"business_csv",bucket:"business-documents",workspace:BUSINESS,intent:intents[3],type:CSV_MIME,bytes:csv,parentType:"workspace",parent:BUSINESS},
    {label:"business_xlsx",bucket:"business-documents",workspace:BUSINESS,intent:intents[4],type:XLSX_MIME,bytes:xlsxFixture(),parentType:"workspace",parent:BUSINESS},
    {label:"business_logo",bucket:"business-logos",workspace:BUSINESS,intent:intents[5],type:"image/png",bytes:image},
    {label:"business_unlinked",bucket:"business-documents",workspace:BUSINESS,intent:intents[6],type:"image/png",bytes:image,parentType:"workspace",parent:BUSINESS},
  ];
  let attempted=false, all=true, logo=null;
  try{
    for(const f of cases){
      if(f.workspace===BUSINESS&&!attempted){
        const row=await businessRow();
        need(row?.id===BUSINESS&&row?.name===NAME&&row?.owner_id===OWNER&&row?.status==="suspended"
          &&row?.business_support_version===plan.business_version,"EXACT_ORDINARY_BUSINESS_FIXTURE");
        attempted=true;
        need((await setStatus("active",plan.business_version)).status===200,"ORDINARY_BUSINESS_RESUME_REQUIRED");
      }
      const report={};
      evidence.results[f.label]=report;
      try{
        if(f.label==="personal"||f.label==="business_logo"){
          const denied=await upload(other,f);
          report.foreign_denied=denied.status===403;
          need(report.foreign_denied,"ORDINARY_FOREIGN_UPLOAD_DENIED");
        }
        const received=await upload(owner,f);
        report.status=received.status;
        if(/^[A-Z_]+$/.test(received.data?.error || "")) report.safe_error=received.data.error;
        need(received.status===200&&typeof received.data?.path==="string"
          &&received.data.type===f.type&&Number.isSafeInteger(received.data.size),"ORDINARY_FILE_VALIDATED");
        if(f.bucket==="payment-proofs"){
          report.linked_and_retrieved=await normalPayment(f,received.data);
          need(report.linked_and_retrieved,"ORDINARY_PAYMENT_RECORD_LINK_AND_CLEANUP");
        }else if(f.label==="business_csv"||f.label==="business_xlsx"){
          const r=await rpc(owner,"register_business_document",{p_document_id:f.intent,p_workspace_id:BUSINESS,p_parent_type:"workspace",
            p_parent_id:BUSINESS,p_storage_path:received.data.path,p_original_name:"FR32-migration-synthetic-"+f.label,
            p_mime_type:received.data.type,p_size_bytes:received.data.size});
          report.registered=r.status===200&&unwrap(r.data)?.id===f.intent;
          if(/^[A-Z_]+$/.test(r.data?.message || "")) report.safe_link_error=r.data.message;
          need(report.registered,"ORDINARY_DOCUMENT_REGISTERED");
        }else if(f.label==="business_logo"){
          const current=await profile();
          need(current?.workspace_id===BUSINESS&&current.logo_storage_path===null,"EXACT_EMPTY_ORDINARY_LOGO_PROFILE");
          const r=await saveLogo(received.data.path,current.version);
          report.linked=r.status===200&&unwrap(r.data)?.logo_storage_path===received.data.path;
          need(report.linked,"ORDINARY_LOGO_REFERENCE_SAVED");
          logo=received.data.path;
        }
        if(f.bucket!=="payment-proofs"){
          const b=await context(f.bucket,received.data.path);
          report.broker_readback=f.label==="business_unlinked" ? b.status===404 : b.status===200&&b.data.length===received.data.size;
          need(report.broker_readback,"ORDINARY_BROKER_READBACK");
        }
        report.passed=true;
      }catch(error){report.problem_code=error instanceof Stop?error.code:"ORDINARY_CASE_EXCEPTION"; all=false;}
    }
  }finally{
    if(attempted){
      if(logo){
        const state=await profile();
        need(state?.workspace_id===BUSINESS&&state.logo_storage_path===logo,"EXACT_ORDINARY_LOGO_RESTORE_SCOPE");
        need((await saveLogo(null,state.version)).status===200,"ORDINARY_LOGO_RESTORE_REQUIRED");
        need((await profile())?.logo_storage_path===null,"ORDINARY_LOGO_RESTORE_READBACK_REQUIRED");
      }
      const state=await businessRow();
      if(state?.status==="active"&&state.business_support_version===plan.business_version+1){
        need((await setStatus("suspended",state.business_support_version)).status===200,"ORDINARY_BUSINESS_RESUSPEND_REQUIRED");
      }
      evidence.business_restored=(await businessRow())?.status==="suspended";
      need(evidence.business_restored,"ORDINARY_BUSINESS_RESTORE_READBACK_REQUIRED");
    }
  }
  need(all,"ORDINARY_UPLOAD_SURFACES_STILL_OPEN");
}

async function run(){
  const plan=JSON.parse(await readFile(new URL("./staging-ordinary-private-uploads-run.json",import.meta.url),"utf8"));
  if(!plan.enabled)return {result:"ORDINARY_UPLOAD_ACCEPTANCE_ARCHIVED",exit_code:0};
  need(plan.project==="dczlddwbtgvfdujgcitb"&&Number.isInteger(plan.business_version)
    &&process.env.GITHUB_REPOSITORY==="dwtdhruvp246/mushavobudget"&&process.env.GITHUB_REF==="refs/heads/security/stage-3-authorization"
    &&process.env.GITHUB_RUN_ATTEMPT==="1","EXACT_ORDINARY_STAGING_PLAN");
  const r=await fetch(WEB_ORIGIN+"/config.js?v=27",{signal:AbortSignal.timeout(15000),redirect:"error"});
  need(r.ok,"EXACT_ORDINARY_STAGING_CONFIGURATION");
  const {key}=readPublicConfiguration(await r.text());
  const options={accountScope:"standard"};
  const report=await checkStagingAccess(privateAccounts(process.env,options),apiTransport(key,AGENT),
    x=>exercise(x,key,plan),options);
  return {...report,progress_display:"Stage 4/10 | FR.3/8 | FR.3.2 ordinary managed uploads",commit:process.env.GITHUB_SHA};
}
const report=await run().catch(error=>({result:"ORDINARY_UPLOAD_REVIEW_REQUIRED",problem_code:error instanceof Stop?error.code:"ORDINARY_UPLOAD_ERROR",exit_code:1}));
console.log(JSON.stringify(report,null,2));
process.exitCode=report.exit_code;
