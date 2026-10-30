// Password sign-in policy. Static assets only; retired sign-in-code routes never reach a provider.
const response=(status,result)=>new Response(JSON.stringify({result}),{status,headers:{
  'content-type':'application/json; charset=utf-8','cache-control':'no-store',
  'x-content-type-options':'nosniff','referrer-policy':'no-referrer',
  'content-security-policy':"default-src 'none'; frame-ancestors 'none'"
}});
export default {
  async fetch(request,env){
    if(new URL(request.url).pathname.startsWith('/api/email-verification/'))return response(410,'SIGNIN_VERIFICATION_REMOVED');
    if(!['GET','HEAD'].includes(request.method))return response(405,'METHOD_NOT_ALLOWED');
    if(typeof env?.ASSETS?.fetch!=='function')return response(503,'ASSETS_UNAVAILABLE');
    const clean=new Request(request);clean.headers.delete('authorization');clean.headers.delete('cookie');
    return env.ASSETS.fetch(clean);
  }
};

