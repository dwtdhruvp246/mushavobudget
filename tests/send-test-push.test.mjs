import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionSource = await readFile(
  new URL("../supabase/functions/send-test-push/index.ts", import.meta.url),
  "utf8"
);
const denoConfig = JSON.parse(await readFile(
  new URL("../supabase/functions/send-test-push/deno.json", import.meta.url),
  "utf8"
));
const migrationSource = await readFile(
  new URL("../supabase/migrations/20260908130000_push_test_rate_limit.sql", import.meta.url),
  "utf8"
);
const configSource = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
const applicationSource = await readFile(new URL("../app.js", import.meta.url), "utf8");
const applicationPage = await readFile(new URL("../app.html", import.meta.url), "utf8");
const workerSource = await readFile(new URL("../sw.js", import.meta.url), "utf8");

test("the Edge dependency and Supabase client are version-pinned", () => {
  assert.match(functionSource, /npm:web-push@3\.6\.7/);
  assert.match(functionSource, /npm:@types\/web-push@3\.6\.4/);
  assert.equal(denoConfig.nodeModulesDir, "auto");
  assert.match(functionSource, /@supabase\/supabase-js@2\.110\.9/);
});

test("the caller identity is verified and never accepted from the body", () => {
  assert.match(functionSource, /userClient\.auth\.getUser\(\)/);
  assert.match(functionSource, /\.eq\("user_id", userData\.user\.id\)/);
  assert.doesNotMatch(functionSource, /request\.json\(/);
  assert.match(configSource, /\[functions\.send-test-push\][\s\S]*verify_jwt = false/);
});

test("VAPID private material remains server-only", () => {
  assert.match(functionSource, /Deno\.env\.get\("VAPID_PRIVATE_KEY"\)/);
  assert.match(functionSource, /Deno\.env\.get\("VAPID_PUBLIC_KEY"\)/);
  assert.match(functionSource, /Deno\.env\.get\("VAPID_SUBJECT"\)/);
  assert.doesNotMatch(applicationSource, /VAPID_PRIVATE_KEY/);
  assert.doesNotMatch(applicationPage, /VAPID_PRIVATE_KEY/);
});

test("CORS is restricted to the configured official application origin", () => {
  assert.match(functionSource, /Deno\.env\.get\("APP_ORIGIN"\)/);
  assert.match(functionSource, /requestOrigin !== appOrigin/);
  assert.match(functionSource, /ORIGIN_NOT_ALLOWED/);
  assert.doesNotMatch(functionSource, /"Access-Control-Allow-Origin": "\*"/);
});

test("a durable service-role-only claim rate limits test sends", () => {
  const claimAt = functionSource.indexOf('"claim_push_test_rate_limit"');
  const sendAt = functionSource.indexOf("webpush.sendNotification");
  assert.ok(claimAt >= 0 && sendAt > claimAt);
  assert.match(migrationSource, /force row level security/);
  assert.match(migrationSource, /revoke all on table public\.push_test_rate_limits from anon, authenticated/);
  assert.match(migrationSource, /revoke all on function public\.claim_push_test_rate_limit\(uuid, integer\)[\s\S]*from public, anon, authenticated/);
  assert.match(migrationSource, /grant execute on function public\.claim_push_test_rate_limit\(uuid, integer\)[\s\S]*to service_role/);
});

test("test delivery uses a fixed payload and retires expired endpoints", () => {
  assert.match(functionSource, /const TEST_PAYLOAD = JSON\.stringify/);
  assert.match(functionSource, /Your payment reminder notifications are connected/);
  assert.match(functionSource, /statusCode === 404 \|\| statusCode === 410/);
  assert.match(functionSource, /disabled_at: permanentlyGone \? sentAt : null/);
});

test("the test control appears only for a linked current device", () => {
  assert.match(applicationPage, /id="sendTestPushButton"[^>]*hidden/);
  assert.match(applicationSource, /testButton\.hidden = true/);
  assert.match(applicationSource, /else if \(enabled\)[\s\S]{0,300}testButton\.hidden = false/);
  assert.match(applicationSource, /supabase\.functions\.invoke\("send-test-push"/);
});

test("manual test delivery gains Stage 10 click routing without scheduling", () => {
  assert.match(workerSource, /addEventListener\("push"/);
  assert.match(workerSource, /showNotification\(notification\.title/);
  assert.match(workerSource, /addEventListener\("notificationclick"/);
  assert.doesNotMatch(functionSource, /cron|schedule/i);
});
