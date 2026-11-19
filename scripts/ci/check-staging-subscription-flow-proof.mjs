import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { API_ORIGIN, WEB_ORIGIN, Stop, apiTransport, checkStagingAccess, digest, need,
  privateAccounts, readPublicConfiguration } from "./staging-access.mjs";
import { normalizeStaticPdf } from "../../supabase/functions/validate-payment-proof/pdf.mjs";
import { pdf, receiptPdf } from "../fixtures/pdf-proof-tools/fixtures.mjs";

const AGENT = "Mushavo-Staging-FR32-Subscription-Flow";
const OWNER = "ca7bdcf2-e69d-42e2-8ae8-79cac6de2184";
const PERSONAL = "017513c6-ce57-48af-b902-9552faeb83dd";
const FAMILY = "50e06a1d-734a-45d7-9d17-3bf46c8e9d71";
const BUSINESS = "8d9307e6-aada-4c9a-a8f5-43c57e0865e2";
const BUSINESS_NAME = "audit-fr3-logo-ingestion-20261112";
const BUCKET = "subscription-proofs";
const REASON = "Synthetic FR.3.2 audit receipt. No money transferred.";
const LANES = {
  personal: PERSONAL,
  "family-plan": PERSONAL,
  "family-renewal": FAMILY,
  "family-extra": FAMILY,
  business: BUSINESS,
  "business-extra": BUSINESS,
  "business-purchase": PERSONAL,
};
const one = r => r.status === 200 && r.data?.length === 1 ? r.data[0] : null;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const isDenial = r => r.status >= 400 && r.status < 500;

function billingSubmission(lane, workspace, renewal, quote) {
  switch (lane) {
    case "family-extra":
      return ["submit_family_extra_places", {p_workspace_id: workspace, p_count: 1, p_expected_amount: quote.amount}];
    case "business":
    case "business-extra":
      return ["submit_business_subscription_payment", {p_workspace_id: workspace, p_quote_id: quote.id, p_payment_id: randomUUID()}];
    case "business-purchase":
      return ["submit_business_plan_request", {
        ...renewal, p_plan_code: "audit_fr32_business", p_total_member_count: 1, p_expected_settings_version: 1,
        p_personal_workspace_id: workspace, p_business_name: "Synthetic FR32 Business purchase", p_submission_id: randomUUID(),
      }];
    case "family-plan":
      return ["submit_family_plan_request", {...renewal, p_personal_workspace_id: workspace, p_family_name: "Synthetic FR32 Family request"}];
    default:
      return ["submit_subscription_renewal", {...renewal, p_workspace_id: workspace}];
  }
}

async function exercise({ actors, evidence }, key, decodeJpeg, selected) {
  const owner = actors.USER_A, other = actors.USER_B, admin = actors.ADMIN;
  need(owner.id === OWNER && other.id !== OWNER && admin.id !== OWNER, "EXACT_SUBSCRIPTION_IDENTITIES");
  const input = await receiptPdf();
  const differentInput = await receiptPdf({pages: 2});
  const clean = await normalizeStaticPdf(input, pdf, decodeJpeg);
  const sha = digest(clean);
  const basename = sha.slice(0, 32).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5") + ".pdf";
  evidence.requests = 0;
  evidence.lanes = {};
  evidence.production_changed = false;

  async function call(actor, path, body, customHeaders = {}) {
    need(++evidence.requests <= 105, "EXACT_SUBSCRIPTION_REQUEST_BOUND");
    const result = await fetch(API_ORIGIN + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { apikey: key, authorization: "Bearer " + actor.token, "user-agent": AGENT,
        origin: WEB_ORIGIN, "content-type": "application/json", ...customHeaders },
      ...(body === undefined ? {} : { body: body instanceof Uint8Array ? body : JSON.stringify(body) }),
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000),
    });
    let data;
    if (path === "/functions/v1/get-private-file" && result.ok) data = Buffer.from(await result.arrayBuffer());
    else try { data = await result.json(); } catch {}
    return {
      status: result.status, data,
      mediaType: result.headers.get("x-mushavo-media-type"),
      noStore: /private, no-store/.test(result.headers.get("cache-control") || ""),
    };
  }
  const rpc = (actor, name, args) => call(actor, "/rest/v1/rpc/" + name, args);
  const quoteFor = async (lane, ws) => {
    if (lane === "family-extra") {
      const q = await rpc(owner, "family_extra_place_quote", {p_workspace_id: ws, p_count: 1});
      need(q.status === 200 && q.data?.workspace_id === ws && q.data.amount === 1 && q.data.target_limit === 5,
        q.data?.message === "ACTIVE_FAMILY_SUBSCRIPTION_REQUIRED" ? "FAMILY_EXTRA_ACTIVE_TERM_REQUIRED" : "FAMILY_EXTRA_REAL_QUOTE_REQUIRED");
      return q.data;
    }
    if (lane === "business" || lane === "business-extra") {
      const q = await rpc(owner, "business_subscription_quote",
        {p_workspace_id: ws, p_kind: lane === "business-extra" ? "extra_seats" : "renewal", p_billing_period: "monthly", p_quantity: 1});
      need(q.status === 200 && uuid.test(q.data?.id || "") && q.data.workspace_id === ws && q.data.amount === 1
        && (lane !== "business-extra" || q.data.total_seats === 2 && q.data.additional_seats === 1),
        "BUSINESS_REAL_QUOTE_REQUIRED");
      return q.data;
    }
    return null;
  };
  const inspect = (actor, reference) => call(actor, "/rest/v1/subscription_payments?select=id,renewal_request_id,status,amount,currency,workspace_id,submitted_by"
    + "&reference_number=eq." + reference + "&limit=2");
  const review = (actor, id) => rpc(actor, "review_subscription_payment",
    {p_payment_id: id, p_decision: "rejected", p_reason: REASON});
  const broker = (actor, path) => call(actor, "/functions/v1/get-private-file", {bucket: BUCKET, path});
  const savedFile = r => r.status === 200 && r.noStore && r.mediaType === "application/pdf" && digest(r.data) === sha;
  const workspace = actor => call(actor, "/rest/v1/budget_workspaces?select=id,name,status,owner_id,business_support_version&id=eq." + BUSINESS + "&limit=2");
  const setBusinessStatus = (status, version) => rpc(admin, "admin_business_set_status", {
    p_workspace_id: BUSINESS, p_status: status, p_expected_version: version,
    p_confirmation_name: BUSINESS_NAME, p_reason: REASON, p_request_id: randomUUID(),
  });
  const exactBusiness = w => w?.id === BUSINESS && w.name === BUSINESS_NAME && w.owner_id === OWNER;

  async function runLane(lane) {
    const ws = LANES[lane], record = {checks: {}};
    evidence.lanes[lane] = record;
    const check = (name, ok) => {
      record.checks[name] = ok === true;
      need(ok === true, name);
    };
    const reference = "FR32-SYNTHETIC-20261115-" + lane;
    const path = "workspaces/" + ws + "/" + OWNER + "/fr32-billing-" + lane + "/" + basename;
    const upload = (actor, bytes) => call(actor, "/functions/v1/validate-subscription-flow-proof", bytes, {
      "content-type": "application/pdf", "x-mushavo-attachment": lane + ":" + ws,
    });
    if (lane === "business-purchase") {
      const terms = await rpc(other, "public_business_checkout_terms", {});
      check("PRIVATE_TEST_PLAN_STAYS_OUT_OF_PUBLIC_CHECKOUT", terms.status === 200 && Array.isArray(terms.data)
        && !terms.data.some(term => term.plan_id === "0b8eacc8-eae9-4b83-89f8-d8684fe05c9a"));
    }
    const initial = await inspect(admin, reference);
    check("EXACT_LEDGER_BASELINE", initial.status === 200 && initial.data?.length <= 1);
    let payment = one(initial);
    if (!payment) {
      const uploadDenied = await upload(other, input);
      check("UNRELATED_ACCOUNT_UPLOAD_DENIED", uploadDenied.status === 403 && uploadDenied.data?.error === "SUBSCRIPTION_FLOW_OWNER_REQUIRED");
      const uploadResult = await upload(owner, input);
      record.upload_status = uploadResult.status;
      if (/^[A-Z_]{4,80}$/.test(uploadResult.data?.error || "")) record.upload_error = uploadResult.data.error;
      check("VALIDATED_PROOF_WRITTEN", uploadResult.status === 200 && uploadResult.noStore && uploadResult.data?.path === path
        && uploadResult.data.type === "application/pdf" && uploadResult.data.size === clean.length);
      const same = await upload(owner, input);
      check("IDENTICAL_UPLOAD_RETURNED_SAME_PROOF", same.status === 200 && same.data?.path === path && same.data.size === clean.length);
      const over = await upload(owner, differentInput);
      check("SCOPED_UPLOAD_QUOTA_DENIED_SECOND_FILE", over.status === 429 && over.data?.error === "PROOF_UPLOAD_CAPACITY_REACHED");

      const q = await quoteFor(lane, ws);
      const common = {
        p_payment_method: "Synthetic staging", p_payment_date: new Date().toISOString().slice(0, 10),
        p_reference_number: reference, p_notes: REASON,
        p_proof_path: path, p_proof_name: "Synthetic FR32 proof.pdf",
        p_proof_mime_type: "application/pdf", p_proof_size_bytes: clean.length,
      };
      const renewal = { p_plan_code: lane === "personal" ? "audit_fr32_personal" : "audit_fr32_household",
        p_total_member_count: lane === "personal" ? 1 : 4, p_billing_period: "monthly", p_currency: "USD", p_amount: 1 };
      const [method, args] = billingSubmission(lane, ws, renewal, q);
      const sent = await rpc(owner, method, {...common, ...args});
      record.submission_status = sent.status;
      if (/^[A-Z_0-9]{4,110}$/.test(sent.data?.message || "")) record.submission_error = sent.data.message;
      payment = one(await inspect(admin, reference));
      check("REAL_SUBMISSION_COMMITTED", payment?.status === "pending_review" && sent.status === 200);
    } else {
      record.resumed_exact_payment = true;
    }

    check("OWNER_AND_AMOUNT_BOUND", payment?.workspace_id === ws && payment.submitted_by === OWNER
      && payment.currency === "USD" && Number(payment.amount) === 1 && uuid.test(payment.id));
    if (payment.status === "pending_review") {
      const ordinaryReview = await review(other, payment.id);
      check("ORDINARY_ACCOUNT_REVIEW_DENIED", isDenial(ordinaryReview));
      const reviewed = await review(admin, payment.id);
      record.staff_review_status = reviewed.status;
      if (/^[A-Z_0-9]{4,110}$/.test(reviewed.data?.message || "")) record.staff_review_error = reviewed.data.message;
      check("AUTHORIZED_STAFF_REJECTED_SYNTHETIC_PAYMENT", reviewed.status === 200 && reviewed.data === "rejected");
    }
    const saved = one(await inspect(owner, reference));
    check("OWNER_CAN_READ_REVIEW_OUTCOME", saved?.id === payment.id && saved.status === "rejected");
    const proof = one(await call(admin, "/rest/v1/subscription_payment_proofs?select=payment_id,storage_path,mime_type,size_bytes,uploaded_by&payment_id=eq."
      + payment.id + "&limit=2"));
    check("PROOF_METADATA_SURVIVED_REVIEW", proof?.payment_id === payment.id && proof.storage_path === path
      && proof.uploaded_by === OWNER && proof.mime_type === "application/pdf" && Number(proof.size_bytes) === clean.length);
    check("OWNER_DOWNLOADED_EXACT_PROOF", savedFile(await broker(owner, path)));
    check("AUTHORIZED_STAFF_DOWNLOADED_EXACT_PROOF", savedFile(await broker(admin, path)));
    check("UNRELATED_ACCOUNT_DOWNLOAD_DENIED", (await broker(other, path)).status === 404);
  }

  let suspendedVersion, failure = false;
  try {
    if (selected.includes("business") || selected.includes("business-extra")) {
      const initial = one(await workspace(admin));
      need(exactBusiness(initial) && initial.status === "suspended"
        && [52, 54, 56, 58].includes(initial.business_support_version), "EXACT_SUSPENDED_BUSINESS_FIXTURE");
      suspendedVersion = initial.business_support_version;
      need((await setBusinessStatus("active", suspendedVersion)).status === 200, "BUSINESS_FIXTURE_ACTIVATION");
    }
    for (const lane of selected) {
      try { await runLane(lane); } catch (error) {
        evidence.lanes[lane].problem_code = error instanceof Stop ? error.code : "SUBSCRIPTION_FLOW_REQUEST_FAILED";
        failure = true;
      }
    }
  } finally {
    if (suspendedVersion !== undefined) {
      const current = one(await workspace(admin));
      need(exactBusiness(current), "BUSINESS_FIXTURE_RESTORE_SCOPE");
      if (current.status === "active" && current.business_support_version === suspendedVersion + 1) {
        need((await setBusinessStatus("suspended", current.business_support_version)).status === 200, "BUSINESS_FIXTURE_RESUSPENSION");
      }
      const restored = one(await workspace(admin));
      evidence.business_fixture_suspended = exactBusiness(restored) && restored.status === "suspended"
        && [suspendedVersion, suspendedVersion + 2].includes(restored.business_support_version);
      need(evidence.business_fixture_suspended, "BUSINESS_FIXTURE_RESTORE_READBACK");
    }
  }
  need(!failure, "SUBSCRIPTION_FLOW_CHECKS_REQUIRE_REVIEW");
}

async function main() {
  const p = JSON.parse(await readFile(new URL("./staging-subscription-flow-proof-run.json", import.meta.url), "utf8"));
  if (p.enabled === false) return {result: "SUBSCRIPTION_FLOW_PLAN_ARCHIVED", exit_code: 0};
  need(p.enabled === true && p.project === "dczlddwbtgvfdujgcitb" && p.version === 1
    && Array.isArray(p.lanes) && p.lanes.length >= 1 && p.lanes.length <= Object.keys(LANES).length
    && new Set(p.lanes).size === p.lanes.length && p.lanes.every(lane => Object.hasOwn(LANES, lane)),
    "EXACT_STAGING_SUBSCRIPTION_RUN");
  need(process.env.GITHUB_REPOSITORY === "dwtdhruvp246/mushavobudget"
    && process.env.GITHUB_REF === "refs/heads/security/stage-3-authorization"
    && process.env.GITHUB_RUN_ATTEMPT === "1", "EXACT_STAGING_BRANCH_REQUIRED");
  const response = await fetch(WEB_ORIGIN + "/config.js?v=27", {redirect: "error", signal: AbortSignal.timeout(15000)});
  need(response.ok, "STAGING_CONFIGURATION_REQUIRED");
  const {key} = readPublicConfiguration(await response.text());
  const {default: jpeg} = await import("../fixtures/logo-jpeg-tools/node_modules/jpeg-js/index.js");
  const options = {accountScope: "standard"};
  const result = await checkStagingAccess(privateAccounts(process.env, options), apiTransport(key, AGENT),
    input => exercise(input, key, jpeg.decode, p.lanes), options);
  return {...result, progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Subscription flows", commit: process.env.GITHUB_SHA};
}
const report = await main().catch(error => ({
  progress_display: "Stage 4/10 | FR.3/8 | FR.3.2 Subscription flows",
  result: "SUBSCRIPTION_FLOW_REVIEW_REQUIRED", problem_code: error instanceof Stop ? error.code : "SUBSCRIPTION_RUN_ERROR", exit_code: 1,
}));
console.log(JSON.stringify(report, null, 2));
process.exitCode = report.exit_code;
