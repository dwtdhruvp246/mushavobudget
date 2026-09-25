import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260924130000_guard_payment_record_payer.sql", import.meta.url), "utf8");

test("a Family payment defaults to the recorder, preserves another chosen payer, and hides the payer on Personal payments", () => {
  const source = app.slice(app.indexOf("function applyRecordPaymentOccurrence"), app.indexOf("function showRecordPaymentDialog"));
  const elements = new Map();
  const $ = (selector) => {
    if (!elements.has(selector)) elements.set(selector, { value: "", hidden: false, required: false });
    return elements.get(selector);
  };
  const members = [{ id: "person1" }, { id: "person2" }];
  const context = { $, activeMembers: () => members, currentFamilyMember: () => members[1], money: () => "$20.00" };
  vm.runInNewContext(`${source}\nglobalThis.apply = applyRecordPaymentOccurrence;`, context);
  const occurrence = { item: { id: "payment", name: "Rent", currency: "USD", visibility: "family", responsible_member_id: "person1" }, outstanding: 20, dueDate: "2026-09-30", periodStart: "2026-09-01" };
  context.apply(occurrence);
  assert.equal($("#recordPaidBy").value, "person2");
  assert.equal($("#recordPaidByField").hidden, false);
  assert.equal($("#recordPaidBy").required, true);

  $("#recordPaidBy").value = "person1";
  context.apply(occurrence, true);
  assert.equal($("#recordPaidBy").value, "person1");

  context.apply({ ...occurrence, item: { ...occurrence.item, visibility: "personal" } });
  assert.equal($("#recordPaidByField").hidden, true);
  assert.equal($("#recordPaidBy").required, false);
  assert.equal($("#recordPaidBy").value, "");
});

test("payment history distinguishes the payer from the signed-in recorder", () => {
  const source = app.slice(app.indexOf("function memberById"), app.indexOf("function currentFamilyMember"));
  const context = {
    state: {
      members: [{ id: "payer", name: "Person 1", user_id: "user-1" }, { id: "recorder", name: "Person 2", user_id: "user-2" }],
      session: { user: { id: "user-2" } }, profile: { full_name: "Person 2" }
    }
  };
  vm.runInNewContext(`${source}\nglobalThis.attribution = paymentRecordAttribution;`, context);
  assert.equal(context.attribution({ family_id: "family", visibility: "family", paid_by_member_id: "payer", recorded_by: "user-2" }), "Paid by Person 1 · Recorded by Person 2");
  assert.equal(context.attribution({ visibility: "personal", recorded_by: "user-2" }), "Recorded by Person 2");
});

test("a member's own Free plans stay Free while the joined family's paid access is separate", () => {
  const source = app.slice(app.indexOf("function formatSubscriptionDate("), app.indexOf("function renderWorkspacePlans"));
  const elements = new Map();
  const $ = (selector) => {
    if (!elements.has(selector)) elements.set(selector, {
      hidden: false, textContent: "", innerHTML: "",
      classList: { toggle(_name, hidden) { this.hidden = hidden; }, contains() { return true; } },
      closest: () => ({ classList: { toggle() {} } })
    });
    return elements.get(selector);
  };
  const state = {
    session: { user: { id: "person2" } },
    workspaces: [{ id: "personal", workspace_type: "personal", owner_id: "person2" }, { id: "joined", name: "Person 1 family", workspace_type: "household", owner_id: "person1" }],
    ownedFamilySubscriptions: [], entitlementHistory: [], plans: [], paymentItems: [],
    personalWorkspaceEntitlement: { plan_name: "Free", effective_status: "active" },
    workspaceEntitlement: { plan_name: "Family", effective_status: "active", plan_code: "household", paid_through_at: null },
    workspaceSubscription: { billing_period: "annual", member_limit: 4 },
    memberUsage: { used_member_count: 2, member_limit: 4, active_member_count: 2, pending_invitation_count: 0, available_member_count: 2 }
  };
  const context = {
    $, state, currentBudgetWorkspace: () => state.workspaces[1], currentWorkspaceIsOwned: () => false,
    titleCase: (value) => `${value || ""}`.replace(/^./, (letter) => letter.toUpperCase()),
    escapeHtml: (value) => `${value}`, renderWorkspacePlans() {}, renderRenewalHistory() {}, renderEntitlementHistory() {}
  };
  vm.runInNewContext(`${source}\nglobalThis.render = renderSubscription;`, context);
  context.render();
  assert.equal($("#ownedPersonalPlanName").textContent, "Free");
  assert.equal($("#ownedFamilyPlanName").textContent, "None");
  assert.match($("#ownedFamilyPlanDetail").textContent, /No Family workspace purchased/);
  assert.match($("#joinedFamilyAccessDetail").textContent, /You have not purchased this plan/);
  assert.equal($("#ownedWorkspacePlansPanel").hidden, false);
  assert.equal($("#openRenewalButton").hidden, true);
  assert.equal($("#startOwnFamilyPlan").textContent, "Start your own Family plan");
});

test("the database rejects a named payer from a different or inactive family", () => {
  assert.match(migration, /members\.family_id = new\.family_id/);
  assert.match(migration, /members\.status = 'active'/);
  assert.match(migration, /before insert or update of family_id, paid_by_member_id/);
  assert.match(migration, /array\['notifications', 'family_invitations'\]/);
});
