import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260925080000_cancel_pending_family_invitation.sql", import.meta.url), "utf8");

test("only family owners can cancel a pending invitation in the member list", () => {
  const list = {innerHTML: "", items: [], append(article) { this.items.push(article.innerHTML); }};
  const state = {
    session: {user: {id: "head", email: "head@example.com"}},
    family: {name: "Household"},
    families: [{id: "owned", owner_id: "head"}, {id: "joined", owner_id: "another"}],
    familyInvitations: [
      {id: "pending-owned", family_id: "owned", status: "pending", invitee_email: "one@example.com", role: "Adult", created_at: "2026-09-25"},
      {id: "accepted-owned", family_id: "owned", status: "accepted", invitee_email: "two@example.com", role: "Adult", created_at: "2026-09-25"},
      {id: "pending-joined", family_id: "joined", status: "pending", invitee_email: "head@example.com", role: "Adult", created_at: "2026-09-25"}
    ]
  };
  const context = {
    state, $: () => list, document: {createElement() { return {className: "", innerHTML: ""}; }},
    escapeHtml: (value) => String(value), statusBadge: (status) => status,
    canManageMembersForFamily: (familyId) => familyId === "owned"
  };
  vm.runInNewContext(app.slice(app.indexOf("function renderInvitations"), app.indexOf("function renderSettings")), context);
  context.renderInvitations();
  assert.match(list.items[0], /data-cancel-family-invite="pending-owned"/);
  assert.doesNotMatch(list.items[1], /data-cancel-family-invite/);
  assert.doesNotMatch(list.items[2], /data-cancel-family-invite/);
  assert.match(list.items[2], /data-accept-invite="pending-joined"/);
});

test("the server cancels only a pending invitation owned by the caller and releases its seat", () => {
  for (const sql of [schema, migration]) {
    const rpc = sql.slice(sql.lastIndexOf("create or replace function public.cancel_family_invitation"), sql.indexOf("revoke all on function public.cancel_family_invitation"));
    assert.match(rpc, /families\.owner_id = auth\.uid\(\)/);
    assert.match(rpc, /invitations\.status = 'pending'/);
    assert.match(rpc, /can_manage_family_members\(v_invitation\.family_id\)/);
    assert.match(rpc, /for update of invitations/);
    assert.match(rpc, /set status = 'cancelled', responded_at = now\(\)/);
    assert.match(rpc, /delete from public\.notifications[\s\S]*invitation_id = v_invitation\.id/);
    assert.match(sql, /revoke delete on public\.family_invitations from authenticated/);
    assert.match(sql, /grant execute on function public\.cancel_family_invitation\(uuid\) to authenticated/);
  }
  assert.match(schema, /after insert or update of status, responded_at, invitee_email on public\.family_invitations/);
  assert.match(schema, /workspace_invitations\.status = 'pending'/);
  assert.match(app, /supabase\.rpc\("cancel_family_invitation"/);
});
