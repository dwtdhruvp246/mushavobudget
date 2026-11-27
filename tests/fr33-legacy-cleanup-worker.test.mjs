import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileOrdinaryUploads } from '../supabase/functions/_shared/business-upload-cleanup.mjs';

const id = 'ab123456-9012-4012-9012-901234567890';
const parent = `workspaces/${id}/${id}/${id}`;
const managed = `${parent}/managed-upload-v1/${id}.pdf`;
const legacy = `${parent}/${id}.pdf`;
const claim = (object_name, rest = {}) => ({
  bucket_id: 'business-documents', object_name, cleanup_token: id, ...rest
});

test('a marked legacy Business logo can use the ordinary cleanup worker', async () => {
  const logo = `${id}/${id}/${id}.png`;
  const result = await reconcileOrdinaryUploads({
    claim: async () => [claim(logo, { bucket_id: 'business-logos', legacy_account_erasure: true })],
    remove: async (bucket, name) => {
      assert.equal(bucket, 'business-logos');
      assert.equal(name, logo);
      return { data: [{ name }] };
    },
    finish: async () => true
  });
  assert.deepEqual(result, { claimed: 1, removed: 1, retry: 0 });
  await assert.rejects(reconcileOrdinaryUploads({
    claim: async () => [claim(logo, { bucket_id: 'business-logos' })],
    remove: async () => assert.fail('Unmarked legacy logo cannot reach Storage'),
    finish: async () => assert.fail('Unmarked legacy logo cannot be acknowledged')
  }), /Invalid ordinary cleanup claim/);
});

test('account erasure can remove a verified legacy proof alongside a managed document', async () => {
  const removals = [];
  const finalized = [];
  const result = await reconcileOrdinaryUploads({
    claim: async limit => {
      assert.equal(limit, 5);
      return [claim(managed), claim(legacy, { legacy_account_erasure: true })];
    },
    remove: async (bucket, name) => {
      removals.push([bucket, name]);
      return { data: [{ name }] };
    },
    finish: async (bucket, name, token) => {
      assert.equal(token, id);
      finalized.push([bucket, name]);
      return true;
    }
  });
  assert.deepEqual(result, { claimed: 2, removed: 2, retry: 0 });
  assert.deepEqual(removals, [['business-documents', managed], ['business-documents', legacy]]);
  assert.deepEqual(finalized, removals);
});

test('unmarked legacy paths and marked paths outside Business documents cannot reach Storage', async () => {
  const invalid = [
    claim(legacy),
    claim(legacy, { legacy_account_erasure: 'true' }),
    claim(legacy, { bucket_id: 'payment-proofs', legacy_account_erasure: true }),
    claim(`${parent}/unverified.pdf`, { legacy_account_erasure: true })
  ];
  for (const row of invalid) {
    await assert.rejects(reconcileOrdinaryUploads({
      claim: async () => [row],
      remove: async () => assert.fail('Unexpected Storage call'),
      finish: async () => assert.fail('Unexpected acknowledgement')
    }), /Invalid ordinary cleanup claim/);
  }
});
