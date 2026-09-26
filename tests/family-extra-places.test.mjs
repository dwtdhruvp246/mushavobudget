import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const sql = readFileSync(new URL('../supabase/migrations/20260925120000_family_extra_places.sql', import.meta.url), 'utf8');
const correction = readFileSync(new URL('../supabase/migrations/20260925134000_correct_family_extra_place_month_count.sql', import.meta.url), 'utf8');
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

function addUtcMonths(value, months) {
  const date = new Date(value);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate(), date.getUTCHours()));
}

function seatQuote(anchorValue, expiryValue, purchaseValue, monthlyPrice = 5) {
  const anchor = new Date(anchorValue);
  const expiry = new Date(expiryValue);
  const purchase = new Date(purchaseValue);
  let monthIndex = 0;
  let monthStart = anchor;
  let nextMonth = addUtcMonths(anchor, 1);
  while (nextMonth <= purchase) {
    monthIndex += 1;
    monthStart = nextMonth;
    nextMonth = addUtcMonths(anchor, monthIndex + 1);
  }
  const firstHalf = purchase < new Date((monthStart.getTime() + nextMonth.getTime()) / 2);
  let fullMonths = 0;
  while (addUtcMonths(anchor, monthIndex + 2) <= expiry) {
    fullMonths += 1;
    monthIndex += 1;
  }
  return { firstHalf, fullMonths, amount: monthlyPrice * (fullMonths + (firstHalf ? 0.5 : 0)) };
}

test('proration excludes the current second half and never counts the renewal boundary as a month', () => {
  assert.deepEqual(seatQuote('2026-09-03T12:00:00Z', '2027-09-03T12:00:00Z', '2026-09-25T12:00:00Z'),
    { firstHalf: false, fullMonths: 11, amount: 55 });
  assert.match(correction, /v_full_month_end := v_anchor \+ make_interval\(months => v_month_index \+ 2\)/);
  assert.match(correction, /exit when v_full_month_end > v_subscription\.paid_through_at/);
  assert.doesNotMatch(correction, /v_next_month <= v_subscription\.paid_through_at/);
});

test('purchase-day billing matches the four agreed annual examples', () => {
  const anchor = '2026-05-20T12:00:00Z';
  const expiry = '2027-05-20T12:00:00Z';
  assert.deepEqual(seatQuote(anchor, expiry, '2026-05-30T12:00:00Z'), { firstHalf: true, fullMonths: 11, amount: 57.5 });
  assert.deepEqual(seatQuote(anchor, expiry, '2026-06-10T12:00:00Z'), { firstHalf: false, fullMonths: 11, amount: 55 });
  assert.deepEqual(seatQuote(anchor, expiry, '2026-07-02T12:00:00Z'), { firstHalf: true, fullMonths: 10, amount: 52.5 });
  assert.deepEqual(seatQuote(anchor, expiry, '2026-08-13T12:00:00Z'), { firstHalf: false, fullMonths: 9, amount: 45 });
});
