// Strict modeled PostgREST subset for the actual app SDK. PostgreSQL/RLS execute locally.
const ident=/^[a-z_][a-z0-9_]*$/;
export const appTables=new Set(['profiles','app_admins','family_heads','families','family_members','family_invitations','notifications','budget_workspaces','workspace_members','workspace_subscriptions','plans','plan_prices','plan_features','plan_limits','supported_currencies','subscription_renewal_requests','subscription_invoices','subscription_payments','subscription_entitlement_history','workspace_settings','exchange_rate_snapshots','payment_conversions','payment_items','payment_records']);
export const appRPCs=new Set(['email_gate_current_session_verified','my_account_suspended','get_my_business_invitations','effective_workspace_entitlement','workspace_billable_member_count','workspace_member_usage','public_business_checkout_terms','personal_payment_plan_access','exchange_rate_status','record_my_analytics_activity']);
const need=x=>{if(!x)throw Error('MODELED_REST_SCOPE_REQUIRED');};
// PGlite exposes SQL DATE as a JS Date. PostgREST JSON uses YYYY-MM-DD.
function rowsJSON(result){return result.rows.map(row=>Object.fromEntries(Object.entries(row).map(([name,value])=>{const type=result.fields.find(f=>f.name===name)?.dataTypeID;return [name,type===1082&&value instanceof Date?value.toISOString().slice(0,10):type===1700&&value!==null?Number(value):value];})));}
export async function modeledREST(db,url,{method,body,headers}){
 const part=url.pathname.split('/').filter(Boolean),args=[];const bind=value=>{args.push(value);return '$'+args.length;};
 if(part[2]==='rpc'){
  const name=part[3];need(part.length===4&&appRPCs.has(name)&&method==='POST'&&body&&typeof body==='object'&&!Array.isArray(body));
  const names=Object.keys(body).sort();need(names.every(x=>ident.test(x))&&names.length<=4);
  const call=names.map(x=>x+'=>'+bind(body[x])).join(',');
  const reg=await db.query("select proretset,pg_get_function_result(oid) result from pg_proc where pronamespace='public'::regnamespace and proname=$1",[name]);need(reg.rows.length===1);
  const meta=reg.rows[0],rows=rowsJSON(await db.query(meta.proretset?'select * from public.'+name+'('+call+')':'select public.'+name+'('+call+') as result',args));
  return {status:200,data:meta.proretset?rows:rows[0]?.result??null};
 }
 const table=part[2];need(part.length===3&&appTables.has(table)&&method==='GET');
 const select=url.searchParams.get('select')||'*';let selected='*';
 if(select!=='*'){
  // Only these two existing embedding projections are exercised with empty fixture relations.
  if(['*,families(name,owner_email)','*,plans(display_name,code)'].includes(select.replaceAll(' ','')))selected='*';
  else{const cols=select.split(',').map(x=>x.trim());need(cols.length<=32&&cols.every(x=>ident.test(x)));selected=cols.join(',');}
 }
 const where=[];let order='',limit='';
 for(const [key,value] of url.searchParams){
  if(key==='select')continue;
  if(key==='order'){const entries=value.split(',');need(entries.length<=3);order=' order by '+entries.map(x=>{const [col,dir='asc',nulls]=x.split('.');need(ident.test(col)&&['asc','desc'].includes(dir)&&(!nulls||['nullsfirst','nullslast'].includes(nulls)));return col+' '+dir+(nulls?' nulls '+(nulls==='nullsfirst'?'first':'last'):'');}).join(',');continue;}
  if(key==='limit'){need(/^[1-9][0-9]{0,2}$/.test(value)&&Number(value)<=500);limit=' limit '+value;continue;}
  if(key==='or'){
   need(/^\(visibility\.eq\.personal,family_id\.eq\.[a-f0-9-]{36}\)$/.test(value));where.push('(visibility='+bind('personal')+' or family_id='+bind(value.slice(value.lastIndexOf('.')+1,-1))+'::uuid)');continue;
  }
  need(ident.test(key));const i=value.indexOf('.'),op=value.slice(0,i),operand=value.slice(i+1);need(i>0&&operand.length<=512);
  if(op==='eq'||op==='neq'||op==='ilike')where.push(key+(op==='eq'?' = ':op==='neq'?' <> ':' ilike ')+bind(operand));
  else if(op==='is'){need(['null','true','false'].includes(operand));where.push(key+' is '+operand);}
  else if(op==='in'){need(/^\([a-f0-9,-]+\)$/.test(operand));const values=operand.slice(1,-1).split(',');need(values.length<=8&&values.every(x=>/^[a-f0-9-]{36}$/.test(x)));where.push(key+' in ('+values.map(bind).join(',')+')');}
  else need(false);
 }
 const rows=rowsJSON(await db.query('select '+selected+' from public.'+table+(where.length?' where '+where.join(' and '):'')+order+limit,args));
 const single=String(headers.accept||'').includes('application/vnd.pgrst.object+json');
 if(single){if(rows.length!==1)return {status:406,data:{code:'PGRST116',details:'The result contains '+rows.length+' rows',message:'JSON object requested, multiple (or no) rows returned'}};return {status:200,data:rows[0]};}
 return {status:200,data:rows};
}
