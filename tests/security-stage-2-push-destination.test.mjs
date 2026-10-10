import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import https from "node:https";
import test from "node:test";
import {
  createGuardedPushSender, createPushLookup, isPublicPushAddress,
  isBlockedPushDestination, validatePushEndpoint,
} from "../supabase/functions/_shared/push-destination.mjs";

const allowed = [
  "https://fcm.googleapis.com/fcm/send/OPAQUE%2FTEST?token=abc",
  "HTTPS://FCM.GOOGLEAPIS.COM:443/fcm/send/OPAQUE_TEST",
  "https://android.googleapis.com/gcm/send/OPAQUE_TEST",
  "https://updates.push.services.mozilla.com/wpush/v2/OPAQUE_TEST",
  "https://updates-push.services.mozaws.net/wpush/v2/OPAQUE_TEST",
  "https://web.push.apple.com/Qabc/OPAQUE_TEST",
  "https://a.b.push.apple.com/OPAQUE_TEST",
  "https://db5.notify.windows.com/?token=OPAQUE_TEST",
];
const rejected = [
  null, undefined, "", 12, "https://fcm.googleapis.com/" + "x".repeat(4096),
  "http://fcm.googleapis.com/fcm/send/TEST", "ftp://fcm.googleapis.com/TEST",
  "https://localhost/OPAQUE_TEST", "https://127.0.0.1/OPAQUE_TEST",
  "https://10.0.0.1/OPAQUE_TEST", "https://169.254.169.254/OPAQUE_TEST",
  "https://2130706433/OPAQUE_TEST", "https://0x7f000001/OPAQUE_TEST",
  "https://[::1]/OPAQUE_TEST", "https://[::ffff:127.0.0.1]/OPAQUE_TEST",
  "https://example.com/OPAQUE_TEST", "https://fcm.googleapis.com.evil.example/TEST",
  "https://evilfcm.googleapis.com/TEST", "https://web.push.apple.com.evil.example/TEST",
  "https://evilpush.apple.com/TEST", "https://notify.windows.com.evil.example/TEST",
  "https://fcm.googleapis.com./TEST", "https://user:pass@fcm.googleapis.com/TEST",
  "https://fcm.googleapis.com@127.0.0.1/TEST", "https://%66cm.googleapis.com/TEST",
  "https://fcm.googleapis.com:80/TEST", "https://fcm.googleapis.com:444/TEST",
  "https://fcm.googleapis.com:0443/TEST", "https://fcm.googleapis.com:443abc/TEST",
  "https://fcm.googleapis.com/TEST#fragment", "https://fcm.googleapis.com/TEST#",
  " https://fcm.googleapis.com/TEST", "https://fcm.googleapis.com/TEST\n",
  String.raw`https://fcm.googleapis.com\@localhost/TEST`,
  "https://ｆcm.googleapis.com/TEST", "https://fcm.googleаpis.com/TEST",
  "https:///fcm.googleapis.com/TEST", "https://fcm.googleapis.com:443:/TEST",
  "https://" + "a".repeat(64) + ".push.apple.com/TEST",
];
const privateAddresses = [
  "0.0.0.0","0.1.2.3","10.0.0.1","10.255.255.255","100.64.0.1","100.127.255.255",
  "127.0.0.1","127.255.1.1","169.254.1.1","172.16.0.1","172.31.255.255",
  "192.0.0.1","192.0.2.1","192.88.99.1","192.168.0.1","198.18.0.1",
  "198.19.255.255","198.51.100.1","203.0.113.1","224.0.0.1","239.1.1.1",
  "240.0.0.1","255.255.255.255","::","::1","::ffff:127.0.0.1",
  "0:0:0:0:0:ffff:7f00:1","::ffff:808:808","64:ff9b::808:808",
  "100::1","2001::1","2001:1ff::1","2001:db8::1","2002:0808:0808::1",
  "3fff::1","3fff:fff:ffff::1","fc00::1","fdff::1","fe80::1","ff02::1",
  "2606:4700::1%eth0","2606:4700::192.0.2.1","127.000.0.1","garbage","1.2.3.999",
];
const publicAddresses = [
  "8.8.8.8","1.1.1.1","100.63.255.255","100.128.0.1","172.15.255.255","172.32.0.1",
  "169.253.255.255","169.255.0.1","198.17.255.255","198.20.0.1","223.255.255.255",
  "2001:4860:4860::8888","2606:4700:4700::1111","2a00:1450:4001::200e",
  "2606:4700:0000:0000:0000:0000:0000:1111","2001:200::1","3fff:1000::1",
];
function lookupResult(lookup, hostname = "fcm.googleapis.com", options = {}) {
  return new Promise((resolve, reject) => lookup(hostname, options, (error, address, family) =>
    error ? reject(error) : resolve({ address, family })));
}
test("provider endpoints retain opaque path/query bytes", () => {
  for (const endpoint of allowed) assert.equal(validatePushEndpoint(endpoint).endpoint, endpoint);
});
test("malformed, lookalike, credentialed and private literal endpoints reject without echoing input", () => {
  for (const endpoint of rejected) {
    assert.throws(() => validatePushEndpoint(endpoint), error =>
      isBlockedPushDestination(error) && error.message === "PUSH_DESTINATION_BLOCKED");
  }
});
test("conservative IPv4/IPv6 classification rejects special/private and allows representative public addresses", () => {
  for (const address of privateAddresses) assert.equal(isPublicPushAddress(address), false, address);
  for (const address of publicAddresses) assert.equal(isPublicPushAddress(address), true, address);
});
test("lookup returns the vetted answer for single, all and family-specific connections", async () => {
  const records = [{address:"8.8.8.8",family:4},{address:"2606:4700:4700::1111",family:6}];
  const lookup = createPushLookup("fcm.googleapis.com", (_host, options, callback) => {
    assert.deepEqual(options, {all:true,verbatim:true}); callback(null, records);
  });
  assert.deepEqual(await lookupResult(lookup), {address:"8.8.8.8",family:4});
  assert.deepEqual((await lookupResult(lookup, undefined, {all:true})).address, records);
  assert.deepEqual(await lookupResult(lookup, undefined, {family:6}), {address:records[1].address,family:6});
});
test("mixed, mapped, malformed and inconsistent DNS answers reject the entire answer", async () => {
  for (const records of [
    [{address:"8.8.8.8",family:4},{address:"127.0.0.1",family:4}],
    [{address:"::ffff:127.0.0.1",family:6}],
    [{address:"8.8.8.8",family:6}], [{address:"not-an-IP",family:4}], [null],
  ]) {
    const lookup = createPushLookup("fcm.googleapis.com", (_h,_o,callback) => callback(null,records));
    await assert.rejects(lookupResult(lookup), isBlockedPushDestination);
  }
});
test("each connection revalidates DNS and a different hostname never reaches the resolver", async () => {
  let count = 0;
  const lookup = createPushLookup("fcm.googleapis.com", (_h,_o,callback) => {
    count++; callback(null,[{address:count === 1 ? "8.8.8.8" : "10.0.0.1",family:4}]);
  });
  await lookupResult(lookup);
  await assert.rejects(lookupResult(lookup), isBlockedPushDestination);
  await assert.rejects(lookupResult(lookup,"localhost"), isBlockedPushDestination);
  assert.equal(count,2);
});
test("DNS failure, empty/family-incompatible answers and deadlines remain temporary with safe errors", async () => {
  for (const resolver of [
    (_h,_o,callback) => callback(new Error("PRIVATE_DNS_DETAIL")),
    (_h,_o,callback) => callback(null,[]),
    () => {throw new Error("PRIVATE_DNS_DETAIL");},
  ]) {
    await assert.rejects(lookupResult(createPushLookup("fcm.googleapis.com",resolver)), error =>
      !isBlockedPushDestination(error) && error.message === "PUSH_DNS_LOOKUP_FAILED");
  }
  const ipv4 = createPushLookup("fcm.googleapis.com", (_h,_o,callback) => callback(null,[{address:"8.8.8.8",family:4}]));
  await assert.rejects(lookupResult(ipv4,undefined,{family:6}), /PUSH_DNS_NO_COMPATIBLE_ADDRESS/);
  let calls = 0;
  const slow = createPushLookup("fcm.googleapis.com", (_h,_o,callback) => {
    setTimeout(() => callback(null,[{address:"8.8.8.8",family:4}]),25);
  },5);
  await new Promise(resolve => slow("fcm.googleapis.com",{},error => {
    calls++; assert.equal(error.message,"PUSH_DNS_TIMEOUT"); setTimeout(resolve,35);
  }));
  assert.equal(calls,1);
});
test("the native HTTPS Agent rejects a private DNS answer before connecting", async () => {
  let resolutions = 0;
  const agent = new https.Agent({lookup:createPushLookup("fcm.googleapis.com", (_h,_o,callback) => {
    resolutions++; callback(null,[{address:"127.0.0.1",family:4}]);
  })});
  try {
    await assert.rejects(new Promise((resolve,reject) => {
      const request = https.request({hostname:"fcm.googleapis.com",agent,method:"POST"}, response => {
        response.destroy(); reject(new Error("Unexpected network response"));
      });
      request.on("error",reject); request.end();
    }), isBlockedPushDestination);
    assert.equal(resolutions,1);
  } finally {agent.destroy();}
});
test("blocked endpoints never invoke the push library; network options cannot replace the guard", async () => {
  let sends = 0;
  const send = createGuardedPushSender({sendNotification(){sends++;return Promise.resolve({statusCode:201});}});
  for (const endpoint of rejected) await assert.rejects(send({endpoint,keys:{}},"test"),isBlockedPushDestination);
  for (const options of [{proxy:"https://proxy.example"}, {agent:false}, {timeout:0}, {headers:{Host:"localhost"}}, []]) {
    await assert.rejects(send({endpoint:allowed[0],keys:{}},"test",options), /PUSH_SEND_OPTIONS_INVALID/);
  }
  assert.equal(sends,0);
});
test("success and provider errors preserve options/results and always dispose of the guarded Agent", async () => {
  for (const statusCode of [201,404,410,429,503]) {
    let disposed = false;
    const failure = Object.assign(new Error("PRIVATE_PROVIDER_BODY"),{statusCode});
    const send = createGuardedPushSender({async sendNotification(subscription,payload,options){
      assert.equal(subscription.endpoint,allowed[0]);assert.equal(payload,"synthetic");
      assert.deepEqual(subscription.keys,{p256dh:"PRIVATE_KEY",auth:"PRIVATE_AUTH"});
      assert.equal(options.TTL,3600);assert.equal(options.urgency,"normal");assert.equal(options.timeout,10000);
      assert.ok(options.agent instanceof https.Agent); assert.equal(options.agent.options.keepAlive,false);
      assert.deepEqual(options.agent.options.proxyEnv, {});
      assert.equal(options.agent.options.rejectUnauthorized, true);
      assert.equal(options.agent.options.servername, "fcm.googleapis.com");
      const destroy = options.agent.destroy.bind(options.agent);
      options.agent.destroy = () => {disposed = true;destroy();};
      if(statusCode !== 201)throw failure;
      return {statusCode,body:"accepted"};
    }});
    const delivery = send({endpoint:allowed[0],keys:{p256dh:"PRIVATE_KEY",auth:"PRIVATE_AUTH"}},"synthetic",{TTL:3600,urgency:"normal"});
    if(statusCode===201)assert.deepEqual(await delivery,{statusCode,body:"accepted"});
    else await assert.rejects(delivery,error => error === failure);
    assert.equal(disposed,true);
  }
});

// Execute the actual three TypeScript entrypoints with isolated Auth/DB/transport doubles.
test("a whole-send deadline rejects a stalled send and disposes of its Agent", async () => {
  const originalTimeout = globalThis.setTimeout;
  let disposed = false;
  globalThis.setTimeout = (callback, milliseconds, ...args) => {
    if (milliseconds === 15000) {
      queueMicrotask(callback);
      return originalTimeout(() => {}, 1);
    }
    return originalTimeout(callback, milliseconds, ...args);
  };
  try {
    const send = createGuardedPushSender({sendNotification(_subscription, _payload, options) {
      const destroy = options.agent.destroy.bind(options.agent);
      options.agent.destroy = () => {disposed = true; destroy();};
      return new Promise(() => {});
    }});
    await assert.rejects(send({endpoint:allowed[0], keys:{}}, "test"), /PUSH_SEND_TIMEOUT/);
    assert.equal(disposed, true);
  } finally { globalThis.setTimeout = originalTimeout; }
});

// Execute the actual three TypeScript entrypoints with isolated Auth/DB/transport doubles.
// No hosted database, resolver, push provider or credentials are used.
let handlerSerial = 0;
async function runHandler(name, endpoint, providerStatus) {
  const source = await readFile(new URL("../supabase/functions/"+name+"/index.ts",import.meta.url),"utf8");
  const user = "synthetic-user", workspace = "synthetic-workspace";
  const sourceId = "11111111-1111-4111-8111-111111111111";
  const job = {id:"synthetic-job",user_id:user,workspace_id:workspace,source_id:sourceId,
    source_type:name === "dispatch-admin-notifications" ? "public_enquiry_created" : "business_bill",
    notification_id:"synthetic-notification",notification_type:"synthetic-test",title:"test",body:"test",
    target_url:"/app#payments",idempotency_key:"business_bill:"+sourceId+":due:2026-10-10:reminder:2026-10-10"};
  const updates=[],rpcs=[],logs=[];
  let sends=0,handler;
  const data = {
    push_subscriptions:[{id:"synthetic-device",endpoint,p256dh:"PRIVATE_KEY",auth:"PRIVATE_AUTH",failure_count:2}],
    business_bills:{id:sourceId,workspace_id:workspace,due_on:"2026-10-10",status:"open",amount:20,paid_amount:0},
    app_admins:{role:"super_admin"}, notifications:{id:job.notification_id,user_id:user,read_at:null},
    enquiries:{status:"new"},
  };
  const client = {
    auth:{getUser:async()=>({data:{user:{id:user}},error:null})},
    from(table) {
      let update, filters=[];
      const q = {
        select(){return q;},eq(...args){filters.push(args);return q;},is(...args){filters.push(args);return q;},
        update(value){update=value;return q;},
        maybeSingle(){return Promise.resolve({data:data[table] ?? null,error:null});},
        then(resolve,reject) {
          if(update)updates.push({table,value:update,filters});
          return Promise.resolve({data:update ? null : (data[table] ?? []),error:null}).then(resolve,reject);
        },
      };return q;
    },
    async rpc(name,params) {
      rpcs.push({name,params});
      let result = 0;
      if(name === "claim_push_test_rate_limit" || name === "business_bill_reminder_allowed")result=true;
      if(name === "claim_notification_outbox" || name === "claim_admin_notification_outbox")result=[job];
      return {data:result,error:null};
    },
  };
  const webpush = {
    setVapidDetails(){},
    async sendNotification(_sub,_payload,options) {
      sends++; assert.ok(options.agent instanceof https.Agent);assert.equal(options.timeout,10000);
      if(providerStatus!==201)throw Object.assign(new Error("PRIVATE_PROVIDER_BODY"),{statusCode:providerStatus});
      return {statusCode:201};
    },
  };
  const id = "__mushavoPushFixture" + (++handlerSerial);
  globalThis[id] = {createClient:()=>client,webpush};
  const env = {APP_ORIGIN:"https://mushavo-budget-staging.pages.dev",SUPABASE_URL:"https://synthetic.invalid",
    SUPABASE_ANON_KEY:"dummy-public",SUPABASE_SERVICE_ROLE_KEY:"dummy-service",
    VAPID_PUBLIC_KEY:"dummy-public",VAPID_PRIVATE_KEY:"dummy-private",VAPID_SUBJECT:"mailto:dummy@example.com",
    CRON_SECRET:"dummy-cron"};
  const oldDeno=globalThis.Deno, oldWarn=console.warn, oldError=console.error;
  globalThis.Deno={env:{get:key=>env[key]},serve(fn){handler=fn;}};
  console.warn=(...args)=>logs.push(args);console.error=(...args)=>logs.push(args);
  try {
    let js = stripTypeScriptTypes(source,{mode:"strip"});
    js=js.replace(/import[^;]*from "npm:@supabase\/supabase-js@2\.110\.9";/,
      "const {createClient}=globalThis."+id+";");
    js=js.replace('import webpush from "npm:web-push@3.6.7";',"const {webpush}=globalThis."+id+";");
    js=js.replace('"../_shared/push-destination.mjs"',JSON.stringify(new URL("../supabase/functions/_shared/push-destination.mjs",import.meta.url).href));
    await import("data:text/javascript;base64,"+Buffer.from(js+"\n//"+id).toString("base64"));
    assert.equal(typeof handler,"function");
    const response=await handler(new Request("https://synthetic.invalid/test",{
      method:"POST",headers:{Origin:env.APP_ORIGIN,Authorization:"Bearer dummy-session",
        "x-mushavo-cron-secret":env.CRON_SECRET,"Content-Type":"application/json"},
      body:JSON.stringify({source:"cron"}),
    }));
    const body=await response.json();
    const output=JSON.stringify({body,logs});
    for(const sensitive of ["PRIVATE_KEY","PRIVATE_AUTH","PRIVATE_PROVIDER_BODY",endpoint])assert.equal(output.includes(sensitive),false);
    return {responseStatus:response.status,body,updates,rpcs,sends};
  } finally {
    globalThis.Deno=oldDeno;console.warn=oldWarn;console.error=oldError;delete globalThis[id];
  }
}
for (const name of ["send-test-push","dispatch-push-reminders","dispatch-admin-notifications"]) {
  test(name+" blocks an unsafe endpoint before transport and retires only that device", async () => {
    const result=await runHandler(name,"https://127.0.0.1/PRIVATE_ENDPOINT",201);
    assert.equal(result.sends,0);
    const device=result.updates.find(row=>row.table==="push_subscriptions");
    assert.equal(device.value.failure_count,3);assert.ok(device.value.disabled_at);
    assert.deepEqual(device.filters,[["id","synthetic-device"],["user_id","synthetic-user"]]);
    if(name==="send-test-push"){
      assert.equal(result.responseStatus,502);assert.equal(result.body.disabled,1);
    }else{
      assert.equal(result.body.failed,1);assert.equal(result.body.retry,0);
      const outcome=result.rpcs.find(row=>row.name.startsWith("record_")).params;
      assert.equal(outcome.p_succeeded,false);assert.equal(outcome.p_permanent_failure,true);
    }
  });
  test(name+" preserves successful delivery and provider permanent/temporary failures", async () => {
    for(const statusCode of [201,404,410,429,503]){
      const result=await runHandler(name,allowed[0],statusCode);
      assert.equal(result.sends,1);
      const device=result.updates.find(row=>row.table==="push_subscriptions").value;
      const permanent=statusCode===404 || statusCode===410;
      if(statusCode===201){assert.equal(device.failure_count,0);assert.ok(device.last_success_at);}
      else{assert.equal(device.failure_count,3);assert.equal(Boolean(device.disabled_at),permanent);}
      if(name!=="send-test-push"){
        const outcome=result.rpcs.find(row=>row.name.startsWith("record_")).params;
        assert.equal(outcome.p_succeeded,statusCode===201);
        assert.equal(outcome.p_permanent_failure,permanent);
        assert.equal(result.body.retry,statusCode!==201 && !permanent ? 1 : 0);
      }
    }
  });
}
