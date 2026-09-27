import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const appPage = readFileSync(new URL("../app.html", import.meta.url), "utf8");
const site = readFileSync(new URL("../site.js", import.meta.url), "utf8");
const migration = readFileSync(new URL("../supabase/migrations/20260927183000_business_stage_0_launch_lock.sql", import.meta.url), "utf8");
const schema = readFileSync(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const specification = readFileSync(new URL("../docs/BUSINESS_STAGE_0_SPECIFICATION.md", import.meta.url), "utf8");

test("Business Stage 0 defaults both customer launch controls to closed", () => {
  assert.match(migration, /values \('business', 'stage_0', false, false, now\(\)\)/);
  assert.match(migration, /where workspace_type = 'business'/);
  assert.match(migration, /available_for_purchase = false/);
  assert.match(migration, /cta_label = 'Coming soon'/);
  assert.match(migration, /where plans\.workspace_type = 'business'[\s\S]*limit_value = null/);
  assert.match(schema, /create table if not exists public\.product_release_controls/);
});

test("the database blocks every existing Business provisioning path", () => {
  for (const guard of [
    "enforce_business_plan_launch_control_trigger",
    "enforce_business_workspace_launch_control_trigger",
    "enforce_business_subscription_request_launch_control_trigger",
    "enforce_business_admin_invitation_launch_control_trigger",
    "enforce_business_payment_approval_launch_control_trigger",
    "enforce_business_member_invitation_launch_control_trigger",
    "enforce_business_member_provision_launch_control_trigger"
  ]) assert.match(migration, new RegExp(guard));

  assert.match(migration, /before insert or update of workspace_type on public\.budget_workspaces/);
  assert.match(migration, /before insert or update of requested_plan_id on public\.subscription_renewal_requests/);
  assert.match(migration, /before update of status on public\.subscription_payments/);
  assert.match(migration, /before insert or update of workspace_id on public\.workspace_members/);
  assert.match(migration, /raise exception 'BUSINESS_COMING_SOON'/);
});

test("the public catalogue withholds unfinished Business prices, currencies, and seats", () => {
  assert.match(migration, /plans\.workspace_type = 'business' and not plans\.available_for_purchase then null/);
  assert.match(migration, /case when plans\.available_for_purchase then coalesce\(\([\s\S]*?else '\[\]'::jsonb end/);
  assert.match(migration, /case when plans\.available_for_purchase then coalesce\(\([\s\S]*?else array\[\]::text\[\] end/);
  assert.match(site, /isBusinessComingSoon/);
  assert.match(site, /Seats to be announced/);
  assert.match(site, /public-plan-coming-soon/);
  assert.match(site, /Business plan coming soon/);
});

test("the signed-in catalogue removes the six-seat assumption and cannot select Business", () => {
  const includedSeatsSource = app.slice(app.indexOf("function includedMemberSeats"), app.indexOf("function isBusinessComingSoon"));
  assert.doesNotMatch(includedSeatsSource, /business/);
  assert.match(includedSeatsSource, /household" \? 4 : 1/);
  assert.match(app, /Business is coming soon\. Pricing and included seats will be announced before launch\./);
  assert.match(app, /plan\.is_active && plan\.available_for_purchase !== false/);
  assert.match(app, /BUSINESS_COMING_SOON/);
  assert.doesNotMatch(appPage, /owner plus five team members/i);
});

test("the specification fixes permissions, statuses, finance rules, and isolation", () => {
  for (const phrase of [
    "Only the Owner manages subscription",
    "`team.manage`",
    "Nobody may approve their own",
    "Staff never receive company-wide financial totals",
    "Every Business record must contain `workspace_id`",
    "Actual income",
    "Actual paid spending",
    "Committed spending",
    "No duplicate counting",
    "immutable conversion-rate snapshot",
    "Personal and Family"
  ]) assert.match(specification, new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.match(specification, /`draft`, `submitted`, `changes_requested`, `approved`, `rejected`/);
  assert.match(specification, /Owner is redirected to a locked renewal experience/);
});

test("Stage 0 leaves the Personal and Family product paths intact", () => {
  assert.match(app, /plan\?\.code === "household" \? 4 : 1/);
  assert.match(app, /Start Family plan/);
  assert.match(app, /submit_family_plan_request/);
  assert.match(app, /plan\.code !== "free"/);
  assert.doesNotMatch(migration, /where workspace_type = '(?:personal|household)'/);
  assert.doesNotMatch(migration, /update public\.payment_items/);
  assert.doesNotMatch(migration, /update public\.workspace_members/);
});
