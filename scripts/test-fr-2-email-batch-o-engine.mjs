// Offline actual-engine regression for O. Ephemeral localhost certificate only.
import https from 'node:https';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {localTLS} from './lib/browser-local-tls.mjs';
import {publicBrowser,publicRequestAllowed} from './check-fr-2-email-batch-o.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');let origin,unexpected=0;const variant=process.argv[3]??'normal';if(!['normal','source-drift','unreviewed-route'].includes(variant))throw Error('LOCAL_VARIANT_REQUIRED');
const server=https.createServer(localTLS(),async(req,res)=>{try{
 if(!publicRequestAllowed(origin+req.url,req.method,{origin})){unexpected++;res.writeHead(404).end();return;}
 let f=new URL(req.url,origin).pathname.slice(1);if(f==='offline'||f==='app-entry')f+='.html';
 let data=await readFile(path.join(root,f));if(variant==='source-drift'&&f==='sw.js')data=Buffer.concat([data,Buffer.from('\n// SYNTHETIC DRIFT\n')]);if(variant==='unreviewed-route'&&f==='offline.html')data=Buffer.from(data.toString().replace('</body>','<img src="/auth/batch-o-deny-probe"></body>'));const type=f.endsWith('.js')?'application/javascript':f.endsWith('.html')?'text/html':f.endsWith('.css')?'text/css':f.endsWith('.webmanifest')?'application/manifest+json':'image/png';
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'}).end(data);
 }catch{res.writeHead(500).end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='https://localhost:'+server.address().port;
let r;try{r=await publicBrowser(process.argv[2],{fixtureOrigin:origin});}finally{await new Promise(resolve=>server.close(resolve));}
r.local_fixture_variant=variant;r.local_fixture_closed=true;r.local_fixture_unexpected_requests=unexpected;console.log(JSON.stringify(r,null,2));process.exitCode=r.exit_code||Number(unexpected>0);
