import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {priceState,validatePlanDraft} from '../admin-plans.js';
const currencies=[{code:'USD',is_active:true},{code:'ZAR',is_active:true}];
const definition={code:'business',display_name:'Business',description:'Business tools',marketing_summary:'Company finances',workspace_type:'business',sort_order:0,included_member_seats:1,active_payment_limit:null,is_active:true,is_public:true,is_featured:false,available_for_purchase:false,cta_label:'Choose plan',feature_codes:[]};
const business={currency:'USD',included_seats:4,pilot_enabled:true,monthly_base:20,monthly_seat:0,annual_base:null,annual_seat:null,payment_instructions:'Internal test instructions'};
test('Business validation matches required billing fields and retains zero versus unset',()=>{
 assert.deepEqual(validatePlanDraft({definition,business,price:null},currencies),{});
 const bad=validatePlanDraft({definition,business:{...business,included_seats:null,payment_instructions:'',monthly_seat:null},price:null},currencies);
 assert.match(bad.bseats,/included seats/);assert.match(bad.instructions,/instructions/);assert.match(bad.monthly_base,/both/);
});
test('unsupported currencies and nonfinite Business prices are rejected locally',()=>{
 const bad=validatePlanDraft({definition:{...definition,available_for_purchase:true},business:{...business,currency:'XYZ',monthly_base:Infinity},price:null},currencies);
 assert(bad.bcurrency&&bad.monthly_base);
 assert.deepEqual(validatePlanDraft({definition:{...definition,available_for_purchase:true},business,price:null},currencies),{});
 assert(validatePlanDraft({definition:{...definition,available_for_purchase:true},business:{...business,pilot_enabled:false},price:null},currencies).pilot);
});
test('Free limits and existing workspace types remain protected',()=>{
 const bad=validatePlanDraft({definition:{...definition,code:'free',workspace_type:'personal',active_payment_limit:null},business:null,price:null},currencies,{plan:{workspace_type:'household'}});
 assert(bad.limit&&bad.type);
});
test('price state distinguishes future and expired dates independently of the active flag',()=>{
 const at=Date.parse('2026-10-01T00:00Z');
 assert.equal(priceState({is_active:true,effective_from:'2026-10-02Z'},at),'Scheduled');
 assert.equal(priceState({is_active:true,effective_from:'2026-09-01Z',effective_until:'2026-10-01Z'},at),'Previous');
 assert.equal(priceState({is_active:true,effective_from:'2026-09-01Z'},at),'Current');
 assert.equal(priceState({is_active:false,effective_from:'2026-09-01Z'},at),'Archived');
});
test('scheduled price replacement and incomplete paid prices show field errors',()=>{
 const draft={definition:{...definition,code:'personal',workspace_type:'personal'},business:null,price:{currency:'USD',billing_period:'monthly',amount:0,extra_member_amount:0,effective_from:null}};
 const bad=validatePlanDraft(draft,currencies,{plan:{workspace_type:'personal'},prices:[{is_active:true,effective_from:new Date(Date.now()+86400000).toISOString(),currency:'USD',billing_period:'monthly'}]});
 assert(bad.amount&&bad.effective);
});
test('editor saves only through the atomic RPC and fences late reads by user and epoch',async()=>{
 const source=await readFile(new URL('../admin-plans.js',import.meta.url),'utf8');
 assert.match(source,/admin_save_plan_workbench/);assert.doesNotMatch(source,/\.from\(/);
 assert.match(source,/token!==epoch\|\|actor!==user\(\)/);assert.match(source,/capture\.draft\.definition/);
});
test('consolidated schema contains the exact workbench deployment',async()=>{
 const [schema,migration]=await Promise.all([readFile(new URL('../supabase/schema.sql',import.meta.url),'utf8'),readFile(new URL('../supabase/migrations/20261001190000_admin_plans_workbench.sql',import.meta.url),'utf8')]);
 assert(schema.includes(migration));
 const repair=await readFile(new URL('../supabase/migrations/20261002042500_reconcile_business_plan_seats.sql',import.meta.url),'utf8');
 assert(schema.includes(repair));
 const release=await readFile(new URL('../supabase/migrations/20261002060000_business_public_availability.sql',import.meta.url),'utf8');
 assert(schema.endsWith(release));
});
test('customer cards and renewal price selection exclude future and previous versions',async()=>{
 const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
 const context=vm.createContext({Date});
 vm.runInContext(source.slice(source.indexOf('function isCurrentPlanPrice'),source.indexOf('function activePriceFor')),context);
 const at=Date.parse('2026-10-01T00:00Z');
 assert.equal(context.isCurrentPlanPrice({is_active:true,effective_from:'2026-10-02Z'},at),false);
 assert.equal(context.isCurrentPlanPrice({is_active:true,effective_from:'2026-09-01Z',effective_until:'2026-10-01Z'},at),false);
 assert.equal(context.isCurrentPlanPrice({is_active:true,effective_from:'2026-10-01Z'},at),true);
 assert.equal(context.isCurrentPlanPrice({is_active:false,effective_from:'2026-09-01Z'},at),false);
});
test('GitHub Pages ships the imported editor module',async()=>{
 const workflow=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
 assert.match(workflow,/cp app-entry\.js app\.js admin-plans\.js business\.js/);
});
