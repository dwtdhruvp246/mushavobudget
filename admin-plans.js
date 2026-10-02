// Admin catalogue editor. All mutations go through protected, atomic RPCs.
export const PLAN_LABELS = {
  'payments.recurring':'Recurring payments','receipts.upload':'Receipt uploads','finance.analytics':'Finance analytics',
  'reports.advanced':'Advanced reports','export.csv':'CSV export','export.pdf':'Print / PDF',
  'members.invite':'Member invitations','approvals.enabled':'Approval controls','audit.full_history':'Full audit history'
};
export function priceState(price, at=Date.now()) {
  if (!price.is_active) return 'Archived';
  if (Date.parse(price.effective_from)>at) return 'Scheduled';
  if (price.effective_until && Date.parse(price.effective_until)<=at) return 'Previous';
  return 'Current';
}
export function validatePlanDraft(draft, currencies, snapshot=null) {
  const errors={}; const d=draft.definition,b=draft.business,p=draft.price;
  const required=(key,value,message)=>{if(!String(value??'').trim())errors[key]=message;};
  required('name',d.display_name,'Enter a plan name.');
  if(!/^[a-z][a-z0-9_]{0,39}$/.test(d.code||''))errors.code='Use a permanent code starting with a letter, with lowercase letters, numbers or underscores.';
  if(!Number.isInteger(d.sort_order)||d.sort_order<0||d.sort_order>10000)errors.sort='Enter a display order between 0 and 10,000.';
  for(const [key,value,max] of [['name',d.display_name,80],['description',d.description,500],['marketing',d.marketing_summary,500],['cta',d.cta_label,60]])if(String(value??'').length>max)errors[key]=`Use at most ${max} characters.`;
  required('description',d.description,'Enter the application description.');required('marketing',d.marketing_summary,'Enter the customer pricing summary.');required('cta',d.cta_label,'Enter customer button text.');
  if(d.workspace_type!=='business'&&(!Number.isInteger(d.included_member_seats)||d.included_member_seats<1||d.included_member_seats>100))errors.seats='Include between 1 and 100 people, counting the Owner/head.';
  if(d.active_payment_limit!==null&&(!Number.isInteger(d.active_payment_limit)||d.active_payment_limit<1||d.active_payment_limit>100000))errors.limit='Enter a whole-number payment limit, or leave blank for unlimited.';
  if(d.code==='free'&&d.active_payment_limit!==5)errors.limit='The Free plan must retain its five-payment limit.';
  if(snapshot && d.workspace_type!==snapshot.plan.workspace_type)errors.type='An existing plan cannot change workspace type.';
  if(d.workspace_type==='business'&&d.available_for_purchase&&!snapshot?.purchase_enabled)errors.purchasable='Public Business purchase is closed. Pilot billing is configured separately.';
  const validCurrency=c=>currencies.some(x=>x.code===c&&x.is_active!==false);
  const amount=(v,nullable=false)=>nullable&&v===null||typeof v==='number'&&Number.isFinite(v)&&v>=0;
  if(b){
    if(!validCurrency(b.currency))errors.bcurrency='Choose an active supported currency.';
    if(b.included_seats!==null&&(!Number.isInteger(b.included_seats)||b.included_seats<1||b.included_seats>100))errors.bseats='Include between 1 and 100 seats.';
    for(const [k,label] of [['monthly_base','Monthly base'],['annual_base','Annual base'],['monthly_seat','Monthly extra seat'],['annual_seat','Annual extra seat']])if(!amount(b[k],true))errors[k]=label+' must be zero or greater, or blank if unconfigured.';
    if(b.pilot_enabled){
      if(b.included_seats===null)errors.bseats='Enter included seats before enabling pilot billing.';
      required('instructions',b.payment_instructions,'Enter payment instructions before enabling pilot billing.');
      if(!((b.monthly_base!==null&&b.monthly_seat!==null)||(b.annual_base!==null&&b.annual_seat!==null)))errors.monthly_base='Configure both the base and extra-seat price for at least one billing cycle.';
    }
    if(b.payment_instructions.length>4000)errors.instructions='Payment instructions must be at most 4,000 characters.';
  }
  if(p){
    if(d.code==='free'||d.workspace_type==='business')errors.amount='Use the pricing controls for this plan type.';
    if(!validCurrency(p.currency))errors.currency='Choose an active supported currency.';
    if(!Number.isFinite(p.amount)||p.amount<=0)errors.amount='Paid Personal/Family plans require a base price greater than zero.';
    if(!amount(p.extra_member_amount))errors.extra='Extra-person price must be zero or greater.';
    if(p.effective_from&&(!Number.isFinite(Date.parse(p.effective_from))||Date.parse(p.effective_from)<Date.now()-60000))errors.effective='Choose a future date and time, or publish immediately.';
    if(snapshot?.prices.some(x=>x.currency===p.currency&&x.billing_period===p.billing_period&&priceState(x)==='Scheduled'))errors.effective='Cancel the existing scheduled price in History before publishing another for this currency and cycle.';
  }
  return errors;
}
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const number=v=>String(v).trim()===''?null:Number(v);
const money=(v,c)=>{try{return new Intl.NumberFormat(undefined,{style:'currency',currency:c}).format(Number(v));}catch{return c+' '+Number(v).toFixed(2);}};
const date=v=>v?new Date(v).toLocaleString():'Immediately';
const friendly={PLAN_SETTINGS_CHANGED:'This plan changed in another session. Reload the plan before saving; your entries have been retained.',BUSINESS_BILLING_SETTINGS_CHANGED:'Business billing changed in another session. Reload before saving.',SCHEDULED_PRICE_EXISTS:'A price is already scheduled for this currency and cycle. Cancel it in History first.',INVALID_BUSINESS_BILLING_SETTINGS:'Business billing settings are incomplete. Check currency, seats, prices and payment instructions.',BUSINESS_PUBLIC_PURCHASE_CLOSED:'Public Business purchase remains closed. Enable private pilot billing instead.',INVALID_PRICE_START:'Choose a date within the next year, or publish immediately.',PLAN_MANAGEMENT_ACCESS_REQUIRED:'Your account does not have permission to manage plans.',FREE_PLAN_LIMIT_REQUIRED:'The Free plan must retain its five-payment limit.'};
export function createAdminPlans(root,api){
  let selected=null,snapshot=null,baseline='',tab='details',epoch=0,busy=false,newPlan=false,filter='',review=null;
  const $=s=>root.querySelector(s);const user=()=>api.userId();
  const field=(key,label,value='',extra='',type='text')=>`<label class="ap-field" for="ap-${key}">${label}<input id="ap-${key}" data-key="${key}" type="${type}" value="${esc(value??'')}" ${extra} aria-describedby="ap-error-${key}"><small id="ap-error-${key}" class="ap-error"></small></label>`;
  const check=(key,label,value,extra='')=>`<label class="ap-check"><input id="ap-${key}" data-key="${key}" type="checkbox" ${value?'checked':''} ${extra}>${label}</label><small id="ap-error-${key}" class="ap-error"></small>`;
  function currencies(value,key){return `<label class="ap-field" for="ap-${key}">Currency<select id="ap-${key}" data-key="${key}" aria-describedby="ap-error-${key}">${api.currencies().map(x=>`<option ${x.code===value?'selected':''} value="${esc(x.code)}">${esc(x.code)} — ${esc(x.name||x.code)}</option>`).join('')}</select><small id="ap-error-${key}" class="ap-error"></small></label>`;}
  function catalogue(){
    const plans=api.plans().filter(p=>(p.display_name+' '+p.workspace_type+' '+p.code).toLowerCase().includes(filter.toLowerCase()));
    $('#ap-catalogue').innerHTML=plans.map(p=>`<button type="button" class="ap-plan ${p.id===selected?'selected':''}" data-select="${esc(p.id)}" aria-pressed="${p.id===selected}"><strong>${esc(p.display_name)}</strong><span>${p.workspace_type==='household'?'Family':esc(p.workspace_type)} · ${!p.is_active?'Archived':p.workspace_type==='business'&&!p.available_for_purchase?'Private pilot':p.available_for_purchase?'Purchasable':'Sales closed'}</span><small>${p.is_public?'Shown on Pricing':'Hidden from Pricing'}</small></button>`).join('')||'<p>No matching plans.</p>';
  }
  function skeleton(){root.innerHTML=`<div class="ap-heading"><div><p class="eyebrow">Catalogue management</p><h2>Plans &amp; pricing</h2><p class="muted-copy">Manage each plan, its prices and customer availability in one place.</p></div><button type="button" data-new>Add plan</button></div><div class="ap-layout"><aside class="ap-catalogue"><label for="ap-search">Find a plan<input id="ap-search" type="search" data-pwa-ignore-dirty="true" placeholder="Name or workspace type" value="${esc(filter)}"></label><div id="ap-catalogue"></div></aside><section id="ap-editor" class="ap-editor"><p role="status">Select a plan to manage.</p></section></div><dialog id="ap-review" class="payment-dialog ap-dialog"><div id="ap-review-body"></div><div class="button-row"><button type="button" data-publish class="primary">Publish changes</button><button type="button" data-close-review>Keep editing</button></div></dialog>`;catalogue();}
  function activePrice(period,currency){return snapshot?.prices.filter(p=>p.billing_period===period&&p.currency===currency&&priceState(p)==='Current').sort((a,b)=>Date.parse(b.effective_from)-Date.parse(a.effective_from))[0];}
  function editor(){
    const p=snapshot?.plan||{display_name:'',code:'',workspace_type:'personal',description:'',marketing_summary:'',sort_order:0,is_active:true,is_public:false,is_featured:false,available_for_purchase:false,cta_label:'Choose plan'};
    const b=snapshot?.business||{currency:'USD',included_seats:null,pilot_enabled:false,monthly_base:null,annual_base:null,monthly_seat:null,annual_seat:null,payment_instructions:''};
    const business=p.workspace_type==='business';const free=p.code==='free';const limits=snapshot?.limits||[];
    const seats=limits.find(x=>x.limit_code==='included_member_seats')?.limit_value??1;
    const limit=limits.find(x=>x.limit_code==='active_planned_payments')?.limit_value??null;
    const features=new Set((snapshot?.features||[]).filter(x=>x.enabled).map(x=>x.feature_code));
    const labels={...PLAN_LABELS};for(const f of snapshot?.features||[])labels[f.feature_code]||=f.feature_code;
    $('#ap-editor').innerHTML=`<header class="ap-editor-heading"><div><h3>${newPlan?'New plan':esc(p.display_name)}</h3><p>${business?'Business settings apply to existing pilot workspaces. Public purchase stays closed.':free?'Free personal access · five active payments':'Prices and customer presentation for this plan.'}</p></div><div class="ap-actions"><span id="ap-dirty" role="status">Saved</span><button type="button" data-reload ${newPlan?'disabled':''}>Reload plan</button></div></header><div class="ap-tabs" role="tablist" aria-label="Plan settings">${['details','pricing','features','availability','history'].map(t=>`<button type="button" role="tab" id="ap-tab-${t}" data-tab="${t}" aria-controls="ap-panel-${t}" aria-selected="false">${({details:'Details',pricing:'Pricing & seats',features:'Features & limits',availability:'Availability',history:'History'})[t]}</button>`).join('')}</div><p id="ap-message" class="ap-message hidden" role="alert"></p><form id="ap-form" novalidate>
    <section id="ap-panel-details" role="tabpanel" aria-labelledby="ap-tab-details" class="ap-panel"><div class="ap-fields">${field('name','Plan name',p.display_name,'maxlength="80" required')}${field('code','Permanent code',p.code,newPlan?'maxlength="40" required':'readonly')}
    <label class="ap-field">Workspace type<select id="ap-type" data-key="type" ${newPlan?'':'disabled'}>${['personal','household','business'].map(t=>`<option value="${t}" ${p.workspace_type===t?'selected':''}>${t==='household'?'Family':t==='business'?'Business':'Personal'}</option>`).join('')}</select><small id="ap-error-type" class="ap-error"></small></label>${field('sort','Display order',p.sort_order,'min="0" max="10000" step="1"','number')}
    <label class="ap-field ap-wide">Application description<textarea id="ap-description" data-key="description" maxlength="500" rows="3">${esc(p.description)}</textarea><small id="ap-error-description" class="ap-error"></small></label><label class="ap-field ap-wide">Public pricing summary<textarea id="ap-marketing" data-key="marketing" maxlength="500" rows="3">${esc(p.marketing_summary)}</textarea><small id="ap-error-marketing" class="ap-error"></small></label>${field('cta','Customer button text',p.cta_label,'maxlength="60"')}
    </div></section>
    <section id="ap-panel-pricing" role="tabpanel" aria-labelledby="ap-tab-pricing" class="ap-panel"><div id="ap-pricing-body"></div>
    <div id="ap-business-pricing" class="${business?'':'hidden'}"><div class="ap-fields">${currencies(b.currency,'bcurrency')}${field('bseats','Seats included, counting Owner',b.included_seats,'min="1" max="100" step="1"','number')}${field('monthly_base','Monthly base price',b.monthly_base,'min="0" step="0.01"','number')}${field('monthly_seat','Extra seat per monthly term',b.monthly_seat,'min="0" step="0.01"','number')}${field('annual_base','Annual base price',b.annual_base,'min="0" step="0.01"','number')}${field('annual_seat','Extra seat per annual term',b.annual_seat,'min="0" step="0.01"','number')}<label class="ap-field ap-wide">Payment instructions<textarea id="ap-instructions" data-key="instructions" maxlength="4000" rows="3">${esc(b.payment_instructions)}</textarea><small id="ap-error-instructions" class="ap-error"></small></label></div><p class="ap-help">Blank means unconfigured; zero is an intentional no-charge price. Configure both prices for every cycle you enable. Additional seats use remaining-term proration and keep the same expiry.</p></div>
    <div id="ap-standard-pricing" class="${business||free?'hidden':''}"><div id="ap-price-cards" class="ap-price-cards"></div><button type="button" data-add-price>Publish a new price</button><div id="ap-new-price" class="hidden"><div class="ap-fields">${currencies(api.currencies()[0]?.code||'USD','currency')}<label class="ap-field">Billing period<select id="ap-period" data-key="period"><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>${field('amount','Base subscription price','','min="0.01" step="0.01"','number')}${field('extra','Additional person per month',0,'min="0" step="0.01"','number')}${field('effective','Effective from (UTC; blank = immediately)','','','datetime-local')}</div><p class="ap-help">Family annual extra-person pricing multiplies the monthly rate by 12. Mid-term Family additions use its purchase-anchored half-month rule.</p><button type="button" data-remove-price>Discard new price</button></div></div>
    <p id="ap-free-price" class="${free?'':'hidden'}">Free access has no paid price.</p><details id="ap-calculator" class="ap-calculator ${free||newPlan?'hidden':''}"><summary>Calculate an example subscription or added seats</summary><div class="ap-fields"><label class="ap-field">Cycle<select id="ap-calc-period"><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>${currencies(business?b.currency:api.currencies()[0]?.code||'USD','calc-currency')}${field('calc-total','Total people, including Owner/head',5,'min="1" max="100"','number')}${field('calc-extra','Seats added mid-term',1,'min="1" max="100"','number')}${field('calc-start','Term starts (UTC)',new Date().toISOString().slice(0,16),'','datetime-local')}${field('calc-end','Term ends (UTC)',new Date(Date.now()+30*86400000).toISOString().slice(0,16),'','datetime-local')}${field('calc-at','Addition date (UTC)',new Date(Date.now()+15*86400000).toISOString().slice(0,16),'','datetime-local')}</div><button type="button" data-calculate>Calculate using billing rules</button><p id="ap-calc-result" role="status"></p></details>
    </section>
    <section id="ap-panel-features" role="tabpanel" aria-labelledby="ap-tab-features" class="ap-panel"><h4>Included catalogue features</h4><p class="ap-help">These entries appear on public and signed-in plan comparisons. Finance analytics controls Personal/Family finance access. Other entries describe supported tools; Business operating permissions are managed under Team and do not change when these labels are edited.</p><div class="ap-feature-list">${Object.entries(labels).map(([code,label])=>`<label class="ap-check"><input type="checkbox" data-feature="${esc(code)}" ${features.has(code)?'checked':''}>${esc(label)}</label>`).join('')}</div><div class="ap-fields">${field('seats','People included, counting Owner/head',seats,business?'readonly':'min="1" max="100"','number')}${field('limit','Active payment limit (blank = unlimited)',free?5:limit,free?'readonly':business?'disabled':'min="1" max="100000"','number')}</div><p class="ap-help">${business?'Business seat capacity is edited in Pricing & seats. Personal payment limits do not govern Business financial records.':'Feature access and payment-limit changes apply to current subscribers on their next access refresh. Paid dates and purchased workspace seats remain intact.'}</p></section>
    <section id="ap-panel-availability" role="tabpanel" aria-labelledby="ap-tab-availability" class="ap-panel">${check('active','Active in the application',p.is_active,free?'disabled':'')}${check('public','Show on public Pricing',p.is_public)}${check('featured','Show as recommended',p.is_featured)}${check('purchasable','Available for public purchase',p.available_for_purchase,business&&!snapshot?.purchase_enabled?'disabled':'')}<div id="ap-pilot-control" class="${business?'':'hidden'}">${check('pilot','Enable billing for existing pilot Business workspaces',b.pilot_enabled)}<p class="ap-help">Public Business purchase and workspace creation are separate release controls. This editor cannot unlock either.</p></div><p class="ap-help">Close new sales with purchase availability. Existing finance data, paid-through dates and member seats are not removed.</p></section>
    <section id="ap-panel-history" role="tabpanel" aria-labelledby="ap-tab-history" class="ap-panel"><h4>Price versions</h4><div id="ap-price-history"></div><h4>Recent changes</h4><div id="ap-audit"></div></section>
    <footer class="ap-footer"><span>Changes affect this plan. Existing invoice amounts remain recorded.</span><div class="ap-actions"><button type="button" data-preview>Preview customer view</button><button class="primary" id="ap-save" type="submit">Review changes</button></div></footer></form><dialog id="ap-preview" class="payment-dialog ap-dialog"><div class="ap-preview-controls"><label>View<select id="ap-preview-view"><option value="public">Public Pricing</option><option value="signed">Signed-in Subscription</option></select></label><label>Cycle<select id="ap-preview-period"><option value="monthly">Monthly</option><option value="annual">Annual</option></select></label>${currencies(business?b.currency:api.currencies()[0]?.code||'USD','preview-currency')}</div><p class="ap-help">Proposed catalogue presentation. Member permissions and subscription status still determine actual access.</p><div id="ap-preview-body"></div><button type="button" data-close-preview>Close preview</button></dialog>`;
    tab=free&&tab==='pricing'?'features':tab;setTab(tab);$('#ap-extra').closest('label').classList.toggle('hidden',p.workspace_type!=='household');
    renderPrices();renderHistory();baseline=JSON.stringify(read());markDirty();
  }
  function read(){
    const v=k=>$('#ap-'+k)?.value??'';const ck=k=>$('#ap-'+k)?.checked||false;const type=v('type');
    const definition={code:v('code').trim().toLowerCase(),display_name:v('name').trim(),workspace_type:type,description:v('description').trim(),marketing_summary:v('marketing').trim(),cta_label:v('cta').trim(),sort_order:Number(v('sort')),included_member_seats:number(v('seats')),active_payment_limit:number(v('limit')),is_active:ck('active'),is_public:ck('public'),is_featured:ck('featured'),available_for_purchase:ck('purchasable'),feature_codes:[...root.querySelectorAll('[data-feature]:checked')].map(x=>x.dataset.feature).sort()};
    const business=type==='business'?{currency:v('bcurrency'),included_seats:number(v('bseats')),monthly_base:number(v('monthly_base')),annual_base:number(v('annual_base')),monthly_seat:number(v('monthly_seat')),annual_seat:number(v('annual_seat')),payment_instructions:v('instructions').trim(),pilot_enabled:ck('pilot')}:null;
    const price=!$('#ap-new-price').classList.contains('hidden')?{billing_period:v('period'),currency:v('currency'),amount:number(v('amount')),extra_member_amount:type==='household'?number(v('extra')):0,effective_from:v('effective')?v('effective')+':00Z':null}:null;
    return {definition,business,price};
  }
  function dirty(){return !!baseline&&JSON.stringify(read())!==baseline || newPlan&&!baseline&&Boolean($('#ap-name')?.value || $('#ap-code')?.value);}
  function markDirty(){if($('#ap-dirty'))$('#ap-dirty').textContent=dirty()?'Unsaved changes':'Saved';}
  function message(text){const e=$('#ap-message');if(e){e.textContent=text;e.classList.toggle('hidden',!text);}}
  function setTab(value){tab=value;root.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.tab===tab)));root.querySelectorAll('[role=tabpanel]').forEach(p=>p.hidden=p.id!=='ap-panel-'+tab);}
  function renderPrices(){const prices=(snapshot?.prices||[]).filter(x=>priceState(x)==='Current');$('#ap-price-cards').innerHTML=prices.map(x=>`<article><span>${esc(x.currency)} · ${x.billing_period==='annual'?'Annual':'Monthly'}</span><strong>${money(x.amount,x.currency)}</strong><small>${Number(x.extra_member_amount)>0?money(x.extra_member_amount,x.currency)+' per extra person/month':'No additional-person charge'}</small><small>Effective ${esc(date(x.effective_from))}</small></article>`).join('')||'<p>No current prices configured.</p>';}
  function renderHistory(){
    $('#ap-price-history').innerHTML=(snapshot?.prices||[]).slice().reverse().map(x=>`<article class="ap-history-row"><div><strong>${money(x.amount,x.currency)} · ${esc(x.billing_period)}</strong><small>${esc(date(x.effective_from))} → ${x.effective_until?esc(date(x.effective_until)):'No end date'}</small></div><span>${priceState(x)}</span>${priceState(x)==='Scheduled'?`<button type="button" data-cancel-price="${esc(x.id)}">Cancel scheduled price</button>`:''}</article>`).join('')||'<p>No catalogue price history.</p>';
    $('#ap-audit').innerHTML=(snapshot?.history||[]).map(x=>`<article class="ap-history-row"><div><strong>${esc(x.action.replaceAll('.',' ').replaceAll('_',' '))}</strong><small>${esc(date(x.created_at))} · actor ${esc(x.actor_id||'System')}</small>${x.safe_details?`<details><summary>View recorded changes</summary><pre class="ap-audit-values">${esc(JSON.stringify(x.safe_details,null,2))}</pre></details>`:''}</div></article>`).join('')||'<p>No changes recorded yet.</p>';
  }
  async function select(id,force=false){
    if(busy)return;if(!force&&dirty()&&!await api.confirm({title:'Unsaved plan changes',message:'Discard your unsaved entries and open the selected plan?',action:'Discard changes'}))return;
    const token=++epoch,actor=user();selected=id;newPlan=false;baseline='';snapshot=null;catalogue();$('#ap-editor').innerHTML='<p role="status">Loading plan settings…</p>';
    try{const data=await api.rpc('admin_plan_workbench_snapshot',{p_plan_id:id});if(token!==epoch||actor!==user())return;snapshot=data;editor();}
    catch(e){if(token!==epoch||actor!==user())return;$('#ap-editor').innerHTML=`<p role="alert">${esc(friendly[e.message]||e.message)}</p><button type="button" data-retry>Retry loading</button>`;}
  }
  async function startNew(){if(busy)return;if(dirty()&&!await api.confirm({title:'Unsaved plan changes',message:'Discard changes and add a new plan?',action:'Discard changes'}))return;++epoch;selected=null;newPlan=true;snapshot=null;tab='details';catalogue();editor();}
  function showErrors(errors){root.querySelectorAll('.ap-error').forEach(x=>x.textContent='');root.querySelectorAll('[aria-invalid]').forEach(x=>x.removeAttribute('aria-invalid'));for(const[k,msg]of Object.entries(errors)){const field=$('#ap-'+k),error=$('#ap-error-'+k);if(error)error.textContent=msg;if(field)field.setAttribute('aria-invalid','true');}const first=Object.keys(errors)[0];if(first){message('Check the highlighted fields before publishing.');const field=$('#ap-'+first);const panel=field?.closest('[role=tabpanel]');if(panel)setTab(panel.id.replace('ap-panel-',''));field?.focus();return true;}message('');return false;}
  function preview(){
    const {definition:d,business:b,price:p}=read();const period=$('#ap-preview-period').value,c=$('#ap-preview-currency').value;
    const existing=activePrice(period,c),proposed=p?.billing_period===period&&p.currency===c?p:existing;
    const amount=d.code==='free'?'Free':b?(b.currency===c?(period==='annual'?b.annual_base:b.monthly_base):null):proposed?.amount;
    const publicView=$('#ap-preview-view').value==='public';const hidden=publicView&&!d.is_public;const unannounced=d.workspace_type==='business'&&!d.available_for_purchase;const labels={...PLAN_LABELS};for(const code of d.feature_codes)labels[code]||=code;
    $('#ap-preview-body').innerHTML=hidden?'<p>This plan is hidden from the public Pricing page.</p>':`<article class="ap-customer-card"><span>${d.workspace_type==='household'?'Family':esc(d.workspace_type)}</span><h3>${esc(d.display_name||'Unnamed plan')}</h3><p>${esc(d.marketing_summary)}</p><strong>${d.workspace_type==='business'&&!d.available_for_purchase?'Coming soon':amount==='Free'?'Free':amount===null||amount===undefined?'Price unavailable':money(amount,c)+' / '+(period==='annual'?'year':'month')}</strong><p>${unannounced?'Seats to be announced':(b?b.included_seats??'Seats not configured':d.included_member_seats)+' people included'}</p><ul>${Object.entries(labels).map(([code,label])=>`<li>${d.feature_codes.includes(code)?'✓':'×'} ${esc(label)}</li>`).join('')}</ul><span>${d.available_for_purchase?esc(d.cta_label):'Purchase unavailable'}</span></article>`;
  }
  async function calculate(){
    const token=epoch,actor=user();const draft=read(),period=$('#ap-calc-period').value,c=$('#ap-calc-currency').value,b=draft.business;
    const p=draft.price?.billing_period===period&&draft.price.currency===c?draft.price:activePrice(period,c);
    const base=b?(b.currency===c?b[period==='annual'?'annual_base':'monthly_base']:null):p?.amount;
    const rate=b?b[period==='annual'?'annual_seat':'monthly_seat']:p?.extra_member_amount;
    const result=$('#ap-calc-result');if(base==null||rate==null){result.textContent='Configure a price for the selected currency and cycle first.';return;}
    result.textContent='Calculating…';try{const value=await api.rpc('admin_plan_calculation_preview',{p_workspace_type:draft.definition.workspace_type,p_base:base,p_seat_price:rate,p_included:b?b.included_seats:draft.definition.included_member_seats,p_total:Number($('#ap-calc-total').value),p_extra:Number($('#ap-calc-extra').value),p_start:$('#ap-calc-start').value+':00Z',p_end:$('#ap-calc-end').value+':00Z',p_at:$('#ap-calc-at').value+':00Z',p_period:period});if(token!==epoch||actor!==user())return;result.textContent=`Full subscription: ${money(value.subscription_total,c)}. Added seats: ${money(value.extra_seat_total,c)}. Expiry remains ${date(value.expiry)}.${value.family?' Remaining full months: '+value.family.full_months_remaining+'; half-month charge: '+(value.family.current_half_charge?'yes':'no')+'.':''} Preview only; no payment or seats are created.`;}catch(e){if(token===epoch&&actor===user())result.textContent=friendly[e.message]||'Check the price, seats and term dates: '+e.message;}
  }
  async function reviewChanges(event){event.preventDefault();if(busy)return;const draft=read();const errors=validatePlanDraft(draft,api.currencies(),snapshot);if(newPlan&&api.plans().some(p=>p.code===draft.definition.code))errors.code='This permanent code is already used. Choose another code.';if(showErrors(errors))return;
    review={draft:structuredClone(draft),token:epoch,user:user(),id:selected,editToken:snapshot?.edit_token};
    const d=draft.definition;const business=draft.business;const current=baseline?JSON.parse(baseline):null;const differences=[];
    for(const section of ['definition','business','price'])for(const[k,v]of Object.entries(draft[section]||{}))if(JSON.stringify(v)!==JSON.stringify(current?.[section]?.[k]))differences.push(`<li><strong>${esc(k.replaceAll('_',' '))}</strong>: ${esc(Array.isArray(v)?v.join(', '):v??'Unconfigured')}</li>`);
    $('#ap-review-body').innerHTML=`<h3>Review ${esc(d.display_name)}</h3><ul class="ap-change-list">${differences.join('')||'<li>No setting changes.</li>'}</ul><p>${Number(snapshot?.subscriber_count||0)} existing workspace subscription(s). Features and payment limits apply on access refresh. Existing invoices, paid dates and purchased seats are preserved.</p>${business?'<p>Private pilot settings do not enable public Business purchase. Changed settings invalidate unsubmitted quotes; submitted payment amounts remain recorded.</p>':''}${draft.price?'<p>The new price applies from its effective date to new purchases and renewal quotes. Accepted invoices keep their original amounts.</p>':''}<p id="ap-publish-error" role="alert"></p>`;$('#ap-review').showModal();
  }
  async function publish(){if(busy||!review)return;const capture=review;if(capture.token!==epoch||capture.user!==user())return;busy=true;const finish=api.beginOperation?.();$('#ap-form').inert=true;root.querySelectorAll('button').forEach(x=>x.disabled=true);
    try{const old=baseline?JSON.parse(baseline):null;const result=await api.rpc('admin_save_plan_workbench',{p_plan_id:capture.id,p_edit_token:capture.editToken||null,p_definition:capture.draft.definition,p_business:JSON.stringify(capture.draft.business)!==JSON.stringify(old?.business)?capture.draft.business:null,p_price:capture.draft.price});if(capture.token!==epoch||capture.user!==user())return;
      snapshot=result;selected=result.plan.id;newPlan=false;$('#ap-review').close();review=null;api.markClean?.();await api.reload();if(capture.token!==epoch||capture.user!==user())return;catalogue();editor();message('Saved. Customer pages use these settings after their next refresh. Earlier invoices keep their original amounts.');api.toast('Plan settings published.');
    }catch(e){if(capture.token===epoch&&capture.user===user())$('#ap-publish-error').textContent=friendly[e.message]||e.message;}
    finally{finish?.();if(capture.token===epoch&&capture.user===user()){busy=false;if($('#ap-form'))$('#ap-form').inert=false;root.querySelectorAll('button').forEach(x=>x.disabled=false);}}
  }
  async function cancelPrice(id){
    if(busy||!snapshot)return;if(dirty()){message('Save or reload your unsaved settings before cancelling a scheduled price.');return;}
    const token=epoch,actor=user(),plan=selected,editToken=snapshot.edit_token;
    if(!await api.confirm({title:'Cancel scheduled price',message:'Keep the current price and withdraw this future price?',action:'Cancel scheduled price'})||token!==epoch||actor!==user())return;
    busy=true;const finish=api.beginOperation?.();$('#ap-form').inert=true;root.querySelectorAll('button').forEach(x=>x.disabled=true);
    try{const result=await api.rpc('admin_cancel_scheduled_plan_price',{p_plan_id:plan,p_price_id:id,p_edit_token:editToken});if(token!==epoch||actor!==user())return;snapshot=result;await api.reload();if(token!==epoch||actor!==user())return;editor();message('Scheduled price cancelled. The previous price remains available.');}
    catch(e){if(token===epoch&&actor===user())message(friendly[e.message]||e.message);}
    finally{finish?.();if(token===epoch&&actor===user()){busy=false;if($('#ap-form'))$('#ap-form').inert=false;root.querySelectorAll('button').forEach(x=>x.disabled=false);}}
  }
  skeleton();
  root.addEventListener('submit',event=>{if(event.target.id==='ap-form')reviewChanges(event);});
  root.addEventListener('input',event=>{if(event.target.id==='ap-search'){filter=event.target.value;catalogue();return;}markDirty();});
  root.addEventListener('change',event=>{
    if(event.target.id==='ap-type'&&newPlan){const saved=read().definition;snapshot={plan:{...saved,workspace_type:event.target.value},features:saved.feature_codes.map(feature_code=>({feature_code,enabled:true})),prices:[],limits:[{limit_code:'included_member_seats',limit_value:saved.included_member_seats},{limit_code:'active_planned_payments',limit_value:saved.active_payment_limit}]};editor();baseline='';$('#ap-dirty').textContent='Unsaved new plan';}
    else if(event.target.closest('#ap-preview'))preview();else markDirty();
  });
  root.addEventListener('click',event=>{const button=event.target.closest('button');if(!button||button.disabled)return;
    if(button.dataset.select)select(button.dataset.select);else if(button.dataset.tab)setTab(button.dataset.tab);else if(button.hasAttribute('data-new'))startNew();else if(button.hasAttribute('data-reload'))select(selected);else if(button.hasAttribute('data-retry'))select(selected,true);
    else if(button.hasAttribute('data-add-price')){$('#ap-new-price').classList.remove('hidden');markDirty();}
    else if(button.hasAttribute('data-remove-price')){$('#ap-new-price').classList.add('hidden');markDirty();}
    else if(button.hasAttribute('data-preview')){preview();$('#ap-preview').showModal();}
    else if(button.hasAttribute('data-close-preview'))$('#ap-preview').close();else if(button.hasAttribute('data-close-review'))$('#ap-review').close();else if(button.hasAttribute('data-publish'))publish();
    else if(button.hasAttribute('data-calculate'))calculate();else if(button.dataset.cancelPrice)cancelPrice(button.dataset.cancelPrice);
  });
  return {
    render(){if(!['super_admin','admin_staff'].includes(api.role())){this.reset();root.innerHTML='<p>Plan management requires an authorized administrator.</p>';return;}if(!$('#ap-catalogue'))skeleton();catalogue();if(!snapshot&&!newPlan&&!selected&&api.plans()[0])select(api.plans()[0].id,true);},
    reset(){++epoch;busy=false;selected=null;snapshot=null;review=null;baseline='';newPlan=false;tab='details';filter='';root.querySelectorAll('dialog').forEach(x=>x.close());root.innerHTML='';},
    isDirty:dirty
  };
}
