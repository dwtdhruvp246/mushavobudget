import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../business.js", import.meta.url), "utf8");
const invitationId = "11111111-1111-4111-8111-111111111111";
const savedMailFailure = { error: "BUSINESS_INVITATION_EMAIL_FAILED", invitation_id: invitationId };
const savedMailMessage = "The invitation was saved, but email delivery failed. Use Resend in the pending invitations list.";

function httpFailure(status, payload) {
  return {
    data: null,
    error: {
      message: "Edge Function returned a non-2xx status code",
      context: {
        status,
        async json() {
          if (payload === undefined) throw new SyntaxError("Invalid JSON");
          return payload;
        }
      }
    }
  };
}

function harness(result, role = "staff") {
  const messages = { textContent: "", classList: { toggle(name, active) { messages[name] = active; } } };
  const field = { disabled: false };
  const calls = [];
  const writes = [];
  let closed = 0;
  let refreshed = 0;
  const nodes = {
    "#businessInviteDialog": {
      dataset: { mode: "create" },
      querySelectorAll: () => [field],
      close: () => { closed++; }
    },
    "#businessTeamMessage": messages,
    "#businessInvitationId": { value: "" },
    "#businessInviteRole": { value: role },
    "#businessInviteEmail": { value: "test@example.invalid" }
  };
  const friendlyStart = source.indexOf("function friendlyMessage(");
  const friendlyEnd = source.indexOf("\n}", friendlyStart) + 2;
  const messagesStart = source.indexOf("function setTeamMessage(");
  const messagesEnd = source.indexOf("function selectedTeamScopes()", messagesStart);
  const helperStart = source.indexOf("async function businessInvitationFailure(");
  const handlersStart = helperStart < 0 ? source.indexOf("async function withTeamBusy(") : helperStart;
  const handlersEnd = source.indexOf("function renderIncomingInvitations()", handlersStart);
  const instantiate = new Function("dependencies", `
    const { $, state, selectedTeamScopes, supabase, query, refreshBusinessTeam } = dependencies;
    let teamBusy = false;
    ${source.slice(friendlyStart, friendlyEnd)}
    ${source.slice(messagesStart, messagesEnd)}
    ${source.slice(handlersStart, handlersEnd)}
    return { saveBusinessInvitation, teamAction, busy: () => teamBusy };
  `);
  const handlers = instantiate({
    $: selector => nodes[selector],
    state: { workspace: { id: "fixture-workspace" } },
    selectedTeamScopes: () => [],
    supabase: {
      functions: { invoke: async (name, options) => { calls.push({ name, body: options.body }); return result; } },
      rpc: (name, args) => { writes.push({ name, args }); return { invitation_id: invitationId }; }
    },
    query: async (_name, value) => value,
    refreshBusinessTeam: async () => { refreshed++; }
  });
  return {
    ...handlers, messages, field, calls, writes,
    submit: () => handlers.saveBusinessInvitation({ preventDefault() {} }),
    closed: () => closed, refreshed: () => refreshed
  };
}

test("502 on create refreshes the pending invitation list and gives the saved-invitation resend guidance", async () => {
  const h = harness(httpFailure(502, savedMailFailure));
  await h.submit();
  assert.equal(h.messages.textContent, savedMailMessage);
  assert.equal(h.messages.error, true);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].body.action, "create");
  assert.equal(h.writes.length, 0);
  assert.equal(h.closed(), 1);
  assert.equal(h.refreshed(), 1);
  assert.equal(h.field.disabled, false);
  assert.equal(h.busy(), false);
});

test("429 resend reads the function error code and keeps the existing cooldown guidance", async () => {
  const h = harness(httpFailure(429, { error: "BUSINESS_INVITATION_RATE_LIMITED" }));
  await h.teamAction("resend", invitationId);
  assert.equal(h.messages.textContent, "Wait one minute before resending this invitation.");
  assert.equal(h.messages.error, true);
  assert.deepEqual(h.calls, [{ name: "invite-business-member", body: { action: "resend", invitation_id: invitationId } }]);
  assert.equal(h.refreshed(), 0);
  assert.equal(h.busy(), false);
});

test("502 on resend refreshes the existing invitation once and shows the delivery error", async () => {
  const h = harness(httpFailure(502, savedMailFailure));
  await h.teamAction("resend", invitationId);
  assert.equal(h.messages.textContent, savedMailMessage);
  assert.equal(h.refreshed(), 1);
  assert.equal(h.calls.length, 1);
});

test("a gateway error without an invitation response keeps the create form and avoids a false saved claim", async () => {
  const h = harness(httpFailure(502));
  await h.submit();
  assert.equal(h.messages.textContent, "Edge Function returned a non-2xx status code");
  assert.equal(h.closed(), 0);
  assert.equal(h.refreshed(), 0);
  assert.equal(h.field.disabled, false);
});

test("the custom-role reservation still uses one resend and retains the saved invitation on delivery failure", async () => {
  const h = harness(httpFailure(502, savedMailFailure), "custom_fixture");
  await h.submit();
  assert.equal(h.writes.length, 1);
  assert.equal(h.writes[0].name, "create_business_invitation");
  assert.deepEqual(h.calls, [{ name: "invite-business-member", body: { action: "resend", invitation_id: invitationId } }]);
  assert.equal(h.messages.textContent, savedMailMessage);
  assert.equal(h.closed(), 1);
  assert.equal(h.refreshed(), 1);
});

test("successful create and resend still give their existing messages", async () => {
  const create = harness({ data: { email: "test@example.invalid" }, error: null });
  await create.submit();
  assert.equal(create.messages.textContent, "Invitation sent to test@example.invalid.");
  assert.equal(create.closed(), 1);
  assert.equal(create.refreshed(), 1);

  const resend = harness({ data: { status: "resent" }, error: null });
  await resend.teamAction("resend", invitationId);
  assert.equal(resend.messages.textContent, "Invitation resent.");
  assert.equal(resend.refreshed(), 1);
});
