import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationSource = await readFile(
  new URL("../supabase/migrations/20260908170000_notification_outbox.sql", import.meta.url),
  "utf8"
);
const schemaSource = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const diagnosticSource = await readFile(
  new URL("../supabase/pwa-stage-11-diagnostic.sql", import.meta.url),
  "utf8"
);

for (const [label, source] of [["migration", migrationSource], ["consolidated schema", schemaSource]]) {
  test(`${label} defines a private, idempotent reminder outbox`, () => {
    assert.match(source, /create table if not exists public\.notification_outbox/);
    assert.match(source, /idempotency_key text not null/);
    assert.match(source, /unique index if not exists notification_outbox_idempotency_key_unique_idx/);
    assert.match(source, /enable row level security/);
    assert.match(source, /force row level security/);
    assert.match(source, /revoke all on table public\.notification_outbox from anon, authenticated/);
  });

  test(`${label} resolves assigned recipients and active unpaid payments`, () => {
    assert.match(source, /when items\.visibility = 'personal' then items\.owner_id/);
    assert.match(source, /else responsible_members\.user_id/);
    assert.match(source, /workspace_members\.status = 'active'/);
    assert.match(source, /where items\.status = 'active'/);
    assert.match(source, /sum\(records\.amount\)/);
    assert.match(source, /< possible_due_dates\.amount/);
  });

  test(`${label} respects timezone, privacy, real currency, and the bell workflow`, () => {
    assert.match(source, /pg_catalog\.pg_timezone_names/);
    assert.match(source, /make_timestamptz/);
    assert.match(source, /detailed_notification_previews/);
    assert.match(source, /unpaid_occurrences\.currency/);
    assert.match(source, /insert into public\.notifications/);
    assert.match(source, /on conflict \(idempotency_key\) do nothing/);
  });

  test(`${label} atomically claims and bounds retries`, () => {
    assert.match(source, /for update skip locked/);
    assert.match(source, /status = 'processing'/);
    assert.match(source, /attempt_count = outbox\.attempt_count \+ 1/);
    assert.match(source, /interval '5 minutes'/);
    assert.match(source, /interval '30 minutes'/);
    assert.match(source, /outbox\.attempt_count >= 3/);
    assert.match(source, /p_permanent_failure/);
  });

  test(`${label} keeps queue functions server-only`, () => {
    assert.match(source, /revoke all on function public\.enqueue_due_payment_reminders\(timestamptz\)[\s\S]*from public, anon, authenticated/);
    assert.match(source, /revoke all on function public\.claim_notification_outbox\(integer, timestamptz\)[\s\S]*from public, anon, authenticated/);
    assert.match(source, /grant execute on function public\.claim_notification_outbox\(integer, timestamptz\)[\s\S]*to service_role/);
  });
}

test("Stage 11 does not enable Cron or automatic push sending", () => {
  assert.doesNotMatch(migrationSource, /cron\.schedule|net\.http_post|webpush|sendNotification/);
});

test("the diagnostic duplicate and claim exercise always rolls back", () => {
  assert.match(diagnosticSource, /on conflict \(idempotency_key\) do nothing/g);
  assert.match(diagnosticSource, /duplicate_insert_was_ignored/);
  assert.match(diagnosticSource, /first_claim_returned_one_row/);
  assert.match(diagnosticSource, /second_claim_returned_no_rows/);
  assert.match(diagnosticSource, /rollback;/);
});
