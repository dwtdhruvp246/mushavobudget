const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(path.join(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES,'playwright'));
const root=path.join(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('business.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'').replace(/<link\b[^>]*>/g,'');
const source=read('business.js').replace(/^import .*;$/m,'').replace(/const supabase = isConfigured[^;]+;/,'const supabase=window.fixtureSupabase;').replace(/\nloadBusinessAccess\(\);\s*$/,'');
(async()=>{const browser=await chromium.launch({executablePath:process.env.MUSHAVO_CHROMIUM_EXECUTABLE,args:['--no-sandbox']});try{
 for(const width of [320,390,1366]){
  const page=await browser.newPage({viewport:{width,height:800}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://localhost/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://localhost/business.html#business/team');await page.addStyleTag({content:read('business.css')});
  await page.addScriptTag({content:`window.setInterval=()=>0;window.calls=[];window.deliveries=[];
   window.MushavoPWA={beginOperation:()=>()=>{},markFormClean(){},hasUnsavedChanges:()=>false};
   window.fixtureRoles={roles:[{code:'staff',name:'Staff',scope_mode:'legacy',is_system:true,status:'active',version:1,members:1,invitations:0,permissions:['workspace.view','finance.create']},{code:'finance_manager',name:'Finance Manager',scope_mode:'legacy',is_system:true,status:'active',version:1,members:0,invitations:0,permissions:['workspace.view','finance.view_all','reports.view','reports.export']}],
    permissions:['workspace.view','finance.create','finance.view_all','reports.view','reports.export','team.view','team.manage'].map(code=>({permission_code:code,display_name:code,description:'Permission description',permission_group:code.split('.')[0],editable:true})),overrides:[],can_manage:true};
   window.fixtureSupabase={rpc:async(name,args)=>{calls.push({name,args});
    if(name==='business_roles_snapshot')return {data:fixtureRoles};
    if(name==='save_business_role'){const role={code:args.p_code||'custom_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',name:args.p_name,description:args.p_description,scope_mode:args.p_scope_mode,is_system:false,status:'active',version:2,members:0,invitations:0,permissions:args.p_permissions};fixtureRoles.roles=fixtureRoles.roles.filter(r=>r.code!==role.code);fixtureRoles.roles.push(role);return {data:role};}
    if(name==='create_business_invitation')return {data:{invitation_id:'invite-id',email:args.p_email}};
    if(name==='business_team_snapshot')return {data:state.teamSnapshot};return {data:[]};},functions:{invoke:async(name,args)=>{deliveries.push(args.body);return {data:{email:'new@example.com'}};}}};
   ${source}
   state.session={user:{id:'owner',email:'owner@example.com'}};state.profile={full_name:'Owner'};
   state.workspace={id:'company',name:'Company',owner_id:'owner',workspace_type:'business',status:'active'};state.workspaces=[state.workspace];state.memberships=[{workspace_id:'company',user_id:'owner',role:'business_owner',status:'active'}];
   state.workspaceSubscription={status:'active',paid_through_at:'2099-01-01T00:00:00Z'};state.businessProfile={onboarding_status:'complete',trading_name:'Company'};
   state.workspaceSettings={base_currency:'USD',enabled_currencies:['USD'],timezone:'UTC'};state.supportedCurrencies=[{code:'USD',name:'US dollar'}];
   state.businessDimensions=[{id:'branch',name:'Harare',status:'active',dimension_type:'branch'}];
   state.teamSnapshot={can_manage:true,can_transfer:true,members:[{id:'member',user_id:'staff',full_name:'Staff person',email:'staff@example.com',role:'staff',scope_ids:[]}],invitations:[],capacity:{available:5}};
   state.roleSnapshot=fixtureRoles;state.rolesAttempted=true;renderBusinessWorkspace();
  `});
  assert(await page.locator('#businessRolesCard').isVisible());await page.locator('#addBusinessRole').click();
  await page.locator('#businessRoleName').fill('Branch Supervisor');await page.locator('#businessRoleScope').selectOption('assigned');
  await page.locator('#businessRolePermissionChoices input[value="reports.export"]').check();
  assert(await page.locator('#businessRolePermissionChoices input[value="reports.view"]').isChecked());
  await page.locator('#businessRoleForm button[type=submit]').click();await page.waitForFunction(()=>!document.querySelector('#businessRoleDialog').open);
  const saved=await page.evaluate(()=>calls.find(c=>c.name==='save_business_role').args);assert.equal(saved.p_scope_mode,'assigned');assert(saved.p_permissions.includes('reports.view'));
  assert.equal(await page.locator('#businessInviteRole option[value="custom_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"]').innerText(),'Branch Supervisor');
  await page.locator('[data-edit-business-member=member]').click();await page.locator('#businessInviteRole').selectOption('custom_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  assert.match(await page.locator('#businessInviteScopeHelp').innerText(),/at least one/);
  await page.locator('#businessInviteScopes input[value=branch]').check();await page.locator('#businessMemberPermissionChoices select[data-permission="reports.view"]').selectOption('deny');
  assert.match(await page.locator('[data-permission-status="reports.export"]').innerText(),/Not allowed/);
  await page.locator('#saveBusinessInvitation').click();await page.waitForFunction(()=>!document.querySelector('#businessInviteDialog').open);
  const access=await page.evaluate(()=>calls.find(c=>c.name==='update_business_member_role_access').args);assert.deepEqual(access.p_scope_ids,['branch']);assert(access.p_overrides.some(p=>p.permission_code==='reports.view'&&p.effect==='deny'));
  // A custom invitation uses the existing deployed mail delivery path.
  await page.locator('#inviteBusinessMember').click();await page.locator('#businessInviteEmail').fill('new@example.com');await page.locator('#businessInviteRole').selectOption('custom_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');await page.locator('#businessInviteScopes input[value=branch]').check();
  await page.locator('#saveBusinessInvitation').click();await page.waitForFunction(()=>deliveries.length===1);assert.deepEqual(await page.evaluate(()=>deliveries[0]),{action:'resend',invitation_id:'invite-id'});
  await page.waitForFunction(()=>!document.querySelector('#businessInviteDialog').open);
  await page.locator('[data-edit-business-role=staff]').click();assert(await page.locator('#businessRoleName').isDisabled());assert(await page.locator('#businessRoleScope').isDisabled());await page.locator('#businessRoleDialog [data-close-role]').last().click();
  await page.locator('#addBusinessRole').click();await page.locator('#businessRoleCopy').selectOption('finance_manager');assert.equal(await page.locator('#businessRoleScope').inputValue(),'all');assert(await page.locator('#businessRolePermissionChoices input[value="finance.view_all"]').isChecked());
  const sizes=await page.evaluate(()=>({page:document.documentElement.scrollWidth,dialog:document.querySelector('#businessRoleDialog').scrollWidth,client:document.querySelector('#businessRoleDialog').clientWidth}));assert(sizes.page<=width+1);assert(sizes.dialog<=sizes.client+1, JSON.stringify(sizes)+' '+JSON.stringify(await page.locator('#businessRoleDialog').evaluate(d=>[...d.querySelectorAll('*')].filter(e=>e.getBoundingClientRect().right>d.getBoundingClientRect().right).map(e=>({tag:e.tagName,id:e.id,width:e.getBoundingClientRect().width})))));
  await page.locator('#businessRoleDialog [data-close-role]').last().click();
  // Names are rendered as text; staff cannot use Owner role controls.
  await page.evaluate(()=>{fixtureRoles.roles[0].name='<img src=x onerror=alert(1)>';state.session.user.id='staff';state.memberships=[{workspace_id:'company',user_id:'staff',role:'staff',status:'active'}];fixtureRoles.can_manage=false;renderTeam();});assert.equal(await page.locator('#businessRolesCard').isVisible(),false);assert.equal(await page.locator('#businessRolesList img').count(),0);
  assert.deepEqual(errors,[]);console.log('PASS '+width+'px: role creation, dependent permissions, scopes, atomic exceptions, custom invitations, built-in protection, copying, safe text and staff restrictions');await page.close();
 }
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
