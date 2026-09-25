import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/20260925120000_family_extra_places.sql', import.meta.url), 'utf8');
const source = app.slice(app.indexOf('async function refreshFamilySeatQuote'), app.indexOf('function openRenewalDialog'));

function harness(quotes) {
  const elements = new Map();
  const calls = [];
  const $ = selector => {
    if (!elements.has(selector)) elements.set(selector, {
      value: selector === '#familySeatsCount' ? '1' : '',
      textContent: '', innerHTML: '', disabled: false, files: [],
      classList: {toggle() {}},
      close() { calls.push('closed'); }
    });
    return elements.get(selector);
  };
  const state = {familySeatQuote:null};
  const context = {
    state, $, Number, Date,
    currentBudgetWorkspace:()=>({id:'family-1'}),
    supabase:{rpc:(name,args)=>({name,args})},
    query:async(label,request)=>{
      calls.push({label,request});
      if(request.name==='family_extra_place_quote') return quotes.shift();
      return 'payment-id';
    },
    setSubmitting:(button,busy)=>{button.disabled=busy;},
    money:(amount,currency)=>`${currency} ${Number(amount).toFixed(2)}`,
    escapeHtml:value=>String(value), titleCase:value=>value,
    uploadSubscriptionProof:async()=>'',
    toDateValue:()=>'',
    loadWorkspaceSubscriptionData:async()=>{},renderFamilyApp:()=>{},
    showToast:value=>calls.push(value),friendlyMessage:value=>value,
    window:{},
    SUBSCRIPTION_PROOF_BUCKET:'proofs'
  };
  vm.runInNewContext(source,context);
  return {context,elements,calls,$,state};
}

const quote={
  workspace_id:'family-1',additional_count:1,current_limit:4,target_limit:5,
  billing_period:'annual',currency:'USD',monthly_price:5,
  current_half_charge:true,full_months_remaining:11,
  amount:57.5,paid_through_at:'2027-05-20T10:00:00.000Z'
};

test('a Family quote shows the half month, full months and unchanged renewal date',async()=>{
  const h=harness([quote]);
  await h.context.refreshFamilySeatQuote();
  assert.match(h.$('#familySeatsQuote').innerHTML,/USD 2\.50/);
  assert.match(h.$('#familySeatsQuote').innerHTML,/11 × USD 5\.00/);
  assert.match(h.$('#familySeatsQuote').innerHTML,/USD 57\.50/);
  assert.equal(h.$('#familySeatsPaymentFields').disabled,false);
});

test('a changed server quote cannot submit an old price',async()=>{
  const h=harness([quote,{...quote,amount:55,current_half_charge:false}]);
  await h.context.refreshFamilySeatQuote();
  await h.context.submitFamilySeats({preventDefault(){}});
  assert.equal(h.calls.some(call=>call.request?.name==='submit_family_extra_places'),false);
  assert.ok(h.calls.some(call=>typeof call==='string'&&call.includes('quote changed')));
});

test('zero-cost last-half places do not require payment details and still await review',async()=>{
  const h=harness([{...quote,amount:0,current_half_charge:false,full_months_remaining:0}]);
  await h.context.refreshFamilySeatQuote();
  assert.equal(h.$('#familySeatsPaymentDate').required,false);
  assert.equal(h.$('#familySeatsReference').required,false);
  assert.equal(h.$('#familySeatsSubmit').textContent,'Request free remaining days');
  assert.match(sql,/when v_amount = 0 then 'No payment required'/);
  assert.match(sql,/if v_request\.purchase_kind = 'extra_places'/);
});

test('approval of extra places keeps the original subscription expiry',()=>{
  const branch=sql.split("if v_request.purchase_kind = 'extra_places' then")[1].split("\n  if p_decision = 'rejected' then")[0];
  assert.match(branch,/v_subscription\.paid_through_at is distinct from v_request\.seat_expiry_at/);
  assert.match(branch,/set status = 'approved'/);
  assert.doesNotMatch(branch,/set paid_through_at/);
  assert.match(sql,/v_first_half := now\(\) < v_month_start/);
  assert.match(sql,/v_next_month := v_anchor \+ make_interval\(months => v_month_index \+ 1\)/);
});
