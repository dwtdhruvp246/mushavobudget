import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const signup = await readFile(new URL("../signup.html", import.meta.url), "utf8");
const createSource = signup.match(/      function createInvitationClient\([\s\S]*?\n      }/)?.[0];
const openSource = signup.match(/      async function openCompletedInvitation\([\s\S]*?\n      }/)?.[0];
assert.ok(createSource);
assert.ok(openSource);

test("opening or leaving an invite does not replace an admin tab's stored session", async () => {
  const local = { token: "admin" };
  const temporary = { token: null };
  const created = [];
  const window = { sessionStorage: temporary };
  const createInvitationClient = vm.runInNewContext(`${createSource}\ncreateInvitationClient`, { window, URL });
  const createClient = (_url, _key, options) => {
    created.push(options.auth);
    return {
      async openInvite() { options.auth.storage.token = "invitee"; },
      async leaveInvite() { options.auth.storage.token = null; }
    };
  };
  const client = createInvitationClient(createClient, {
    supabaseUrl: "https://example.supabase.co", supabasePublishableKey: "public"
  });
  await client.openInvite();
  assert.equal(temporary.token, "invitee");
  assert.equal(local.token, "admin");
  assert.equal(created[0].storage, temporary);
  assert.equal(created[0].detectSessionInUrl, true);
  assert.notEqual(created[0].storageKey, "sb-example-auth-token");
  await client.leaveInvite();
  assert.equal(local.token, "admin");
});

test("a completed workspace promotes the invitee session before opening the app", async () => {
  const actions = [];
  const window = {
    location: { href: "https://budget.example/signup.html?mode=admin-invite" , replace(url) { actions.push(["navigate", url]); } },
    MushavoPWA: { markFormClean() { actions.push(["clean"]); } }
  };
  const session = { access_token: "access", refresh_token: "refresh", user: { id: "invitee" } };
  const openCompletedInvitation = vm.runInNewContext(`${openSource}\nopenCompletedInvitation`, {
    window, URL, form: {}, isAdminInvite: true
  });
  const inviteClient = { auth: { async getSession() { return { data: { session }, error: null }; } } };
  const createClient = (_url, _key, options) => {
    assert.equal(options.auth.detectSessionInUrl, false);
    return { auth: { async setSession(tokens) {
      actions.push(["promote", tokens]);
      return { data: { user: { id: "invitee" } }, error: null };
    } } };
  };
  await openCompletedInvitation(inviteClient, createClient, {
    supabaseUrl: "https://example.supabase.co", supabasePublishableKey: "public"
  });
  assert.deepEqual(actions.map(([action]) => action), ["promote", "clean", "navigate"]);
  assert.equal(actions[0][1].refresh_token, "refresh");
  assert.match(actions[2][1], /app\.html\?signup=invited$/);
  assert.match(signup, /if \(completionError\) throw completionError;\s+await openCompletedInvitation\(supabase, createClient, config\)/);
});
