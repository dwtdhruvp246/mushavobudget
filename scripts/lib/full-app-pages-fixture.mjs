// Test-only adapter: the unchanged legacy fixture now sees real Pages-style 308s.
// No provider traffic, extra server, product-source rewrite or TLS relaxation.
import https from 'node:https';
import {fullAppLocalFixture} from './full-app-local-fixture.mjs';
import {pagesHTMLAliases} from './full-app-pages-redirects.mjs';
export async function fullAppPagesFixture(modulePath,{pagesFailure=null,fixtureFactory=fullAppLocalFixture,...options}={}){
 if(typeof fixtureFactory!=='function')throw Error('LOCAL_PAGES_FACTORY_REQUIRED');
 if(![null,'redirect'].includes(pagesFailure))throw Error('LOCAL_PAGES_FAILURE_REQUIRED');
 const original=https.createServer;
 try {
  https.createServer=function(tls,handler){
   if(!tls||typeof tls.cert!=='string'||typeof tls.key!=='string'||typeof handler!=='function')throw Error('LOCAL_PAGES_SERVER_REQUIRED');
   return original.call(this,tls,(req,res)=>{
    const u=new URL(req.url,'https://'+req.headers.host);
    if(u.hostname==='localhost'&&req.method==='GET'){
     const clean=u.pathname.endsWith('.html')?u.pathname.slice(0,-5):null;
     if(clean&&pagesHTMLAliases[clean]===u.pathname){res.writeHead(308,{location:pagesFailure==='redirect'?'/api/email-verification/begin':clean+u.search,'content-length':'0'});res.end();return;}
     if(pagesHTMLAliases[u.pathname])req.url=pagesHTMLAliases[u.pathname]+u.search;
    }
    return handler(req,res);
   });
  };
  return await fixtureFactory(modulePath,options);
 } finally {https.createServer=original;}
}
