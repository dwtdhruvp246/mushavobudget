import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20260928170000_business_stage_4_team.sql", import.meta.url), "utf8");
const diagnostic = await readFile(new URL("../supabase/diagnostics/business_stage_4_team_diagnostic.sql", import.meta.url), "utf8");
const schema = await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8");
const app = await readFile(new URL("../business.js", import.meta.url), "utf8");
const page = await readFile(new URL("../business.html", import.meta.url), "utf8");
const edge = await readFile(new URL("../supabase/functions/invite-business-member/index.ts", import.meta.url), "utf8");

test("Stage 4 schema is mirrored exactly and private support tables force RLS", () => {
  assert.ok(schema.includes(migration));
  assert.match(migration, /business_invitation_scopes enable row level security;[\s\S]*business_invitation_scopes force row level security/);
  assert.match(migration, /business_team_operation_permits enable row level security;[\s\S]*business_team_operation_permits force row level security/);
  assert.match(migration, /revoke all on table public\.business_team_operation_permits from public, anon, authenticated/);
});

test("pending invitations reserve capacity and expired or cancelled invitations release it", () => {
  assert.match(migration, /count\(\*\) from public\.workspace_invitations where workspace_id = p_workspace_id and status = 'pending'/);
  assert.match(migration, /set status = 'expired'.*version = version \+ 1/s);
  assert.match(migration, /set status = 'cancelled'.*version = version \+ 1/s);
  assert.match(page, /Pending invitations reserve capacity immediately/);
});

test("duplicate members and pending invitations are rejected before a seat is reserved", () => {
  assert.match(migration, /raise exception 'ALREADY_BUSINESS_MEMBER'/);
  assert.match(migration, /raise exception 'INVITATION_ALREADY_PENDING'/);
  assert.match(migration, /raise exception 'CANNOT_INVITE_YOURSELF'/);
  assert.match(migration, /raise exception 'BUSINESS_SEAT_LIMIT_REACHED'/);
});

test("invitation acceptance requires the authenticated email and protected member permit", () => {
  const respond = migration.slice(migration.indexOf("create or replace function public.respond_business_invitation"), migration.indexOf("create or replace function public.update_business_member_access"));
  assert.match(respond, /invitee_user_id = auth\.uid\(\).*lower\(invitee_email\).*auth\.jwt/s);
  assert.match(respond, /business_team_operation_permits[\s\S]*'member_write'/);
  assert.match(respond, /status = 'accepted'/);
});

test("removal revokes Business access and ownership transfer is owner-confirmed and atomic", () => {
  assert.match(migration, /delete from public\.business_member_permissions[\s\S]*delete from public\.business_member_scopes[\s\S]*status = 'inactive'/);
  assert.match(migration, /owner_id = auth\.uid\(\).*for update/s);
  assert.match(migration, /p_confirmation_name[\s\S]*OWNERSHIP_CONFIRMATION_MISMATCH/);
  assert.match(migration, /role = 'business_admin'[\s\S]*role = 'business_owner'[\s\S]*owner_id = v_new_owner\.user_id/);
});

test("email delivery verifies the caller and records delivery with service authority", () => {
  assert.match(edge, /userClient\.auth\.getUser\(\)/);
  assert.match(edge, /userClient\.rpc\("create_business_invitation"/);
  assert.match(edge, /inviteUserByEmail/);
  assert.match(edge, /signInWithOtp/);
  assert.match(edge, /record_business_invitation_delivery/);
  assert.match(migration, /grant execute on function public\.record_business_invitation_delivery[\s\S]*to service_role/);
});

test("Business Team UI supports invites, scopes, editing, resend, cancellation, removal and transfer", () => {
  for (const phrase of ["invite-business-member", "edit_business_invitation", "cancel_business_invitation", "update_business_member_access", "remove_business_member", "transfer_business_ownership", "respond_business_invitation"]) assert.match(app, new RegExp(phrase));
  assert.match(page, /businessInviteScopes/);
  assert.match(page, /businessOwnershipDialog/);
  assert.match(page, /businessAvailableSeats/);
});

test("diagnostic checks privileges, permit gates, transfer safeguards and launch locks", () => {
  assert.match(diagnostic, /Authenticated users have direct access to protected team tables/);
  assert.match(diagnostic, /Stage 0 launch locks do not require protected Stage 4 permits/);
  assert.match(diagnostic, /Ownership transfer protections are missing/);
  assert.match(diagnostic, /Public Business launch controls were opened by Stage 4/);
});
