import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const source=read('business.js'),migration=read('supabase/migrations/20261004153000_business_custom_roles.sql');
const start=source.indexOf('const ROLE_OWN_BLOCKED'),end=source.indexOf('async function refreshBusinessRoles()',start);
const context=vm.createContext({Set});vm.runInContext(source.slice(start,end),context);
test('a member deny overrides the role and disables dependent actions',()=>{
  assert.equal(context.rolePermissionAllowed('reports.export',['reports.view','reports.export'],[{permission_code:'reports.view',effect:'deny'}],'assigned'),false);
  assert.equal(context.rolePermissionAllowed('finance.record_payment',['finance.record_payment'],[],'all'),false);
});
test('individual exceptions grant only actions permitted by the data scope',()=>{
  assert.equal(context.rolePermissionAllowed('reports.view',[],[{permission_code:'reports.view',effect:'allow'}],'own'),true);
  assert.equal(context.rolePermissionAllowed('finance.view_all',[],[{permission_code:'finance.view_all',effect:'allow'}],'own'),false);
  assert.equal(context.rolePermissionAllowed('approvals.view',['approvals.view'],[],'own'),false);
});
test('custom-role migration preserves built-in and Personal/Family role validation',()=>{
  assert(read('supabase/schema.sql').includes(migration));
  assert.match(migration,/INVALID_HOUSEHOLD_ROLE/);assert.match(migration,/INVALID_PERSONAL_ROLE/);
  assert.match(migration,/business_roles_name_unique/);assert.match(migration,/BUSINESS_SYSTEM_ROLE_PROTECTED/);
});
test('role snapshots from another selected company are discarded',async()=>{
  let resolve,renders=0;
  const f=vm.createContext({state:{workspace:{id:'one'},locked:false},workspaceLoadSequence:1,query:()=>new Promise(r=>resolve=r),supabase:{rpc(){}},renderBusinessRoles(){renders++;},renderTeam(){},renderIdentity(){},friendlyMessage:e=>e.message});
  const a=source.indexOf('async function refreshBusinessRoles()'),b=source.indexOf('function renderBusinessRoles()',a);vm.runInContext(source.slice(a,b),f);
  const pending=f.refreshBusinessRoles();f.state.workspace={id:'two'};f.workspaceLoadSequence=2;resolve({roles:[{code:'private-role'}]});await pending;
  assert.equal(f.state.roleSnapshot,undefined);assert.equal(renders,0);
});
test('missing migration keeps the existing team usable and disables custom-role controls',async()=>{
  let renders=0;const f=vm.createContext({state:{workspace:{id:'one'},locked:false},workspaceLoadSequence:1,query:async()=>{throw new Error('PGRST202');},supabase:{rpc(){}},renderBusinessRoles(){renders++;},renderTeam(){},renderIdentity(){},friendlyMessage:e=>e.message});
  const a=source.indexOf('async function refreshBusinessRoles()'),b=source.indexOf('function renderBusinessRoles()',a);vm.runInContext(source.slice(a,b),f);await f.refreshBusinessRoles();
  assert.equal(f.state.roleSnapshot,null);assert.match(f.state.rolesError,/database update/);assert.equal(renders,1);
});
