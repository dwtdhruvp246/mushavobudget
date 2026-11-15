import {readFile} from "node:fs/promises";
import {API_ORIGIN,Stop,apiTransport,checkStagingAccess,digest,need,privateAccounts,readPublicConfiguration} from "./staging-access.mjs";
import {encodeLogoRgbaPng} from "../../supabase/functions/validate-business-logo/png.mjs";

const OWNER="ca7bdcf2-e69d-42e2-8ae8-79cac6de2184";
const WORKSPACE="017513c6-ce57-48af-b902-9552faeb83dd";
const AGENT="Mushavo-Staging-FR32-Ordinary-Browser";
const NOTE="FR.3.2 synthetic browser receipt";
const image=Buffer.from(encodeLogoRgbaPng(2,1,Uint8Array.from([5,10,120,255,4,12,125,255])));
const RPCS=new Set(["app_session_status","my_account_suspended","get_my_admin_user_invitation",
  "public_business_checkout_terms","effective_workspace_entitlement","personal_payment_plan_access",
  "workspace_billable_member_count","workspace_member_usage","exchange_rate_status"]);
const safeId=x=>/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(x || "");
const filePath=x=>typeof x==="string"&&x.startsWith("personal/"+OWNER+"/managed-upload-v1/")
  && x.split("/").length===5&&safeId(x.split("/")[3])&&/^[a-f0-9-]{36}[.]png$/.test(x.split("/")[4]);
const get=async (origin,path)=>fetch(origin+path,{redirect:"error",signal:AbortSignal.timeout(15000),
  headers:{"user-agent":"Mozilla/5.0 "+AGENT}});

async function exercise({actors,evidence},key,origin,chromium){
  const {USER_A:owner,USER_B:other}=actors;
  need(owner.id===OWNER&&other.id!==OWNER,"EXACT_ORDINARY_BROWSER_ACTORS");
  evidence.served_source={};
  for(const [path,file] of [["/app.js?v=127","app.js"],["/business.js?v=27","business.js"],["/private-files.js?v=3","private-files.js"]]){
    const result=await get(origin,path);
    evidence.served_source[file]=result.status===200&&digest(Buffer.from(await result.arrayBuffer()))
      ===digest(await readFile(new URL("../../"+file,import.meta.url)));
    need(evidence.served_source[file],"EXACT_BROWSER_RELEASE_ASSETS");
  }
  const stats=evidence.browser={validator:0,submission:0,direct_storage_writes:0,blocked:[],phase:"START"};
  let receipt, itemId;
  const browser=await chromium.launch({headless:true});
  try{
    const ctx=await browser.newContext({serviceWorkers:"block",userAgent:"Mozilla/5.0 "+AGENT,timezoneId:"UTC"});
    ctx.setDefaultTimeout(22000);
    const session={...owner.session,expires_at:owner.session.expires_at??Math.floor(Date.now()/1000)+owner.session.expires_in};
    await ctx.addInitScript(({origin,session})=>{
      const storageKey="sb-dczlddwbtgvfdujgcitb-auth-token";
      if(location.origin===origin&&!localStorage.getItem(storageKey))localStorage.setItem(storageKey,JSON.stringify(session));
    },{origin,session});
    await ctx.route("**/*",async route=>{
      const req=route.request(),url=new URL(req.url()),method=req.method();
      const read=["GET","HEAD"].includes(method);
      let allow=read&&(url.origin===origin||url.origin==="https://cdn.jsdelivr.net"&&url.pathname.startsWith("/npm/"));
      if(url.origin===API_ORIGIN){
        allow=method==="OPTIONS"||read&&!url.pathname.startsWith("/storage/");
        if(url.pathname.startsWith("/storage/")&&method==="POST")stats.direct_storage_writes++;
        if(method==="POST"&&url.pathname==="/functions/v1/validate-ordinary-private-upload"){
          const parts=(req.headers()["x-mushavo-attachment"]||"").split(":");
          allow=++stats.validator===1&&parts.length===3&&parts[0]==="payment-proofs"&&parts[1]===WORKSPACE&&safeId(parts[2])
            && req.headers()["content-type"]==="image/png"&&req.postDataBuffer()?.equals(image);
          if(allow){
            const response=await route.fetch({maxRedirects:0});
            if(response.status()===200)receipt=await response.json();
            stats.validator_http=response.status();
            return route.fulfill({response});
          }
        }else if(method==="POST"&&url.pathname==="/rest/v1/rpc/create_completed_one_time_payment"){
          const p=req.postDataJSON();
          allow=++stats.submission===1&&p.p_workspace_id===WORKSPACE&&p.p_name===NOTE&&p.p_amount===0.02
            &&p.p_currency==="USD"&&p.p_paid_by_member_id===null&&filePath(receipt?.path)
            &&p.p_proof_path===receipt.path&&p.p_proof_name==="synthetic-browser.png"
            &&p.p_proof_mime_type===receipt.type&&receipt.type==="image/png"&&p.p_proof_size_bytes===receipt.size;
          if(allow){
            const response=await route.fetch({maxRedirects:0});
            stats.submission_http=response.status();
            if(response.status()===200){const reply=await response.json();itemId=reply?.[0]?.payment_item_id;}
            return route.fulfill({response});
          }
        }else if(method==="POST"){allow=url.pathname.startsWith("/rest/v1/rpc/")&&RPCS.has(url.pathname.split("/").at(-1));}
      }
      if(allow)return route.continue();
      if(stats.blocked.length<20&&[origin,API_ORIGIN].includes(url.origin))stats.blocked.push([method,url.pathname.replace(/[a-f0-9-]{36}/g,"[id]").slice(0,125)]);
      return route.abort("blockedbyclient");
    });
    const page=await ctx.newPage();
    stats.phase="OPEN_PAYMENT_PAGE";
    await page.goto(origin+"/app#personal/payments",{waitUntil:"domcontentloaded"});
    await page.locator("[data-open-payment-item-dialog]").click();
    await page.locator('[data-payment-entry-choice="completed"]').click();
    const form=page.locator("#completedPaymentForm");
    await form.waitFor({state:"visible"});
    await form.locator("#completedPaymentName").fill(NOTE);
    await form.locator("#completedPaymentAmount").fill("0.02");
    await form.locator("#completedPaymentCurrency").selectOption("USD");
    await form.locator("#completedPaymentProof").setInputFiles({name:"synthetic-browser.png",mimeType:"image/png",buffer:image});
    stats.phase="SUBMIT_FROM_BROWSER_FORM";
    const isPayment=r=>r.url()===API_ORIGIN+"/rest/v1/rpc/create_completed_one_time_payment"&&r.request().method()==="POST";
    const [result]=await Promise.all([page.waitForResponse(isPayment),form.locator("#completedPaymentSubmit").click()]);
    need(result.status()===200&&safeId(itemId)&&stats.validator===1&&stats.submission===1&&stats.direct_storage_writes===0,
      "BROWSER_USED_MANAGED_UPLOAD_AND_REGISTERED_RECEIPT");
    await form.waitFor({state:"hidden"});
    const b=await fetch(API_ORIGIN+"/functions/v1/get-private-file",{method:"POST",redirect:"error",signal:AbortSignal.timeout(15000),
      headers:{apikey:key,authorization:"Bearer "+owner.token,origin,"content-type":"application/json"},
      body:JSON.stringify({bucket:"payment-proofs",path:receipt.path})});
    stats.broker_exact=b.status===200&&Buffer.from(await b.arrayBuffer()).length===receipt.size;
    need(stats.broker_exact,"BROWSER_ATTACHED_PROOF_PRIVATE_READBACK");
    stats.phase="COMPLETE";
  }finally{
    await browser.close();
    if(safeId(itemId)){
      const removed=await fetch(API_ORIGIN+"/rest/v1/payment_items?id=eq."+itemId,{method:"DELETE",redirect:"error",
        signal:AbortSignal.timeout(15000),headers:{apikey:key,authorization:"Bearer "+owner.token,origin}});
      stats.disposable_payment_deleted=removed.status===204;
      need(stats.disposable_payment_deleted,"BROWSER_DISPOSABLE_PAYMENT_CLEANUP");
    }
  }
}

async function main(){
  const p=JSON.parse(await readFile(new URL("./staging-ordinary-upload-browser-run.json",import.meta.url),"utf8"));
  if(!p.enabled)return {result:"ORDINARY_BROWSER_ACCEPTANCE_ARCHIVED",exit_code:0};
  need(/^https:\/\/(?:[a-z0-9-]+\.)?mushavo-budget-staging\.pages\.dev$/.test(p.origin)&&p.project==="dczlddwbtgvfdujgcitb"
    &&process.env.GITHUB_REPOSITORY==="dwtdhruvp246/mushavobudget"&&process.env.GITHUB_REF==="refs/heads/security/stage-3-authorization"
    &&process.env.GITHUB_RUN_ATTEMPT==="1","EXACT_ORDINARY_BROWSER_SCOPE");
  const r=await get(p.origin,"/config.js?v=27");
  need(r.ok,"STAGING_BROWSER_CONFIG_AVAILABLE");
  const {key}=readPublicConfiguration(await r.text());
  const {chromium}=await import("../fixtures/staging-browser-tools/node_modules/playwright/index.mjs");
  const options={accountScope:"ordinary"};
  const report=await checkStagingAccess(privateAccounts(process.env,options),apiTransport(key,AGENT),
    x=>exercise(x,key,p.origin,chromium),options);
  return {...report,progress_display:"Stage 4/10 | FR.3/8 | FR.3.2 ordinary browser uptake",commit:process.env.GITHUB_SHA};
}
const output=await main().catch(error=>({result:"STAGING_ORDINARY_BROWSER_REVIEW_REQUIRED",
  problem_code:error instanceof Stop?error.code:"ORDINARY_BROWSER_SEED_ERROR",exit_code:1}));
console.log(JSON.stringify(output,null,2));
process.exitCode=output.exit_code;
