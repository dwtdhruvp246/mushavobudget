const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(__dirname+'/../app.js','utf8');
function makeContext(){
 let calls=[],refreshed=[],messages=[];
 const button={disabled:false};
 const context={adminBusinessSupport:{userId:'actor',sequence:1,snapshot:{workspace:{id:'selected-workspace',name:'My Business',version:4},subscription:{version:9},current_limit:1},requests:{}},adminBusinessSupportBusy:false,
 state:{session:{user:{id:'actor'}},isAdmin:true,adminRole:'super_admin'},adminDetailsSequence:1,
 FormData:class {get(k){return {total_seats:'10',confirmation_name:'wrong-form-name',reason:'x'}[k]}},
 $:()=>({open:true}),supabase:{rpc:(name,args)=>{calls.push({name,args});return Promise.resolve({})}},
 query:async(_,p)=>p,showToast:message=>messages.push(message),openAdminBusinessSupport:async(id)=>{refreshed.push(id)},
 Number,Math,escapeHtml:value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')};
 vm.createContext(context);
 const helpers=app.slice(app.indexOf('function renderAdminBusinessSeatEditor('),app.indexOf('function renderAdminBusinessSupport('));
 const submit=app.slice(app.indexOf('async function submitAdminBusinessSupport('),app.indexOf("\ndocument.addEventListener('submit',",app.indexOf('async function submitAdminBusinessSupport(')));
 vm.runInContext(helpers+'\n'+submit,context);
 const form={dataset:{businessSupportForm:'seats'},reportValidity:()=>true,querySelector:()=>button,isConnected:true};
 return {context,form,button,calls,refreshed,messages};
}
test('selected workspace editor requires only seats, loads live allowance and escapes its name',()=>{
 const {context}=makeContext();
 const markup=context.renderAdminBusinessSeatEditor({workspace:{name:'A <test> & "business"'},current_limit:10,usage:3},'active');
 assert.match(markup,/value="10"/);assert.match(markup,/min="3"/);
 assert.match(markup,/A &lt;test&gt; &amp; &quot;business&quot;/);
 assert.doesNotMatch(markup,/confirmation_name|name="reason"|textarea/);
 assert.equal((markup.match(/<input /g)||[]).length,1);
 assert.match(markup,/>Save seats</);
 for(const role of ['admin_staff','support_staff','staff']){
  context.state.adminRole=role;assert.equal(context.renderAdminBusinessSeatEditor({workspace:{}},'active'),'');
 }
 context.state.adminRole='super_admin';assert.equal(context.renderAdminBusinessSeatEditor({workspace:{}},'expired'),'');
});
test('save binds to selected snapshot and supplies name and audit note automatically',async()=>{
 const {context,form,calls,refreshed,messages,button}=makeContext();
 await context.submitAdminBusinessSupport(form);
 assert.equal(calls.length,1);const {name,args}=calls[0];
 assert.equal(name,'admin_set_business_seats');assert.equal(args.p_workspace_id,'selected-workspace');
 assert.equal(args.p_confirmation_name,'My Business');assert.equal(args.p_total_seats,10);
 assert.equal(args.p_expected_version,9);assert.ok(!('p_request_id' in args));
 assert.match(args.p_reason,/from 1 to 10 total seats/);
 assert.deepEqual(refreshed,['selected-workspace']);assert.deepEqual(messages,['Seat allowance saved.']);assert.equal(button.disabled,false);
});
test('stale-session and non-admin submissions cannot make a seat request',async()=>{
 for(const mutate of [
  c=>{c.state.adminRole='support_staff'},c=>{c.state.session.user.id='replacement-user'},c=>{c.adminBusinessSupportBusy=true}
 ]){
  const {context,form,calls}=makeContext();mutate(context);await context.submitAdminBusinessSupport(form);assert.equal(calls.length,0);
 }
});
test('server conflict keeps editor available and gives refresh guidance',async()=>{
 const {context,form,button,messages,refreshed}=makeContext();
 context.query=async()=>{throw Error('SUBSCRIPTION_CHANGED_REFRESH_DETAILS')};
 await context.submitAdminBusinessSupport(form);
 assert.deepEqual(refreshed,[]);assert.match(messages[0],/subscription changed.*Refresh details/i);
 assert.equal(button.disabled,false);assert.equal(context.adminBusinessSupportBusy,false);
});
