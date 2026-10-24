import path from 'node:path';
import {fileURLToPath} from 'node:url';
const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const expectedInputs=new Set(['email-verification-crypto.mjs','email-verification-http.mjs','email-verification-zoho.mjs',
  'email-verification-gateway.mjs','email-verification-rate-client.mjs','email-verification-pages.mjs','email-verification-rate-do.mjs']
  .map(file=>'supabase/functions/_shared/'+file));
export async function buildEmailWorkers(esbuild,root=defaultRoot) {
  if(esbuild.version!=='0.28.2')throw Error('PINNED_ESBUILD_REQUIRED');
  const artifacts={};const seen=new Set();
  for(const[name,file]of [['pages','email-verification-pages.mjs'],['limiter','email-verification-rate-do.mjs']]) {
    const built=await esbuild.build({absWorkingDir:root,entryPoints:['supabase/functions/_shared/'+file],
      outfile:name==='pages'?'_worker.js':'email-rate-worker.mjs',bundle:true,format:'esm',platform:'browser',target:'es2022',
      write:false,metafile:true,minify:false,sourcemap:false,legalComments:'none',logLevel:'silent',charset:'ascii'});
    if(built.outputFiles.length!==1||built.outputFiles[0].contents.length>131072)throw Error('UNEXPECTED_BUNDLE_SHAPE');
    for(const input of Object.keys(built.metafile.inputs)) {
      const normal=input.replaceAll('\\','/');if(!expectedInputs.has(normal))throw Error('UNREVIEWED_BUNDLE_INPUT');seen.add(normal);
    }
    if(Object.values(built.metafile.outputs).some(out=>out.imports.length!==0))throw Error('UNRESOLVED_WORKER_IMPORT');
    artifacts[name]=built.outputFiles[0].text;
  }
  if(seen.size!==expectedInputs.size)throw Error('INCOMPLETE_BUNDLE_INPUTS');
  return {...artifacts,inputs:[...seen].sort()};
}
