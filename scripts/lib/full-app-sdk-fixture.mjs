import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
const root=new URL('../fixtures/full-app-sdk/',import.meta.url);
const hash=b=>createHash('sha256').update(b).digest('hex');
export function verifySDKGraph(sdk){
 if(typeof vm.SourceTextModule!=='function')throw Error('SDK_PARSER_FLAG_REQUIRED');
 for(const [url,row]of sdk.modules){
  const parsed=new vm.SourceTextModule(row.bytes.toString(),{identifier:url});
  const actual=[...new Set(parsed.dependencySpecifiers)].sort();
  if(JSON.stringify(actual)!==JSON.stringify([...row.imports].sort()))throw Error('SDK_GRAPH_REQUIRED');
 }
 return {modules:sdk.modules.size,parser:'NODE_V8_SOURCE_TEXT_MODULE_STATIC_DEPENDENCIES',optional_dynamic_tracing_import_executed:false};
}
export async function loadFullAppSDK(){
 const manifest=JSON.parse(await readFile(new URL('manifest.json',root),'utf8')),modules=new Map();
 if(Object.keys(manifest.modules).length!==9||!Object.hasOwn(manifest.modules,manifest.entry))throw Error('SDK_GRAPH_REQUIRED');
 for(const [url,row]of Object.entries(manifest.modules)){
  if(!/^https:\/\/cdn\.jsdelivr\.net\/npm\/(?:@[a-z0-9-]+\/)?[a-z0-9-]+@[0-9][a-zA-Z0-9.+-]*\/\+esm$/.test(url)||! /^[a-f0-9]{20}\.mjs$/.test(row.filename)||row.license_filename!==row.filename.replace('.mjs','.LICENSE.txt'))throw Error('SDK_GRAPH_REQUIRED');
  const bytes=await readFile(new URL(row.filename,root));if(bytes.length!==row.bytes||hash(bytes)!==row.sha256)throw Error('SDK_BYTES_REQUIRED');
  if(!Array.isArray(row.imports)||!row.imports.every(p=>typeof p==='string'&&Object.hasOwn(manifest.modules,new URL(p,url).href)))throw Error('SDK_GRAPH_REQUIRED');
  if(hash(await readFile(new URL(row.license_filename,root)))!==row.license_sha256)throw Error('SDK_LICENSE_REQUIRED');
  modules.set(url,{bytes,sha256:row.sha256,imports:row.imports});
 }
 return {entry:manifest.entry,modules};
}
