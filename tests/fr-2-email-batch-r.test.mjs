import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {publicBrowserSettings} from '../scripts/check-fr-2-email-batch-o.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
test('canonical worker is exactly the owner-hosted Q worker and the old v88 bytes remain a separate fixture',async()=>{
 const [canonical,reviewed,historical]=await Promise.all(['../sw.js','../deployment/candidates/email-offline-pages-v89.sw.js','./fixtures/email-offline-v88.sw.js'].map(f=>readFile(new URL(f,import.meta.url))));
 assert(canonical.equals(reviewed));assert.equal(sha(canonical),'0bc471318eb7156aed4f004c153a3e45fd08a71f665ad77ba59caa29fd8d8c47');
 assert.equal(sha(historical),'de41c590f8538b9998eebc7c5a181792a616db44711486fe3f976f7f0d2e750c');assert(!canonical.equals(historical));
});
test('historical worker selection is confined to explicit local regression fixtures while normal checks expect v89',()=>{
 const fixtureOrigin='https://localhost:1234';assert.equal(publicBrowserSettings().cacheName,'mushavo-budget-pwa-shell-v89');
 assert.equal(publicBrowserSettings({fixtureOrigin,historicalWorker:true}).cacheName,'mushavo-budget-pwa-shell-v88');
 for(const options of [{},{fixtureOrigin,candidateWorker:true},{fixtureOrigin,tlsDiagnostic:true},{reviewedDeploymentOrigin:'https://mushavo-budget-staging.pages.dev'}])assert.throws(()=>publicBrowserSettings({...options,historicalWorker:true}));
});
