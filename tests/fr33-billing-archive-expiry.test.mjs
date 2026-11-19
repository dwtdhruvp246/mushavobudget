import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileBillingArchiveExpiry } from '../supabase/functions/_shared/fr33-billing-archive-expiry.mjs';

const workspace = 'f13fc7d4-840a-4cb1-8110-aded017314cb';
const lease = 'f8852088-4641-4db6-ac6b-58953ce215cd';
const object = 'cdef8738-7756-4fe5-96a1-bd59728d2f50';
const path = 'workspaces/' + workspace + '/a5fe3462-55eb-49b6-909f-c21ba6de4791/fr33-retained-v1/85b1f2fd-d538-4048-86a8-ead9ccf8e26a.png';
const valid = {status:'remove_proof',workspace_id:workspace,lease_id:lease,object_id:object,path};

test('accepts idle and proof-free completions without calling Storage', async () => {
  const forbidden = () => assert.fail('unexpected Storage operation');
  assert.equal(await reconcileBillingArchiveExpiry({step:async () => null,remove:forbidden}),null);
  assert.deepEqual(await reconcileBillingArchiveExpiry({
    step:async () => ({status:'completed',invoices:2,payments:2}),remove:forbidden,
  }),{status:'completed'});
});

test('removes just the leased proof and requires database acknowledgement', async () => {
  const actions = [];
  const status = await reconcileBillingArchiveExpiry({
    step:async (...args) => { actions.push(args); return args.length ? {status:'completed'} : valid; },
    remove:async (...args) => { actions.push(args); return {error:null,data:[{id:object,name:path}]}; },
  });
  assert.deepEqual(actions,[[],['subscription-proofs',path],[workspace,lease]]);
  assert.deepEqual(status,{status:'completed'});
});

test('blocks a cross-workspace path and unsafe path shapes', async () => {
  for (const candidate of [path.replace(workspace,lease),path.replace('fr33-retained-v1','..'),path.replace('.png','.exe')]) {
    const result = await reconcileBillingArchiveExpiry({
      step:async () => ({...valid,path:candidate}),remove:() => assert.fail('unexpected Storage operation'),
    });
    assert.deepEqual(result,{status:'retry'});
  }
});

test('Storage errors, swapped object identities and unconfirmed absence are retryable', async () => {
  for (const result of [{error:{},data:null},{error:null,data:[{id:lease,name:path}]},{error:null,data:[]}]) {
    let calls = 0;
    assert.deepEqual(await reconcileBillingArchiveExpiry({
      step:async () => { calls++; return valid; },remove:async () => result,
    }),{status:'retry'});
    assert.equal(calls,1);
  }
  assert.deepEqual(await reconcileBillingArchiveExpiry({
    step:async (...args) => args.length ? {status:'proof_still_present'} : valid,
    remove:async () => ({error:null,data:[{id:object,name:path}]}),
  }),{status:'retry'});
});
