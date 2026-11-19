// Native full-app integration with real local SQL. Every service/provider/account is synthetic.
import https from 'node:https';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {startFullAppLoopbackBrowser} from './full-app-staging-browser.mjs';
import {fullAppPagesFixture} from './full-app-pages-fixture.mjs';
import {scopedProbe,scopedAcknowledgement} from '../check-fr-2-email-batch-u-scoped.mjs';
const root=new URL('../../',import.meta.url),id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
export async function scopedLocalCheck(executable,modulePath){
 let dir,f,result,problem=null,inspection;const SQLproblems=[];
 try{
  // Verify original U55 fixture before two explicit test-only source hooks: correct
  // base URL in the temporary module and expose its existing serial SQL executor.
  const fixtureURL=new URL('./full-app-local-fixture.mjs',import.meta.url),original=await readFile(fixtureURL,'utf8'),manifest=JSON.parse(await readFile(new URL('docs/security-audit/security-fr-2-email-batch-u-source-manifest.json',root),'utf8'));
  if(createHash('sha256').update(original).digest('hex')!==manifest.file_sha256['scripts/lib/full-app-local-fixture.mjs'])throw Error('SCOPED_LOCAL_FIXTURE_HASH_REQUIRED');
  if(original.split('return {releaseInitialRestore()').length!==2||original.split("const root=new URL('../../',import.meta.url)").length!==2)throw Error('SCOPED_LOCAL_HOOK_REQUIRED');
  let source=original.replace("const root=new URL('../../',import.meta.url)",'const root=new URL('+JSON.stringify(root.href)+')').replace('return {releaseInitialRestore()','return {runPrivilegedSQL:query=>serial(()=>db.exec(query)),releaseInitialRestore()').replace(/from '(\.[^']+)'/g,(_,s)=>'from '+JSON.stringify(new URL(s,fixtureURL).href));
  dir=await mkdtemp(path.join(tmpdir(),'mushavo-u-scoped-public-fixture-'));const filename=path.join(dir,'fixture.mjs');await writeFile(filename,source);const factory=(await import(pathToFileURL(filename).href)).fullAppLocalFixture;
  // Existing adapter receives only a test factory override; hosted code cannot.
  f=await fullAppPagesFixture(modulePath,{fixtureFactory:factory});
  await f.runPrivilegedSQL(`BEGIN;SELECT set_config('request.jwt.claim.role','',true),set_config('request.jwt.claim.sub','${f.actors[0].id}',true),set_config('request.jwt.claims','{"sub":"${f.actors[0].id}"}',true);DELETE FROM public.payment_items WHERE id='${id(63001)}'::uuid AND owner_id='${f.actors[0].id}'::uuid;COMMIT;`);
  const target={ref:'dczlddwbtgvfdujgcitb',status:'ACTIVE_HEALTHY',database:{host:'db.dczlddwbtgvfdujgcitb.supabase.co'}};
  const transport=async(url,o)=>{
   if(url==='https://api.supabase.com/v1/projects/dczlddwbtgvfdujgcitb')return Response.json(target);
   if(url==='https://api.supabase.com/v1/projects/dczlddwbtgvfdujgcitb/database/query'){
    const q=JSON.parse(o.body).query;try{const sets=await f.runPrivilegedSQL(q),rows=[...sets].reverse().find(s=>s.fields?.length)?.rows||[];return Response.json(rows,{status:201});}catch(e){await f.runPrivilegedSQL('ROLLBACK;');SQLproblems.push({code:e.code||'OTHER',class:/^[A-Z][A-Z0-9_]{3,100}$/.test(e.message||'')?e.message:'SYNTHETIC_SQL_ERROR'});return Response.json({code:'SYNTHETIC_SQL_ERROR'},{status:400});}
   }
   if(url==='https://mushavo-budget-staging.pages.dev/config.js')return new Response('window.MUSHAVO_BUDGET_CONFIG='+JSON.stringify({supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:f.publishableKey,vapidPublicKey:''})+';',{headers:{'content-type':'application/javascript'}});
   const u=new URL(url);if(u.origin!=='https://dczlddwbtgvfdujgcitb.supabase.co'||!['/auth/v1/token','/auth/v1/user','/auth/v1/logout'].includes(u.pathname))throw Error('SCOPED_LOCAL_ROUTE_REQUIRED');
   return new Promise((resolve,reject)=>{const q=https.request(f.api+u.pathname+u.search,{method:o.method,rejectUnauthorized:false,headers:o.headers},r=>{const chunks=[];let size=0;r.on('data',v=>{if((size+=v.length)>131072){q.destroy();reject(Error('SCOPED_LOCAL_RESPONSE_BOUND'));}else chunks.push(v);});r.on('end',()=>resolve(new Response(r.statusCode===204?null:Buffer.concat(chunks),{status:r.statusCode,headers:r.headers})));});q.on('error',()=>reject(Error('SCOPED_LOCAL_AUTH_TRANSPORT_REQUIRED')));q.end(o.body||'');});
  };
  result=await scopedProbe({managementToken:'sbp_fc'+'S'.repeat(30),publishableKey:f.publishableKey,accounts:f.actors.map(a=>({email:a.email,password:a.password})),allowedRecipients:f.actors.map(a=>a.email),acknowledgement:scopedAcknowledgement,browserExecutable:executable},{transport,readCode:async()=>f.state.code,createBrowser:()=>startFullAppLoopbackBrowser(executable,{origin:f.origin,api:f.api,publishableKey:f.publishableKey})});
 }catch(e){problem=/^[A-Z][A-Z0-9_]{3,90}$/.test(e?.message||'')?e.message:'SCOPED_LOCAL_REVIEW_REQUIRED';}
 finally{if(f){inspection=await f.inspect();await f.cleanup();await f.close();}if(dir)await rm(dir,{recursive:true,force:true});}
 return {scope:'LOCAL_SCOPED_FIXTURE_ACTUAL_SQL_AND_NATIVE_FULL_APP_SYNTHETIC_SERVICES',result,fixture_state:inspection,SQLproblems,synthetic_email_requests:f?.state.mail||0,actual_hosted_requests:0,real_email_requests:0,private_packets_or_real_credentials_accessed:false,problem_code:problem,exit_code:!problem&&result?.exit_code===0?0:1};
}
