import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { collectBaseline, collectLive } from '../scripts/security-stage-0-check.mjs';

test('baseline reports missing native inputs and whitelists config without leaking credentials', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'mushavo-stage0-'));
  try {
    await writeFile(path.join(root,'package.json'),JSON.stringify({dependencies:{'@capacitor/core':'7.4.0'}}));
    await writeFile(path.join(root,'capacitor.config.json'),JSON.stringify({appId:'com.test.budget',webDir:'www',signingPassword:'private-fixture',server:{url:'https://user:private-fixture@example.test',cleartext:true}}));
    const result = await collectBaseline(root);
    assert.equal(result.packages['@capacitor/core'].declared,'7.4.0');
    assert.equal(result.packages.esbuild.declared,null);
    assert.equal(result.nativeFiles.android,false);
    assert.equal(result.nativeConfig.appId,'com.test.budget');
    assert.equal(result.nativeConfig.usesRemoteServer,true);
    assert.equal(result.evidenceType,'LOCAL_INVENTORY_ONLY');
    assert(!JSON.stringify(result).includes('private-fixture'));
  } finally { await rm(root,{recursive:true,force:true}); }
});

test('failed live requests remain unverified and never produce passing headers', async () => {
  const result = await collectLive('/no-fixture',async () => {throw new Error('private network details');});
  assert.equal(result.length,9);
  for (const item of result) {
    assert.equal(item.status,'CANNOT VERIFY'); assert.equal(item.headers,undefined);
    assert(!JSON.stringify(item).includes('private network details'));
  }
});

test('live checks preserve 404s, absent headers and source mismatch', async () => {
  const root = await mkdtemp(path.join(tmpdir(),'mushavo-live-'));
  try {
    await writeFile(path.join(root,'app.js'),'local version');
    await writeFile(path.join(root,'business.js'),'matching version');
    const result = await collectLive(root,async url => new Response(url.endsWith('business.js')?'matching version':'remote version', {status:url.endsWith('/privacy')?404:200}));
    assert.equal(result.find(item=>item.route==='/privacy').httpStatus,404);
    assert.equal(result.find(item=>item.route==='/app.js').matchesLocalSource,false);
    assert.equal(result.find(item=>item.route==='/business.js').matchesLocalSource,true);
    assert.equal(result[0].headers['content-security-policy'],null);
  } finally { await rm(root,{recursive:true,force:true}); }
});
