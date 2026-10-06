import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
function fn(name) {
  const match = new RegExp(`(?:async )?function ${name}\\(`).exec(source);
  assert.ok(match, name);
  return source.slice(match.index, source.indexOf("\n}", match.index) + 2);
}
const invitation = { invitation_id: "invite-1", workspace_id: "business-1", workspace_name: "Example Business", role: "viewer" };
function harness() {
  const cards = [], calls = [];
  const context = {
    URL, Date, console,
    state: {
      session: { user: { id: "recipient", email: "viewer@example.com" } }, isAdmin: false,
      familyInvitations: [], businessInvitations: [invitation], workspaces: [], adminWorkspaces: [],
      families: [], adminFamilies: [], notifications: [{ id: "notice-1", title: "Business workspace invitation",
        body: "Owner invited you to join Example Business as Viewer.", business_invitation_id: "invite-1", created_at: "2026-10-06T18:00:00Z" }]
    },
    document: { createElement: () => ({}) },
    notificationDueOccurrences: () => [],
    escapeHtml: value => String(value).replaceAll("<", "&lt;").replaceAll(">", "&gt;"),
    statusBadge: value => value,
    emptyState: () => "empty",
    supabase: { rpc: (name, args) => { calls.push({ name, args }); return Promise.resolve({ data: "business-1" }); } },
    query: async (_label, result) => (await result).data,
    window: { location: { origin: "https://mushavobudget.com", href: "https://mushavobudget.com/app.html#personal/notifications", assign: target => calls.push({ target }) } },
    loadNotifications: async () => calls.push("refresh"),
    renderNotifications: () => calls.push("render"),
    showToast: message => calls.push(message)
  };
  vm.createContext(context);
  vm.runInContext(["workspaceNotificationType", "workspaceNotificationLabel", "notificationWorkspace", "renderNotificationList", "respondToBusinessNotificationInvitation", "notificationTargetUrl"].map(fn).join("\n"), context);
  return { context, cards, calls, list: { append: card => cards.push(card), innerHTML: "" } };
}

test("pending Business requests show workspace context and Accept/Decline before membership exists", () => {
  const h = harness();
  h.context.renderNotificationList(h.list);
  assert.match(h.cards[0].innerHTML, /Business · Example Business/);
  assert.match(h.cards[0].innerHTML, /data-accept-business-invite="invite-1"/);
  assert.match(h.cards[0].innerHTML, /data-decline-business-invite="invite-1"/);
  h.context.state.businessInvitations = [];
  h.context.renderNotificationList(h.list);
  assert.doesNotMatch(h.cards.at(-1).innerHTML, /data-(accept|decline)-business-invite/);
});

test("notification HTML escapes Business identity supplied by invitation data", () => {
  const h = harness();
  h.context.state.businessInvitations = [{ ...invitation, workspace_name: "<img src=x onerror=alert(1)>" }];
  h.context.renderNotificationList(h.list);
  assert.doesNotMatch(h.cards[0].innerHTML, /<img/);
  assert.match(h.cards[0].innerHTML, /&lt;img/);
});

test("Accept calls the protected RPC and opens the workspace returned by the server", async () => {
  const h = harness();
  await h.context.respondToBusinessNotificationInvitation("invite-1", true);
  assert.equal(h.calls[0].name, "respond_business_invitation");
  assert.equal(h.calls[0].args.p_invitation_id, "invite-1");
  assert.equal(h.calls[0].args.p_accept, true);
  assert.equal(h.calls[1].target, "https://mushavobudget.com/business.html?workspace=business-1#business/overview");
});

test("Decline refreshes Notifications and does not enter Business", async () => {
  const h = harness();
  await h.context.respondToBusinessNotificationInvitation("invite-1", false);
  assert.equal(h.calls[0].args.p_accept, false);
  assert.ok(h.calls.includes("refresh"));
  assert.ok(h.calls.includes("render"));
  assert.ok(h.calls.includes("Business invitation declined."));
  assert.ok(!h.calls.some(call => call.target));
});

test("unknown invitations and account changes cannot redirect another signed-in identity", async () => {
  const h = harness();
  await h.context.respondToBusinessNotificationInvitation("unknown", true);
  assert.equal(h.calls.length, 0);
  h.context.query = async () => { h.context.state.session.user.id = "different-account"; return "business-1"; };
  await h.context.respondToBusinessNotificationInvitation("invite-1", true);
  assert.equal(h.calls.length, 1);
  assert.ok(!h.calls.some(call => call.target));
});

test("a server denial refreshes stale invitations and never grants or redirects access", async () => {
  const h = harness();
  h.context.query = async () => { throw Error("BUSINESS_INVITATION_NOT_AVAILABLE"); };
  await h.context.respondToBusinessNotificationInvitation("invite-1", true);
  assert.ok(h.calls.includes("BUSINESS_INVITATION_NOT_AVAILABLE"));
  assert.ok(h.calls.includes("refresh"));
  assert.ok(!h.calls.some(call => call.target));
});

test("notification loading cannot install a previous account's asynchronous results", async () => {
  const h = harness();
  let release;
  const chain = { select() { return this; }, order() { return this; }, limit() { return new Promise(resolve => { release = resolve; }); } };
  h.context.supabase.from = () => chain;
  vm.runInContext(fn("loadNotifications"), h.context);
  const loading = h.context.loadNotifications();
  h.context.state.session.user.id = "different-account";
  release({ data: [{ id: "stale" }] });
  await loading;
  assert.equal(h.context.state.notifications[0].id, "notice-1");
});

test("the new trigger migration is mirrored in the complete schema", () => {
  const migration = readFileSync(new URL("../supabase/migrations/20261006180000_business_invitation_notifications.sql", import.meta.url), "utf8");
  const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
  assert.ok(schema.includes(migration));
});

test("notification navigation permits only same-origin app and matching Business invitation targets", () => {
  const h = harness();
  const valid = { business_invitation_id: "invite-1", url: "/business.html?invitation=invite-1#business/team" };
  assert.ok(h.context.notificationTargetUrl(valid));
  assert.ok(h.context.notificationTargetUrl({ url: "/app.html#personal/notifications" }));
  for (const url of ["https://other.example/business.html?invitation=invite-1#business/team", "/business.html?invitation=other#business/team", "/business.html?invitation=invite-1#business/settings", "javascript:alert(1)", "http://["]) {
    assert.equal(h.context.notificationTargetUrl({ ...valid, url }), null);
  }
  assert.equal(h.context.notificationTargetUrl({ url: valid.url }), null);
});

test("the email destination renders incoming invitation names and scopes as text", () => {
  const business = readFileSync(new URL("../business.js", import.meta.url), "utf8");
  const start = business.indexOf("function renderIncomingInvitations(");
  const code = business.slice(start, business.indexOf("\n}", start) + 2);
  const node = () => ({ children: [], dataset: {}, append(...children) { this.children.push(...children); }, replaceChildren() { this.children = []; }, set innerHTML(_value) { throw Error("Untrusted HTML rendering"); } });
  const list = node();
  const context = { document: { createElement: node }, $: () => list,
    state: { incomingInvitations: [{ ...invitation, workspace_name: "<img src=x onerror=alert(1)>", inviter_name: "<script>bad</script>", scope_names: ["<b>Branch</b>"], expires_at: "2026-10-13" }] },
    formatRole: () => "Viewer", formatDate: () => "13 October" };
  vm.runInNewContext(code + "\nrenderIncomingInvitations();", context);
  assert.equal(list.children[0].children[0].textContent, "<img src=x onerror=alert(1)>");
  assert.match(list.children[0].children[1].textContent, /<script>bad<\/script>.*Viewer.*<b>Branch<\/b>/);
  const buttons = list.children[0].children[2].children;
  assert.equal(buttons[0].dataset.respondBusinessInvitation, "invite-1");
  assert.equal(buttons[1].dataset.accept, "false");
});
