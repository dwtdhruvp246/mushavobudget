import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readPublicZIP} from './lib/read-public-zip.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
const root=new URL('../',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function replaceSeatEntries(previous,replacements){
 if(!(previous instanceof Map)||previous.size!==42||!previous.has('app.js')||!previous.has('app.html')
 ||!(replacements instanceof Map)||replacements.size!==2||!replacements.has('app.js')||!replacements.has('app.html'))throw Error('PUBLIC_SET_REQUIRED');
 for(const bytes of replacements.values())if(!Buffer.isBuffer(bytes)||!bytes.length)throw Error('SOURCE_REQUIRED');
 const result=new Map(previous);
 for(const [name,bytes] of replacements)result.set(name,bytes);
 if([...previous].filter(([name,bytes])=>!replacements.has(name)&&bytes.equals(result.get(name))).length!==40)throw Error('UNRELATED_PUBLIC_CHANGE');
 return result;
}
export function prepare(previous,output){
 const manifest=JSON.parse(fs.readFileSync(new URL('scripts/business-seats-simple-manifest.json',root)));
 for(const [name,digest] of Object.entries(manifest.sources)){
  if(hash(fs.readFileSync(new URL(name,root)))!==digest)throw Error('SOURCE_HASH_MISMATCH');
 }
 const original=fs.readFileSync(previous);
 if(hash(original)!=='99b4c23e6e2b44cb7c98c2945e15915daa0963efe278323aed1119e3a2311240')throw Error('ACCEPTED_BUSINESS_SEATS_ZIP_REQUIRED');
 if(fs.readdirSync(output).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 const replacements=new Map(['app.js','app.html'].map(name=>[name,Buffer.from(fs.readFileSync(new URL(name,root),'utf8').replaceAll('kttkospkblwvguuwnhjj','dczlddwbtgvfdujgcitb'))]));
 const entries=replaceSeatEntries(readPublicZIP(original,42),replacements);
 const bytes=createPublicZIP([...entries]),decoded=readPublicZIP(bytes,42);
 for(const [name,data] of entries)if(!data.equals(decoded.get(name)))throw Error('ZIP_READBACK_FAILED');
 const zip=path.join(output,'mushavo-business-seats-simple-staging.zip');
 fs.writeFileSync(zip,bytes,{flag:'wx'});
 if(!fs.readFileSync(zip).equals(bytes)||!fs.readFileSync(previous).equals(original))throw Error('ZIP_READBACK_FAILED');
 return {progress_display:'Stage 3/10 | FR.2/8 | Batch W/Z',result:'BUSINESS_SEAT_EDITOR_SIMPLIFIED_PREPARED_NOT_DEPLOYED',
 ZIP_path:zip,ZIP_SHA256:hash(bytes),source_hashes_verified:Object.keys(manifest.sources).length,public_files:42,changed_files:['app.js','app.html'],
 unchanged_public_files:40,SQL_install_required:false,SQL_executed:false,frontend_uploaded:false,actual_hosted_requests:0,hosted_acceptance:false,exit_code:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(prepare(process.argv[2],process.argv[3]),null,2));}
 catch(error){const codes=new Set(['PUBLIC_SET_REQUIRED','SOURCE_REQUIRED','UNRELATED_PUBLIC_CHANGE','SOURCE_HASH_MISMATCH','ACCEPTED_BUSINESS_SEATS_ZIP_REQUIRED','EMPTY_OUTPUT_REQUIRED','ZIP_READBACK_FAILED']);
 console.log(JSON.stringify({result:'BUSINESS_SEAT_EDITOR_PREPARATION_FAILED',problem_code:codes.has(error.message)?error.message:'SOURCE_OR_PATH_REQUIRED',exit_code:1},null,2));process.exitCode=1;}
}
