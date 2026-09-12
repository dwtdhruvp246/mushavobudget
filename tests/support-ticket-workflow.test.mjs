import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [migration, schema, html, source] = await Promise.all([
  readFile(new URL("../supabase/migrations/20260912120000_support_ticket_workflow.sql", import.meta.url), "utf8"),
  readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"),
  readFile(new URL("../app.html", import.meta.url), "utf8"),
  readFile(new URL("../app.js", import.meta.url), "utf8")
]);

for (const [label, sql] of [["migration", migration], ["consolidated schema", schema]]) {
  test(`${label} defines ticket records, conversation messages, and queue indexes`, () => {
    assert.match(sql, /create table if not exists public\.support_tickets/);
    assert.match(sql, /create table if not exists public\.support_ticket_messages/);
    assert.match(sql, /support_tickets_queue_idx/);
    assert.match(sql, /waiting_customer/);
  });

  test(`${label} protects customers, internal notes, and staff operations with RLS`, () => {
    assert.match(sql, /alter table public\.support_tickets enable row level security/);
    assert.match(sql, /customer_id = \(select auth\.uid\(\)\)/);
    assert.match(sql, /not is_internal/);
    assert.match(sql, /'super_admin', 'admin_staff', 'support_staff'/);
    assert.match(sql, /created_by = \(select auth\.uid\(\)\)/);
  });
}

test("customers can create tickets and follow non-internal replies", () => {
  assert.match(html, /data-family-tab="support"/);
  assert.match(html, /id="supportTicketForm"/);
  assert.match(html, /id="supportTicketList"/);
  assert.match(source, /async function createUserSupportTicket/);
  assert.match(source, /function renderUserSupport/);
  assert.match(source, /adminView \? state\.adminSupportMessages : state\.supportTicketMessages/);
});

test("authorized admins receive filters, assignment, status, priority, replies, and internal notes", () => {
  assert.match(html, /id="adminSupportSearch"/);
  assert.match(html, /id="adminSupportStatus"/);
  assert.match(html, /id="adminSupportPriority"/);
  assert.match(source, /data-support-assignee/);
  assert.match(source, /data-support-status/);
  assert.match(source, /data-support-priority/);
  assert.match(source, /name="internal"/);
  assert.match(source, /\["super_admin", "admin_staff", "support_staff"\]/);
});

test("legacy household support notes are preserved", () => {
  assert.match(html, /Legacy household notes/);
  assert.match(html, /id="adminNoteForm"/);
  assert.match(source, /renderAdminNotes\(\)/);
  assert.doesNotMatch(migration, /drop table[^;]*admin_support_notes/i);
});
