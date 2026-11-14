const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync(__dirname+'/../app.js','utf8');
test('seat submission uses subscription version and absolute total, then reloads details',async()=>{
 const source=app.slice(app.indexOf('async function submitAdminBusinessSupport('),app.indexOf("\ndocument.addEventListener('submit',",app.indexOf('async function submitAdminBusinessSupport(')));
 let called,refreshed;const button={disabled:false};
 const ctx={adminBusinessSupport:{userId:'actor',sequence:1,snapshot:{workspace:{id:'workspace',version:4},subscription:{version:9}},requests:{}},adminBusinessSupportBusy:false,
 state:{session:{user:{id:'actor'}},isAdmin:true,adminRole:'super_admin'},adminDetailsSequence:1,
 FormData:class {get(k){return {total_seats:'5',confirmation_name:'Test',reason:'Test allowance'}[k]}},
 $:()=>({open:true}),supabase:{rpc:(name,args)=>{called={name,args};return Promise.resolve({})}},
 query:async(_,p)=>p,showToast:()=>{},openAdminBusinessSupport:async(id)=>{refreshed=id}};
 vm.createContext(ctx);vm.runInContext(source,ctx);
 const form={dataset:{businessSupportForm:'seats'},reportValidity:()=>true,querySelector:()=>button,isConnected:true};
 await ctx.submitAdminBusinessSupport(form);
 assert.equal(called.name,'admin_set_business_seats');assert.equal(called.args.p_expected_version,9);
 assert.equal(called.args.p_total_seats,5);assert.ok(!('p_request_id' in called.args));assert.equal(refreshed,'workspace');assert.equal(button.disabled,false);
 called=null;ctx.state.adminRole='support_staff';await ctx.submitAdminBusinessSupport(form);assert.equal(called,null);
});
