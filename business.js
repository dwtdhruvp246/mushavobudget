// Mushavo Budget Business application — Stage 6 bills and recurring
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm";

const config = window.MUSHAVO_BUDGET_CONFIG || window.EXPENSE_TRACKER_CONFIG || {};
const placeholders = ["YOUR-PROJECT-REF", "YOUR-SUPABASE-PUBLISHABLE-KEY"];
const isConfigured = Boolean(
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  !placeholders.some((value) => `${config.supabaseUrl} ${config.supabasePublishableKey}`.includes(value))
);
const supabase = isConfigured ? createClient(config.supabaseUrl, config.supabasePublishableKey) : null;
const VALID_TABS = new Set(["overview", "activity", "bills", "approvals", "budgets", "reports", "team", "settings", "subscription"]);
const TAB_COPY = {
  overview: ["Business overview", "Business overview", "A clear view of your company’s financial activity."],
  activity: ["Business ledger", "Activity & Transactions", "Company financial activity in one ordered record."],
  bills: ["Business commitments", "Bills & Recurring", "Supplier bills, recurring costs, and due dates."],
  approvals: ["Business controls", "Requests & Approvals", "Review spending requests and claims with clear ownership."],
  budgets: ["Business planning", "Budgets", "Plan company spending and monitor limits."],
  reports: ["Business analysis", "Reports", "Understand income, paid spending, and commitments."],
  team: ["People & access", "Team", "Workspace members, roles, and access status."],
  settings: ["Workspace setup", "Settings", "Business identity and reporting preferences."],
  subscription: ["Plan & access", "Subscription & Billing", "Subscription dates, status, and renewal access."]
};
const ROLE_LABELS = {
  business_owner: "Owner",
  business_admin: "Admin",
  finance_manager: "Finance Manager",
  team_manager: "Team Manager",
  staff: "Staff",
  contributor: "Contributor",
  viewer: "Viewer",
  owner: "Owner"
};

const state = {
  session: null,
  profile: null,
  workspaces: [],
  memberships: [],
  workspace: null,
  workspaceMembers: [],
  teamSnapshot: null,
  incomingInvitations: [],
  workspaceSubscription: null,
  workspaceEntitlement: null,
  workspaceSettings: null,
  businessProfile: null,
  businessCategories: [],
  businessDimensions: [],
  setupDraft: null,
  supportedCurrencies: [],
  transactions: [],
  bills: [],
  requests: [],
  budgets: [],
  documents: [],
  auditEvents: [],
  permissions: new Set(),
  claims: [],
  claimReceipts: [],
  memberScopes: [],
  claimSummary: null,
  billSuppliers: [],
  billSchedules: [],
  billPayments: [],
  billDocuments: [],
  billSummary: null,
  tab: "overview",
  locked: false,
  lockOwner: false
};
let workspaceLoadSequence = 0;
let appOpening = false;
let setupStep = "basics";
let setupOpen = false;
let setupBusy = false;
let chosenCurrencies = new Set();
let teamBusy = false;
let claimBusy = false;
let openedClaimId = null;
let openedBillId = null;
let billBusy = false;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showOnly(viewId) {
  ["businessLoading", "businessConfig", "businessSuspended", "businessNoAccess", "businessInvitations", "businessError", "businessApp"]
    .forEach((id) => document.getElementById(id)?.classList.toggle("hidden", id !== viewId));
}

function friendlyMessage(error) {
  const message = String(error?.message || error || "The Business workspace could not be opened.");
  if (/BUSINESS_SETUP_CHANGED|BUSINESS_CATEGORY_CHANGED|BUSINESS_DIMENSION_CHANGED|BUSINESS_SETUP_DRAFT_CHANGED/.test(message)) return "Someone updated this business while you were editing. Reload this workspace and try again.";
  if (/BUSINESS_ACTIVE_OWNER_REQUIRED/.test(message)) return "Only the Owner of an active Business subscription can change setup.";
  if (/INVALID_BUSINESS_CURRENCIES|INVALID_BUSINESS_SETUP/.test(message)) return "Check the business name, selected currencies, timezone and financial period.";
  if (/BUSINESS_DRAFT_CURRENCY_IN_USE/.test(message)) return "Keep the first draft's currency enabled, or edit the draft to another enabled currency first.";
  if (/INVALID_BUSINESS_SETUP_DRAFT/.test(message)) return "Check the draft type, category, enabled currency, amount and dates.";
  if (/BUSINESS_SETUP_INCOMPLETE/.test(message)) return "Save your details and keep at least one active category before finishing setup.";
  if (/BUSINESS_SEAT_LIMIT_REACHED/.test(message)) return "All available Business seats are in use or reserved by pending invitations.";
  if (/INVITATION_ALREADY_PENDING/.test(message)) return "This email already has a pending invitation.";
  if (/ALREADY_BUSINESS_MEMBER/.test(message)) return "This person is already an active member of this Business workspace.";
  if (/CANNOT_INVITE_YOURSELF/.test(message)) return "You are already a member of this Business workspace.";
  if (/BUSINESS_INVITATION_RATE_LIMITED/.test(message)) return "Wait one minute before resending this invitation.";
  if (/BUSINESS_INVITATION_CHANGED/.test(message)) return "This invitation changed while you were editing. Reload the team list and try again.";
  if (/OWNERSHIP_CONFIRMATION_MISMATCH/.test(message)) return "Type the exact business name to confirm the ownership transfer.";
  if (/BUSINESS_TEAM_ACCESS_REQUIRED/.test(message)) return "You do not have permission to manage this Business team.";
  if (/BUSINESS_CLAIM_CHANGED/.test(message)) return "This claim changed. Open it again to see the latest status.";
  if (/BUSINESS_RECEIPT_REQUIRED/.test(message)) return "Attach a receipt or proof before submitting.";
  if (/BUSINESS_EXCHANGE_RATE_UNAVAILABLE/.test(message)) return "No exchange rate is available for this currency. Try the reporting currency or wait for rates to sync.";
  if (/BUSINESS_REPORTING_CURRENCY_LOCKED/.test(message)) return "This Business reporting currency is locked after the first expense claim so historical totals remain consistent.";
  if (/BUSINESS_SELF_APPROVAL_FORBIDDEN/.test(message)) return "Another authorized member must review your claim.";
  if (/BUSINESS_SCOPE_ACCESS_REQUIRED/.test(message)) return "This claim is outside your assigned project, branch or team.";
  if (/BUSINESS_CLAIM_ACCESS_REQUIRED|BUSINESS_REVIEW_ACCESS_REQUIRED|BUSINESS_PAYMENT_ACCESS_REQUIRED/.test(message)) return "Your role or subscription does not allow this action.";
  if (/BUSINESS_BILL_POSSIBLE_DUPLICATE/.test(message)) return "A bill for this supplier, amount and due date already exists. Check it before creating another.";
  if (/business_bill_supplier_reference_idx/.test(message)) return "This supplier invoice reference already exists.";
  if (/BUSINESS_BILL_CLAIM_LINK_INVALID/.test(message)) return "Choose an approved company expense with the same amount, currency and project that has no linked bill.";
  if (/BUSINESS_CLAIM_LINKED_TO_BILL/.test(message)) return "Record payment on the linked supplier bill so the expense is counted once.";
  if (/BUSINESS_BILL_PAYMENT_INVALID|BUSINESS_BILL_NOT_OPEN/.test(message)) return "Check the outstanding amount, date and payment reference. This bill may already be paid.";
  if (/business_categories_active_(name|code)_idx/i.test(message)) return "That category is already active. Choose another name.";
  if (/business_dimensions_active_(name|code)_idx/i.test(message)) return "That tag is already active. Choose another name.";
  if (/jwt|session|refresh token/i.test(message)) return "Your session could not be verified. Please sign in again.";
  if (/permission|row-level security|not authorized/i.test(message)) return "You do not have permission to open this Business workspace.";
  return message;
}

async function query(label, request) {
  const { data, error } = await request;
  if (error) {
    error.message = `${label}: ${error.message}`;
    throw error;
  }
  return data;
}

function selectedWorkspaceStorageKey() {
  return `mushavo-budget:selected-business-workspace:${state.session?.user?.id || "guest"}`;
}

function clearBusinessWorkspaceState() {
  // Clear before every Business workspace load. Stage 2 data collections are
  // already represented here so future requests cannot retain another
  // company's results while a new workspace is opening.
  workspaceLoadSequence += 1;
  state.workspace = null;
  state.workspaceMembers = [];
  state.teamSnapshot = null;
  state.workspaceSubscription = null;
  state.workspaceEntitlement = null;
  state.workspaceSettings = null;
  state.businessProfile = null;
  state.businessCategories = [];
  state.businessDimensions = [];
  state.setupDraft = null;
  state.transactions = [];
  state.bills = [];
  state.requests = [];
  state.budgets = [];
  state.documents = [];
  state.auditEvents = [];
  state.permissions = new Set();
  state.claims = [];
  state.claimReceipts = [];
  state.memberScopes = [];
  state.claimSummary = null;
  state.billSuppliers = [];
  state.billSchedules = [];
  state.billPayments = [];
  state.billDocuments = [];
  state.billSummary = null;
  openedClaimId = null;
  openedBillId = null;
  claimBusy = false;
  billBusy = false;
  state.locked = false;
  state.lockOwner = false;
  setupStep = "basics";
  setupOpen = false;
  setupBusy = false;
  teamBusy = false;
  chosenCurrencies = new Set();
  $("#businessLock")?.classList.add("hidden");
  $("#businessOnboarding")?.classList.add("hidden");
  $$("[data-business-panel]").forEach((panel) => panel.classList.add("hidden"));
}

function roleForWorkspace(workspace) {
  if (!workspace || !state.session) return null;
  if (workspace.owner_id === state.session.user.id) return "business_owner";
  return state.memberships.find((member) =>
    member.workspace_id === workspace.id && member.user_id === state.session.user.id && member.status === "active"
  )?.role || null;
}

function authorizedBusinessWorkspaces(workspaces, memberships) {
  const userId = state.session.user.id;
  const activeWorkspaceIds = new Set(
    memberships.filter((member) => member.user_id === userId && member.status === "active").map((member) => member.workspace_id)
  );
  return workspaces.filter((workspace) =>
    workspace.workspace_type === "business" &&
    workspace.status !== "closed" &&
    (workspace.owner_id === userId || activeWorkspaceIds.has(workspace.id))
  );
}

function requestedWorkspaceId() {
  return new URL(window.location.href).searchParams.get("workspace") || "";
}

function currentTab() {
  const [area, rawTab] = window.location.hash.replace(/^#\/?/, "").split("/");
  const tab = rawTab?.replace(/\.+$/, "");
  return area === "business" && VALID_TABS.has(tab) ? tab : "overview";
}

function setWorkspaceUrl(workspaceId, replace = true) {
  const url = new URL(window.location.href);
  url.searchParams.set("workspace", workspaceId);
  url.hash = `business/${state.tab}`;
  window.history[replace ? "replaceState" : "pushState"](null, "", `${url.pathname}${url.search}${url.hash}`);
}

function renderWorkspaceSelectors() {
  $$('[data-workspace-selector]').forEach((select) => {
    select.innerHTML = "";
    state.workspaces.forEach((workspace) => select.append(new Option(workspace.name || "Business workspace", workspace.id)));
    select.value = state.workspace?.id || "";
    select.disabled = state.workspaces.length < 2;
  });
}

function formatRole(role) {
  return ROLE_LABELS[role] || String(role || "Member").replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString("en", { day: "numeric", month: "short", year: "numeric" });
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString("en", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
  });
}

function countdown(value) {
  if (!value) return "Not scheduled";
  const expiry = new Date(value).getTime();
  if (!Number.isFinite(expiry)) return "—";
  const days = Math.ceil((expiry - Date.now()) / 86400000);
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}

function money(value, currency) {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value));
  } catch {
    return `${Number(value).toFixed(2)} ${currency || ""}`;
  }
}

function claimPermission(code) {
  return !state.locked && state.permissions.has(code);
}

function claimNode(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value != null) node.textContent = value;
  return node;
}

function setClaimMessage(selector, message = "", error = false) {
  const node = $(selector);
  node.textContent = message;
  node.classList.toggle("hidden", !message);
  node.classList.toggle("error", error);
}

function claimCard(claim) {
  const card = claimNode("article", "claim-row");
  const body = claimNode("div", "claim-row-body");
  body.append(
    claimNode("strong", "", claim.title),
    claimNode("small", "", `${claim.kind === "reimbursement" ? "Reimbursement" : "Company expense"} · ${formatDate(claim.expense_date)} · ${claim.status.replaceAll("_", " ")}`)
  );
  const amount = claimNode("strong", "claim-row-amount", money(claim.amount, claim.currency));
  const button = claimNode("button", "button secondary", "View");
  button.type = "button";
  button.dataset.claimId = claim.id;
  card.append(body, amount, button);
  return card;
}

function renderClaims() {
  const claims = [...state.claims].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const ownId = state.session?.user?.id;
  const reviewable = claims.filter((item) => item.status === "submitted" && item.submitted_by !== ownId && claimPermission("approvals.review"));
  const summary = state.claimSummary;
  const finance = claimPermission("finance.view_all") && summary?.finance_visible;
  const currency = summary?.reporting_currency || state.workspaceSettings?.reporting_currency || "USD";
  const billSummary = state.billSummary;
  const paidAmount = Number(summary?.paid_amount || 0) + Number(billSummary?.paid_amount || 0);
  const commitment = Number(summary?.committed_amount || 0) + Number(billSummary?.outstanding || 0);
  $("#businessPaidTotal").textContent = finance && billSummary ? money(paidAmount, currency) : finance ? money(summary.paid_amount, currency) : "Private";
  $("#businessCommitmentTotal").textContent = finance && billSummary ? money(commitment, currency) : finance ? money(summary.committed_amount, currency) : "Private";
  $("#businessPaidCount").textContent = finance ? String(summary.paid_count) : "—";
  $("#businessReportPaid").textContent = finance && billSummary ? money(paidAmount, currency) : finance ? money(summary.paid_amount, currency) : "Available to finance roles";
  $("#businessReportCommitted").textContent = finance && billSummary ? money(commitment, currency) : finance ? money(summary.committed_amount, currency) : "Available to finance roles";
  $("#businessReportPending").textContent = finance ? String(summary.pending_count) : "—";
  $("#businessReviewCount").textContent = String(summary?.review_count || 0);
  $("#businessApprovalTabCount").textContent = String(summary?.review_count || 0);
  for (const [selector, items, empty] of [
    ["#businessOverviewClaims", claims.slice(0, 4), "No expense claims recorded yet."],
    ["#businessClaimActivity", claims, "No expense claims recorded yet."],
    ["#businessClaimApprovals", reviewable, "No claims need your review."]
  ]) {
    const container = $(selector);
    container.replaceChildren(...(items.length ? items.map(claimCard) : [claimNode("p", "claim-empty", empty)]));
  }
  $$("[data-open-add], [data-open-claim]").forEach((button) => button.classList.toggle("hidden", !claimPermission("finance.create")));
}

async function refreshClaims() {
  const workspaceId = state.workspace?.id;
  if (!workspaceId || state.locked) return;
  const sequence = workspaceLoadSequence;
  const [claims, receipts, summary] = await Promise.all([
    query("Business claims load", supabase.from("business_expense_claims").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(500)),
    query("Business receipts load", supabase.from("business_documents").select("*").eq("workspace_id", workspaceId).eq("parent_type", "expense_claim").eq("status", "active").limit(500)),
    query("Business claim summary", supabase.rpc("business_claim_summary", { p_workspace_id: workspaceId }))
  ]);
  if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId) return;
  state.claims = claims;
  state.claimReceipts = receipts;
  state.claimSummary = summary;
  renderClaims();
  if (openedClaimId && $("#businessClaimDetailDialog").open) renderClaimDetail();
}

function openClaimForm(kind, existing = null) {
  if (!claimPermission("finance.create")) return;
  if ($("#businessAddDialog").open) $("#businessAddDialog").close();
  if ($("#businessClaimDetailDialog").open) $("#businessClaimDetailDialog").close();
  $("#businessClaimForm").reset();
  $("#businessClaimId").value = existing?.id || "";
  $("#businessClaimVersion").value = existing?.version || "";
  $("#businessClaimKind").value = kind;
  $("#businessClaimDialogTitle").textContent = existing ? "Edit draft" : kind === "reimbursement" ? "New reimbursement claim" : "New company expense";
  const today = new Date();
  $("#businessClaimDate").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  $("#businessClaimCurrency").replaceChildren(...(state.workspaceSettings?.enabled_currencies || []).map((code) => new Option(code, code)));
  $("#businessClaimCurrency").value = state.workspaceSettings?.default_payment_currency || state.workspaceSettings?.reporting_currency;
  $("#businessClaimCategory").replaceChildren(...state.businessCategories
    .filter((item) => item.status === "active" && ["expense", "both"].includes(item.category_type))
    .map((item) => new Option(item.name, item.id)));
  const scopedIds = new Set(state.memberScopes.map((item) => item.dimension_id));
  $("#businessClaimDimension").replaceChildren(new Option(scopedIds.size ? "Choose assigned tag" : "None", ""), ...state.businessDimensions
    .filter((item) => item.status === "active" && (!scopedIds.size || scopedIds.has(item.id)))
    .map((item) => new Option(item.name, item.id)));
  $("#businessClaimDimension").required = scopedIds.size > 0;
  if (existing) {
    $("#businessClaimTitle").value = existing.title;
    $("#businessClaimAmount").value = existing.amount;
    $("#businessClaimCurrency").value = existing.currency;
    $("#businessClaimDate").value = existing.expense_date;
    $("#businessClaimCategory").value = existing.category_id;
    $("#businessClaimDimension").value = existing.dimension_id || "";
    $("#businessClaimDescription").value = existing.description || "";
  }
  setClaimMessage("#businessClaimFormMessage");
  $("#businessClaimDialog").showModal();
}

async function createClaim(event) {
  event.preventDefault();
  if (claimBusy) return;
  claimBusy = true;
  const workspaceId = state.workspace.id;
  const existingId = $("#businessClaimId").value;
  try {
    const payload = {
      p_workspace_id: workspaceId,
      p_title: $("#businessClaimTitle").value,
      p_description: $("#businessClaimDescription").value,
      p_category_id: $("#businessClaimCategory").value,
      p_dimension_id: $("#businessClaimDimension").value || null,
      p_amount: Number($("#businessClaimAmount").value),
      p_currency: $("#businessClaimCurrency").value,
      p_expense_date: $("#businessClaimDate").value
    };
    const claim = existingId
      ? await query("Save Business draft", supabase.rpc("save_business_claim_draft", {
        ...payload, p_claim_id: existingId, p_expected_version: Number($("#businessClaimVersion").value)
      }))
      : await query("Create Business claim", supabase.rpc("create_business_claim", {
        ...payload, p_kind: $("#businessClaimKind").value
      }));
    $("#businessClaimDialog").close();
    await refreshClaims();
    if (state.workspace?.id === workspaceId) openClaimDetail(claim.id);
  } catch (error) {
    setClaimMessage("#businessClaimFormMessage", friendlyMessage(error), true);
  } finally { claimBusy = false; }
}

function detailLine(key, value) {
  const row = document.createElement("div");
  row.append(claimNode("dt", "", key), claimNode("dd", "", value));
  return row;
}

function actionButton(text, action) {
  const button = claimNode("button", "button secondary", text);
  button.type = "button";
  button.dataset.claimAction = action;
  return button;
}

async function renderClaimDetail() {
  const claim = state.claims.find((item) => item.id === openedClaimId);
  if (!claim || !$("#businessClaimDetailDialog").open) return;
  const own = claim.submitted_by === state.session.user.id;
  $("#claimDetailTitle").textContent = claim.title;
  $("#claimDetailMeta").textContent = `${claim.kind === "reimbursement" ? "Reimbursement claim" : "Company expense"} · ${claim.status.replaceAll("_", " ")}`;
  $("#claimDetailFields").replaceChildren(
    detailLine("Amount", money(claim.amount, claim.currency)),
    detailLine("Reporting amount", money(claim.reporting_amount, claim.reporting_currency)),
    detailLine("Expense date", formatDate(claim.expense_date)),
    detailLine("Category", state.businessCategories.find((item) => item.id === claim.category_id)?.name || "Archived category"),
    detailLine("Details", claim.description || "—"),
    detailLine("Review", claim.review_reason || "—"),
    detailLine("Payment", claim.paid_at ? `${formatDate(claim.paid_at)} · ${claim.payment_reference}` : "Not recorded")
  );
  const receipts = state.claimReceipts.filter((item) => item.parent_id === claim.id);
  const receiptList = $("#claimReceiptList");
  receiptList.replaceChildren();
  for (const receipt of receipts) {
    const link = claimNode("button", "button secondary", receipt.original_name);
    link.type = "button";
    link.dataset.receiptPath = receipt.storage_path;
    receiptList.append(link);
  }
  if (!receipts.length) receiptList.append(claimNode("p", "claim-empty", "No receipt attached."));
  $("#claimUploadField").classList.toggle("hidden", !(own && ["draft", "changes_requested"].includes(claim.status)));
  $("#claimDecisionPanel").classList.add("hidden");
  const actions = $("#claimDetailActions");
  actions.replaceChildren();
  if (own && ["draft", "changes_requested"].includes(claim.status)) {
    const direct = claim.kind === "company_expense" && roleForWorkspace(state.workspace) === "business_owner";
    actions.append(actionButton("Edit draft", "edit"),
      actionButton(direct ? "Ready for payment" : "Submit for review", "submit"));
  }
  if (!own && claim.status === "submitted" && claimPermission("approvals.review")) {
    actions.append(actionButton("Approve", "approved"), actionButton("Request changes", "changes_requested"), actionButton("Reject", "rejected"));
  }
  if (claim.status === "approved" && claimPermission("finance.record_payment")) actions.append(actionButton("Record payment", "paid"));
  try {
    const history = await query("Claim history load", supabase.rpc("business_claim_history", {
      p_workspace_id: claim.workspace_id, p_claim_id: claim.id
    }));
    if (openedClaimId !== claim.id) return;
    $("#claimHistoryList").replaceChildren(...history.map((event) => {
      const line = claimNode("p", "claim-history-entry");
      line.append(claimNode("strong", "", event.action.replaceAll(".", " ").replaceAll("_", " ")),
        document.createTextNode(` · ${formatDateTime(event.created_at)}${event.reason ? ` · ${event.reason}` : ""}`));
      return line;
    }));
  } catch (error) { setClaimMessage("#claimDetailMessage", friendlyMessage(error), true); }
}

function openClaimDetail(id) {
  if (!state.claims.some((item) => item.id === id)) return;
  openedClaimId = id;
  setClaimMessage("#claimDetailMessage");
  $("#businessClaimDetailDialog").showModal();
  renderClaimDetail();
}

async function uploadClaimReceipt() {
  const file = $("#claimReceiptFile").files[0];
  const claim = state.claims.find((item) => item.id === openedClaimId);
  if (!file || !claim || claimBusy) return;
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type) || !file.size || file.size > 10485760) {
    setClaimMessage("#claimDetailMessage", "Choose a JPG, PNG, WebP or PDF file up to 10 MB.", true);
    return;
  }
  claimBusy = true;
  const documentId = crypto.randomUUID();
  const cleanName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "receipt";
  const path = `workspaces/${claim.workspace_id}/${state.session.user.id}/${documentId}/${cleanName}`;
  let uploaded = false;
  try {
    await query("Upload receipt", supabase.storage.from("business-documents").upload(path, file, { contentType: file.type, upsert: false }));
    uploaded = true;
    await query("Register receipt", supabase.rpc("register_business_document", {
      p_document_id: documentId, p_workspace_id: claim.workspace_id,
      p_parent_type: "expense_claim", p_parent_id: claim.id,
      p_storage_path: path, p_original_name: file.name,
      p_mime_type: file.type, p_size_bytes: file.size
    }));
    $("#claimReceiptFile").value = "";
    await refreshClaims();
    setClaimMessage("#claimDetailMessage", "Receipt attached.");
  } catch (error) {
    if (uploaded) await supabase.storage.from("business-documents").remove([path]);
    setClaimMessage("#claimDetailMessage", friendlyMessage(error), true);
  } finally { claimBusy = false; }
}

async function claimAction(action, confirmed = false) {
  if (claimBusy) return;
  const claim = state.claims.find((item) => item.id === openedClaimId);
  if (!claim) return;
  if (action === "edit") {
    openClaimForm(claim.kind, claim);
    return;
  }
  if (["rejected", "changes_requested", "paid"].includes(action) && !confirmed) {
    $("#claimDecisionPanel").dataset.action = action;
    $("#claimDecisionLabel").textContent = action === "paid" ? "Payment reference" : action === "rejected" ? "Reason for rejection" : "What needs to change?";
    $("#claimDecisionInput").value = "";
    $("#claimDecisionInput").maxLength = action === "paid" ? 160 : 1000;
    $("#claimDecisionPanel").classList.remove("hidden");
    $("#claimDecisionInput").focus();
    return;
  }
  const reason = confirmed && action !== "paid" ? $("#claimDecisionInput").value.trim() : null;
  const reference = confirmed && action === "paid" ? $("#claimDecisionInput").value.trim() : null;
  if (confirmed && (!reason && !reference)) {
    setClaimMessage("#claimDetailMessage", "Enter a reason or payment reference.", true);
    return;
  }
  claimBusy = true;
  try {
    const args = { p_workspace_id: claim.workspace_id, p_claim_id: claim.id, p_expected_version: claim.version };
    if (action === "submit") await query("Submit claim", supabase.rpc("submit_business_claim", args));
    else if (action === "paid") await query("Record payment", supabase.rpc("record_business_claim_payment", {
      ...args, p_paid_at: new Date().toISOString(), p_payment_reference: reference
    }));
    else await query("Review claim", supabase.rpc("review_business_claim", { ...args, p_decision: action, p_reason: reason }));
    await refreshClaims();
    setClaimMessage("#claimDetailMessage", "Claim updated.");
  } catch (error) {
    setClaimMessage("#claimDetailMessage", friendlyMessage(error), true);
  } finally { claimBusy = false; }
}

function billAccess() {
  return claimPermission("finance.view_all");
}

function billCard(bill) {
  const card = claimNode("article", "claim-row");
  const remaining = Math.max(0, Number(bill.amount) - Number(bill.paid_amount));
  const body = claimNode("div", "claim-row-body");
  body.append(claimNode("strong", "", bill.title),
    claimNode("small", "", `${state.billSuppliers.find((item) => item.id === bill.supplier_id)?.name || "Supplier"} · Due ${formatDate(bill.due_on)} · ${bill.status === "open" && new Date(bill.due_on + "T23:59:59") < new Date() ? "Overdue" : bill.status}`));
  const button = actionButton("View", "bill-view");
  button.dataset.billId = bill.id;
  card.append(body, claimNode("strong", "claim-row-amount", `${money(remaining, bill.currency)} left`), button);
  return card;
}

function renderBills() {
  const allowed = billAccess();
  $("#addBusinessBill").classList.toggle("hidden", !allowed || !claimPermission("finance.create"));
  $("#addBusinessSupplier").classList.toggle("hidden", !allowed || !claimPermission("finance.create"));
  $$("[data-open-bill]").forEach((button) => button.classList.toggle("hidden", !allowed || !claimPermission("finance.create")));
  const summary = state.billSummary;
  const currency = summary?.reporting_currency || state.workspaceSettings?.reporting_currency || "USD";
  $("#businessBillsDue").textContent = allowed && summary ? String(summary.due_count) : "—";
  $("#businessBillsOverdue").textContent = allowed && summary ? String(summary.overdue_count) : "—";
  $("#businessBillsOutstanding").textContent = allowed && summary ? money(summary.outstanding, currency) : "—";
  $("#businessOverviewBillsDue").textContent = allowed && summary ? String(Number(summary.due_count) + Number(summary.overdue_count)) : "—";
  $("#businessBillList").replaceChildren(...(allowed && state.bills.length
    ? state.bills.map(billCard)
    : [claimNode("p", "claim-empty", allowed ? "No bills yet. Add a supplier, then a bill." : "Your role does not include company bills.")]));
  $("#businessSupplierList").replaceChildren(...(allowed && state.billSuppliers.length
    ? state.billSuppliers.map((supplier) => {
      const row = claimNode("div", "claim-row");
      row.append(claimNode("strong", "", supplier.name));
      const button = actionButton("Edit", "supplier-edit");
      button.dataset.supplierId = supplier.id;
      row.append(button);
      return row;
    }) : [claimNode("p", "claim-empty", "No suppliers yet.")]));
  $("#businessScheduleList").replaceChildren(...(allowed && state.billSchedules.length
    ? state.billSchedules.map((schedule) => {
      const row = claimNode("div", "claim-row");
      const info = claimNode("div", "claim-row-body");
      info.append(claimNode("strong", "", schedule.title),
        claimNode("small", "", `${schedule.frequency} · every ${schedule.interval_count} · ${schedule.status}`));
      row.append(info);
      if (schedule.status === "active" && claimPermission("finance.create")) {
        const stop = actionButton("Stop", "schedule-stop");
        stop.dataset.scheduleId = schedule.id;
        row.append(stop);
      }
      return row;
    }) : [claimNode("p", "claim-empty", "No recurring schedules yet.")]));
}

async function refreshBills() {
  const workspaceId = state.workspace?.id;
  if (!workspaceId || state.locked || !billAccess()) { renderBills(); return; }
  const sequence = workspaceLoadSequence;
  const [suppliers, schedules, bills, payments, documents, summary] = await Promise.all([
    query("Supplier load", supabase.from("business_suppliers").select("*").eq("workspace_id", workspaceId).eq("status", "active").order("name").limit(500)),
    query("Bill schedule load", supabase.from("business_bill_schedules").select("*").eq("workspace_id", workspaceId).order("created_at", { ascending: false }).limit(500)),
    query("Bill load", supabase.from("business_bills").select("*").eq("workspace_id", workspaceId).order("due_on", { ascending: false }).limit(500)),
    query("Bill payment load", supabase.from("business_bill_payments").select("*").eq("workspace_id", workspaceId).order("paid_at", { ascending: false }).limit(500)),
    query("Bill document load", supabase.from("business_documents").select("*").eq("workspace_id", workspaceId).in("parent_type", ["business_bill", "business_bill_payment"]).eq("status", "active").limit(500)),
    query("Bill summary", supabase.rpc("business_bill_summary", { p_workspace_id: workspaceId }))
  ]);
  if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId) return;
  Object.assign(state, { billSuppliers: suppliers, billSchedules: schedules, bills, billPayments: payments, billDocuments: documents, billSummary: summary });
  renderBills();
  renderClaims();
  if (openedBillId && $("#businessBillDetailDialog").open) renderBillDetail();
  const targetId = new URL(window.location.href).searchParams.get("bill");
  if (targetId && state.bills.some((item) => item.id === targetId)) {
    const url = new URL(window.location.href);
    url.searchParams.delete("bill");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    openBillDetail(targetId);
  }
}

function openSupplierForm(supplier = null) {
  if (!billAccess() || !claimPermission("finance.create")) return;
  $("#businessSupplierForm").reset();
  $("#businessSupplierTitle").textContent = supplier ? "Edit supplier" : "Add supplier";
  $("#businessSupplierId").value = supplier?.id || "";
  $("#businessSupplierVersion").value = supplier?.version || "";
  $("#supplierName").value = supplier?.name || "";
  $("#supplierEmail").value = supplier?.email || "";
  $("#supplierNotes").value = supplier?.notes || "";
  setClaimMessage("#supplierFormMessage");
  $("#businessSupplierDialog").showModal();
}

async function saveSupplier(event) {
  event.preventDefault();
  if (billBusy) return;
  billBusy = true;
  try {
    await query("Save supplier", supabase.rpc("save_business_supplier", {
      p_workspace_id: state.workspace.id,
      p_supplier_id: $("#businessSupplierId").value || null,
      p_name: $("#supplierName").value,
      p_email: $("#supplierEmail").value,
      p_notes: $("#supplierNotes").value,
      p_expected_version: Number($("#businessSupplierVersion").value) || null
    }));
    $("#businessSupplierDialog").close();
    await refreshBills();
  } catch (error) { setClaimMessage("#supplierFormMessage", friendlyMessage(error), true); }
  finally { billBusy = false; }
}

function renderBillType() {
  const recurring = $("#billType").value !== "once";
  $("#billIntervalField").classList.toggle("hidden", !recurring);
  $("#billReferenceField").classList.toggle("hidden", recurring);
  $("#billClaimField").classList.toggle("hidden", recurring);
}

function openBillForm() {
  if (!billAccess() || !claimPermission("finance.create")) return;
  if ($("#businessAddDialog").open) $("#businessAddDialog").close();
  $("#businessBillForm").reset();
  $("#billSupplier").replaceChildren(new Option("Choose supplier", ""), ...state.billSuppliers.map((item) => new Option(item.name, item.id)));
  $("#billCategory").replaceChildren(...state.businessCategories
    .filter((item) => item.status === "active" && ["expense", "both"].includes(item.category_type))
    .map((item) => new Option(item.name, item.id)));
  $("#billCurrency").replaceChildren(...(state.workspaceSettings?.enabled_currencies || []).map((code) => new Option(code, code)));
  $("#billCurrency").value = state.workspaceSettings?.default_payment_currency || state.workspaceSettings?.reporting_currency;
  const scopes = new Set(state.memberScopes.map((item) => item.dimension_id));
  $("#billDimension").replaceChildren(new Option(scopes.size ? "Choose assigned tag" : "None", ""), ...state.businessDimensions
    .filter((item) => item.status === "active" && (!scopes.size || scopes.has(item.id)))
    .map((item) => new Option(item.name, item.id)));
  $("#billDimension").required = scopes.size > 0;
  $("#billSourceClaim").replaceChildren(new Option("No linked expense", ""), ...state.claims
    .filter((item) => item.kind === "company_expense" && item.status === "approved"
      && !state.bills.some((bill) => bill.source_claim_id === item.id))
    .map((item) => new Option(`${item.title} · ${money(item.amount, item.currency)}`, item.id)));
  const today = new Date();
  $("#billDue").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  $("#billRemindDays").value = 3;
  $("#billCreateAnyway").classList.add("hidden");
  setClaimMessage("#billFormMessage");
  renderBillType();
  $("#businessBillDialog").showModal();
}

async function saveBill(event, allowDuplicate = false) {
  event?.preventDefault();
  if (billBusy) return;
  billBusy = true;
  try {
    const common = {
      p_workspace_id: state.workspace.id,
      p_supplier_id: $("#billSupplier").value,
      p_title: $("#billTitle").value,
      p_category_id: $("#billCategory").value,
      p_dimension_id: $("#billDimension").value || null,
      p_amount: Number($("#billAmount").value),
      p_currency: $("#billCurrency").value,
      p_remind_days_before: Number($("#billRemindDays").value)
    };
    const frequency = $("#billType").value;
    if (frequency === "once") {
      await query("Create bill", supabase.rpc("create_business_bill", {
        ...common, p_reference: $("#billReference").value,
        p_due_on: $("#billDue").value, p_source_claim_id: $("#billSourceClaim").value || null,
        p_allow_duplicate: allowDuplicate
      }));
    } else {
      await query("Create recurring schedule", supabase.rpc("create_business_bill_schedule", {
        ...common, p_frequency: frequency, p_interval_count: Number($("#billInterval").value),
        p_starts_on: $("#billDue").value, p_ends_on: null
      }));
    }
    $("#businessBillDialog").close();
    await refreshBills();
    await refreshClaims();
  } catch (error) {
    setClaimMessage("#billFormMessage", friendlyMessage(error), true);
    $("#billCreateAnyway").classList.toggle("hidden", !/BUSINESS_BILL_POSSIBLE_DUPLICATE/.test(String(error?.message)));
  } finally { billBusy = false; }
}

function renderBillDetail() {
  const bill = state.bills.find((item) => item.id === openedBillId);
  if (!bill) return;
  const payments = state.billPayments.filter((item) => item.bill_id === bill.id);
  $("#billDetailTitle").textContent = bill.title;
  $("#billDetailMeta").textContent = `${state.billSuppliers.find((item) => item.id === bill.supplier_id)?.name || "Supplier"} · ${bill.status}`;
  $("#billDetailFields").replaceChildren(
    detailLine("Total", money(bill.amount, bill.currency)),
    detailLine("Paid", money(bill.paid_amount, bill.currency)),
    detailLine("Outstanding", money(Number(bill.amount) - Number(bill.paid_amount), bill.currency)),
    detailLine("Due", formatDate(bill.due_on)),
    detailLine("Supplier reference", bill.reference || "—"),
    detailLine("Linked expense", bill.source_claim_id ? "Linked to an approved company expense" : "—")
  );
  $("#billPaymentList").replaceChildren(...(payments.length ? payments.map((item) => {
    const row = claimNode("div", "claim-row");
    row.append(claimNode("strong", "", money(item.amount, item.currency)),
      claimNode("small", "", `${formatDateTime(item.paid_at)} · ${item.reference}`));
    return row;
  }) : [claimNode("p", "claim-empty", "No payments recorded.")]));
  $("#billPaymentForm").classList.toggle("hidden", bill.status !== "open" || !claimPermission("finance.record_payment"));
  $("#cancelBusinessBill").classList.toggle("hidden", bill.status !== "open" || Number(bill.paid_amount) > 0 || !claimPermission("finance.create"));
  $("#billPaymentAmount").max = String(Number(bill.amount) - Number(bill.paid_amount));
  $("#billPaymentAmount").value = String(Number(bill.amount) - Number(bill.paid_amount));
  $("#billProofList").replaceChildren(...(state.billDocuments.filter((doc) => doc.parent_id === bill.id
    || payments.some((item) => item.id === doc.parent_id)).map((doc) => {
    const button = actionButton(doc.original_name, "bill-proof");
    button.dataset.proofPath = doc.storage_path;
    return button;
  })));
  $("#billProofParent").replaceChildren(new Option("Invoice / bill", bill.id), ...payments.map((item) =>
    new Option(`Payment ${money(item.amount, item.currency)} · ${formatDateTime(item.paid_at)}`, item.id)));
}

function openBillDetail(id) {
  if (!state.bills.some((item) => item.id === id)) return;
  openedBillId = id;
  setClaimMessage("#billDetailMessage");
  renderBillDetail();
  $("#businessBillDetailDialog").showModal();
}

async function saveBillPayment(event) {
  event.preventDefault();
  if (billBusy) return;
  const bill = state.bills.find((item) => item.id === openedBillId);
  if (!bill) return;
  billBusy = true;
  try {
    const paymentId = $("#billPaymentForm").dataset.requestId || crypto.randomUUID();
    $("#billPaymentForm").dataset.requestId = paymentId;
    await query("Record bill payment", supabase.rpc("record_business_bill_payment", {
      p_workspace_id: bill.workspace_id, p_bill_id: bill.id,
      p_payment_id: paymentId, p_amount: Number($("#billPaymentAmount").value),
      p_paid_at: new Date().toISOString(), p_reference: $("#billPaymentReference").value
    }));
    delete $("#billPaymentForm").dataset.requestId;
    $("#billPaymentForm").reset();
    await refreshBills();
    await refreshClaims();
    setClaimMessage("#billDetailMessage", "Payment recorded.");
  } catch (error) { setClaimMessage("#billDetailMessage", friendlyMessage(error), true); }
  finally { billBusy = false; }
}

async function uploadBillProof() {
  const bill = state.bills.find((item) => item.id === openedBillId);
  const file = $("#billProofFile").files[0];
  if (!bill || !file || billBusy) return;
  if (!["image/jpeg", "image/png", "image/webp", "application/pdf"].includes(file.type)
    || !file.size || file.size > 10485760) {
    setClaimMessage("#billDetailMessage", "Choose a JPG, PNG, WebP or PDF up to 10 MB.", true);
    return;
  }
  billBusy = true;
  const documentId = crypto.randomUUID();
  const path = `workspaces/${bill.workspace_id}/${state.session.user.id}/${documentId}/${(file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "proof")}`;
  const parentId = $("#billProofParent").value;
  const parentType = parentId === bill.id ? "business_bill" : "business_bill_payment";
  let uploaded = false;
  try {
    await query("Upload bill proof", supabase.storage.from("business-documents").upload(path, file, { contentType: file.type, upsert: false }));
    uploaded = true;
    await query("Register bill proof", supabase.rpc("register_business_document", {
      p_document_id: documentId, p_workspace_id: bill.workspace_id,
      p_parent_type: parentType, p_parent_id: parentId,
      p_storage_path: path, p_original_name: file.name,
      p_mime_type: file.type, p_size_bytes: file.size
    }));
    $("#billProofFile").value = "";
    await refreshBills();
    setClaimMessage("#billDetailMessage", "Proof attached.");
  } catch (error) {
    if (uploaded) await supabase.storage.from("business-documents").remove([path]);
    setClaimMessage("#billDetailMessage", friendlyMessage(error), true);
  } finally { billBusy = false; }
}

function businessOwnerCanSetUp() {
  return !state.locked && roleForWorkspace(state.workspace) === "business_owner";
}

function setSetupMessage(message = "", error = false) {
  const node = $("#onboardingMessage");
  node.textContent = message;
  node.classList.toggle("hidden", !message);
  node.classList.toggle("error", error);
}

function renderCurrencyChoices() {
  const search = $("#setupCurrencySearch").value.trim().toLowerCase();
  const container = $("#setupCurrencies");
  container.replaceChildren();
  state.supportedCurrencies.filter((currency) =>
    `${currency.code} ${currency.name}`.toLowerCase().includes(search)
  ).forEach((currency) => {
    const label = document.createElement("label");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.value = currency.code;
    checkbox.checked = chosenCurrencies.has(currency.code);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) chosenCurrencies.add(currency.code);
      else chosenCurrencies.delete(currency.code);
      renderBaseCurrencyChoice();
      renderDraftSelectors();
    });
    label.append(checkbox, document.createTextNode(`${currency.code} · ${currency.name}`));
    container.append(label);
  });
  if (!container.childElementCount) container.textContent = "No matching currencies.";
}

function renderBaseCurrencyChoice() {
  const select = $("#setupBaseCurrency");
  const previous = select.value || state.workspaceSettings?.base_currency;
  select.replaceChildren(new Option("Choose base currency", ""));
  [...chosenCurrencies].sort().forEach((code) => select.append(new Option(code, code)));
  select.value = chosenCurrencies.has(previous) ? previous : [...chosenCurrencies].sort()[0] || "";
}

function renderDraftSelectors() {
  const kind = $("#setupDraftKind").value;
  const dueField = $("#setupDraftDueField");
  dueField.classList.toggle("hidden", kind !== "bill");
  $("#setupDraftDue").required = kind === "bill";
  if (kind !== "bill") $("#setupDraftDue").value = "";

  const currencySelect = $("#setupDraftCurrency");
  const previousCurrency = currencySelect.value || state.setupDraft?.currency || state.workspaceSettings?.base_currency;
  currencySelect.replaceChildren(new Option("Select currency", ""));
  [...chosenCurrencies].sort().forEach((code) => currencySelect.append(new Option(code, code)));
  currencySelect.value = chosenCurrencies.has(previousCurrency) ? previousCurrency : "";

  const categorySelect = $("#setupDraftCategory");
  const previousCategory = categorySelect.value || state.setupDraft?.category_id;
  categorySelect.replaceChildren(new Option("Choose a category", ""));
  state.businessCategories.filter((category) =>
    category.status === "active" && (category.category_type === "both"
      || category.category_type === (kind === "income" ? "income" : "expense"))
  ).forEach((category) => categorySelect.append(new Option(category.name, category.id)));
  categorySelect.value = [...categorySelect.options].some((option) => option.value === previousCategory) ? previousCategory : "";

  const dimensionSelect = $("#setupDraftTag");
  const previousTag = dimensionSelect.options.length ? dimensionSelect.value : state.setupDraft?.dimension_id;
  dimensionSelect.replaceChildren(new Option("No tag", ""));
  state.businessDimensions.filter((dimension) => dimension.status === "active")
    .forEach((dimension) => dimensionSelect.append(new Option(`${dimension.name} · ${dimension.dimension_type.replaceAll("_", " ")}`, dimension.id)));
  dimensionSelect.value = [...dimensionSelect.options].some((option) => option.value === previousTag) ? previousTag : "";
}

function renderSetupLists() {
  const categories = $("#setupCategoryList");
  categories.replaceChildren();
  state.businessCategories.forEach((category) => {
    const row = document.createElement("div");
    row.className = `setup-item${category.status === "active" ? "" : " inactive"}`;
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = category.name;
    const type = document.createElement("small");
    type.textContent = `${category.category_type === "expense" ? "Expenses and bills" : category.category_type === "income" ? "Income" : "Both"} · ${category.is_system_default ? "Starter" : "Your category"}`;
    info.append(title, type);
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.dataset.setupCategoryToggle = category.id;
    toggle.textContent = category.status === "active" ? "Remove" : "Use category";
    row.append(info, toggle);
    categories.append(row);
  });
  if (!categories.childElementCount) categories.textContent = "No categories yet. Add your first one below.";

  const tags = $("#setupTagList");
  tags.replaceChildren();
  state.businessDimensions.filter((dimension) => dimension.status === "active").forEach((dimension) => {
    const row = document.createElement("div");
    row.className = "setup-item";
    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = dimension.name;
    const type = document.createElement("small");
    type.textContent = dimension.dimension_type.replaceAll("_", " ");
    info.append(title, type);
    row.append(info);
    tags.append(row);
  });
  if (!tags.childElementCount) tags.textContent = "No tags added. You can skip this step.";
  renderDraftSelectors();
}

function renderSetupDraft() {
  const draft = state.setupDraft;
  const summary = $("#setupDraftSummary");
  const overview = $("#businessOverviewDraft");
  summary.classList.toggle("hidden", !draft);
  overview.classList.toggle("hidden", !draft);
  summary.textContent = draft
    ? `Saved setup draft: ${draft.description} · ${draft.currency} ${Number(draft.amount).toFixed(2)}. Not counted as income or spending.`
    : "";
  overview.textContent = summary.textContent;
  const activity = $("#businessSetupDraftActivity");
  activity.classList.toggle("hidden", !draft);
  activity.replaceChildren();
  if (draft) {
    const card = document.createElement("div");
    card.className = "setup-draft-preview";
    card.textContent = `Setup draft · ${draft.kind}: ${draft.description} · ${draft.currency} ${Number(draft.amount).toFixed(2)}. No money movement recorded.`;
    activity.append(card);
  }
}

function renderBusinessSetup() {
  const profile = state.businessProfile;
  const settings = state.workspaceSettings;
  $("#setupBusinessName").value = profile?.trading_name || state.workspace?.name || "";
  $("#setupTimezone").value = settings?.timezone || "Africa/Harare";
  $("#setupPeriodDay").value = profile?.period_start_day || 1;
  $("#setupFinancialMonth").value = String(profile?.financial_year_start_month || 1);
  chosenCurrencies = new Set(settings?.enabled_currencies?.length
    ? settings.enabled_currencies : [settings?.base_currency || "USD"]);
  renderCurrencyChoices();
  renderBaseCurrencyChoice();
  if (chosenCurrencies.has(settings?.base_currency)) $("#setupBaseCurrency").value = settings.base_currency;
  renderSetupLists();
  $("#setupDraftKind").value = state.setupDraft?.kind || "income";
  $("#setupDraftDescription").value = state.setupDraft?.description || "";
  $("#setupDraftAmount").value = state.setupDraft?.amount ?? "";
  $("#setupDraftDate").value = state.setupDraft?.record_date || new Date().toISOString().slice(0, 10);
  $("#setupDraftDue").value = state.setupDraft?.due_date || "";
  renderDraftSelectors();
  renderSetupDraft();
  $("#editBusinessSetup").classList.toggle("hidden", roleForWorkspace(state.workspace) !== "business_owner");
}

function showSetupStep(step) {
  const steps = ["basics", "categories", "tags", "first"];
  if (!steps.includes(step)) return;
  setupStep = step;
  $("#onboardingProgress").textContent = `Step ${steps.indexOf(step) + 1} of ${steps.length}`;
  $$("[data-setup-pane]").forEach((pane) => pane.classList.toggle("hidden", pane.dataset.setupPane !== step));
  $$("[data-setup-step]").forEach((button) => {
    if (!button.closest(".onboarding-steps")) return;
    button.classList.toggle("active", button.dataset.setupStep === step);
    button.setAttribute("aria-current", button.dataset.setupStep === step ? "step" : "false");
  });
  setSetupMessage();
  $("#businessOnboarding").scrollIntoView({ block: "start", behavior: "smooth" });
}

async function withSetupBusy(action) {
  if (setupBusy || !businessOwnerCanSetUp()) return;
  const sequence = workspaceLoadSequence;
  setupBusy = true;
  $("#businessOnboarding").querySelectorAll("button").forEach((button) => { button.disabled = true; });
  $$("[data-workspace-selector]").forEach((select) => { select.disabled = true; });
  try { await action(); }
  catch (error) {
    if (sequence === workspaceLoadSequence) setSetupMessage(friendlyMessage(error), true);
  }
  finally {
    setupBusy = false;
    $("#businessOnboarding").querySelectorAll("button").forEach((button) => { button.disabled = false; });
    renderWorkspaceSelectors();
  }
}

async function saveBusinessBasics(event) {
  event.preventDefault();
  await withSetupBusy(async () => {
    if (!chosenCurrencies.size) throw new Error("Select at least one currency.");
    const workspaceId = state.workspace.id;
    const sequence = workspaceLoadSequence;
    const saved = await query("Business setup", supabase.rpc("save_business_setup", {
      p_workspace_id: workspaceId,
      p_trading_name: $("#setupBusinessName").value.trim(),
      p_base_currency: $("#setupBaseCurrency").value,
      p_enabled_currencies: [...chosenCurrencies],
      p_timezone: $("#setupTimezone").value.trim(),
      p_financial_year_start_month: Number($("#setupFinancialMonth").value),
      p_period_start_day: Number($("#setupPeriodDay").value),
      p_expected_profile_version: state.businessProfile?.version ?? null,
      p_expected_settings_updated_at: state.workspaceSettings?.updated_at ?? null
    }));
    if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId) return;
    state.businessProfile = saved.profile;
    state.workspaceSettings = saved.settings;
    state.workspace.name = saved.profile.trading_name;
    renderBusinessSetup();
    renderIdentity();
    renderWorkspaceSelectors();
    showSetupStep("categories");
    setSetupMessage("Business details saved.");
  });
}

async function addBusinessCategory(event) {
  event.preventDefault();
  await withSetupBusy(async () => {
    const workspaceId = state.workspace.id;
    const sequence = workspaceLoadSequence;
    const result = await query("Business category", supabase.rpc("save_business_category", {
      p_workspace_id: workspaceId,
      p_category_id: null,
      p_category_type: $("#setupCategoryType").value,
      p_name: $("#setupCategoryName").value.trim(),
      p_code: null,
      p_description: "",
      p_colour: null,
      p_status: "active",
      p_expected_version: null
    }));
    if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId) return;
    state.businessCategories.push(result);
    $("#businessCategoryForm").reset();
    renderSetupLists();
    setSetupMessage("Category added.");
  });
}

async function toggleBusinessCategory(categoryId) {
  const category = state.businessCategories.find((item) => item.id === categoryId);
  if (!category) return;
  if (category.status === "active" &&
      state.businessCategories.filter((item) => item.status === "active").length <= 1) {
    setSetupMessage("Keep at least one category active.", true);
    return;
  }
  if (category.status === "active" && state.setupDraft?.category_id === category.id) {
    setSetupMessage("Choose a different category for the saved draft before removing this one.", true);
    return;
  }
  await withSetupBusy(async () => {
    const workspaceId = state.workspace.id;
    const sequence = workspaceLoadSequence;
    const result = await query("Business category choice", supabase.rpc("save_business_category", {
      p_workspace_id: workspaceId,
      p_category_id: category.id,
      p_category_type: category.category_type,
      p_name: category.name,
      p_code: category.code,
      p_description: category.description,
      p_colour: category.colour,
      p_status: category.status === "active" ? "archived" : "active",
      p_expected_version: category.version
    }));
    if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId) return;
    state.businessCategories = state.businessCategories.map((item) => item.id === result.id ? result : item);
    renderSetupLists();
    setSetupMessage(result.status === "active" ? "Category selected." : "Category removed from active use.");
  });
}

async function addBusinessTag(event) {
  event.preventDefault();
  await withSetupBusy(async () => {
    const workspaceId = state.workspace.id;
    const sequence = workspaceLoadSequence;
    const result = await query("Business tag", supabase.rpc("save_business_dimension", {
      p_workspace_id: workspaceId,
      p_dimension_id: null,
      p_dimension_type: $("#setupTagType").value,
      p_name: $("#setupTagName").value.trim(),
      p_code: null,
      p_description: "",
      p_parent_id: null,
      p_status: "active",
      p_expected_version: null
    }));
    if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId) return;
    state.businessDimensions.push(result);
    $("#businessTagForm").reset();
    renderSetupLists();
    setSetupMessage("Tag added.");
  });
}

async function saveBusinessDraft(event) {
  event.preventDefault();
  await withSetupBusy(async () => {
    const workspaceId = state.workspace.id;
    const sequence = workspaceLoadSequence;
    const result = await query("Business setup draft", supabase.rpc("save_business_setup_draft", {
      p_workspace_id: workspaceId,
      p_kind: $("#setupDraftKind").value,
      p_description: $("#setupDraftDescription").value.trim(),
      p_amount: Number($("#setupDraftAmount").value),
      p_currency: $("#setupDraftCurrency").value,
      p_record_date: $("#setupDraftDate").value,
      p_due_date: $("#setupDraftKind").value === "bill" ? $("#setupDraftDue").value : null,
      p_category_id: $("#setupDraftCategory").value || null,
      p_dimension_id: $("#setupDraftTag").value || null,
      p_expected_version: state.setupDraft?.version ?? null
    }));
    if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId) return;
    state.setupDraft = result;
    renderSetupDraft();
    setSetupMessage("First item saved as a draft. It is excluded from financial totals.");
  });
}

async function finishBusinessSetup() {
  if ($("#setupDraftDescription").value.trim() &&
      $("#setupDraftDescription").value.trim() !== state.setupDraft?.description &&
      !window.confirm("Finish setup without saving this draft?")) return;
  await withSetupBusy(async () => {
    const workspaceId = state.workspace.id;
    const sequence = workspaceLoadSequence;
    const result = await query("Complete Business setup", supabase.rpc("complete_business_onboarding", {
      p_workspace_id: workspaceId
    }));
    if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId) return;
    state.businessProfile = result;
    setupOpen = false;
    setWorkspaceUrl(workspaceId);
    renderBusinessWorkspace();
  });
}

function renderIdentity() {
  const role = roleForWorkspace(state.workspace);
  const fullName = state.profile?.full_name || state.session?.user?.user_metadata?.full_name || state.session?.user?.email || "Business member";
  const initials = fullName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "MB";
  $$('[data-user-initials]').forEach((node) => { node.textContent = initials; });
  $("#businessRoleBadge").textContent = formatRole(role);
  $("#businessStatusBadge").textContent = state.workspace?.status === "suspended" ? "Suspended" : "Active";
  $("#settingsWorkspaceName").textContent = state.workspace?.name || "—";
  $("#settingsUserRole").textContent = formatRole(role);
  $("#settingsWorkspaceStatus").textContent = state.workspace?.status || "—";
  $("#settingsCurrency").textContent = state.workspaceSettings?.base_currency || "—";
  $("#settingsEnabledCurrencies").textContent = state.workspaceSettings?.enabled_currencies?.join(", ") || "—";
  $("#settingsLocale").textContent = state.workspaceSettings?.locale || "—";
  $("#settingsTimezone").textContent = state.workspaceSettings?.timezone || "—";
  $("#settingsFinancialMonth").textContent = state.businessProfile?.financial_year_start_month
    ? new Date(2026, state.businessProfile.financial_year_start_month - 1, 1).toLocaleString("en", { month: "long" })
    : "—";
  $("#settingsPeriodDay").textContent = state.businessProfile?.period_start_day
    ? `Day ${state.businessProfile.period_start_day}` : "—";
  $("#businessReportingCurrency").textContent = state.workspaceSettings?.base_currency || "—";
}

function renderTeam() {
  const list = $("#businessTeamList");
  const snapshot = state.teamSnapshot || { members: state.workspaceMembers, invitations: [], capacity: {} };
  const activeMembers = snapshot.members || [];
  const capacity = snapshot.capacity || {};
  $("#businessTeamCount").textContent = `${activeMembers.length} ${activeMembers.length === 1 ? "person" : "people"}`;
  $("#businessSeatLimit").textContent = capacity.limit ?? "—";
  $("#businessActiveSeats").textContent = capacity.active ?? activeMembers.length;
  $("#businessPendingSeats").textContent = capacity.pending ?? 0;
  $("#businessAvailableSeats").textContent = capacity.available ?? "—";
  $("#inviteBusinessMember").classList.toggle("hidden", !snapshot.can_manage);
  $("#inviteBusinessMember").disabled = !snapshot.can_manage || !capacity.available;
  list.replaceChildren();
  activeMembers.forEach((member) => {
    const isCurrentUser = member.user_id === state.session.user.id;
    const label = member.full_name || (isCurrentUser ? state.profile?.full_name || state.session.user.email : "Business member");
    const article = document.createElement("article");
    article.className = "team-member";
    const avatar = document.createElement("span");
    avatar.className = "team-avatar";
    avatar.textContent = label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "BM";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = isCurrentUser ? `${label} (you)` : label;
    const joined = document.createElement("small");
    joined.textContent = `${member.email || "Verified Mushavo account"} · Joined ${formatDate(member.joined_at)}`;
    const scope = document.createElement("small");
    scope.className = "team-scope";
    const names = (member.scope_ids || []).map((id) => state.businessDimensions.find((item) => item.id === id)?.name).filter(Boolean);
    scope.textContent = names.length ? `Scope: ${names.join(", ")}` : "Scope: Entire workspace";
    copy.append(name, joined, scope);
    const role = document.createElement("span");
    role.className = "role-badge";
    role.textContent = formatRole(member.role);
    article.append(avatar, copy, role);
    if (snapshot.can_manage && member.role !== "business_owner" && !isCurrentUser) {
      const actions = document.createElement("div");
      actions.className = "team-member-actions";
      actions.innerHTML = `<button type="button" data-edit-business-member="${member.id}">Edit access</button><button type="button" class="danger" data-remove-business-member="${member.id}">Remove</button>${snapshot.can_transfer ? `<button type="button" data-transfer-business-owner="${member.id}">Make Owner</button>` : ""}`;
      article.append(actions);
    }
    list.append(article);
  });
  if (!activeMembers.length) {
    const empty = document.createElement("p");
    empty.className = "page-intro";
    empty.textContent = "No active Business members are available.";
    list.append(empty);
  }

  const invitationCard = $("#businessPendingCard");
  const invitationList = $("#businessInvitationList");
  const invitations = snapshot.invitations || [];
  invitationCard.classList.toggle("hidden", !snapshot.can_manage);
  invitationList.replaceChildren();
  invitations.forEach((invitation) => {
    const article = document.createElement("article");
    article.className = "team-member";
    const avatar = document.createElement("span");
    avatar.className = "team-avatar";
    avatar.textContent = "✉";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = invitation.email;
    const details = document.createElement("small");
    details.textContent = `${formatRole(invitation.role)} · ${invitation.status === "pending" ? `Expires ${formatDate(invitation.expires_at)}` : formatRole(invitation.status)}`;
    copy.append(title, details);
    const status = document.createElement("span");
    status.className = "role-badge";
    status.textContent = invitation.status === "pending" ? invitation.delivery_status.replaceAll("_", " ") : invitation.status;
    article.append(avatar, copy, status);
    if (invitation.status === "pending") {
      const actions = document.createElement("div");
      actions.className = "team-member-actions";
      actions.innerHTML = `<button type="button" data-edit-business-invitation="${invitation.id}">Edit</button><button type="button" data-resend-business-invitation="${invitation.id}">Resend</button><button type="button" class="danger" data-cancel-business-invitation="${invitation.id}">Cancel</button>`;
      article.append(actions);
    }
    invitationList.append(article);
  });
  if (snapshot.can_manage && !invitations.length) invitationList.textContent = "No invitations yet.";
}

function setTeamMessage(message = "", error = false) {
  const node = $("#businessTeamMessage");
  node.textContent = message;
  node.classList.toggle("hidden", !message);
  node.classList.toggle("error", error);
}

function selectedTeamScopes() {
  return $$("#businessInviteScopes input:checked").map((input) => input.value);
}

function renderScopeChoices(selected = []) {
  const container = $("#businessInviteScopes");
  const chosen = new Set(selected || []);
  container.replaceChildren();
  state.businessDimensions.filter((item) => item.status === "active").forEach((item) => {
    const label = document.createElement("label");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = item.id;
    input.checked = chosen.has(item.id);
    label.append(input, document.createTextNode(`${item.name} · ${item.dimension_type.replaceAll("_", " ")}`));
    container.append(label);
  });
  if (!container.childElementCount) container.textContent = "No project, branch or department tags have been created.";
}

function openBusinessInvitationDialog(invitation = null, member = null) {
  if (!state.teamSnapshot?.can_manage) return;
  const dialog = $("#businessInviteDialog");
  const editing = invitation || member;
  $("#businessInvitationId").value = invitation?.id || member?.id || "";
  $("#businessInvitationVersion").value = invitation?.version || "";
  $("#businessInviteEmail").value = invitation?.email || member?.email || "";
  $("#businessInviteEmail").disabled = Boolean(editing);
  $("#businessInviteEmailField").classList.toggle("hidden", Boolean(member));
  $("#businessInviteRole").value = invitation?.role || member?.role || "staff";
  $("#businessInviteTitle").textContent = member ? "Edit member access" : invitation ? "Edit invitation" : "Invite a team member";
  $("#businessInviteIntro").textContent = member ? "Changes apply immediately." : invitation ? "Update the role or optional access scope." : "Existing and new Mushavo users can join with their verified email.";
  $("#saveBusinessInvitation").textContent = editing ? "Save changes" : "Send invitation";
  $("#businessInviteSeatImpact").textContent = editing ? "No additional seat used" : `Uses 1 of ${state.teamSnapshot?.capacity?.available || 0} available seats`;
  dialog.dataset.mode = member ? "member" : invitation ? "invitation" : "create";
  renderScopeChoices(invitation?.scope_ids || member?.scope_ids || []);
  dialog.showModal();
}

async function refreshBusinessTeam() {
  state.teamSnapshot = await query("Business team", supabase.rpc("business_team_snapshot", { p_workspace_id: state.workspace.id }));
  state.workspaceMembers = state.teamSnapshot?.members || [];
  renderTeam();
}

async function withTeamBusy(action) {
  if (teamBusy) return;
  teamBusy = true;
  $("#businessInviteDialog").querySelectorAll("button,input,select").forEach((node) => { node.disabled = true; });
  try { await action(); }
  catch (error) { setTeamMessage(friendlyMessage(error), true); }
  finally {
    teamBusy = false;
    $("#businessInviteDialog").querySelectorAll("button,input,select").forEach((node) => { node.disabled = false; });
  }
}

async function saveBusinessInvitation(event) {
  event.preventDefault();
  await withTeamBusy(async () => {
    const mode = $("#businessInviteDialog").dataset.mode;
    const id = $("#businessInvitationId").value;
    const role = $("#businessInviteRole").value;
    const scopes = selectedTeamScopes();
    if (mode === "member") {
      await query("Member access", supabase.rpc("update_business_member_access", { p_workspace_id: state.workspace.id, p_member_id: id, p_role: role, p_scope_ids: scopes }));
      setTeamMessage("Member access updated.");
    } else if (mode === "invitation") {
      await query("Invitation access", supabase.rpc("edit_business_invitation", { p_invitation_id: id, p_role: role, p_scope_ids: scopes, p_expected_version: Number($("#businessInvitationVersion").value) }));
      setTeamMessage("Invitation updated.");
    } else {
      const { data, error } = await supabase.functions.invoke("invite-business-member", { body: { action: "create", workspace_id: state.workspace.id, email: $("#businessInviteEmail").value.trim(), role, scope_ids: scopes } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "BUSINESS_INVITATION_EMAIL_FAILED");
      setTeamMessage(`Invitation sent to ${data.email}.`);
    }
    $("#businessInviteDialog").close();
    await refreshBusinessTeam();
  });
}

async function teamAction(action, id) {
  if (teamBusy) return;
  try {
    teamBusy = true;
    if (action === "resend") {
      const { data, error } = await supabase.functions.invoke("invite-business-member", { body: { action: "resend", invitation_id: id } });
      if (error || data?.error) throw new Error(data?.error || error?.message || "BUSINESS_INVITATION_EMAIL_FAILED");
      setTeamMessage("Invitation resent.");
    } else if (action === "cancel") {
      if (!window.confirm("Cancel this invitation and release its reserved seat?")) return;
      await query("Cancel invitation", supabase.rpc("cancel_business_invitation", { p_invitation_id: id }));
      setTeamMessage("Invitation cancelled. The seat is available again.");
    } else if (action === "remove") {
      if (!window.confirm("Remove this member? Their Business access will stop immediately.")) return;
      await query("Remove member", supabase.rpc("remove_business_member", { p_workspace_id: state.workspace.id, p_member_id: id }));
      setTeamMessage("Member removed. Their Business access has ended.");
    }
    await refreshBusinessTeam();
  } catch (error) { setTeamMessage(friendlyMessage(error), true); }
  finally { teamBusy = false; }
}

function renderIncomingInvitations() {
  const container = $("#incomingBusinessInvitations");
  container.replaceChildren();
  state.incomingInvitations.forEach((invitation) => {
    const card = document.createElement("article");
    card.className = "incoming-invitation";
    const scopes = invitation.scope_names?.length ? ` Scope: ${invitation.scope_names.join(", ")}.` : "";
    card.innerHTML = `<h3>${invitation.workspace_name}</h3><p>${invitation.inviter_name} invited you as ${formatRole(invitation.role)}.${scopes} Expires ${formatDate(invitation.expires_at)}.</p><div class="team-member-actions"><button type="button" data-respond-business-invitation="${invitation.invitation_id}" data-accept="true">Accept</button><button type="button" class="danger" data-respond-business-invitation="${invitation.invitation_id}" data-accept="false">Decline</button></div>`;
    container.append(card);
  });
}

async function respondToBusinessInvitation(id, accept) {
  try {
    showOnly("businessLoading");
    const workspaceId = await query("Business invitation response", supabase.rpc("respond_business_invitation", { p_invitation_id: id, p_accept: accept }));
    if (accept) window.localStorage.setItem(selectedWorkspaceStorageKey(), workspaceId);
    state.workspaces = [];
    state.memberships = [];
    appOpening = false;
    await loadBusinessAccess();
  } catch (error) {
    $("#businessErrorMessage").textContent = friendlyMessage(error);
    showOnly("businessError");
  }
}

function renderSubscription() {
  const subscription = state.workspaceSubscription;
  const entitlement = state.workspaceEntitlement;
  const status = entitlement?.effective_status || subscription?.status || "coming soon";
  $("#subscriptionPlanName").textContent = entitlement?.plan_name || "Business preview";
  $("#subscriptionState").textContent = status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  $("#subscriptionStart").textContent = formatDate(subscription?.entitlement_start_at);
  $("#subscriptionBilling").textContent = subscription?.billing_period
    ? subscription.billing_period.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not available";
  $("#subscriptionExpiry").textContent = formatDate(subscription?.paid_through_at || entitlement?.paid_through_at);
  $("#subscriptionCountdown").textContent = subscription ? countdown(subscription.paid_through_at || entitlement?.paid_through_at) : "Launch pending";
}

function resolveWorkspaceLock() {
  const status = state.workspaceEntitlement?.effective_status || state.workspaceSubscription?.status;
  state.locked = state.workspace?.status === "suspended" || ["expired", "suspended"].includes(status);
  state.lockOwner = roleForWorkspace(state.workspace) === "business_owner";
  const panel = $("#businessLock");
  panel.classList.toggle("hidden", !state.locked);
  if (!state.locked) return;
  if (state.lockOwner) {
    $("#businessLockTitle").textContent = "Renew your Business subscription";
    $("#businessLockMessage").textContent = "Only the Business Owner can access renewal. Other members remain locked until the subscription is active again.";
    $("#businessRenewalButton").classList.remove("hidden");
    state.tab = "subscription";
  } else {
    $("#businessLockTitle").textContent = "This Business workspace is locked";
    $("#businessLockMessage").textContent = "The Business subscription has ended or been suspended. Contact the Business Owner to restore access.";
    $("#businessRenewalButton").classList.add("hidden");
  }
}

function renderRoute() {
  let tab = currentTab();
  if (state.locked) tab = state.lockOwner ? "subscription" : "overview";
  if (!state.locked && businessOwnerCanSetUp() &&
      (state.businessProfile?.onboarding_status !== "complete" || setupOpen)) {
    state.tab = "overview";
    $("#businessOnboarding").classList.remove("hidden");
    $$("#businessPanels [data-business-panel]").forEach((panel) => panel.classList.add("hidden"));
    $$("[data-business-nav]").forEach((link) => link.classList.remove("active"));
    $("#businessBreadcrumb").textContent = "Business setup";
    $("#businessPageTitle").textContent = state.workspace?.name || "Your business";
    $("#businessPageIntro").textContent = "Set up your workspace once, then work at your own pace.";
    document.title = "Set up Business | Mushavo Budget";
    showSetupStep(setupStep);
    return;
  }
  $("#businessOnboarding").classList.add("hidden");
  state.tab = tab;
  const [breadcrumb, title, intro] = TAB_COPY[tab];
  $("#businessBreadcrumb").textContent = breadcrumb;
  $("#businessPageTitle").textContent = title;
  $("#businessPageIntro").textContent = intro;
  $$("[data-business-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", state.locked && !state.lockOwner ? true : panel.dataset.businessPanel !== tab);
  });
  $$("[data-business-nav]").forEach((link) => link.classList.toggle("active", link.dataset.businessNav === tab));
  if (window.location.hash !== `#business/${tab}`) setWorkspaceUrl(state.workspace.id);
  document.title = `${title} | Mushavo Budget Business`;
}

function renderBusinessWorkspace() {
  renderWorkspaceSelectors();
  renderIdentity();
  renderTeam();
  renderSubscription();
  resolveWorkspaceLock();
  renderClaims();
  renderBills();
  if (!state.locked) renderBusinessSetup();
  $('[data-open-setup-draft]')?.classList.toggle("hidden", !businessOwnerCanSetUp());
  renderRoute();
  showOnly("businessApp");
}

async function selectBusinessWorkspace(workspaceId) {
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new Error("That Business workspace is not available to this account.");

  clearBusinessWorkspaceState();
  if ($("#businessAddDialog")?.open) $("#businessAddDialog").close();
  if ($("#businessMoreDialog")?.open) $("#businessMoreDialog").close();
  if ($("#businessClaimDialog")?.open) $("#businessClaimDialog").close();
  if ($("#businessClaimDetailDialog")?.open) $("#businessClaimDetailDialog").close();
  for (const selector of ["#businessSupplierDialog", "#businessBillDialog", "#businessBillDetailDialog"]) {
    if ($(selector)?.open) $(selector).close();
  }
  showOnly("businessLoading");
  const requestSequence = workspaceLoadSequence;
  state.workspace = workspace;
  state.tab = currentTab();
  window.localStorage.setItem(selectedWorkspaceStorageKey(), workspace.id);
  setWorkspaceUrl(workspace.id);
  renderWorkspaceSelectors();

  let subscriptions, entitlements, settings, team, profiles, categories, dimensions, drafts, permissions, memberScopes;
  try {
    const memberId = state.memberships.find((item) => item.workspace_id === workspace.id && item.user_id === state.session.user.id)?.id;
    [subscriptions, entitlements, settings, team, profiles, categories, dimensions, drafts, permissions, memberScopes] = await Promise.all([
    query("Business subscription load", supabase.from("workspace_subscriptions").select("*").eq("workspace_id", workspace.id).limit(1)),
    query("Business entitlement load", supabase.rpc("effective_workspace_entitlement", { p_workspace_id: workspace.id })),
    query("Business settings load", supabase.from("workspace_settings").select("*").eq("workspace_id", workspace.id).maybeSingle()),
    query("Business team load", supabase.rpc("business_team_snapshot", { p_workspace_id: workspace.id })),
    query("Business identity load", supabase.from("business_profiles").select("*").eq("workspace_id", workspace.id).maybeSingle()),
    query("Business category load", supabase.from("business_categories").select("*").eq("workspace_id", workspace.id).order("name")),
    query("Business tag load", supabase.from("business_dimensions").select("*").eq("workspace_id", workspace.id).order("name")),
    query("Business first draft load", supabase.from("business_setup_drafts").select("*").eq("workspace_id", workspace.id).maybeSingle()),
    query("Business permissions load", supabase.rpc("business_effective_permissions", { p_workspace_id: workspace.id })),
    memberId ? query("Business assigned scope load", supabase.from("business_member_scopes").select("dimension_id").eq("workspace_id", workspace.id).eq("member_id", memberId)) : Promise.resolve([])
    ]);
  } catch (error) {
    if (requestSequence !== workspaceLoadSequence) return;
    throw error;
  }

  // A slower response from a previously selected company must never overwrite
  // the newly selected Business workspace.
  if (requestSequence !== workspaceLoadSequence || state.workspace?.id !== workspace.id) return;
  state.workspaceSubscription = subscriptions[0] || null;
  state.workspaceEntitlement = entitlements[0] || null;
  state.workspaceSettings = settings || null;
  state.teamSnapshot = team;
  state.workspaceMembers = team?.members || [];
  state.businessProfile = profiles || null;
  state.businessCategories = categories;
  state.businessDimensions = dimensions;
  state.setupDraft = drafts || null;
  state.permissions = new Set((permissions || []).filter((item) => item.allowed).map((item) => item.permission_code));
  state.memberScopes = memberScopes || [];
  renderBusinessWorkspace();
  if (!state.locked) {
    await refreshClaims();
    await refreshBills();
  }
}

async function loadBusinessAccess() {
  if (appOpening) return;
  appOpening = true;
  showOnly("businessLoading");
  try {
    if (!isConfigured) {
      showOnly("businessConfig");
      return;
    }
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    if (!session) {
      window.location.replace("/app.html#personal/dashboard");
      return;
    }
    state.session = session;
    const suspended = await query("account status load", supabase.rpc("my_account_suspended"));
    if (suspended) {
      showOnly("businessSuspended");
      return;
    }

    const [profile, workspaces, memberships, currencies, incomingInvitations] = await Promise.all([
      query("Business profile load", supabase.from("profiles").select("id, full_name, email").eq("id", session.user.id).maybeSingle()),
      query("Business workspace load", supabase.from("budget_workspaces").select("*").eq("workspace_type", "business").neq("status", "closed").order("created_at", { ascending: true })),
      query("Business membership load", supabase.from("workspace_members").select("*").eq("status", "active").order("created_at", { ascending: true })),
      query("Business supported currencies load", supabase.from("supported_currencies").select("code,name").eq("is_active", true).order("code")),
      query("Business invitation load", supabase.rpc("get_my_business_invitations"))
    ]);
    state.profile = profile;
    state.memberships = memberships;
    state.supportedCurrencies = currencies;
    state.incomingInvitations = incomingInvitations || [];
    state.workspaces = authorizedBusinessWorkspaces(workspaces, memberships);
    if (state.incomingInvitations.length) {
      clearBusinessWorkspaceState();
      renderIncomingInvitations();
      showOnly("businessInvitations");
      return;
    }
    if (!state.workspaces.length) {
      clearBusinessWorkspaceState();
      showOnly("businessNoAccess");
      return;
    }

    const requested = requestedWorkspaceId();
    const stored = window.localStorage.getItem(selectedWorkspaceStorageKey());
    const selected = state.workspaces.find((workspace) => workspace.id === requested)
      || state.workspaces.find((workspace) => workspace.id === stored)
      || state.workspaces[0];
    state.tab = currentTab();
    await selectBusinessWorkspace(selected.id);
  } catch (error) {
    console.error(error);
    $("#businessErrorMessage").textContent = friendlyMessage(error);
    showOnly("businessError");
  } finally {
    appOpening = false;
  }
}

async function signOut() {
  clearBusinessWorkspaceState();
  try {
    await supabase?.auth.signOut({ scope: "local" });
  } finally {
    window.location.replace("/app.html");
  }
}

function leaveBusiness(event) {
  event.preventDefault();
  const href = event.currentTarget.getAttribute("href") || "/app.html#personal/dashboard";
  clearBusinessWorkspaceState();
  window.location.assign(href);
}

$$('[data-workspace-selector]').forEach((select) => {
  select.addEventListener("change", (event) => {
    selectBusinessWorkspace(event.target.value).catch((error) => {
      $("#businessErrorMessage").textContent = friendlyMessage(error);
      showOnly("businessError");
    });
  });
});
$$('[data-open-add]').forEach((button) => button.addEventListener("click", () => $("#businessAddDialog").showModal()));
$$('[data-open-claim]').forEach((button) => button.addEventListener("click", () => openClaimForm(button.dataset.openClaim)));
$$('[data-open-bill]').forEach((button) => button.addEventListener("click", openBillForm));
$("#addBusinessBill").addEventListener("click", openBillForm);
$("#addBusinessSupplier").addEventListener("click", () => openSupplierForm());
$("#businessSupplierForm").addEventListener("submit", saveSupplier);
$$('[data-close-supplier]').forEach((button) => button.addEventListener("click", () => $("#businessSupplierDialog").close()));
$("#businessSupplierList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-supplier-id]");
  if (button) openSupplierForm(state.billSuppliers.find((item) => item.id === button.dataset.supplierId));
});
$("#businessBillForm").addEventListener("submit", saveBill);
$("#billType").addEventListener("change", renderBillType);
$("#billCreateAnyway").addEventListener("click", () => saveBill(null, true));
$$('[data-close-bill-form]').forEach((button) => button.addEventListener("click", () => $("#businessBillDialog").close()));
$("#businessBillList").addEventListener("click", (event) => {
  const button = event.target.closest("[data-bill-id]");
  if (button) openBillDetail(button.dataset.billId);
});
$("#businessScheduleList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-schedule-id]");
  if (!button || billBusy || !window.confirm("Stop this schedule? Bills already created will stay payable.")) return;
  billBusy = true;
  try {
    await query("Stop recurring schedule", supabase.rpc("stop_business_bill_schedule", {
      p_workspace_id: state.workspace.id, p_schedule_id: button.dataset.scheduleId
    }));
    await refreshBills();
  } catch (error) { setClaimMessage("#businessBillMessage", friendlyMessage(error), true); }
  finally { billBusy = false; }
});
$$('[data-close-bill-detail]').forEach((button) => button.addEventListener("click", () => $("#businessBillDetailDialog").close()));
$("#businessBillDetailDialog").addEventListener("close", () => { openedBillId = null; delete $("#billPaymentForm").dataset.requestId; });
$("#billPaymentForm").addEventListener("submit", saveBillPayment);
$("#cancelBusinessBill").addEventListener("click", async () => {
  const bill = state.bills.find((item) => item.id === openedBillId);
  if (!bill || billBusy || !window.confirm("Cancel this unpaid bill? This keeps its history and stops its reminders.")) return;
  billBusy = true;
  try {
    await query("Cancel bill", supabase.rpc("cancel_business_bill", { p_workspace_id: bill.workspace_id, p_bill_id: bill.id }));
    await refreshBills();
    await refreshClaims();
    setClaimMessage("#billDetailMessage", "Bill cancelled.");
  } catch (error) { setClaimMessage("#billDetailMessage", friendlyMessage(error), true); }
  finally { billBusy = false; }
});
$("#billPaymentForm").addEventListener("input", () => { delete $("#billPaymentForm").dataset.requestId; });
$("#billProofFile").addEventListener("change", uploadBillProof);
$("#billProofList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-proof-path]");
  if (!button) return;
  try {
    const signed = await query("Open bill proof", supabase.storage.from("business-documents").createSignedUrl(button.dataset.proofPath, 60));
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  } catch (error) { setClaimMessage("#billDetailMessage", friendlyMessage(error), true); }
});
$("#businessClaimForm").addEventListener("submit", createClaim);
$$("[data-close-claim]").forEach((button) => button.addEventListener("click", () => $("#businessClaimDialog").close()));
$$("[data-close-claim-detail]").forEach((button) => button.addEventListener("click", () => $("#businessClaimDetailDialog").close()));
$("#businessClaimDetailDialog").addEventListener("close", () => { openedClaimId = null; });
$("#claimReceiptFile").addEventListener("change", uploadClaimReceipt);
$("#claimDetailActions").addEventListener("click", (event) => {
  const button = event.target.closest("[data-claim-action]");
  if (button) claimAction(button.dataset.claimAction);
});
$("#claimDecisionPanel").addEventListener("click", (event) => {
  if (event.target.closest("[data-cancel-claim-decision]")) $("#claimDecisionPanel").classList.add("hidden");
  if (event.target.closest("[data-confirm-claim-decision]")) claimAction($("#claimDecisionPanel").dataset.action, true);
});
$("#claimReceiptList").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-receipt-path]");
  if (!button) return;
  try {
    const signed = await query("Open receipt", supabase.storage.from("business-documents").createSignedUrl(button.dataset.receiptPath, 60));
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  } catch (error) { setClaimMessage("#claimDetailMessage", friendlyMessage(error), true); }
});
["#businessOverviewClaims", "#businessClaimActivity", "#businessClaimApprovals"].forEach((selector) => {
  $(selector).addEventListener("click", (event) => {
    const button = event.target.closest("[data-claim-id]");
    if (button) openClaimDetail(button.dataset.claimId);
  });
});
$("[data-open-setup-draft]").addEventListener("click", () => {
  $("#businessAddDialog").close();
  if (!businessOwnerCanSetUp()) return;
  setupOpen = true;
  renderRoute();
  showSetupStep("first");
});
$$('[data-open-more]').forEach((button) => button.addEventListener("click", () => $("#businessMoreDialog").showModal()));
$$('[data-dialog-route]').forEach((link) => link.addEventListener("click", () => $("#businessMoreDialog").close()));
$$('[data-sign-out]').forEach((button) => button.addEventListener("click", signOut));
$$('[data-leave-business]').forEach((link) => link.addEventListener("click", leaveBusiness));
$$('[data-retry]').forEach((button) => button.addEventListener("click", loadBusinessAccess));

const financialMonths = Array.from({ length: 12 }, (_, month) =>
  new Option(new Date(2026, month, 1).toLocaleString("en", { month: "long" }), String(month + 1))
);
$("#setupFinancialMonth").replaceChildren(...financialMonths);
const timezones = [...new Set(["Africa/Harare", "UTC", "Africa/Johannesburg",
  ...(Intl.supportedValuesOf?.("timeZone") || [])])].sort();
$("#setupTimezones").replaceChildren(...timezones.map((zone) => new Option(zone, zone)));
$("#setupCurrencySearch").addEventListener("input", renderCurrencyChoices);
$("#setupDraftKind").addEventListener("change", renderDraftSelectors);
$("#businessBasicsForm").addEventListener("submit", saveBusinessBasics);
$("#businessCategoryForm").addEventListener("submit", addBusinessCategory);
$("#businessTagForm").addEventListener("submit", addBusinessTag);
$("#businessDraftForm").addEventListener("submit", saveBusinessDraft);
$("#finishBusinessSetup").addEventListener("click", finishBusinessSetup);
$("#editBusinessSetup").addEventListener("click", () => {
  if (!businessOwnerCanSetUp()) return;
  setupOpen = true;
  setupStep = "basics";
  renderRoute();
});
$("#inviteBusinessMember").addEventListener("click", () => openBusinessInvitationDialog());
$("#businessInviteForm").addEventListener("submit", saveBusinessInvitation);
$$('[data-close-team-dialog]').forEach((button) => button.addEventListener("click", () => $("#businessInviteDialog").close()));
$$('[data-close-ownership-dialog]').forEach((button) => button.addEventListener("click", () => $("#businessOwnershipDialog").close()));
$("#businessTeamList").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-business-member]");
  if (edit) openBusinessInvitationDialog(null, state.teamSnapshot?.members?.find((item) => item.id === edit.dataset.editBusinessMember));
  const remove = event.target.closest("[data-remove-business-member]");
  if (remove) teamAction("remove", remove.dataset.removeBusinessMember);
  const transfer = event.target.closest("[data-transfer-business-owner]");
  if (transfer) {
    $("#ownershipMemberId").value = transfer.dataset.transferBusinessOwner;
    $("#ownershipBusinessName").textContent = state.workspace.name;
    $("#ownershipConfirmation").value = "";
    $("#businessOwnershipDialog").showModal();
  }
});
$("#businessInvitationList").addEventListener("click", (event) => {
  const edit = event.target.closest("[data-edit-business-invitation]");
  if (edit) openBusinessInvitationDialog(state.teamSnapshot?.invitations?.find((item) => item.id === edit.dataset.editBusinessInvitation));
  const resend = event.target.closest("[data-resend-business-invitation]");
  if (resend) teamAction("resend", resend.dataset.resendBusinessInvitation);
  const cancel = event.target.closest("[data-cancel-business-invitation]");
  if (cancel) teamAction("cancel", cancel.dataset.cancelBusinessInvitation);
});
$("#incomingBusinessInvitations").addEventListener("click", (event) => {
  const button = event.target.closest("[data-respond-business-invitation]");
  if (button) respondToBusinessInvitation(button.dataset.respondBusinessInvitation, button.dataset.accept === "true");
});
$("#businessOwnershipForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (teamBusy) return;
  try {
    teamBusy = true;
    await query("Ownership transfer", supabase.rpc("transfer_business_ownership", {
      p_workspace_id: state.workspace.id,
      p_new_owner_member_id: $("#ownershipMemberId").value,
      p_confirmation_name: $("#ownershipConfirmation").value
    }));
    $("#businessOwnershipDialog").close();
    appOpening = false;
    await loadBusinessAccess();
  } catch (error) { setTeamMessage(friendlyMessage(error), true); }
  finally { teamBusy = false; }
});
$("#businessOnboarding").addEventListener("click", (event) => {
  const step = event.target.closest("[data-setup-step],[data-setup-next]");
  if (step) showSetupStep(step.dataset.setupStep || step.dataset.setupNext);
  const category = event.target.closest("[data-setup-category-toggle]");
  if (category) toggleBusinessCategory(category.dataset.setupCategoryToggle);
});
$$("[data-business-nav]").forEach((link) => link.addEventListener("click", () => {
  if (state.businessProfile?.onboarding_status === "complete") setupOpen = false;
  if (link.getAttribute("href") === window.location.hash) renderRoute();
}));

window.addEventListener("hashchange", () => {
  if (!state.workspace) return;
  renderRoute();
  $("#businessMoreDialog")?.close();
  $("#businessMain")?.focus({ preventScroll: true });
});

$("#businessToday").textContent = new Date().toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
loadBusinessAccess();
