import {readFile,readdir,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const hash=b=>createHash('sha256').update(b).digest('hex');
const need=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{safeCode:code});};
const workerHash='4d10a3f6ea03ab14979b1d821df2c35409d519b0550da8bd4a92f4b28d37b0a1';
const configHash='bc73523d98847f678f86b07b2855d8e86259e40e451f471dd9a2320f3452d028';
async function unlinked(file){
  for(let p=path.resolve(file);;){
    need(!(await lstat(p)).isSymbolicLink(),'LINKED_CANDIDATE_REFUSED');
    const parent=path.dirname(p);if(parent===p)break;p=parent;
  }
}
export async function verifyAccountCandidate(directory){
    await unlinked(directory);
    need(JSON.stringify((await readdir(directory)).sort())===JSON.stringify(['email-rate-worker.mjs','wrangler.json']),'CANDIDATE_FILE_SET_MISMATCH');
    for(const [file,expected]of [['email-rate-worker.mjs',workerHash],['wrangler.json',configHash]]){
      const selected=path.join(directory,file);await unlinked(selected);
      const stat=await lstat(selected);need(stat.isFile()&&stat.size<=2097152,'INVALID_CANDIDATE_FILE');
      need(hash(await readFile(selected))===expected,'CANDIDATE_HASH_MISMATCH');
    }
}
export async function checkCloudflareAccount(input,{transport=fetch,candidateCheck=verifyAccountCandidate}={}){
  const receipt={stage_step:'FR.2.4.E3.4_CLOUDFLARE_ACCOUNT_CHECK',
    result:'READ_ONLY_ACCOUNT_CHECK_REVIEW_REQUIRED',requests_attempted:0,
    candidate_hashes_match:false,token_active:false,staging_Pages_project_in_selected_account:false,
    complete_Worker_inventory_received:false,target_Worker_absent:false,
    candidate_files_changed:false,Cloudflare_resources_or_bindings_changed:false,
    token_saved_to_disk_or_environment:false,account_identifiers_or_credentials_printed:false,
    Zoho_file_accessed:false,email_dispatched:false,deployed:false,hosted_acceptance:false,
    production_or_native_changed:false,findings_closed:[],problem_code:null,exit_code:1};
  let checkpoint='LOCAL_INPUT';
  try{
    need(input&&Object.keys(input).sort().join(',')==='account,candidate,token','INVALID_LOCAL_INPUT');
    need(typeof input.account==='string'&&/^[a-f0-9]{32}$/.test(input.account),'INVALID_ACCOUNT_ID');
    need(typeof input.token==='string'&&/^[\x21-\x7e]{20,512}$/.test(input.token),'INVALID_TOKEN_INPUT');
    need(typeof input.candidate==='string'&&path.isAbsolute(input.candidate),'INVALID_CANDIDATE_PATH');
    await candidateCheck(input.candidate);
    receipt.candidate_hashes_match=true;
    async function get(suffix){
      receipt.requests_attempted++;
      let response;
      try{response=await transport('https://api.cloudflare.com/client/v4'+suffix,{
        method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),
        headers:{Authorization:'Bearer '+input.token,Accept:'application/json'}});}
      catch{need(false,checkpoint+'_NETWORK_OR_REDIRECT_FAILURE');}
      if(response.status!==200){await response.body?.cancel();need(false,checkpoint+'_HTTP_REVIEW_REQUIRED');}
      need(/^(application\/json)(?:\s*;|$)/i.test(response.headers.get('content-type')||''),checkpoint+'_INVALID_RESPONSE');
      const reader=response.body?.getReader();need(reader,checkpoint+'_INVALID_RESPONSE');
      const chunks=[];let size=0;
      try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
        need(size<=2097152,checkpoint+'_RESPONSE_TOO_LARGE');chunks.push(value);}}
      finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      let parsed;try{parsed=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{need(false,checkpoint+'_INVALID_RESPONSE');}
      need(parsed?.success===true&&Array.isArray(parsed.errors)&&parsed.errors.length===0,checkpoint+'_API_REVIEW_REQUIRED');
      return parsed;
    }
    checkpoint='TOKEN';const token=await get('/user/tokens/verify');
    need(token.result?.status==='active','TOKEN_NOT_ACTIVE');receipt.token_active=true;
    checkpoint='PAGES';const pages=await get(`/accounts/${input.account}/pages/projects/mushavo-budget-staging`);
    need(pages.result?.name==='mushavo-budget-staging'&&pages.result.subdomain==='mushavo-budget-staging.pages.dev','STAGING_PROJECT_MISMATCH');
    receipt.staging_Pages_project_in_selected_account=true;
    checkpoint='WORKERS';const workers=await get(`/accounts/${input.account}/workers/scripts`);
    need(Array.isArray(workers.result)&&workers.result.every(x=>x&&typeof x.id==='string'),'WORKER_INVENTORY_INVALID');
    const info=workers.result_info;
    need(!info||((info.total_pages===undefined||info.total_pages<=1)&&
      (info.total_count===undefined||info.total_count===workers.result.length)&&
      (info.count===undefined||info.count===workers.result.length)),'WORKER_INVENTORY_INCOMPLETE');
    receipt.complete_Worker_inventory_received=true;
    need(!workers.result.some(x=>x.id==='mushavo-email-rate-staging'),'TARGET_WORKER_ALREADY_EXISTS');
    receipt.target_Worker_absent=true;
    receipt.result='STAGING_ACCOUNT_AND_CURRENT_WORKER_ABSENCE_SCOPED_PASS_NOT_DEPLOYED';receipt.exit_code=0;
  }catch(error){receipt.problem_code=error.safeCode||checkpoint+'_LOCAL_OR_RESPONSE_FAILURE';}
  receipt.checked_UTC=new Date().toISOString();return receipt;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  let input,size=0;const chunks=[];
  try{for await(const chunk of process.stdin){size+=chunk.length;need(size<=16384,'INPUT_TOO_LARGE');chunks.push(chunk);}input=JSON.parse(Buffer.concat(chunks).toString('utf8'));need(input&&typeof input==='object'&&!Array.isArray(input),'INVALID_PRIVATE_INPUT');}
  catch{console.log(JSON.stringify({stage_step:'FR.2.4.E3.4_CLOUDFLARE_ACCOUNT_CHECK',result:'LOCAL_INPUT_REVIEW_REQUIRED',requests_attempted:0,problem_code:'INVALID_PRIVATE_INPUT',exit_code:1}));process.exitCode=1;}
  if(input){const receipt=await checkCloudflareAccount(input);console.log(JSON.stringify(receipt,null,2));process.exitCode=receipt.exit_code;}
}
