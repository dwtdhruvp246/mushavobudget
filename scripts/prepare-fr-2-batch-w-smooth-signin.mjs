// Patch only background sign-in UI in the exact accepted staging archive. No deployment, SQL or email.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readCanonicalPublicZIP} from './prepare-fr-2-email-modern-package.mjs';
import {createPublicZIP} from './lib/store-public-zip.mjs';
const root=new URL('../',import.meta.url),hash=b=>createHash('sha256').update(b).digest('hex');
export const stage='FR.2.5.W37_SMOOTH_BACKGROUND_VERIFICATION_AND_FRESH_PROOF';
export const display='Stage 3/10 | FR.2/8 | Batch W/Z';
export const retainedZIPHash='1696a99a4fd5fde38210818ada25a983a352a5cb0b547294383b007aaa45865b';
export const updates=[
 {name:'email-verification.js',before:'9273be56b63614d7bf8041133362070cc34bfea5266dc8fd2272209c0fce8743',after:'32517c78d13ab401238c3d07d460f64710e8122d0474876e07d541b4d09f2875'},
 {name:'session-entry.js',before:'e4beb5ab129d8ed0b75f22670e37bdd18f79a9637377ec629328e89cd5c3df53',after:'970809c0d1ff9e1b170098147026b080dafcef585cf1c8ffd3f1f2f6745811ab'},
 {name:'auth-flows.js',before:'d22778e9f3b21180d30161a6588b4675f73ac5c2f939bc4b82c224a81106cffa',after:'795630fc842fa2ee40a4b5ca8b43ad28d32aa1c8480002dac93ad430ebfee23c'},
 {name:'app.js',before:'ba02a923b8373d5812df1499ab570fafb45cad078d252ef63d42cb087a866e8e',after:'c18946c75ae34a52f91ecb755ec29e7c50f92628829180035096fdfbfdb5c0c6'},
 {name:'business.js',before:'bacb6b6d01db0018361253332777f2296332a3ac66b367a99494b3124f1b7628',after:'b7fa416d4f56468842da986a6290796a0b482fdc2c4feda32521624681de608f'},
 {name:'styles.css',before:'a34e2aef3181399bcda1320496732bddb474ddf6044135c707c7297c0726b80d',after:'2502aba1e198ad5c1e63bfc255e1e3254d5d3cf1374aa75555b1c172b045a321'},
 {name:'business.css',before:'a1a129f9d400c11c211e842e40f44195e3ccb16397ec925f75aea8a3673064d9',after:'ddcbb062a597f752634948c442292de2e2dfadda938a31697caf21f4d28c3321'},
 {name:'auth.html',before:'e07cffa1be014ad28197b402978020e7b7e40b79797d9ea64cc485d87870fb4e',after:'bc59aedaf62fe83bccf3fcdf8e1503dc49fc3c03be105a5468cd73ae92daaa77'},
 {name:'app.html',before:'db910ee00accc58f37cc3f2ee786a5b26a1d4cd7bdae01cacdec1c2bd7d1bd59',after:'9d78464ca2bbe7cf07b65e766d2c2c6e87b1fc9de7372a8b58868e93dafa400c'},
 {name:'business.html',before:'3ffba4d1057e53ce42b1161c93174496fd8ee6917b73b44260cb528311341b3c',after:'2ed5748411a2beab752b66829fb2fec896a26b6c708d9c29eb38d1741c6dfcec'}
];
export function verifySources(){
 const m=JSON.parse(fs.readFileSync(new URL('docs/security-audit/security-fr-2-batch-w-smooth-signin-source-manifest.json',root),'utf8'));
 const rows=Object.entries(m.file_sha256||{});
 if(m.stage_step!==stage||rows.length!==m.source_file_count||rows.length<12||rows.length>50)throw Error('AUTO_ENTRY_SOURCE_REQUIRED');
 for(const[name,digest]of rows){
  if(!/^[A-Za-z0-9_./-]+$/.test(name)||name.includes('..')||!/^[a-f0-9]{64}$/.test(digest))throw Error('AUTO_ENTRY_SOURCE_REQUIRED');
  const p=new URL(name,root);if(!fs.lstatSync(p).isFile()||hash(fs.readFileSync(p))!==digest)throw Error('AUTO_ENTRY_SOURCE_REQUIRED');
 }
 for(const row of updates)if(m.file_sha256[row.name]!==row.after)throw Error('AUTO_ENTRY_SOURCE_REQUIRED');
 return rows.length;
}
export function replaceEntries(previous,replacements){
 if(!(previous instanceof Map)||previous.size!==44||!(replacements instanceof Map)||replacements.size!==updates.length
 ||[...replacements.keys()].sort().join(',')!==updates.map(x=>x.name).sort().join(','))throw Error('PUBLIC_SET_REQUIRED');
 const next=new Map(previous);
 for(const[name,{before,bytes}]of replacements){
  if(!Buffer.isBuffer(previous.get(name))||hash(previous.get(name))!==before)throw Error('PRIOR_AUTO_ENTRY_SOURCE_REQUIRED');
  if(!Buffer.isBuffer(bytes)||!bytes.length)throw Error('AUTO_ENTRY_SOURCE_REQUIRED');next.set(name,bytes);
 }
 if([...previous].filter(([name,b])=>!replacements.has(name)&&Buffer.isBuffer(b)&&b.equals(next.get(name))).length!==44-updates.length)throw Error('UNRELATED_PUBLIC_CHANGE_REFUSED');
 return next;
}
function ordinary(filename,directory=false){
 if(typeof filename!=='string'||!path.isAbsolute(filename))throw Error('PUBLIC_PATH_REQUIRED');
 for(let current=filename;;){if(fs.lstatSync(current).isSymbolicLink())throw Error('PUBLIC_PATH_REQUIRED');const parent=path.dirname(current);if(parent===current)break;current=parent;}
 if(directory?!fs.statSync(filename).isDirectory():!fs.statSync(filename).isFile())throw Error('PUBLIC_PATH_REQUIRED');
}
export function prepareSmoothSigninZIP(retained,output){
 const count=verifySources();ordinary(retained);ordinary(output,true);
 if(fs.readdirSync(output).length)throw Error('EMPTY_OUTPUT_REQUIRED');
 if(fs.statSync(retained).size>8388608)throw Error('ACCEPTED_AUTO_SIGNIN_ZIP_REQUIRED');
 const prior=fs.readFileSync(retained);if(hash(prior)!==retainedZIPHash)throw Error('ACCEPTED_AUTO_SIGNIN_ZIP_REQUIRED');
 const next=replaceEntries(readCanonicalPublicZIP(prior),new Map(updates.map(row=>[row.name,{before:row.before,bytes:fs.readFileSync(new URL(row.name,root))}])));
 const bytes=createPublicZIP([...next]),decoded=readCanonicalPublicZIP(bytes);
 if([...next].some(([name,b])=>!b.equals(decoded.get(name)))||hash(fs.readFileSync(retained))!==retainedZIPHash)throw Error('ZIP_READBACK_REQUIRED');
 const filename=path.join(output,'mushavo-smooth-signin-staging.zip');fs.writeFileSync(filename,bytes,{flag:'wx'});
 if(!fs.readFileSync(filename).equals(bytes))throw Error('ZIP_READBACK_REQUIRED');
 return{stage_step:stage,progress_display:display,result:'SMOOTH_SIGNIN_PUBLIC_ZIP_PREPARED_NOT_DEPLOYED',
 source_parent_commit:'d24945b1bb71f4876333603171f719d92d6ab794',source_hashes_verified:count,
 public_files:44,changed_files:updates.map(x=>x.name),unchanged_public_entries:44-updates.length,
 retained_ZIP_SHA256_verified:retainedZIPHash,retained_ZIP_unchanged:true,
 configuration_worker_service_worker_headers_and_routes_byte_preserved:true,
 ZIP_path:filename,ZIP_SHA256:hash(bytes),portable_ZIP_readback_verified:true,Windows_dotNET_ZIP_readback_verified:false,
 actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,
 pending_batch_V_MFA_deferred_by_owner:true,full_lettered_batch_W_complete:false,hosted_acceptance:false,
 production_or_native_changed:false,APK_update_deferred:true,findings_closed:[],exit_code:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{if(process.argv.length!==4)throw Error('PUBLIC_PATH_REQUIRED');console.log(JSON.stringify(prepareSmoothSigninZIP(process.argv[2],process.argv[3]),null,2));}
 catch(error){const known=new Set(['AUTO_ENTRY_SOURCE_REQUIRED','PUBLIC_SET_REQUIRED','PRIOR_AUTO_ENTRY_SOURCE_REQUIRED','UNRELATED_PUBLIC_CHANGE_REFUSED','PUBLIC_PATH_REQUIRED','EMPTY_OUTPUT_REQUIRED','ACCEPTED_AUTO_SIGNIN_ZIP_REQUIRED','ZIP_READBACK_REQUIRED']);
 console.log(JSON.stringify({stage_step:stage,progress_display:display,result:'SMOOTH_SIGNIN_PREPARATION_REVIEW_REQUIRED',problem_code:known.has(error?.message)?error.message:'PUBLIC_ZIP_OR_SOURCE_REQUIRED',actual_hosted_requests:0,real_email_requests:0,settings_SQL_or_account_writes:0,frontend_uploaded:false,hosted_acceptance:false,production_or_native_changed:false,exit_code:1},null,2));process.exitCode=1;}
}
