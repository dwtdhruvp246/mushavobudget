import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration = await readFile(
  new URL("../supabase/migrations/20260921130000_notification_workspace_context.sql", import.meta.url),
  "utf8"
);
const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const application = await readFile(new URL("../app.js", import.meta.url), "utf8");
const diagnostic = await readFile(
  new URL("../supabase/notification-workspace-context-diagnostic.sql", import.meta.url),
  "utf8"
);

for (const [label, source] of [["migration", migration], ["consolidated schema", schema]]) {
  test(`${label} stores and backfills notification workspace identity`, () => {
    assert.match(source, /alter table public\.notifications[\s\S]*add column if not exists workspace_id uuid/);
    assert.match(source, /foreign key \(workspace_id\) references public\.budget_workspaces\(id\) on delete set null/);
    assert.match(source, /set_notification_workspace_context_trigger/);
    assert.match(source, /items\.workspace_id into new\.workspace_id/);
    assert.match(source, /workspaces\.legacy_family_id = notifications\.family_id/);
  });

  test(`${label} keeps private push previews generic and labels detailed previews`, () => {
    assert.match(source, /coalesce\(settings\.detailed_notification_previews, false\)/);
    assert.match(source, /when v_detailed_previews then left/);
    assert.match(source, /when 'household' then 'Family'/);
    assert.match(source, /when 'business' then 'Business'/);
    assert.match(source, /else 'Personal'/);
    assert.match(source, /else 'Mushavo Budget'/);
  });

  test(`${label} constrains payment and admin routes to exact workspace-aware targets`, () => {
    assert.match(source, /source=push&workspace=.*&payment_item=/);
    assert.match(source, /notification_id=.*&workspace=.*&subscription_payment=/);
    assert.match(source, /link_admin_notification_workspace_context_trigger/);
    assert.match(source, /notification_outbox_target_url_check/);
    assert.match(source, /admin_notification_outbox_target_url_check/);
  });
}

test("notification cards show Personal, Family, and Business workspace labels", () => {
  assert.match(application, /workspace_type === "household"\) return "Family"/);
  assert.match(application, /workspace_type === "business"\) return "Business"/);
  assert.match(application, /return "Personal"/);
  assert.match(application, /`\$\{workspaceNotificationType\(workspace\)\} · \$\{workspace\.name/);
  assert.match(application, /workspaceNotificationLabel\(notificationWorkspace\(notification\)\)/);
});

test("notification deep links select an authorized workspace before locating a payment", () => {
  const selection = application.indexOf("await selectNotificationWorkspace(workspaceId)");
  const paymentLookup = application.indexOf("state.paymentItems.find((item) => item.id === paymentItemId)");
  assert.ok(selection > 0);
  assert.ok(paymentLookup > selection);
  assert.match(application, /paymentItem\.workspace_id !== workspaceId/);
  assert.match(application, /state\.adminSubscriptionPayments\.find\(\(item\) => item\.id === subscriptionPaymentId\)/);
});

test("the workspace notification diagnostic always rolls back", () => {
  assert.match(diagnostic, /notification_workspace_context_ready/);
  assert.match(diagnostic, /rollback;/);
});
