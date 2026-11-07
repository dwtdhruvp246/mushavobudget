// Actual entrypoint evaluation with explicit synthetic SDK/provider ports.
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {requireEmailVerifiedSession,emailVerificationFailure} from '../../supabase/functions/_shared/email-session-assurance.mjs';
import {activeNotificationRecipient,prepareReminderPayload} from '../../supabase/functions/_shared/notification-recipient.mjs';
export const origin='https://mushavo-budget-staging.pages.dev';
export const actor='00000000-0000-4000-8000-000000000901';
export const recipient='00000000-0000-4000-8000-000000000902';
export const invitation='00000000-0000-4000-8000-000000000903';
export const guardedNames=['invite-admin-user','invite-business-member','send-test-push','sync-exchange-rates'];
const currencySource=stripTypeScriptTypes(await readFile(new URL('../../supabase/functions/_shared/currencyapi.ts',import.meta.url),'utf8'));
const currency=new Function(currencySource.replace(/^export\s+/gm,'')+'\nreturn {normalizeCurrencyApiPayload,PROVIDER_BASE_CURRENCY,PROVIDER_NAME,safeProviderError,currencyApiUrl,providerFailure};')();

export async function edgeHarness(name,options={}) {
  const calls={sequence:[],proof:[],reads:[],writes:[],userRPC:[],serviceRPC:[],mail:[],push:[],provider:[],clients:[],logs:[]};
  const env={APP_ORIGIN:origin,SUPABASE_URL:'https://dczlddwbtgvfdujgcitb.supabase.co',
    SUPABASE_ANON_KEY:'synthetic-public',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service',
    VAPID_PUBLIC_KEY:'synthetic-public-vapid',VAPID_PRIVATE_KEY:'synthetic-private-vapid',VAPID_SUBJECT:'mailto:synthetic@example.invalid',
    CRON_SECRET:'synthetic-cron',CURRENCY_SYNC_SECRET:'synthetic-currency-cron',CURRENCYAPI_API_KEY:'synthetic-provider',...options.env};
  const service={
    auth:{admin:{
      async inviteUserByEmail(email,args){calls.mail.push({kind:'invite',email,args});return {data:{user:{id:recipient}},error:null};},
      async updateUserById(id,args){calls.writes.push({table:'Auth_metadata',id,args});return {error:null};}
    }},
    from(table){
      let operation='select',single=false,value;const filters=[];
      const result=()=>{
        const entry={table,filters:[...filters],operation,value};
        calls.sequence.push('service:'+operation+':'+table);
        (operation==='select'?calls.reads:calls.writes).push(entry);
        let data=[];
        if(table==='app_admins') {
          const role=options.adminRole===undefined?'super_admin':options.adminRole;
          const allowed=filters.find(x=>x[0]==='in'&&x[1]==='role')?.[2];
          data=role&&(!allowed||allowed.includes(role))?{role}:null;
        } else if(table==='profiles') data=options.profile===undefined?{account_status:'active'}:options.profile;
        else if(table==='push_subscriptions') data=options.subscriptions===undefined?[{id:'synthetic-device',endpoint:'https://synthetic.invalid/push',p256dh:'synthetic-key',auth:'synthetic-auth',failure_count:0}]:options.subscriptions;
        else if(table==='admin_user_invitations') data={auth_user_id:options.existingUser?recipient:null};
        else if(table==='exchange_rate_sync_runs') data=operation==='insert'&&single?{id:'synthetic-run'}:[];
        else if(table==='supported_currencies') data=[{code:'USD'}];
        if(operation!=='select'&&!(table==='exchange_rate_sync_runs'&&single))data=null;
        return {data,error:options.tableErrors?.[table]??null};
      };
      const q=new Proxy({}, {get:(_,key)=>{
        if(key==='then')return (resolve,reject)=>Promise.resolve(result()).then(resolve,reject);
        return (...args)=>{
          if(['insert','update','upsert','delete'].includes(key)){operation=key;value=args[0];}
          if(['eq','in','is','gte','lt'].includes(key))filters.push([key,...args]);
          if(['single','maybeSingle'].includes(key))single=true;
          return q;
        };
      }});return q;
    },
    async rpc(rpc,args){
      calls.sequence.push('service-rpc:'+rpc);calls.serviceRPC.push({name:rpc,args});
      if(rpc==='reserve_admin_user_invitation')return {data:invitation,error:options.reservationError??null};
      if(rpc==='claim_push_test_rate_limit')return {data:options.rateAllowed!==false,error:null};
      return {data:rpc.startsWith('claim_')||rpc==='currency_conversion_backfill_dates'?[]:0,error:null};
    }
  };
  const mailClient={auth:{async signInWithOtp(args){calls.mail.push({kind:'otp',args});return {error:null};}}};
  const userClient={auth:{async getUser(){calls.sequence.push('getUser');return {data:{user:options.authUser===false?null:{id:options.actor||actor}},error:options.authError??null};}},
    async rpc(rpc,args){
      calls.sequence.push('user-rpc:'+rpc);
      if(rpc==='email_gate_current_session_verified'){
        calls.proof.push({name:rpc,args});
        if(options.proofRPC)return await options.proofRPC(rpc,args);
        if(options.proofThrow)throw options.proofThrow;
        return {data:options.proof===undefined?true:options.proof,error:options.proofError??null};
      }
      calls.userRPC.push({name:rpc,args});
      return {data:{invitation_id:invitation,email:'recipient@example.invalid',invitee_user_id:options.existingUser?recipient:null},error:options.reservationError??null};
    }};
  let handler;
  const createClient=(url,key,settings)=>{
    const kind=key===env.SUPABASE_SERVICE_ROLE_KEY?'service':settings?.global?.headers?.Authorization?'user':'mail';
    calls.clients.push({kind,url,authorization:settings?.global?.headers?.Authorization});
    return kind==='service'?service:kind==='mail'?mailClient:userClient;
  };
  const source=await readFile(new URL(`../../supabase/functions/${name}/index.ts`,import.meta.url),'utf8');
  const js=stripTypeScriptTypes(source,{mode:'strip'}).replace(/^import[^;]*;\s*/gm,'');
  const ports={createClient,requireEmailVerifiedSession,emailVerificationFailure,
    activeNotificationRecipient,prepareReminderPayload,...currency,
    Deno:{env:{get:key=>env[key]},serve:fn=>{handler=fn;}},
    webpush:{setVapidDetails(){calls.sequence.push('vapid');}},
    createGuardedPushSender:()=>async(subscription,payload)=>{calls.push.push({subscription,payload});},
    isBlockedPushDestination:()=>false,
    fetch:async(url,init)=>{calls.provider.push({url:String(url),method:init?.method});return new Response(JSON.stringify({meta:{last_updated_at:new Date().toISOString()},data:{USD:{code:'USD',value:1}}}),{status:200});},
    console:{warn:(...a)=>calls.logs.push(a),error:(...a)=>calls.logs.push(a)}
  };
  new Function(...Object.keys(ports),js)(...Object.values(ports));
  return {calls,env,request:({body={},method='POST',bearer=true,requestOrigin=origin,headers={}}={})=>handler(new Request(origin+'/edge-test',{
    method,headers:{...(bearer?{Authorization:'Bearer synthetic-user-token'}:{}),...(requestOrigin===null?{}:{Origin:requestOrigin}),'Content-Type':'application/json',...headers},
    ...(method==='POST'?{body:JSON.stringify(body)}:{})
  }))};
}

export const validAdminBody={full_name:'Synthetic recipient',email:'recipient@example.invalid',plan_id:'00000000-0000-4000-8000-000000000904',billing_period:'monthly',subscription_currency:'USD',entitlement_start_date:'2026-10-16',enabled_currencies:['USD'],default_currency:'USD'};
export const validBusinessBody={workspace_id:'00000000-0000-4000-8000-000000000905',email:'recipient@example.invalid',role:'staff',scope_ids:[]};
