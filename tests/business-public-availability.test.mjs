import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {validatePlanDraft} from '../admin-plans.js';
const source=await readFile(new URL('../app.js',import.meta.url),'utf8');
function extract(start,end){return source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));}
test('Business annual additional seats use an annual rate while Family keeps twelve monthly rates',()=>{
 const c=vm.createContext({state:{billableMemberCount:3,memberUsage:{member_limit:3}},currentBudgetWorkspace:()=>({id:'p',workspace_type:'personal'}),includedMemberSeats:()=>2});
 vm.runInContext(extract('function extraMemberBillingMonths','function formatSubscriptionDate'),c);
 assert.equal(c.planInvoiceTotal({code:'business-plus',workspace_type:'business'},{amount:100,extra_member_amount:50,billing_period:'annual'},3),150);
 assert.equal(c.planInvoiceTotal({code:'household',workspace_type:'household'},{amount:100,extra_member_amount:5,billing_period:'annual'},3),160);
 assert.equal(c.planInvoiceTotal({code:'business-plus',workspace_type:'business'},{amount:10,extra_member_amount:5,billing_period:'monthly'},3),15);
});
test('new Business checkout is offered from Personal only for active available plans',()=>{
 const c=vm.createContext({state:{plans:[{code:'business',workspace_type:'business',is_active:true,available_for_purchase:true},{code:'closed',workspace_type:'business',is_active:true,available_for_purchase:false},{code:'inactive',workspace_type:'business',is_active:false,available_for_purchase:true}]},currentBudgetWorkspace:()=>({workspace_type:'personal'})});
 vm.runInContext(extract('function eligibleRenewalPlans','async function startAdditionalFamilyPurchase'),c);
 assert.deepEqual(Array.from(c.eligibleRenewalPlans(),p=>p.code),['business']);
 c.state.plans[0].available_for_purchase=false;assert.equal(c.eligibleRenewalPlans().length,0);
});
test('Family head starting Business is switched to the owned Personal workspace before checkout',async()=>{
 const calls=[],personal={id:'personal',workspace_type:'personal',owner_id:'owner',status:'active'},family={id:'family',workspace_type:'household',owner_id:'owner'};
 const c=vm.createContext({state:{session:{user:{id:'owner'}},plans:[{code:'business',workspace_type:'business'}],workspaces:[personal,family]},workspacePlanWorkspace:()=>family,currentBudgetWorkspace:()=>family,selectNotificationWorkspace:async id=>{calls.push(id);return true;},openRenewalDialog:code=>calls.push(code)});
 vm.runInContext(extract('async function openWorkspacePlanSelection','function renderRenewalHistory'),c);await c.openWorkspacePlanSelection('business');assert.deepEqual(calls,['personal','business']);
});
test('publishing Business requires billing enabled and both fields for every configured cycle',()=>{
 const definition={code:'business',display_name:'Business',workspace_type:'business',sort_order:0,is_active:true,available_for_purchase:true,description:'Business tools',marketing_summary:'Business subscription',cta_label:'Choose plan',active_payment_limit:null};
 const business={pilot_enabled:true,currency:'USD',included_seats:2,monthly_base:10,monthly_seat:5,annual_base:100,annual_seat:null,payment_instructions:'Pay by bank'};
 assert(validatePlanDraft({definition,business,price:null},[{code:'USD',is_active:true}]).annual_base);
 assert.deepEqual(validatePlanDraft({definition,business:{...business,annual_base:null},price:null},[{code:'USD',is_active:true}]),{});
});
