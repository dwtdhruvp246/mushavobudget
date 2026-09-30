import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8'),source=read('app.js');
const controls=source.slice(source.indexOf('let adminDetailsSequence'),source.indexOf('function openAdminUserDetails('));
function fixture(){
  const nodes=new Map(),node=()=>({textContent:'',innerHTML:'',open:true,classList:{add(){},remove(){}},showModal(){this.open=true;}});
  const context=vm.createContext({Date,crypto,FormData:class{constructor(form){this.values=form.values;}get(k){return this.values[k];}},document:{addEventListener(){}},state:{session:{user:{id:'admin'}},isAdmin:true,adminRole:'super_admin'},$:(s)=>{if(!nodes.has(s))nodes.set(s,node());return nodes.get(s);},escapeHtml:s=>String(s??'').replaceAll('<','&lt;').replaceAll('>','&gt;'),titleCase:s=>s,formatAdminDate:s=>s||'Not set',adminExpiryCountdown:()=>'',adminDetailRows:rows=>rows.map(r=>r.join(':')).join('|'),query:async(label,result)=>await result,showToast(){},supabase:{rpc(){}}});
  vm.runInContext(controls,context);return {context,nodes};
}
const snapshot=()=>({workspace:{id:'w',name:'Company',owner_id:'old',status:'active',version:3},owner:{email:'old@example.com'},subscription:{status:'active',paid_through_at:'2100-01-01'},can_suspend:true,can_transfer:true,members:[{id:'m',user_id:'new',email:'new@example.com',account_status:'active',role:'staff'}],usage:2,current_limit:4,invitation_limit:4,actions:[{reason:'<img onerror=x>',action:'suspend',before_summary:{status:'active'},after_summary:{status:'suspended'}}],action_count:1});
test('Business support controls follow platform roles and pending-payment protection',()=>{
 const {context,nodes}=fixture();
 for(const [role,status,ownership] of [['super_admin',true,true],['admin_staff',true,false],['finance_staff',false,false],['support_staff',false,false]]){
  context.state.adminRole=role;context.renderAdminBusinessSupport(snapshot());const html=nodes.get('#adminDetailsBody').innerHTML;
  assert.equal(html.includes('data-business-support-form="status"'),status);assert.equal(html.includes('data-business-support-form="ownership"'),ownership);assert.ok(!html.includes('<img'));
 }
 context.state.adminRole='super_admin';const s=snapshot();s.pending_payment=true;context.renderAdminBusinessSupport(s);assert.ok(!nodes.get('#adminDetailsBody').innerHTML.includes('data-business-support-form="ownership"'));
});
test('a late Business support snapshot cannot overwrite another details view',async()=>{
 const {context,nodes}=fixture();let resolve;context.supabase.rpc=()=>new Promise(r=>resolve=r);
 const request=context.openAdminBusinessSupport('w');context.showAdminDetails({eyebrow:'User',title:'Other user',body:'Other details'});resolve(snapshot());await request;
 assert.equal(nodes.get('#adminDetailsDialogTitle').textContent,'Other user');assert.equal(vm.runInContext('adminBusinessSupport',context),null);
});
test('a support response from a previous login is discarded',async()=>{
 const {context,nodes}=fixture();let resolve;context.supabase.rpc=()=>new Promise(r=>resolve=r);const request=context.openAdminBusinessSupport('w');context.state.session={user:{id:'other'}};resolve(snapshot());await request;
 assert.equal(nodes.get('#adminDetailsDialogTitle').textContent,'Loading Business workspace');assert.equal(vm.runInContext('adminBusinessSupport',context),null);
});
test('support submissions use captured Owner/version and suppress duplicate clicks',async()=>{
 const {context}=fixture();context.renderAdminBusinessSupport(snapshot());let resolve,calls=[];context.supabase.rpc=(name,args)=>{calls.push({name,args});return new Promise(r=>resolve=r);};context.openAdminBusinessSupport=async()=>{};
 const button={disabled:false},form={dataset:{businessSupportForm:'ownership'},values:{member_id:'m',confirmation_email:'new@example.com',confirmation_name:'Company',reason:'Verified support case'},reportValidity:()=>true,querySelector:()=>button,isConnected:true};
 const first=context.submitAdminBusinessSupport(form);await context.submitAdminBusinessSupport(form);assert.equal(calls.length,1);assert.equal(calls[0].args.p_expected_owner_id,'old');assert.equal(calls[0].args.p_expected_version,3);assert.ok(calls[0].args.p_request_id);resolve('done');await first;assert.equal(button.disabled,false);
});
test('consolidated schema contains the exact Stage 11 migration',()=>assert.ok(read('supabase/schema.sql').includes(read('supabase/migrations/20260930110000_business_stage_11_admin.sql'))));
