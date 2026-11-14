import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {readPublicZIP} from './lib/read-public-zip.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
const root=new URL('../',import.meta.url);
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
export function prepare(previous,output){
 const manifest=JSON.parse(fs.readFileSync(new URL('scripts/business-seats-manifest.json',root)));
 for(const [name,digest] of Object.entries(manifest.sources)){
  if(hash(fs.readFileSync(new URL(name,root)))!==digest)throw Error('SOURCE_HASH_MISMATCH');
 }
 const original=fs.readFileSync(previous);
 if(hash(original)!=='79efc8646cd64a1cc0604857ebc6433dcf5c69aff984d0c6fd328991e94e8702')throw Error('ACCEPTED_SIGNOUT_RETRY_ZIP_REQUIRED');
 if(fs.readdirSync(output).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 const entries=readPublicZIP(original,42);
 for(const name of ['app.js','app.html'])entries.set(name,Buffer.from(fs.readFileSync(new URL(name,root),'utf8').replaceAll('kttkospkblwvguuwnhjj','dczlddwbtgvfdujgcitb')));
 const bytes=createPublicZIP([...entries]),decoded=readPublicZIP(bytes,42);
 for(const [name,data] of entries)if(!data.equals(decoded.get(name)))throw Error('ZIP_READBACK_FAILED');
 const zip=path.join(output,'mushavo-business-seats-staging.zip');
 fs.writeFileSync(zip,bytes,{flag:'wx'});
 const sqlName='security_fr_2_5_business_seats.sql';
 fs.copyFileSync(new URL('supabase/candidates/'+sqlName,root),path.join(output,sqlName),fs.constants.COPYFILE_EXCL);
 return {result:'BUSINESS_SEATS_PREPARED_NOT_DEPLOYED',ZIP_path:zip,ZIP_SHA256:hash(bytes),public_files:42,changed_files:['app.js','app.html'],unchanged_public_files:40,SQL_install_required:true,SQL_executed:false,frontend_uploaded:false,actual_hosted_requests:0,hosted_acceptance:false,exit_code:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(prepare(process.argv[2],process.argv[3]),null,2));}
 catch(error){console.log(JSON.stringify({result:'BUSINESS_SEATS_PREPARATION_FAILED',message:error.message,exit_code:1},null,2));process.exitCode=1;}
}
