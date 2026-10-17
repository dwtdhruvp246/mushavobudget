import gateway from './email-verification-gateway.mjs';
import {durableRatePort} from './email-verification-rate-client.mjs';
// Separate Pages entrypoint keeps the reviewed E3.1 handlers unchanged.
export default {
  async fetch(request,env) {
    if(!new URL(request.url).pathname.startsWith('/api/email-verification/'))return gateway.fetch(request,env);
    try {
      const port=durableRatePort(env.EMAIL_GATE_LIMITER_NS,env.EMAIL_GATE_RATE_PEPPER);
      return gateway.fetch(request,{...env,EMAIL_GATE_RATE_LIMITER:port});
    } catch {
      return new Response('{"result":"UNAVAILABLE"}',{status:503,headers:{'content-type':'application/json',
        'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer',
        'content-security-policy':"default-src 'none'; frame-ancestors 'none'"}});
    }
  }
};
