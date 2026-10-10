import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFile } from "node:fs/promises";
import { createHash, createECDH, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import https from "node:https";
import { EventEmitter } from "node:events";
import {
  createGuardedPushSender, isBlockedPushDestination,
} from "../supabase/functions/_shared/push-destination.mjs";

const packageRoot = process.env.MUSHAVO_PUSH_TEST_DEPENDENCIES;
if (!packageRoot) throw new Error("Set MUSHAVO_PUSH_TEST_DEPENDENCIES to a separate folder containing web-push@3.6.7; no credentials are used.");
const require = createRequire(resolve(packageRoot, "package.json"));
const webpush = require("web-push");
assert.equal(require("web-push/package.json").version, "3.6.7");
const source = await readFile(require.resolve("web-push/src/web-push-lib.js"));
assert.equal(createHash("sha256").update(source).digest("hex"),
  "4a724b5452b0c51143808cdfd4e58efd3876fc5728af152635b8fcb340bbbff3");

const vapid = webpush.generateVAPIDKeys();
webpush.setVapidDetails("mailto:audit@example.com", vapid.publicKey, vapid.privateKey);
const receiver = createECDH("prime256v1");
receiver.generateKeys();
const subscription = {
  endpoint: "https://fcm.googleapis.com/fcm/send/SYNTHETIC_PRIVATE_PATH",
  keys: { p256dh: receiver.getPublicKey().toString("base64url"), auth: randomBytes(16).toString("base64url") },
};
let statusChecks = 0;
for (const statusCode of [201, 301, 302, 303, 307, 308, 404, 410, 429, 503]) {
  const original = https.request;
  let requestCount = 0, bodyWritten = false, agent;
  https.request = (options, onResponse) => {
    requestCount++;
    agent = options.agent;
    assert.equal(options.hostname, "fcm.googleapis.com");
    assert.equal(options.timeout, 10000);
    assert.ok(agent instanceof https.Agent);
    assert.equal(typeof agent.options.lookup, "function");
    assert.equal(agent.options.rejectUnauthorized, true);
    assert.equal(agent.options.servername, "fcm.googleapis.com");
    assert.deepEqual(agent.options.proxyEnv, {});
    const request = new EventEmitter();
    request.write = body => { assert.ok(Buffer.isBuffer(body)); bodyWritten = true; };
    request.destroy = error => queueMicrotask(() => request.emit("error", error));
    request.end = () => queueMicrotask(() => {
      const response = new EventEmitter();
      response.statusCode = statusCode;
      response.headers = { location: "http://127.0.0.1/NEVER_FOLLOW" };
      onResponse(response);
      response.emit("data", Buffer.from("synthetic provider response"));
      response.emit("end");
    });
    return request;
  };
  try {
    const result = createGuardedPushSender(webpush)(subscription, "synthetic payload", { TTL: 60, urgency: "normal" });
    if (statusCode === 201) assert.equal((await result).statusCode, 201);
    else await assert.rejects(result, error => error.statusCode === statusCode);
    assert.equal(requestCount, 1);
    assert.equal(bodyWritten, true);
    statusChecks++;
  } finally { https.request = original; agent?.destroy(); }
}

let resolutions = 0;
await assert.rejects(createGuardedPushSender(webpush, (_hostname, _options, callback) => {
  resolutions++;
  callback(null, [{ address: "127.0.0.1", family: 4 }]);
})(subscription, "synthetic payload", { TTL: 60 }), isBlockedPushDestination);
assert.equal(resolutions, 1);

const original = https.request;
let requests = 0, destroyed = false;
https.request = options => {
  requests++;
  assert.equal(options.timeout, 10000);
  const request = new EventEmitter();
  request.write = () => {};
  request.destroy = error => { destroyed = true; queueMicrotask(() => request.emit("error", error)); };
  request.end = () => queueMicrotask(() => request.emit("timeout"));
  return request;
};
try {
  await assert.rejects(createGuardedPushSender(webpush)(subscription, "test", { TTL: 60 }), error =>
    error.message === "Socket timeout" && !isBlockedPushDestination(error));
  assert.equal(requests, 1);
  assert.equal(destroyed, true);
} finally { https.request = original; }

console.log(JSON.stringify({
  stage_step: "2.3.2",
  result: "PINNED_WEB_PUSH_LOCAL_TRANSPORT_SCOPED_PASS",
  node: process.version,
  runtime: typeof Deno === "undefined" ? "Node " + process.version : "Deno " + Deno.version.deno,
  web_push: "3.6.7",
  source_matches_reviewed_sha256: true,
  response_status_cases: statusChecks,
  redirect_location_never_followed: true,
  full_dependency_native_agent_private_dns_rejected: true,
  socket_timeout_stays_temporary: true,
  synthetic_crypto_used: true,
  positive_http_response_transport: "LOCAL_REQUEST_DOUBLE",
  external_notifications_or_hosted_requests_sent: false,
  supabase_edge_runtime_or_real_device_delivery_verified: false
}, null, 2));
