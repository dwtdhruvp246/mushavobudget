import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {preparePrivatePacket} from '../scripts/lib/fr-2-email-private-packet.mjs';
import {installStagingSecretBindings,secretBindingPayload,secretNames,installAcknowledgement} from '../scripts/install-fr-2-email-pages-secrets.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),clone=x=>JSON.parse(JSON.stringify(x));
const pub='sb_publishable_SYNTHETIC_INSTALL_PUBLIC',backend='sb_secret_SYNTHETIC_INSTALL_BACKEND',token='SYNTHETIC_INSTALL_CF_TOKEN_1234';
function input(){let n=0;return {account:'a'.repeat(32),token,candidate:path.join(os.tmpdir(),'synthetic-install-candidate'),install_ack:installAcknowledgement,
  packet:preparePrivatePacket({publishableKey:pub,secretKey:backend,expectedWorkerSHA:'a7cbfa8b257eb7a53185fc57cc93a8315bbc453fd0bbbd3cc3b2a5e3cf4ee651',
    configuration:'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:pub,vapidPublicKey:''})+';',
    zoho:{schema_version:1,purpose:'MUSHAVO_STAGING_ZOHO_SENDER_ONLY',accountsOrigin:'https://accounts.zoho.com',mailOrigin:'https://mail.zoho.com',from:'notifications@mushavobudget.com',accountId:'123',clientId:'SYNTHETIC_CLIENT',clientSecret:'SYNTHETIC_ZOHO_SECRET',refreshToken:'SYNTHETIC_REFRESH',account_verified:true},
    recipients:['first@example.com','second@example.com']},{entropy:length=>Buffer.alloc(length,++n)}).private_configuration};}
function fixture({beforeChange=()=>{},afterChange=()=>{},patchMode='normal',readbackMode='normal',authFail=false}={}){
  const channel=()=>({compatibility_date:'2026-07-01',always_use_latest_compatibility_date:false,fail_open:false,limits:{cpu_ms:10},
    env_vars:{EMAIL_GATE_MODE:{type:'plain_text',value:'STAGING_CONTROLLED_ONLY'},EMAIL_GATE_PROJECT:{type:'plain_text',value:'dczlddwbtgvfdujgcitb'},EMAIL_GATE_ORIGIN:{type:'plain_text',value:'https://mushavo-budget-staging.pages.dev'}},
    durable_object_namespaces:{EMAIL_GATE_LIMITER_NS:{namespace_id:'SYNTHETIC_NAMESPACE'}}});
  let pages={id:'SYNTHETIC_PROJECT_ID',name:'mushavo-budget-staging',subdomain:'mushavo-budget-staging.pages.dev',production_branch:'main',source:null,canonical_deployment:{id:'SYNTHETIC_DEPLOYMENT',uses_functions:false},build_config:{destination_dir:'public'},domains:['mushavo-budget-staging.pages.dev'],deployment_configs:{production:channel(),preview:channel()}};
  beforeChange(pages);const calls=[];let patchCalls=0;
  const envelope=result=>({success:true,errors:[],result});const response=(b,status=200)=>new Response(JSON.stringify(b),{status,headers:{'content-type':'application/json'}});
  const transport=async(url,init)=>{
    assert.equal(init.redirect,'error');const u=new URL(url);calls.push({url,init});
    if(u.hostname==='dczlddwbtgvfdujgcitb.supabase.co'){
      assert.equal(u.pathname,'/auth/v1/settings');assert.equal(init.method,'GET');assert.equal(init.body,undefined);assert.equal(init.headers.Authorization,undefined);
      if(init.headers.apikey.includes('NEGATIVE_CONTROL')||authFail)return response({},401);
      assert([pub,backend].includes(init.headers.apikey));return response({external:{email:true},disable_signup:false});
    }
    assert.equal(u.hostname,'api.cloudflare.com');assert.equal(init.headers.Authorization,'Bearer '+token);
    const suffix=u.pathname.replace('/client/v4/accounts/'+'a'.repeat(32),'')+u.search;
    if(init.method==='PATCH'){
      patchCalls++;assert.equal(suffix,'/pages/projects/mushavo-budget-staging');assert.equal(patchCalls,1);
      const payload=JSON.parse(init.body);assert.deepEqual(Object.keys(payload),['deployment_configs']);
      assert.deepEqual(Object.keys(payload.deployment_configs).sort(),['preview','production']);
      for(const c of ['production','preview']){assert.deepEqual(Object.keys(payload.deployment_configs[c]),['env_vars']);assert.equal(Object.keys(payload.deployment_configs[c].env_vars).length,16);for(const [n,row]of Object.entries(payload.deployment_configs[c].env_vars)){assert.equal(row.type,secretNames.includes(n)?'secret_text':'plain_text');assert.equal(typeof row.value,'string');if(!secretNames.includes(n))assert.deepEqual(row,pages.deployment_configs[c].env_vars[n]);}}
      if(patchMode==='denied')return response({success:false,errors:[{message:backend}]},403);
      if(patchMode==='throw_without_commit')throw Error(backend);
      for(const c of ['production','preview'])Object.assign(pages.deployment_configs[c].env_vars,clone(payload.deployment_configs[c].env_vars));
      afterChange(pages);
      if(patchMode==='throw_after_commit')throw Error(backend);
      if(patchMode==='bad_envelope')return response({success:false,errors:[{message:backend}]});
      if(patchMode==='html')return new Response(backend,{headers:{'content-type':'text/html'}});
      return response(envelope({}));
    }
    assert.equal(init.method,'GET');assert.equal(init.body,undefined);
    if(suffix==='/pages/projects/mushavo-budget-staging'){
      if(patchCalls&&readbackMode==='503')return response({},503);
      if(patchCalls&&readbackMode==='malformed')return new Response(backend,{headers:{'content-type':'application/json'}});
      if(patchCalls&&readbackMode==='oversized')return new Response('x'.repeat(2097153),{headers:{'content-type':'application/json'}});
      const visible=clone(pages);if(patchCalls)for(const c of ['production','preview'])for(const n of secretNames)if(visible.deployment_configs[c].env_vars[n])visible.deployment_configs[c].env_vars[n]={type:visible.deployment_configs[c].env_vars[n].type,value:'REDACTED'};
      return response(envelope(visible));
    }
    if(suffix==='/workers/scripts')return response(envelope([{id:'mushavo-email-rate-staging'}]));
    if(suffix==='/workers/durable_objects/namespaces?per_page=1000')return response(envelope([{script:'mushavo-email-rate-staging',class:'EmailGatewayRateLimiter',id:'SYNTHETIC_NAMESPACE',use_sqlite:true}]));
    if(suffix==='/workers/scripts/mushavo-email-rate-staging/subdomain')return response(envelope({enabled:false,previews_enabled:false}));
    throw Error('UNEXPECTED_ENDPOINT');
  };
  return {calls,transport,artifactCheck:async()=>({publishableKey:pub}),get patchCalls(){return patchCalls;}};
}
test('Actual readiness precedes one13-per-channel secret-only PATCH and independent GET',async()=>{const f=fixture(),x=input(),old=clone(x),r=await installStagingSecretBindings(x,f);assert.equal(r.exit_code,0);assert.equal(r.requests_attempted,9);assert.equal(f.patchCalls,1);assert.equal(f.calls[7].init.method,'PATCH');assert.equal(f.calls[8].init.method,'GET');assert.equal(r.remote_state_may_require_review,false);assert.equal(r.secret_values_read_back_or_equality_proven,false);assert.equal(r.selected_project_source_build_and_deployment_metadata_compared_unchanged,true);assert.equal(r.all_observed_channel_settings_except_new_secret_entries_compared_unchanged,true);assert.deepEqual(r.channels.map(x=>x.observed_secret_text_count),[13,13]);assert.deepEqual(x,old);const text=JSON.stringify(r);for(const v of [pub,backend,token,x.account,'SYNTHETIC_NAMESPACE','SYNTHETIC_REFRESH',x.packet.env.EMAIL_GATE_RATE_PEPPER,'first@example.com'])assert(!text.includes(v));});
test('Payload includes exactly13 encrypted rows and3 exact existing markers per channel without deletes or unrelated settings',()=>{const x=input(),p=secretBindingPayload(x.packet.env);assert.equal(secretNames.length,13);for(const c of Object.values(p.deployment_configs)){assert.equal(Object.keys(c.env_vars).length,16);assert.equal(Object.values(c.env_vars).filter(x=>x.type==='secret_text').length,13);for(const [n,v]of Object.entries(c.env_vars))assert.deepEqual(v,{type:secretNames.includes(n)?'secret_text':'plain_text',value:x.packet.env[n]});}});
for(const [name,change]of [['missing acknowledgement',x=>{delete x.install_ack;}],['wrong acknowledgement',x=>{x.install_ack='YES';}],['extra input',x=>{x.extra=true;}]])test(name+' refuses every provider request',async()=>{const x=input(),f=fixture();change(x);const r=await installStagingSecretBindings(x,f);assert.equal(r.requests_attempted,0);assert.equal(f.patchCalls,0);assert.equal(r.secret_patch_attempted,false);});
test('Packet scope failure and public-key rejection do not attempt a PATCH',async()=>{for(const bad of ['scope','auth']){const x=input(),f=fixture({authFail:bad==='auth'});if(bad==='scope')x.packet.project='foreign';const r=await installStagingSecretBindings(x,f);assert.equal(r.exit_code,1);assert.equal(f.patchCalls,0);assert.equal(r.remote_state_may_require_review,false);}});
for(const [name,change]of [
 ['Git source',p=>{p.source={type:'github'};}],['existing Functions deployment',p=>{p.canonical_deployment.uses_functions=true;}],
 ['managed Wrangler config',p=>{p.deployment_configs.preview.wrangler_config_hash='managed';}],['unrelated existing variable',p=>{p.deployment_configs.production.env_vars.UNRELATED={type:'plain_text',value:'leave unchanged'};}],
 ['existing target secret',p=>{p.deployment_configs.preview.env_vars.SUPABASE_SERVICE_ROLE_KEY={type:'secret_text',value:'already exists'};}]
])test(name+' is refused without overwriting',async()=>{const f=fixture({beforeChange:change}),r=await installStagingSecretBindings(input(),f);assert.equal(r.exit_code,1);assert.equal(f.patchCalls,0);assert.equal(r.secret_patch_attempted,false);});
for(const [name,change]of [
 ['partial channel install',p=>{delete p.deployment_configs.preview.env_vars.ZOHO_REFRESH_TOKEN;}],
 ['plaintext secret',p=>{p.deployment_configs.preview.env_vars.SUPABASE_SERVICE_ROLE_KEY.type='plain_text';}],
 ['marker drift',p=>{p.deployment_configs.production.env_vars.EMAIL_GATE_MODE.value='different';}],
 ['date drift',p=>{p.deployment_configs.preview.compatibility_date='2026-01-01';}],
 ['namespace drift',p=>{p.deployment_configs.preview.durable_object_namespaces.EMAIL_GATE_LIMITER_NS.namespace_id='different';}],
 ['deployment drift',p=>{p.canonical_deployment.id='different';}],
 ['unexpected variable',p=>{p.deployment_configs.preview.env_vars.EXTRA={type:'plain_text',value:'different'};}]
])test(name+' leaves a review receipt and never retries or rolls back',async()=>{const f=fixture({afterChange:change}),r=await installStagingSecretBindings(input(),f);assert.equal(r.exit_code,1);assert.equal(r.secret_patch_HTTP_accepted,true);assert.equal(r.independent_project_readback_received,true);assert.equal(r.remote_state_may_require_review,true);assert.equal(r.automatic_retry_or_rollback_attempted,false);assert.equal(f.patchCalls,1);assert.equal(f.calls.length,9);});
for(const mode of ['denied','throw_without_commit','throw_after_commit','bad_envelope','html'])test('PATCH '+mode+' still attempts independent readback and never repeats the write',async()=>{const f=fixture({patchMode:mode}),r=await installStagingSecretBindings(input(),f);assert.equal(r.exit_code,1);assert.equal(r.remote_state_may_require_review,true);assert.equal(f.patchCalls,1);assert.equal(f.calls.length,9);assert.equal(f.calls.at(-1).init.method,'GET');assert(!JSON.stringify(r).includes(backend));});
for(const mode of ['503','malformed','oversized'])test('Readback '+mode+' keeps remote state under review',async()=>{const f=fixture({readbackMode:mode}),r=await installStagingSecretBindings(input(),f);assert.equal(r.exit_code,1);assert.equal(r.remote_state_may_require_review,true);assert.equal(f.patchCalls,1);assert(!JSON.stringify(r).includes(backend));});
test('Actual private CLI requires explicit mode and supports zero-request preflight',()=>{const entry=path.join(root,'scripts/install-fr-2-email-pages-secrets.mjs'),run=(args,text)=>spawnSync(process.execPath,[entry,...args],{input:text,encoding:'utf8',timeout:10000});const p=run(['--private-parent-pipe'],'{"preflight":true}');assert.equal(p.status,0);assert.equal(JSON.parse(p.stdout).requests_attempted,0);for(const [args,s]of [[[],'PRIVATE_INPUT'],[['--private-parent-pipe'],'{}'],[['--private-parent-pipe'],'x'.repeat(65537)]]){const c=run(args,s);assert.equal(c.status,1);assert.equal(JSON.parse(c.stdout).requests_attempted,0);assert(!c.stdout.includes('PRIVATE_INPUT'));assert.equal(c.stderr,'');}});
test('Windows wrapper requires the explicit install switch and keeps packet/token transport private',()=>{const ps=fs.readFileSync(path.join(root,'scripts/run-fr-2-email-pages-secrets.ps1'),'utf8');assert.match(ps,/\[switch\]\$InstallStagingSecrets/);assert.match(ps,/if \(-not \$InstallStagingSecrets.IsPresent\)/);assert.match(ps,/ADD_13_SECRET_TEXT_BINDINGS_PER_CHANNEL_TO_STAGING_ONLY/);assert.match(ps,/\.BaseStream\.Write\(\$Bytes/);assert.match(ps,/DPAPI_packet_and_modern_ZIP_compared_unchanged/);assert.match(ps,/remote_state_may_require_review = \$InstallChildAttempted/);assert(!/WriteAllText|ConvertFrom-SecureString|New-Item|SetEnvironmentVariable/.test(ps));});
