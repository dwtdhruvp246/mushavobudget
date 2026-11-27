import assert from 'node:assert/strict';
import test from 'node:test';
import { privateFileDeployment, readSignedPrivateObject } from '../supabase/functions/get-private-file/signed-private-file.mjs';

const stage = 'https://dczlddwbtgvfdujgcitb.supabase.co';
const prod = 'https://kttkospkblwvguuwnhjj.supabase.co';

test('the production broker requires its explicit switch and accepts only the production web origins', () => {
  assert.equal(privateFileDeployment(prod), null);
  const production = privateFileDeployment(prod, true);
  const staging = privateFileDeployment(stage);
  assert.equal(production.allowsOrigin('https://mushavobudget.com'), true);
  assert.equal(production.allowsOrigin('https://www.mushavobudget.com'), true);
  assert.equal(production.allowsOrigin('https://mushavo-budget-staging.pages.dev'), false);
  assert.equal(production.allowsOrigin('https://mushavobudget.com.invalid'), false);
  assert.equal(staging.allowsOrigin('https://pr-20.mushavo-budget-staging.pages.dev'), true);
  assert.equal(staging.allowsOrigin('https://mushavobudget.com'), false);
  assert.equal(privateFileDeployment('https://arbitrary.supabase.co', true), null);
});

test('a private Storage fetch follows only the exact project and requested object', async () => {
  const objectPath = '/storage/v1/object/sign/subscription-proofs/workspaces/test.png?token=test';
  let fetched = 0;
  const fetcher = async () => { fetched += 1; return new Response('proof'); };
  const call = (projectUrl, signedUrl) => readSignedPrivateObject({
    bucket:'subscription-proofs',path:'workspaces/test.png',maxBytes:25,projectUrl,
    mint:async () => ({data:{signedUrl}}),fetcher,
  });

  assert.equal((await call(prod, stage+objectPath)).error.code, 'PRIVATE_FILE_FETCH_FAILED');
  assert.equal((await call(prod, prod+objectPath.replace('test.png','unrelated.png'))).error.code, 'PRIVATE_FILE_FETCH_FAILED');
  assert.equal(fetched, 0);
  assert.equal(await (await call(prod, prod+objectPath)).data.text(), 'proof');
  assert.equal(await (await call(undefined, stage+objectPath)).data.text(), 'proof');
});
