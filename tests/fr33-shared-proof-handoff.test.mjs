import assert from 'node:assert/strict';
import test from 'node:test';
import { reconcileSharedProof } from '../supabase/functions/_shared/fr33-shared-proof-handoff.mjs';
import { reconcileOrdinaryUploads } from '../supabase/functions/_shared/business-upload-cleanup.mjs';

const ids = [1, 2, 3, 4, 5, 6, 7, 8].map(n => `00000000-0000-4000-8000-00000000000${n}`);
const prefix = `families/${ids[0]}/${ids[1]}/${ids[2]}/`;
const plan = {
  id:ids[0], lease_token:ids[1], bucket:'payment-proofs',
  source_path:`${prefix}${ids[3]}.png`, source_version:ids[4],
  target_path:`${prefix}managed-upload-v1/${ids[5]}/${ids[6]}.png`,
  mime_type:'image/png', byte_count:3, sha256:null, relinked:false,
};

function fixture(row, overrides = {}) {
  const calls = [];
  return {calls, handlers:{
    claim: async () => row,
    step: async (_plan, step, digest) => {
      calls.push(digest ? [step,digest] : [step]);
      return true;
    },
    copy: async (...args) => { calls.push(['copy-bytes',...args]); },
    read: async () => new Blob(['abc']),
    remove: async (bucket, path) => {
      calls.push(['delete-bytes',bucket,path]);
      return {data:[{name:path}]};
    },
    ...overrides,
  }};
}

test('only the version-pinned copy with matching bytes is linked', async () => {
  const {calls,handlers} = fixture(plan);
  assert.deepEqual(await reconcileSharedProof(handlers),{claimed:1,advanced:1});
  assert.deepEqual(calls,[
    ['copy'], ['copy-bytes',plan.bucket,plan.source_path,plan.source_version,plan.target_path],
    ['relink','ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  ]);
});

test('a mismatched target digest or saved checksum leaves the original linked', async () => {
  const {calls,handlers} = fixture(plan,{
    read: async (_bucket,path) => new Blob([path === plan.source_path ? 'abc' : 'xyz']),
  });
  assert.deepEqual(await reconcileSharedProof(handlers),{claimed:1,advanced:0});
  assert.deepEqual(calls.map(call => call[0]),['copy','copy-bytes']);
  const badChecksum = fixture({...plan,sha256:'0'.repeat(64)});
  assert.deepEqual(await reconcileSharedProof(badChecksum.handlers),{claimed:1,advanced:0});
});

test('the worker rejects a replacement in a different Family', async () => {
  const {calls,handlers} = fixture({...plan,target_path:plan.target_path.replace(ids[0],ids[7])});
  await assert.rejects(reconcileSharedProof(handlers),/Invalid proof transfer claim/);
  assert.deepEqual(calls,[]);
});

test('a later lease removes only the original after the database authorizes it', async () => {
  const {calls,handlers} = fixture({...plan,relinked:true});
  assert.deepEqual(await reconcileSharedProof(handlers),{claimed:1,advanced:1});
  assert.deepEqual(calls,[['remove'],['delete-bytes',plan.bucket,plan.source_path],['finish']]);
  const blocked = fixture({...plan,relinked:true},{step:async()=>false});
  assert.deepEqual(await reconcileSharedProof(blocked.handlers),{claimed:1,advanced:0});
  assert.deepEqual(blocked.calls,[]);
});

test('Business bill or paid claim files preserve their document directory', async () => {
  const parent = `workspaces/${ids[0]}/${ids[1]}/${ids[2]}/`;
  const {calls,handlers} = fixture({...plan,bucket:'business-documents',
    source_path:`${parent}${ids[3]}.pdf`,target_path:`${parent}managed-upload-v1/${ids[4]}.pdf`,
    mime_type:'application/pdf',
  });
  assert.deepEqual(await reconcileSharedProof(handlers),{claimed:1,advanced:1});
  assert.deepEqual(calls.map(call => call[0]),['copy','copy-bytes','relink']);
});

test('older Family JPEG and WebP images can also be transferred and cleaned', async () => {
  for (const [extension, mime_type] of [['jpg','image/jpeg'],['jpeg','image/jpeg'],['webp','image/webp']]) {
    const legacy = fixture({...plan,mime_type,
      source_path:plan.source_path.replace(/png$/,extension),
      target_path:plan.target_path.replace(/png$/,extension),
    });
    assert.deepEqual(await reconcileSharedProof(legacy.handlers),{claimed:1,advanced:1});
    const cleanup = await reconcileOrdinaryUploads({
      claim:async () => [{
        bucket_id:plan.bucket,object_name:plan.target_path.replace(/png$/,extension),cleanup_token:plan.lease_token,
      }],
      remove:async (_bucket, path) => ({data:[{name:path}]}),
      finish:async () => true,
    });
    assert.deepEqual(cleanup,{claimed:1,removed:1,retry:0});
  }
});
