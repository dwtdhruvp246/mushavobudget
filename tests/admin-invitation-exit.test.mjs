import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const signup = await readFile(new URL("../signup.html", import.meta.url), "utf8");
const helper = signup.match(/      async function leaveInvitationSetup\([\s\S]*?\n      }/)?.[0];
assert.ok(helper, "invited setup needs an explicit local sign-out on exit");

function exitHarness(error = null) {
  const events = [];
  const attributes = new Map();
  const backToSignIn = {
    getAttribute(name) { return attributes.get(name); },
    setAttribute(name, value) { attributes.set(name, value); },
    removeAttribute(name) { attributes.delete(name); }
  };
  const context = {
    backToSignIn, form: {}, URL,
    showMessage(message) { events.push(`message:${message}`); },
    window: {
      location: { href: "https://mushavobudget.com/signup.html?mode=admin-invite", replace(url) { events.push(`navigate:${url}`); } },
      MushavoPWA: { markFormClean() { events.push("form-clean"); } }
    }
  };
  const supabase = { auth: { async signOut(options) { events.push(`signout:${options.scope}`); return { error }; } } };
  vm.runInNewContext(`${helper}\nglobalThis.exitInvitation = leaveInvitationSetup;`, context);
  return { exit: () => context.exitInvitation(supabase), events, backToSignIn };
}

test("Back to sign in ends the invited session before navigation", async () => {
  const { exit, events } = exitHarness();
  await exit();
  assert.equal(events[0], "signout:local");
  assert.equal(events[1], "form-clean");
  assert.match(events[2], /^navigate:https:\/\/mushavobudget\.com\/app\.html\?auth=manual$/);
  assert.match(signup, /if \(isAdminInvite \|\| isSelfSignupFromInvite\) \{[\s\S]*?backToSignIn\.addEventListener\("click"/);
  assert.match(signup, /event\.preventDefault\(\);\s+await leaveInvitationSetup\(supabase\)/);
});

test("a failed sign-out keeps the visitor on the setup page", async () => {
  const { exit, events, backToSignIn } = exitHarness({ message: "Could not sign out" });
  await exit();
  assert.deepEqual(events.slice(0, 1), ["signout:local"]);
  assert.ok(!events.some((event) => event.startsWith("navigate:")));
  assert.equal(backToSignIn.getAttribute("aria-disabled"), undefined);
});
