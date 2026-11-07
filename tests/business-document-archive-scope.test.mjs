import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { PGlite } from '../scripts/fixtures/email-session-review-tools/node_modules/@electric-sql/pglite/dist/index.js';

const candidate=fs.readFileSync(new URL('../supabase/migrations/20261107072702_business_document_archive_parent_scope.sql',import.meta.url),'utf8');
const original=JSON.parse(fs.readFileSync(new URL('./fixtures/document-archive-reviewed-function.json',import.meta.url),'utf8')).definition;
const ws='11111111-1111-4111-8111-111111111111',doc='22222222-2222-4222-8222-222222222222',parent='33333333-3333-4333-8333-333333333333';
test('archive enforces parent scope and preserves valid owner/workflow behavior',async()=>{
 const db=new PGlite();let checks=0;
 const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
 const scalar=async sql=>(await db.query(sql)).rows[0]?.value;
 const config=async values=>{await db.exec('reset role');for(const [key,value]of Object.entries(values))await db.query('select set_config($1,$2,false)',['test.'+key,String(value)]);await db.exec('set role authenticated');};
 const seed=async(type='expense_claim',status='draft')=>{await db.exec(`reset role; truncate public.business_documents,public.business_expense_claims,public.archive_audit; insert into public.business_documents(id,workspace_id,parent_type,parent_id,storage_path,status) values('${doc}','${ws}','${type}','${parent}','synthetic-path','active'); insert into public.business_expense_claims values('${parent}','${ws}','${status}'); set role authenticated;`);};
 const archive=()=>db.query(`select public.archive_business_document('${ws}','${doc}','Synthetic scope audit') as value`);
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema mushavo_email_auth;grant usage on schema public,auth,mushavo_email_auth to authenticated;
   create function auth.uid()returns uuid language sql stable as $$select '44444444-4444-4444-8444-444444444444'::uuid$$;
   create function mushavo_email_auth.require_application_session()returns void language plpgsql stable as $$begin if current_setting('test.session',true)<>'true' then raise exception 'SESSION_REQUIRED';end if;end$$;
   create function public.business_claims_active(uuid)returns boolean language sql stable as $$select current_setting('test.active',true)='true'$$;
   create function public.business_has_permission(uuid,text)returns boolean language sql stable as $$select current_setting('test.manage',true)='true'$$;
   create function public.business_can_view_claim(uuid,uuid)returns boolean language sql stable as $$select current_setting('test.parent',true)='true'$$;
   create function public.business_can_view_bill_document(uuid,text,uuid)returns boolean language sql stable as $$select current_setting('test.parent',true)='true'$$;
   create table public.business_documents(id uuid,workspace_id uuid,parent_type text,parent_id uuid,storage_path text,status text,archived_at timestamptz,archived_by uuid);
   create table public.business_expense_claims(id uuid,workspace_id uuid,status text);
   create table public.archive_audit(action text);
   create function public.business_record_audit_event(uuid,text,text,uuid,jsonb,jsonb,text)returns void language sql as $$insert into public.archive_audit values($2)$$;`);
  await db.exec(original);await db.exec(`revoke all on function public.archive_business_document(uuid,uuid,text)from public,anon;grant execute on function public.archive_business_document(uuid,uuid,text)to authenticated;grant select on public.business_documents,public.archive_audit to authenticated;`);
  await config({session:true,active:true,manage:true,parent:false});await seed();
  eq((await archive()).rows[0].value,'synthetic-path','reproduce original archive scope bypass');
  await db.exec('reset role');await db.exec(candidate);
  for(const type of ['expense_claim','business_bill','business_bill_payment']){
   await seed(type);await config({session:true,active:true,manage:true,parent:false});
   await assert.rejects(archive(),/BUSINESS_DOCUMENT_SCOPE_REQUIRED/);checks++;
   eq(await scalar(`select status as value from public.business_documents where id='${doc}'`),'active',`${type}: denied archive preserves document`);
   eq(await scalar('select count(*)::int as value from public.archive_audit'),0,`${type}: denied archive emits no mutation audit`);
   await config({parent:true});eq((await archive()).rows[0].value,'synthetic-path',`${type}: authorized archive succeeds`);
  }
  await seed('expense_claim','submitted');await assert.rejects(archive(),/BUSINESS_SUBMITTED_RECEIPT_LOCKED/);checks++;
  await seed('expense_claim','changes_requested');eq((await archive()).rows[0].value,'synthetic-path','changes-requested receipt can be archived');
  await seed();await config({manage:false});await assert.rejects(archive(),/BUSINESS_DOCUMENT_MANAGE_REQUIRED/);checks++;
  await config({manage:true,active:false});await assert.rejects(archive(),/BUSINESS_DOCUMENT_MANAGE_REQUIRED/);checks++;
  await config({active:true,session:false});await assert.rejects(archive(),/SESSION_REQUIRED/);checks++;
  await config({session:true});await archive();await assert.rejects(archive(),/BUSINESS_DOCUMENT_NOT_FOUND/);checks++;
  await db.exec('reset role');eq(await scalar("select has_function_privilege('anon','public.archive_business_document(uuid,uuid,text)','execute')as value"),false,'anonymous denial preserved');
  console.log(`PASS: ${checks} PostgreSQL archive scope assertions; session/parent predicates modeled`);
 }finally{await db.close();}
});
