import {readBoundedJSON} from './email-verification-http.mjs';
const reply=(status,data)=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
// Legacy-compatible fetch class; no public HTTP handler forwards to this namespace.
export class EmailGatewayRateLimiter {
  constructor(ctx) {
    this.ctx=ctx;
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS requests(at_ms INTEGER NOT NULL)');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS requests_time ON requests(at_ms)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS clock_state(id INTEGER PRIMARY KEY CHECK(id=1),last_ms INTEGER NOT NULL)');
  }
  async fetch(request) {
    try {
      if(request.url!=='https://email-rate.internal/check'||request.method!=='POST'
        ||request.headers.get('x-mushavo-internal')!=='email-rate-v1')return reply(404,{success:false});
      const body=await readBoundedJSON(request,32);
      if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length)return reply(400,{success:false});
      const result=this.ctx.storage.transactionSync(()=>{
        const sql=this.ctx.storage.sql;
        const prior=[...sql.exec('SELECT last_ms FROM clock_state WHERE id=1')][0]?.last_ms||0;
        const now=Math.max(Date.now(),prior);
        sql.exec('INSERT INTO clock_state(id,last_ms) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET last_ms=excluded.last_ms',now);
        sql.exec('DELETE FROM requests WHERE at_ms<=?',now-3600000);
        const stats=[...sql.exec('SELECT count(*) AS hour_count,coalesce(sum(CASE WHEN at_ms>? THEN 1 ELSE 0 END),0) AS minute_count FROM requests',now-60000)][0];
        const success=stats.hour_count<600&&stats.minute_count<60;
        if(success)sql.exec('INSERT INTO requests(at_ms) VALUES(?)',now);
        const latest=[...sql.exec('SELECT max(at_ms) AS latest FROM requests')][0].latest;
        return {success,alarm:latest===null?null:latest+3600001};
      });
      if(result.alarm!==null)await this.ctx.storage.setAlarm(result.alarm);
      return reply(200,{success:result.success});
    } catch {return reply(503,{success:false});}
  }
  async alarm() {
    const now=Date.now();
    const latest=this.ctx.storage.transactionSync(()=>{
      this.ctx.storage.sql.exec('DELETE FROM requests WHERE at_ms<=?',now-3600000);
      return [...this.ctx.storage.sql.exec('SELECT max(at_ms) AS latest FROM requests')][0].latest;
    });
    if(latest!==null)await this.ctx.storage.setAlarm(latest+3600001);
    else this.ctx.storage.sql.exec('DELETE FROM clock_state');
  }
}
export default {fetch(){return reply(404,{success:false});}};
