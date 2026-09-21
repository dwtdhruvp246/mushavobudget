import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/20260921090000_additional_family_subscriptions.sql', import.meta.url), 'utf8');
const purchase = app.slice(app.indexOf('async function startAdditionalFamilyPurchase'), app.indexOf('function openRenewalDialog'));
function harness({pending = false, fail = false, plans = [{code:'family-plus', workspace_type:'household'}]} = {}) {
  const calls = [];
  const button = {disabled:false};
  const details = {open:false};
  const context = {
    state:{renewalRequests:pending ? [{provision_workspace_on_approval:true,status:'pending_review'}] : []},
    window:{location:{hash:''},MushavoPWA:{beginOperation:()=>()=>calls.push('finished')}},
    $:id=>id === '#purchaseFamilySubscription' ? button : {closest:()=>details},
    selectFamily:async id=>{calls.push(id); if(fail) throw new Error('Connection unavailable');},
    loadWorkspaceSubscriptionData:async()=>calls.push('loaded'),
    renderFamilyApp:()=>calls.push('rendered'),
    eligibleRenewalPlans:()=>plans,
    openRenewalDialog:code=>calls.push(`purchase:${code}`),
    showToast:text=>calls.push(text), friendlyMessage:text=>text
  };
  vm.runInNewContext(purchase, context);
  return {context,calls,button,details};
}
test('additional purchase switches to Personal before opening the selected Family plan', async()=>{
  const h=harness(); await h.context.startAdditionalFamilyPurchase();
  assert.deepEqual(h.calls,['__personal__','loaded','rendered','purchase:family-plus','finished']);
  assert.equal(h.context.window.location.hash,'family/subscription');
  assert.equal(h.button.disabled,false);
});
test('pending new-family payment opens history rather than another checkout', async()=>{
  const h=harness({pending:true}); await h.context.startAdditionalFamilyPurchase();
  assert.equal(h.details.open,true);
  assert.equal(h.calls.some(x=>x.startsWith('purchase:')),false);
  assert.equal(h.button.disabled,false);
});
test('failed workspace loading does not submit against the old family', async()=>{
  const h=harness({fail:true}); await h.context.startAdditionalFamilyPurchase();
  assert.deepEqual(h.calls,['__personal__','Connection unavailable','finished']);
  assert.equal(h.button.disabled,false);
});
test('unpublished family plans cannot open checkout', async()=>{
  const h=harness({plans:[]}); await h.context.startAdditionalFamilyPurchase();
  assert.ok(h.calls.includes('No Family plan is available for purchase yet.'));
  assert.equal(h.calls.some(x=>x.startsWith('purchase:')),false);
});
test('migration preserves payment approval and owner guards while allowing additional paid families',()=>{
  const submit=sql.slice(0,sql.indexOf('create or replace function public.review_subscription_payment'));
  assert.match(submit,/v_workspace.owner_id <> auth.uid\(\)/);
  assert.match(submit,/v_workspace.workspace_type <> 'personal'/);
  assert.match(submit,/v_pending_count > 0.*FAMILY_PLAN_REQUEST_ALREADY_PENDING/);
  assert.match(submit,/v_owned_count >= 100/);
  assert.doesNotMatch(submit,/update public.family_heads|insert into public.families/);
  assert.doesNotMatch(sql,/raise exception 'FAMILY_LIMIT_REACHED'/);
  assert.match(sql,/FINANCE_REVIEW_ACCESS_REQUIRED/);
  assert.match(sql,/v_payment.status <> 'pending_review'.*already_reviewed/);
  assert.match(sql,/where id = v_payment.workspace_id\s+for update/);
  assert.match(sql,/family_limit = greatest\(heads.family_limit, 1, case when v_request.provision_workspace_on_approval then v_owned_count \+ 1 else 1 end\)/);
  assert.match(sql,/where id = v_request.requested_plan_id and workspace_type = 'household'/);
  assert.match(sql,/PAYMENT_AMOUNT_DOES_NOT_MATCH_INVOICE/);
  assert.match(sql,/INVALID_SUBSCRIPTION_PROOF_PATH/);
});
