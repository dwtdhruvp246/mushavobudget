import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import {historicalSource,decodeHistoricalSources} from './helpers/historical-reviewed-source.mjs';
const encoded=readFileSync(new URL('./fixtures/historical-reviewed-source.gzip.base64',import.meta.url),'utf8');
const sha=x=>createHash('sha256').update(x).digest('hex');
test('FR1 retained inputs independently match the original public-input contract',()=>{
 const root=historicalSource('FR1'),c=JSON.parse(readFileSync(path.join(root,'docs/security-audit/security-final-staging-source-contract.json')));
 assert.equal(c.source_commit,'268eb30b21154c14b5eede7e3ceb187341ef586b');
 for(const row of [...c.public_inputs,c.header_generator]){const b=readFileSync(path.join(root,row.path));assert.equal(sha(b),row.sha256);assert.equal(b.length,row.bytes);}
 assert.notEqual(sha(readFileSync(new URL('../app.js',import.meta.url))),sha(readFileSync(path.join(root,'app.js'))));
});
test('stage10 retained sources independently match all nine original hashes',()=>{
 const root=historicalSource('STAGE10'),c=JSON.parse(readFileSync(path.join(root,'docs/security-audit/security-stage-10-operations-candidate-contract.json')));
 assert.equal(c.source_parent_commit,'1b012fd9c47bfb1733596f64c470feee5d308341');assert.equal(c.source_targets.length,9);
 for(const row of c.source_targets)assert.equal(sha(readFileSync(path.join(root,row.source),'utf8').replace(/\r\n?/g,'\n')),row.normalized_source_sha256);
});
test('changed retained bytes cannot be accepted by their existing fingerprints',()=>{
 const all=JSON.parse(gunzipSync(Buffer.from(encoded.trim(),'base64')));all.FR1.files['app.js'].base64=Buffer.from('ALTERED').toString('base64');assert.throws(()=>decodeHistoricalSources(gzipSync(JSON.stringify(all)).toString('base64')),/HISTORICAL_BYTES_CHANGED/);
});
test('retained inputs cannot escape the temporary directory or change their source pins',()=>{
 const all=JSON.parse(gunzipSync(Buffer.from(encoded.trim(),'base64')));all.FR1.files['../escape']=all.FR1.files['app.js'];assert.throws(()=>decodeHistoricalSources(gzipSync(JSON.stringify(all)).toString('base64')),/HISTORICAL_PATH_INVALID/);delete all.FR1.files['../escape'];all.FR1.source_commit='0'.repeat(40);assert.throws(()=>decodeHistoricalSources(gzipSync(JSON.stringify(all)).toString('base64')),/HISTORICAL_PIN_MISMATCH/);
});
