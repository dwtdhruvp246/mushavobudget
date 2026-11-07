// Local synthetic HTTP/Auth ports for source PostgreSQL tests, never hosted transport.
import assert from 'node:assert/strict';
export function localBusinessTransport(db,users,emails){
const result=(status,data,raw=false)=>({status,text:async()=>raw?data:JSON.stringify(data)});
const ident=value=>{assert.match(value,/^[a-z][a-z0-9_]*$/);return '"'+value+'"';};
async function context(role,i){
 await db.exec('reset role');
 await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true),set_config('request.jwt.claims',$3,true)",[i===undefined?'':users[i],role,JSON.stringify(i===undefined?{role}:{sub:users[i],email:emails[i],role})]);
 await db.exec('set local role '+ident(role));
}
function adapter(fault){
 let calls=0,logouts=0,fired=false,mutations=0;
 async function fetcher(raw,options={}){
  calls++;
  if(raw==='https://mushavo-budget-staging.pages.dev/config.js')return result(200,'window.MUSHAVO_BUDGET_CONFIG = '+JSON.stringify({supabaseUrl:'https://dczlddwbtgvfdujgcitb.supabase.co',supabasePublishableKey:'sb_publishable_SYNTHETIC_LOCAL_ONLY',vapidPublicKey:''})+';',true);
  const url=new URL(raw),method=options.method||'GET',body=options.body?JSON.parse(options.body):{};
  const token=options.headers?.Authorization?.replace('Bearer ',''),i=token?Number(token.slice(-1)):undefined;
  if(url.pathname==='/auth/v1/token'){const account=emails.indexOf(body.email);assert.notEqual(account,-1);return result(200,{access_token:'LOCAL_FAKE_TOKEN_'+account,user:{id:users[account],email:emails[account]}});}
  if(url.pathname==='/auth/v1/user')return result(200,{id:users[i],email:emails[i]});
  if(url.pathname==='/auth/v1/logout'){logouts++;return result(fault==='logout'?500:204,null);}
  await db.exec('savepoint api_request');
  try{
   await context(i===undefined?'anon':'authenticated',i);
   let response;
   if(method!=='GET'&&url.pathname.startsWith('/rest/v1/')&&!['is_platform_staff','my_account_suspended','business_roles_snapshot','business_effective_permissions','business_has_permission','business_team_snapshot'].some(n=>url.pathname.endsWith('/'+n)))mutations++;
   if(url.pathname.startsWith('/rest/v1/rpc/')){
    const name=url.pathname.slice('/rest/v1/rpc/'.length),entries=Object.entries(body);
    const args=entries.map(([key],index)=>ident(key)+' => $'+(index+1)).join(',');
    const meta=(await db.query(`select p.proretset,t.typtype,p.prorettype='void'::regtype as is_void from pg_proc p join pg_type t on t.oid=p.prorettype join pg_namespace n on n.oid=p.pronamespace where n.nspname=$1 and p.proname=$2`,['public',name])).rows[0];
    if(!meta)throw Object.assign(new Error('missing function'),{code:'PGRST202'});
    const rows=(await db.query(meta.proretset?'select * from public.'+ident(name)+'('+args+')':'select to_jsonb(public.'+ident(name)+'('+args+')) as value',entries.map(x=>x[1]))).rows;
    if(meta.is_void)response=result(204,'',true);else response=result(200,meta.proretset?rows:rows[0].value);
    if(['retained_member','retained_invitation'].includes(fault)&&name==='business_roles_snapshot'&&i===0){
     const value=rows[0].value,old=value.roles.find(x=>!x.is_system);
     if(old){old[fault==='retained_member'?'members':'invitations']=1;response=result(200,value);fired=true;}
    }
    if(fault==='retained_after'&&name==='archive_business_role')fired=true;
    if(!fired&&fault==='legacy_void'&&meta.is_void)response=result(200,null);
    if(!fired&&fault==='void_noeffect'&&name==='archive_business_role'){await db.exec('rollback to savepoint api_request');response=result(204,'',true);fired=true;}
    if(!fired&&fault==='void_body'&&name==='archive_business_role'){response=result(204,{unexpected:true});fired=true;}
    if(!fired&&fault==='nonvoid_204'&&name==='save_business_role'){response=result(204,'',true);fired=true;}
   }else{
    const table=url.pathname.slice('/rest/v1/'.length),params=[],cols=(url.searchParams.get('select')||'*').split(',').map(x=>x==='*'?'*':ident(x)).join(',');
    const filters=[...url.searchParams].filter(([key])=>!['select','limit','order'].includes(key));
    const where=method!=='POST'&&filters.length?' where '+filters.map(([key,value])=>{assert(value.startsWith('eq.'));params.push(value.slice(3));return ident(key)+' = $'+params.length;}).join(' and '):'';
    let sql;
    if(method==='GET')sql='select '+cols+' from public.'+ident(table)+where;
    if(method==='DELETE')sql='delete from public.'+ident(table)+where+' returning '+cols;
    if(method==='PATCH'){const sets=Object.entries(body).map(([key,value])=>{params.push(value);return ident(key)+' = $'+params.length;});sql='update public.'+ident(table)+' set '+sets.join(',')+where+' returning '+cols;}
    if(method==='POST'){const entries=Object.entries(body);sql='insert into public.'+ident(table)+'('+entries.map(([key])=>ident(key)).join(',')+') values ('+entries.map(([,value])=>{params.push(value);return '$'+params.length;}).join(',')+') returning '+cols;}
    if(method==='GET'&&url.searchParams.has('order'))sql+=' order by '+url.searchParams.get('order').split(',').map(x=>{const [c,d]=x.split('.');return ident(c)+(d==='desc'?' desc':' asc');}).join(',');
    if(method==='GET'&&url.searchParams.has('limit'))sql+=' limit '+Number(url.searchParams.get('limit'));
    const pgJSON=method==='GET'&&['business_roles','business_role_permissions','business_audit_events'].includes(table);
    if(pgJSON)sql='select to_jsonb(x) as value from ('+sql+') x';
    const dates=['payment_date','expense_date','due_date','period_start','start_date','starts_on','ends_on','planned_on'];
    const rows=(await db.query(sql,params)).rows.map(row=>pgJSON?row.value:Object.fromEntries(Object.entries(row).map(([k,v])=>[k,v instanceof Date?(dates.includes(k)?v.toISOString().slice(0,10):v.toISOString()):v])));
    if(table==='business_role_permissions'&&url.searchParams.has('role')&&rows.length&&['retained_permission','retained_after'].includes(fault)&&(fault==='retained_permission'||fired)){rows[0].enabled=false;fired=true;}
    if(table==='business_audit_events'&&i===0&&fault==='retained_audit_actor'){
     const roleEvent=rows.find(x=>x.action==='business.role_saved');if(roleEvent){roleEvent.actor_id=users[1];fired=true;}
    }
    response=result(method==='POST'?201:200,rows);
    if(!fired&&fault==='foreign_read'&&i===1&&table==='business_expense_claims'&&method==='GET'){
     await db.exec('reset role');const privileged=(await db.query('select '+cols+' from public.'+ident(table)+where,params)).rows;
     if(privileged.length&&privileged[0].submitted_by===users[0]){response=result(200,privileged);fired=true;}
    }
   }
   await db.exec('reset role; release savepoint api_request');return response;
  }catch(error){
   await db.exec('rollback to savepoint api_request; reset role; release savepoint api_request');
   if(!fired&&fault==='missing_function'&&url.pathname.endsWith('/save_business_role')){fired=true;return result(404,{code:'PGRST202'});}
   if(!fired&&fault==='false_denial'&&error.code==='P0001'){fired=true;return result(400,{code:'23503',message:'Synthetic FK failure'});}
   if(!fired&&fault==='hidden_write'&&url.pathname.endsWith('/save_business_role')){
    await db.query("update public.business_profiles set trading_name='UNAUTHORIZED' where workspace_id=$1",[body.p_workspace_id]);fired=true;
   }
   return result(error.code==='42501'?403:400,{code:error.code,message:error.message});
  }
 }
 return {fetcher,counters:()=>({calls,logouts,fired,mutations})};
}
return adapter;
}
