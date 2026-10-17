// Immutable prior-release inputs; production collectors keep their original pins.
import {readFileSync,mkdtempSync,mkdirSync,writeFileSync,copyFileSync,rmSync} from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {after} from 'node:test';
const repo=fileURLToPath(new URL('../../',import.meta.url)),cache=new Map();
const pins={FR1:'268eb30b21154c14b5eede7e3ceb187341ef586b',STAGE10:'1b012fd9c47bfb1733596f64c470feee5d308341'};
export function decodeHistoricalSources(encoded){
 const all=JSON.parse(gunzipSync(Buffer.from(encoded.trim(),'base64'),{maxOutputLength:16*1024*1024}));
 for(const [kind,pin] of Object.entries(pins)){
  const entry=all[kind];if(entry?.source_commit!==pin)throw Error('HISTORICAL_PIN_MISMATCH');
  for(const [name,row] of Object.entries(entry.files)){
   if(path.isAbsolute(name)||name.includes('\\')||name.split('/').some(x=>!x||x==='.'||x==='..'))throw Error('HISTORICAL_PATH_INVALID');
   const bytes=Buffer.from(row.base64,'base64');
   if(createHash('sha256').update(bytes).digest('hex')!==row.sha256||createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex')!==row.git_blob_sha)throw Error('HISTORICAL_BYTES_CHANGED');
  }
 }
 return all;
}
export function historicalSource(kind){
 if(!Object.hasOwn(pins,kind))throw Error('HISTORICAL_KIND_INVALID');
 if(cache.has(kind))return cache.get(kind);
 const all=decodeHistoricalSources(readFileSync(new URL('../fixtures/historical-reviewed-source.gzip.base64',import.meta.url),'utf8'));
 const root=mkdtempSync(path.join(tmpdir(),'mushavo-pinned-'+kind+'-'));
 after(()=>rmSync(root,{recursive:true,force:true}));
 for(const [name,row]of Object.entries(all[kind].files)){const p=path.join(root,name);mkdirSync(path.dirname(p),{recursive:true});writeFileSync(p,Buffer.from(row.base64,'base64'));}
 const extra=kind==='FR1'?['scripts/prepare-final-staging.mjs','scripts/prepare-final-staging-correction.mjs','scripts/check-final-staging-serving.mjs','scripts/offline-test-network.cjs','docs/security-audit/security-final-staging-source-contract.json']:['scripts/collect-stage-10-public-metadata.mjs','scripts/lib/stage-10-public-metadata.mjs','scripts/offline-test-network.cjs','docs/security-audit/security-stage-10-operations-candidate-contract.json'];
 for(const name of extra){const p=path.join(root,name);mkdirSync(path.dirname(p),{recursive:true});copyFileSync(path.join(repo,name),p);}
 cache.set(kind,root);return root;
}
