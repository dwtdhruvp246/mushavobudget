import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, schema, dispatcher, config, cron, html, application, worker, diagnostic] = await Promise.all([
  readFile(new URL("../supabase/migrations/20260916190000_admin_event_notifications.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/functions/dispatch-admin-notifications/index.ts", import.meta.url), "utf8"),
  readFile(new URL("../supabase/config.toml", import.meta.url), "utf8"),
  readFile(new URL("../supabase/cron-admin-notifications.sql", import.meta.url), "utf8"),
  readFile(new URL("../app.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8"),
  readFile(new URL("../sw.js", import.meta.url), "utf8"),
  readFile(new URL("../supabase/admin-operations-4-6-diagnostic.sql", import.meta.url), "utf8")
]);

test("admin event queue is private, idempotent, and atomically claimed", () => {
  assert.match(migration, /create table if not exists public\.admin_notification_outbox/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all on table public\.admin_notification_outbox from public, anon, authenticated/);
  assert.match(migration, /idempotency_key text not null unique/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /attempt_count < 3/);
  assert.match(migration, /interval '5 minutes'/);
  assert.match(migration, /interval '30 minutes'/);
  assert.match(migration, /alter publication supabase_realtime add table public\.notifications/);
  assert.match(schema, /create table if not exists public\.admin_notification_outbox/);
});

test("admin alerts are generated only for platform events with role-specific recipients", () => {
  assert.match(migration, /subscription_payment_submitted[\s\S]*super_admin[\s\S]*admin_staff[\s\S]*finance_staff/);
  assert.match(migration, /support_ticket_created[\s\S]*super_admin[\s\S]*admin_staff[\s\S]*support_staff/);
  assert.match(migration, /public_enquiry_created[\s\S]*super_admin[\s\S]*admin_staff[\s\S]*support_staff/);
  assert.match(migration, /after insert on public\.subscription_payments/);
  assert.match(migration, /after insert on public\.support_tickets/);
  assert.match(migration, /after insert on public\.enquiries/);
  assert.doesNotMatch(migration, /after insert on public\.payment_records/);
  assert.doesNotMatch(migration, /after insert on public\.payment_items/);
  assert.match(migration, /created_by, type, title, body, url[\s\S]*null,[\s\S]*p_event_type/);
});

test("admin push routes are bounded to approved admin tabs", () => {
  assert.match(migration, /#admin\/\(finance\|support\|enquiries\)/);
  for (const route of ["#admin/finance", "#admin/enquiries", "#admin/support"]) {
    assert.ok(worker.includes(`"${route}"`), `${route} should be allowed by the worker`);
  }
  assert.match(worker, /notification_id/);
  assert.match(application, /notification deep link read/);
  assert.match(application, /state\.isAdmin \? "Admin notifications" : "Notifications"/);
});

test("admin dispatcher is secret-protected and revalidates every queued event", () => {
  assert.match(config, /\[functions\.dispatch-admin-notifications\][\s\S]*verify_jwt = false/);
  assert.match(dispatcher, /secureEqual\(suppliedSecret, cronSecret\)/);
  assert.match(dispatcher, /claim_admin_notification_outbox/);
  assert.match(dispatcher, /record_admin_notification_outbox_result/);
  assert.match(dispatcher, /from\("app_admins"\)/);
  assert.match(dispatcher, /from\("subscription_payments"\)/);
  assert.match(dispatcher, /from\("support_tickets"\)/);
  assert.match(dispatcher, /from\("enquiries"\)/);
  assert.match(dispatcher, /statusCode === 404 \|\| statusCode === 410/);
  assert.match(dispatcher, /disabled_at: permanentlyGone \? sentAt : null/);
  assert.doesNotMatch(dispatcher, /console\.(?:log|warn|error)\([^\n]*(?:endpoint|cronSecret|serviceRoleKey|vapidPrivateKey)/);
});

test("admin notification delivery uses the existing protected Vault values", () => {
  assert.match(cron, /mushavo_budget_project_url/);
  assert.match(cron, /mushavo_budget_push_cron_secret/);
  assert.match(cron, /mushavo-budget-dispatch-admin-notifications/);
  assert.match(cron, /'\*\/5 \* \* \* \*'/);
  assert.match(cron, /dispatch-admin-notifications/);
  assert.doesNotMatch(cron, /decrypted_secret\s*;/);
});

test("admin shell exposes bell controls and optional per-device push settings", () => {
  assert.ok((html.match(/data-open-notifications/g) || []).length >= 4);
  assert.match(html, /id="adminPushNotificationControls"/);
  assert.match(html, /id="adminEnablePushNotificationsButton"/);
  assert.match(application, /function renderAdminPushNotificationSettings/);
  assert.match(application, /Admin notifications enabled on this device/);
  assert.match(application, /Promise\.all\(\[loadAdminData\(\), loadNotifications\(\)\]\)/);
  assert.doesNotMatch(application, /if \(!userId \|\| state\.isAdmin\) return/);
});

test("deployment diagnostic checks RLS, privileges, triggers, duplicates, and Cron", () => {
  for (const check of [
    "outbox_rls_forced", "browser_queue_access_blocked", "service_queue_access_enabled",
    "notifications_realtime_enabled", "payment_trigger_exists", "support_trigger_exists", "enquiry_trigger_exists",
    "duplicate_idempotency_keys", "admin_notification_cron_active"
  ]) {
    assert.match(diagnostic, new RegExp(check));
  }
  assert.doesNotMatch(diagnostic, /decrypted_secrets|endpoint|p256dh|auth\s+from/);
});
