import { readFile } from "node:fs/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need, privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { FAMILY, ITEM, OWNER, MEMBER, prefixFor } from "../../supabase/functions/validate-family-proof/scope.mjs";
import { normalizeLogoJpeg } from "../../supabase/functions/validate-business-logo/jpeg.mjs";
import { PROGRESSIVE_ROTATED_JPEG } from "../fixtures/logo-jpeg-tools/images.mjs";

const AGENT = "Mushavo-Staging-FR3-Family-Proof";
const NAME = "audit-fr3-family-proof-20261113";
const BUCKET = "payment-proofs";
const RECORD = "0f8cb006-d556-4440-9bbd-a246e304e09e";
const jpg = Buffer.from(PROGRESSIVE_ROTATED_JPEG, "base64");
const one = r => r.status === 200 && r.data?.length === 1 ? r.data[0] : null;
const empty = r => r.status === 200 && r.data?.length === 0;

async function exercise({ actors, evidence }, key, workspace, png) {
  const owner = actors.USER_A, member = actors.USER_B;
  need(owner.id === OWNER && member.id === MEMBER, "EXACT_FAMILY_ACTORS_REQUIRED");
  const hash = digest(png);
  const suffix = hash.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5") + ".png";
  const paths = Object.fromEntries([owner, member].map(actor => [actor.id, prefixFor(actor.id) + suffix]));
  const today = new Date().toISOString().slice(0, 10);
  const routes = {
    family: "/rest/v1/families?id=eq." + FAMILY,
    workspace: "/rest/v1/budget_workspaces?id=eq." + workspace,
    members: "/rest/v1/family_members?family_id=eq." + FAMILY + "&limit=3",
    item: "/rest/v1/payment_items?id=eq." + ITEM,
    create: "/rest/v1/payment_items",
    records: "/rest/v1/payment_records?payment_item_id=eq." + ITEM + "&limit=2",
    record: "/rest/v1/payment_records",
    context: "/rest/v1/rpc/private_file_download_context",
    removeMember: "/rest/v1/rpc/remove_family_member",
    removeFamily: "/rest/v1/rpc/delete_family_workspace",
    validate: "/functions/v1/validate-family-proof",
    broker: "/functions/v1/get-private-file",
    direct: "/storage/v1/object/" + BUCKET + "/" + paths[MEMBER],
    remove: "/storage/v1/object/" + BUCKET,
  };
  Object.assign(evidence, { checks: {}, requests: 0, cleanup: {} });
  const check = (name, ok) => {
    evidence.checks[name] = Boolean(ok);
    need(ok, name);
  };
  async function call(route, method, actor, body, type) {
    need(Object.hasOwn(routes, route) && ++evidence.requests <= 45, "FAMILY_PROOF_REQUEST_BOUND");
    const r = await fetch(API_ORIGIN + routes[route], {
      method, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
      headers: { apikey: key, authorization: "Bearer " + actor.token, "user-agent": AGENT,
        "content-type": type || "application/json", origin: WEB_ORIGIN, prefer: "return=representation",
        ...(route === "direct" ? { "x-upsert": "false" } : {}) },
      ...(body === undefined ? {} : { body: type ? body : JSON.stringify(body) }),
    });
    let data;
    if (route === "broker" && r.status === 200) data = Buffer.from(await r.arrayBuffer());
    else try { data = await r.json(); } catch {}
    return { status: r.status, data, noStore: /private, no-store/.test(r.headers.get("cache-control") || "") };
  }
  const item = () => call("item", "GET", owner);
  const records = () => call("records", "GET", owner);
  const context = path => call("context", "POST", owner, { p_bucket_id: BUCKET, p_object_name: path });
  const validate = (actor, type = "image/jpeg") => call("validate", "POST", actor, jpg, type);
  const broker = (actor, path) => call("broker", "POST", actor, { bucket: BUCKET, path });
  const save = (payer, path, size) => call("record", "POST", member, {
    id: RECORD, payment_item_id: ITEM, workspace_id: workspace, visibility: "family", family_id: FAMILY,
    owner_id: MEMBER, recorded_by: MEMBER, paid_by_member_id: payer,
    period_start: today.slice(0, 7) + "-01", due_date: today, payment_date: today,
    amount: 1, currency: "USD", payment_method: "Other",
    proof_path: path, proof_name: "synthetic-family.png", proof_mime_type: "image/png", proof_size_bytes: size,
  });
  const valid = (r, path) => r.status === 200 && r.noStore && r.data?.path === path
    && r.data.type === "image/png" && r.data.size === png.length;
  const exact = r => r.status === 200 && r.noStore && digest(r.data) === hash;
  const rejected = (r, code) => r.status >= 400 && r.data?.message === code;
  let bound = false, failure, cleanupFailure;
  try {
    const f = one(await call("family", "GET", owner));
    const w = one(await call("workspace", "GET", owner));
    check("EXACT_FAMILY_FIXTURE", f?.id === FAMILY && f.owner_id === OWNER && f.name === NAME
      && w?.id === workspace && w.owner_id === OWNER && w.legacy_family_id === FAMILY && w.status === "active"
      && w.workspace_type === "household");
    bound = true;
    const members = await call("members", "GET", owner);
    const payer = members.data?.find?.(row => row.user_id === MEMBER && row.status === "active");
    check("EXACT_ACTIVE_MEMBERS", members.status === 200 && members.data?.length === 2 && payer?.family_id === FAMILY
      && members.data.some(row => row.user_id === OWNER && row.status === "active"));
    check("EMPTY_FAMILY_PROOF_BASELINE", empty(await item()) && empty(await records())
      && empty(await context(paths[OWNER])) && empty(await context(paths[MEMBER])));
    const created = await call("create", "POST", owner, {
      id: ITEM, workspace_id: workspace, owner_id: OWNER, created_by: OWNER, visibility: "family", family_id: FAMILY,
      name: NAME, amount: 1, currency: "USD", category: "Other", recurrence_type: "once",
      due_day: Number(today.slice(-2)), start_date: today, reminder_days_before: 0, status: "active",
    });
    check("EXACT_FAMILY_ITEM_CREATED", created.status === 201 && created.data?.[0]?.id === ITEM && created.data[0].workspace_id === workspace);
    const direct = await call("direct", "POST", member, png, "image/png");
    check("DIRECT_RESERVED_WRITE_DENIED", [401,403].includes(direct.status)
      || direct.status === 400 && [401,403].includes(Number(direct.data?.statusCode)));
    check("MISSING_FILE_LINK_DENIED", rejected(await save(payer.id, paths[MEMBER], png.length), "FR3_FAMILY_STORAGE_METADATA_MISMATCH"));
    const mislabeled = await validate(member, "image/png");
    check("MISLABELED_IMAGE_DENIED", mislabeled.status === 422 && mislabeled.data?.error === "INVALID_PROOF_IMAGE");
    check("OWNER_PROOF_NORMALIZED", valid(await validate(owner), paths[OWNER]));
    check("MEMBER_PROOF_NORMALIZED", valid(await validate(member), paths[MEMBER]));
    const before = one(await context(paths[MEMBER]));
    const retry = await validate(member);
    const after = one(await context(paths[MEMBER]));
    check("MEMBER_IDENTICAL_RETRY_REUSED", valid(retry, paths[MEMBER]) && before?.object_id
      && before.object_id === after?.object_id && before.object_version === after.object_version);
    check("WRONG_PROOF_SIZE_DENIED", rejected(await save(payer.id, paths[MEMBER], png.length + 1), "FR3_FAMILY_STORAGE_METADATA_MISMATCH"));
    const saved = await save(payer.id, paths[MEMBER], png.length);
    const row = one(await records());
    check("FAMILY_PAYMENT_LINKED", saved.status === 201 && row?.id === RECORD && row.workspace_id === workspace
      && row.proof_path === paths[MEMBER] && row.proof_mime_type === "image/png" && row.proof_size_bytes === png.length);
    check("OWNER_READS_MEMBER_PROOF", exact(await broker(owner, paths[MEMBER])));
    check("MEMBER_READS_OWN_PROOF", exact(await broker(member, paths[MEMBER])));
    const removed = await call("removeMember", "POST", owner, { p_family_id: FAMILY, p_member_id: payer.id });
    check("EXACT_MEMBER_REMOVED", removed.status === 200 && removed.data === "removed");
    const lostAccess = await validate(member);
    check("FORMER_MEMBER_VALIDATION_DENIED", lostAccess.status === 403 && lostAccess.data?.error === "FAMILY_PROOF_MEMBERSHIP_REQUIRED");
    const lostRead = await broker(member, paths[MEMBER]);
    check("FORMER_MEMBER_PROOF_READ_DENIED", lostRead.status === 404 && lostRead.noStore);
    check("OWNER_RETAINS_PROOF_ACCESS", exact(await broker(owner, paths[MEMBER])));
  } catch (error) { failure = error; }
  finally {
    if (bound) try {
      const current = await item(), linked = await records();
      need(current.status === 200 && linked.status === 200 && [0, 1].includes(current.data?.length)
        && [0, 1].includes(linked.data?.length), "EXACT_FINANCE_CLEANUP_READ_REQUIRED");
      if (linked.data.length) {
        const row = linked.data[0];
        need(row.id === RECORD && row.workspace_id === workspace && row.family_id === FAMILY
          && row.payment_item_id === ITEM && row.owner_id === MEMBER && row.proof_path === paths[MEMBER], "EXACT_RECORD_CLEANUP_REQUIRED");
      }
      if (current.data.length) {
        const row = current.data[0];
        need(row.id === ITEM && row.name === NAME && row.workspace_id === workspace && row.family_id === FAMILY
          && row.owner_id === OWNER, "EXACT_ITEM_CLEANUP_REQUIRED");
        const deleted = await call("item", "DELETE", owner);
        need(deleted.status === 200 && deleted.data?.length === 1, "EXACT_ITEM_DELETE_REQUIRED");
      }
      need(empty(await item()) && empty(await records()), "EXACT_FINANCE_ABSENCE_REQUIRED");
      evidence.cleanup.finance_absent = true;
      const present = [];
      for (const path of Object.values(paths)) {
        const object = await context(path);
        need(object.status === 200 && [0, 1].includes(object.data?.length), "EXACT_OBJECT_CONTEXT_REQUIRED");
        if (object.data.length) {
          need(object.data[0].object_name === path, "EXACT_OBJECT_NAME_REQUIRED");
          present.push(path);
        }
      }
      if (present.length) need((await call("remove", "DELETE", owner, { prefixes: present })).status === 200, "EXACT_OBJECT_REMOVAL_REQUIRED");
      for (const path of Object.values(paths)) need(empty(await context(path)), "EXACT_OBJECT_ABSENCE_REQUIRED");
      evidence.cleanup.objects_absent = true;
      const deleted = await call("removeFamily", "POST", owner, { p_family_id: FAMILY });
      need(deleted.status === 200 && deleted.data === "deleted"
        && empty(await call("family", "GET", owner)) && empty(await call("workspace", "GET", owner)), "FAMILY_FIXTURE_ABSENCE_REQUIRED");
      evidence.cleanup.family_absent = true;
    } catch (error) { cleanupFailure = error; }
    if (failure instanceof Stop) evidence.check_failure = failure.code;
  }
  if (cleanupFailure) throw cleanupFailure;
  if (failure) throw failure;
}

async function main() {
  const p = JSON.parse(await readFile(new URL("./staging-family-proof-images-run.json", import.meta.url), "utf8"));
  if (p.enabled === false) return { result: "FAMILY_PROOF_PLAN_ARCHIVED", exit_code: 0 };
  need(p.enabled === true && p.project === "dczlddwbtgvfdujgcitb" && p.family === FAMILY && p.item === ITEM
    && /^[a-f0-9-]{36}$/.test(p.workspace || "") && p.status === "HOSTED_FAMILY_PROOF_ONCE", "EXACT_FAMILY_PROOF_PLAN_REQUIRED");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization"
    && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_BRANCH_REQUIRED");
  const r = await fetch(WEB_ORIGIN + "/config.js?v=27", { redirect: "error", signal: AbortSignal.timeout(15000) });
  need(r.ok, "STAGING_CONFIGURATION_REQUIRED");
  const { key } = readPublicConfiguration(await r.text());
  const { default: jpeg } = await import("../fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js");
  const png = normalizeLogoJpeg(jpg, jpeg.decode);
  const options = { accountScope: "ordinary" };
  const report = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    input => exercise(input, key, p.workspace, png), options);
  return { ...report, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Family proof images", commit: process.env.GITHUB_SHA };
}

const report = await main().catch(error => ({
  progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Family proof images",
  result: "STAGING_FAMILY_PROOF_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "UNEXPECTED_FAMILY_PROOF_RUN_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
