import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const functionSource = await readFile(
  new URL("../supabase/functions/dispatch-push-reminders/index.ts", import.meta.url),
  "utf8"
);
const denoConfig = JSON.parse(await readFile(
  new URL("../supabase/functions/dispatch-push-reminders/deno.json", import.meta.url),
  "utf8"
));
const supabaseConfig = await readFile(new URL("../supabase/config.toml", import.meta.url), "utf8");
const cronSource = await readFile(new URL("../supabase/cron-push-reminders.sql", import.meta.url), "utf8");
const diagnosticSource = await readFile(
  new URL("../supabase/pwa-stage-12-diagnostic.sql", import.meta.url),
  "utf8"
);

test("the dispatcher dependencies are pinned", () => {
  assert.match(functionSource, /@supabase\/supabase-js@2\.110\.9/);
  assert.match(functionSource, /npm:web-push@3\.6\.7/);
  assert.match(functionSource, /npm:@types\/web-push@3\.6\.4/);
  assert.equal(denoConfig.nodeModulesDir, "auto");
});

test("the dispatcher rejects public requests before database access", () => {
  const authenticationAt = functionSource.indexOf("secureEqual(suppliedSecret, cronSecret)");
  const clientAt = functionSource.indexOf("createClient(supabaseUrl, serviceRoleKey");
  assert.ok(authenticationAt >= 0 && clientAt > authenticationAt);
  assert.match(functionSource, /x-mushavo-cron-secret/);
  assert.match(functionSource, /CRON_AUTHENTICATION_FAILED/);
  assert.match(functionSource, /requestBody\.source !== "cron"/);
  assert.match(supabaseConfig, /\[functions\.dispatch-push-reminders\][\s\S]*verify_jwt = false/);
});

test("the dispatcher enqueues then atomically claims a bounded batch", () => {
  const enqueueAt = functionSource.indexOf('"enqueue_due_payment_reminders"');
  const claimAt = functionSource.indexOf('"claim_notification_outbox"');
  assert.ok(enqueueAt >= 0 && claimAt > enqueueAt);
  assert.match(functionSource, /const CLAIM_BATCH_SIZE = 25/);
});

test("payment state, assignment, membership, and preferences are revalidated", () => {
  assert.match(functionSource, /item\.status !== "active"/);
  assert.match(functionSource, /reminder_enabled/);
  assert.match(functionSource, /assignedUserId !== job\.user_id/);
  assert.match(functionSource, /workspace_members/);
  assert.match(functionSource, /paid >= Number\(item\.amount/);
  assert.match(functionSource, /status: "cancelled"/);
});

test("delivery is multi-device and retires permanent endpoints", () => {
  assert.match(functionSource, /for \(const subscription of subscriptions/);
  assert.match(functionSource, /statusCode === 404 \|\| statusCode === 410/);
  assert.match(functionSource, /disabled_at: permanentlyGone \? sentAt : null/);
  assert.match(functionSource, /record_notification_outbox_result/);
});

test("logs and responses exclude delivery credentials", () => {
  assert.doesNotMatch(functionSource, /console\.(?:log|warn|error)\([^\n]*(?:endpoint|p256dh|vapidPrivateKey|cronSecret)/i);
  assert.doesNotMatch(functionSource, /json\([^\n]*(?:endpoint|p256dh|vapidPrivateKey|cronSecret)/i);
});

test("Cron uses Vault, the dedicated secret header, and a 15-minute schedule", () => {
  assert.match(cronSource, /vault\.decrypted_secrets/);
  assert.match(cronSource, /mushavo_budget_push_cron_secret/);
  assert.match(cronSource, /x-mushavo-cron-secret/);
  assert.match(cronSource, /'\*\/15 \* \* \* \*'/);
  assert.match(cronSource, /dispatch-push-reminders/);
  assert.doesNotMatch(cronSource, /VAPID_PRIVATE_KEY|SUPABASE_SERVICE_ROLE_KEY/);
});

test("the diagnostic checks names and health without selecting decrypted values", () => {
  assert.match(diagnosticSource, /dispatcher_cron_active/);
  assert.match(diagnosticSource, /cron\.job_run_details/);
  assert.doesNotMatch(diagnosticSource, /decrypted_secret/);
});
