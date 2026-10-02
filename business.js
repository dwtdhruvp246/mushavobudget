// Mushavo Budget Business application — Stage 12 pilot and realtime
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
  billingSnapshot: null,
  reportSnapshot: null,
  reportSources: null,
  reportStale: false,
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
let billingSequence = 0, billingOffset = 0, billingBusy = false, billingQuote = null, billingAction = 'renewal', billingSubmissionId = null, billingPrintWindow = null;
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
let incomeBusy = false;
let openedIncome = null;
let activitySequence = 0;
let activityOffset = 0;
let activityFilters = {};
let planningSequence = 0;
let requestOffset = 0;
let budgetOffset = 0;
let budgetSourceOffset = 0;
let requestFilters = {};
let openedRequest = null;
let openedBudget = null;
let workflowBusy = false;
let reportSequence = 0;
let reportSourceSequence = 0;
let reportLoading = false;
let reportAttempted = false;
let reportFilters = {};
let reportSelection = null;
let reportSourceOffset = 0;
let openedReportRecord = null;
let reportExportBusy = false;
let reportPrintWindow = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showOnly(viewId) {
  ["businessLoading", "businessConfig", "businessSuspended", "businessNoAccess", "businessInvitations", "businessError", "businessApp"]
    .forEach((id) => document.getElementById(id)?.classList.toggle("hidden", id !== viewId));
}

function friendlyMessage(error) {
  const message = String(error?.message || error || "The Business workspace could not be opened.");
  if (/INVALID_BUSINESS_LOGO/.test(message)) return "Upload a PNG, JPG or WebP logo up to 2 MB for this business.";
  if (/INVALID_BUSINESS_BRANDING_NAME/.test(message)) return "Enter a business name between 2 and 120 characters.";
  if(/BUSINESS_BILLING_OWNER_REQUIRED/.test(message))return 'Only the Business Owner can view billing or submit a payment.';
  if(/BUSINESS_BILLING_SUSPENDED/.test(message))return 'This Business workspace or Owner account is suspended. An administrator must restore access; payment cannot remove suspension.';
  if(/BUSINESS_BILLING_NOT_CONFIGURED/.test(message))return 'Billing prices, seats or payment instructions are not configured for this cycle. Contact the administrator.';
  if(/BUSINESS_SUBSCRIPTION_QUOTE_CHANGED/.test(message))return 'This quote has expired or the subscription changed. Refresh billing and get a new quote.';
  if(/BUSINESS_CAPACITY_BELOW_USAGE/.test(message))return 'Seats must cover the Owner, active members and pending invitations. Remove or cancel unused places before requesting a lower renewal quantity.';
  if(/BUSINESS_RENEWAL_ALREADY_SCHEDULED/.test(message))return 'Your next term is already paid. Seat changes will be available when that term starts.';
  if(/SUBSCRIPTION_REVIEW_ALREADY_PENDING/.test(message))return 'A subscription payment is already awaiting admin review.';
  if(/SUBSCRIPTION_PROOF_NOT_FOUND|INVALID_SUBSCRIPTION_PROOF_PATH/.test(message))return 'Upload a valid payment proof again before submitting.';
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
  if (/BUSINESS_REQUEST_CHANGED|BUSINESS_BUDGET_CHANGED/.test(message)) return "This record changed or no longer permits that action. Open it again for the latest status.";
  if (/BUSINESS_REQUEST_ACCESS_REQUIRED|BUSINESS_BUDGET_ACCESS_REQUIRED/.test(message)) return "Your role, subscription or assigned scope does not permit this action.";
  if (/BUSINESS_BUDGET_PERIOD_OVERLAP/.test(message)) return "An active budget already covers this category and tag during these dates. Close it or choose another period.";
  if (/BUSINESS_BUDGET_SCOPE_INACTIVE/.test(message)) return "This budget uses an archived category or organisation tag. Edit the draft and select an active scope before activating it.";
  if (/BUSINESS_REPORT_CHANGED/.test(message)) return "The report data or access changed. Refresh the report, then open the figure or export again.";
  if (/BUSINESS_REPORT_EXPORT_TOO_LARGE/.test(message)) return "This export contains more than 10,000 records. Narrow the dates or scope and try again.";
  if (/BUSINESS_REPORT_EXPORT_REQUIRED/.test(message)) return "Your role can view this report but does not have export or print access.";
  if (/BUSINESS_REPORT_ACCESS_REQUIRED/.test(message)) return "Report access is not enabled for your role. Contact the Business Owner.";
  if (/INVALID_BUSINESS_REPORT_FILTER/.test(message)) return "Check the report dates, scope and currency. Original-currency views require one currency.";
  if (/BUSINESS_MONTHLY_PERIOD_REQUIRED/.test(message)) return "Monthly dates must follow the workspace's period start day. Choose a month or use custom dates.";
  if (/BUSINESS_DECISION_REASON_REQUIRED/.test(message)) return "Enter a reason between 2 and 1,000 characters.";
  if (/BUSINESS_REQUEST_LINKED_TO_BILL|BUSINESS_REQUEST_CANNOT_CANCEL/.test(message)) return "This request cannot be cancelled while its bill is outstanding or paid. Manage the linked bill first.";
  if (/BUSINESS_REQUEST_BILL_LINK_INVALID/.test(message)) return "The request must be approved and its amount, currency, category and tag must match the bill.";
  if (/INVALID_BUSINESS_BUDGET|INVALID_BUSINESS_REQUEST/.test(message)) return "Check the name, amount, dates, category, tag and spending purpose.";
  if (/BUSINESS_RECEIPT_REQUIRED/.test(message)) return "Attach a receipt or proof before submitting.";
  if (/BUSINESS_EXCHANGE_RATE_UNAVAILABLE/.test(message)) return "No exchange rate is available for this currency. Try the reporting currency or wait for rates to sync.";
  if (/BUSINESS_REPORTING_CURRENCY_LOCKED/.test(message)) return "The reporting currency is locked after the first financial record so historical totals remain consistent.";
  if (/INVALID_BUSINESS_INCOME|BUSINESS_INCOME_CATEGORY_REQUIRED/.test(message)) return "Check the received amount, income category, date, reference and payment source.";
  if (/BUSINESS_INCOME_ACCESS_REQUIRED/.test(message)) return "Your role, assigned scope or subscription does not allow this income action.";
  if (/BUSINESS_PAYMENT_SOURCE_REQUIRED/.test(message)) return "Choose how the payment was made.";
  if (/INVALID_BUSINESS_ACTIVITY_FILTER/.test(message)) return "Check the date range. The start date must not be after the end date.";
  if (/BUSINESS_CURRENCY_NOT_ENABLED/.test(message)) return "Choose a currency enabled for this workspace.";
  if (/BUSINESS_SELF_APPROVAL_FORBIDDEN/.test(message)) return "Another authorized member must review your claim or spending request.";
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
  stopBusinessRealtime();
  // Clear before every Business workspace load. Stage 2 data collections are
  // already represented here so future requests cannot retain another
  // company's results while a new workspace is opening.
  workspaceLoadSequence += 1;
  state.workspace = null;
  state.workspaceMembers = [];
  state.teamSnapshot = null;
  state.billingSnapshot=null;billingSequence++;billingOffset=0;billingBusy=false;billingQuote=null;billingSubmissionId=null;
  if(billingPrintWindow&&!billingPrintWindow.closed)billingPrintWindow.close();billingPrintWindow=null;
  ['#businessBillingHistory','#businessBillingQuoteDetails'].forEach(selector=>$(selector)?.replaceChildren());
  $('#businessBillingQuoteCard')?.classList.add('hidden');
  setClaimMessage('#businessBillingMessage');setClaimMessage('#businessBillingQuoteMessage');
  state.workspaceSubscription = null;
  state.workspaceEntitlement = null;
  state.workspaceSettings = null;
  state.businessProfile = null;
  clearBusinessBranding();
  state.businessCategories = [];
  state.businessDimensions = [];
  state.setupDraft = null;
  state.transactions = [];
  state.financeSummary = null;
  state.activitySummary = null;
  state.recentTransactions = [];
  // Clear rendered activity as well as models before another company opens.
  ['#businessOverviewClaims', '#businessClaimActivity'].forEach((selector) => $(selector)?.replaceChildren());
  ['#businessActivityTotals', '#businessActivityPage', '#businessActivityMessage'].forEach((selector) => { if ($(selector)) $(selector).textContent = ''; });
  activitySequence += 1;
  activityOffset = 0;
  activityFilters = {};
  incomeBusy = false;
  openedIncome = null;
  $$('dialog[open]').forEach((dialog) => dialog.close());
  $('#businessActivityFilters')?.reset();
  state.bills = [];
  state.requests = [];
  state.budgets = [];
  state.requestSummary = null;
  state.budgetSummary = null;
  state.workflowRolePermissions = [];
  state.workflowPermissionsLoaded = false;
  planningSequence += 1;
  requestOffset = 0; budgetOffset = 0; budgetSourceOffset = 0;
  requestFilters = {};
  openedRequest = null; openedBudget = null; workflowBusy = false;
  state.reportSnapshot = null; state.reportSources = null; state.reportStale = false;
  reportSequence += 1; reportSourceSequence += 1;
  reportLoading = false; reportAttempted = false; reportFilters = {}; reportSelection = null;
  reportSourceOffset = 0; openedReportRecord = null; reportExportBusy = false;
  if (reportPrintWindow && !reportPrintWindow.closed) reportPrintWindow.close();
  reportPrintWindow = null;
  ['#businessReportMetrics','#businessReportHealth','#reportCategoryGroups','#reportDimensionGroups','#reportBudgetComparisons','#reportSourceList','#reportRecordFields','#reportSourcesTotals'].forEach(selector=>$(selector)?.replaceChildren());
  $('#businessReportFilters')?.reset();
  $('#businessReportContent')?.classList.add('hidden');
  if ($('#businessReportContext')) $('#businessReportContext').textContent = '';
  setClaimMessage('#businessReportMessage'); setClaimMessage('#reportSourcesMessage');
  ['#businessRequestList', '#businessBudgetList', '#budgetSourceList', '#requestHistory'].forEach((selector) => $(selector)?.replaceChildren());
  $('#businessRequestFilters')?.reset();
  if ($('#businessBudgetStatus')) $('#businessBudgetStatus').value = '';
  if ($('#businessWorkflowPermissions')) $('#businessWorkflowPermissions').classList.add('hidden');
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

const PAYMENT_SOURCES = { cash: 'Cash', bank_transfer: 'Bank transfer', mobile_money: 'Mobile money', card: 'Card', other: 'Other', unspecified: 'Not recorded (legacy)' };
const TRANSACTION_TYPES = { income: 'Income received', company_expense: 'Company expense', employee_cost: 'Employee-paid cost', reimbursement: 'Reimbursement paid', bill: 'Supplier bill', bill_payment: 'Bill payment', spending_request: 'Spending request' };
const REPORT_SECTIONS = { ledger: 'Actuals and commitments', actuals: 'Received income and company payments', income: 'Income received', paid: 'Company payments', committed: 'Unpaid commitments', bills: 'Unpaid supplier bills', due: 'Bills due', overdue: 'Overdue bills', missing: 'Missing receipts and proofs', employee_claims: 'Employee claim register', reimbursements: 'Employee reimbursements paid', approved_reimbursements: 'Approved reimbursements unpaid', budget_paid: 'Budget payments', budget_committed: 'Budget commitments', budget_activity: 'Budget payments and commitments', budget_plan: 'Planned budget target' };
const REPORT_TYPES = { ...TRANSACTION_TYPES, employee_claim: 'Employee claim record', bill_invoice: 'Supplier invoice check', budget: 'Budget target' };
const REPORT_ACCESS = { workspace: 'Permitted workspace records', assigned_scopes: 'Assigned scopes and your own submissions', own_records: 'Your own records only' };
function sourceLabel(value) { return PAYMENT_SOURCES[value] || 'Not recorded'; }
function workspaceToday() {
  const parts = new Intl.DateTimeFormat('en', { timeZone: state.workspaceSettings?.timezone || 'UTC', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const get = (type) => parts.find((part) => part.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
function populateActivityFilters() {
  const form = $('#businessActivityFilters');
  const fill = (name, label, items) => form.elements.namedItem(name).replaceChildren(new Option(label, ''), ...items.map(([value, text]) => new Option(text, value)));
  fill('currency', 'All currencies', (state.workspaceSettings?.enabled_currencies || []).map((code) => [code, code]));
  fill('category_id', 'All categories', state.businessCategories.map((item) => [item.id, item.name]));
  fill('dimension_id', 'All tags', state.businessDimensions.map((item) => [item.id, item.name]));
}
function transactionCard(item) {
  const card = claimNode('article', 'claim-row');
  const body = claimNode('div', 'claim-row-body');
  const status = item.record_type === 'reimbursement' ? 'reimbursed' : item.status.replaceAll('_', ' ');
  body.append(claimNode('strong', '', item.title), claimNode('small', '', `${TRANSACTION_TYPES[item.record_type]} · ${formatDate(item.event_date + 'T12:00:00')} · ${status}`),
    claimNode('small', '', `${sourceLabel(item.payment_source)}${item.payer_name ? ` · ${item.record_type === 'income' ? 'From' : item.record_type === 'bill' || item.record_type === 'bill_payment' ? 'Supplier' : 'Recorded for'} ${item.payer_name}` : ''}${item.reference ? ` · ${item.reference}` : ''}`));
  const button = claimNode('button', 'button secondary', 'View');
  button.type = 'button'; button.dataset.transactionKey = item.entry_key;
  card.append(body, claimNode('strong', 'claim-row-amount', money(item.amount, item.currency)), button);
  return card;
}
function renderFinanceSummary() {
  const summary = state.financeSummary;
  const finance = claimPermission('finance.view_all') && summary?.finance_visible;
  const currency = summary?.reporting_currency || state.workspaceSettings?.reporting_currency || 'USD';
  for (const [selector, key] of [['#businessIncomeTotal', 'income'], ['#businessPaidTotal', 'paid'], ['#businessCommitmentTotal', 'committed']]) {
    $(selector).textContent = finance ? money(summary[key], currency) : 'Private';
  }
  $('#businessPaidCount').textContent = finance ? String(summary.paid_count) : '—';
  $('#businessReportingCurrency').textContent = currency;
}
function renderTransactions() {
  const summary = state.activitySummary;
  $('#businessClaimActivity').replaceChildren(...(state.transactions.length ? state.transactions.map(transactionCard) : [claimNode('p', 'claim-empty', 'No transactions match these filters.')]));
  const total = Number(summary?.total_count || 0);
  $('#businessActivityPage').textContent = total ? `${activityOffset + 1}–${Math.min(activityOffset + 50, total)} of ${total}` : '0 records';
  $('#businessActivityPrevious').disabled = activityOffset === 0;
  $('#businessActivityNext').disabled = activityOffset + 50 >= total;
  $('#businessActivityTotals').textContent = summary?.finance_visible ? `Matching records · Income received: ${money(summary.income, summary.reporting_currency)} · Business paid: ${money(summary.paid, summary.reporting_currency)} · Approved / bills unpaid: ${money(summary.committed, summary.reporting_currency)}` : 'Only records allowed by your role and assigned scope are shown. Company totals are private.';
  renderFinanceSummary();
}
async function refreshTransactions(summaryToo = true) {
  const workspaceId = state.workspace?.id;
  if (!workspaceId || state.locked) return;
  const sequence = workspaceLoadSequence;
  const request = ++activitySequence;
  setClaimMessage('#businessActivityMessage');
  try {
    const requests = [query('Business activity', supabase.rpc('business_transaction_feed', { p_workspace_id: workspaceId, ...activityFilters, p_offset: activityOffset, p_limit: 50 }))];
    if (summaryToo) requests.push(query('Business recorded totals', supabase.rpc('business_transaction_feed', { p_workspace_id: workspaceId, p_limit: 5 })));
    const [activity, summary] = await Promise.all(requests);
    if (sequence !== workspaceLoadSequence || request !== activitySequence || state.workspace?.id !== workspaceId) return;
    state.transactions = activity.items || [];
    state.activitySummary = activity;
    if (summary) {
      state.financeSummary = summary;
      state.recentTransactions = summary.items || [];
      $('#businessOverviewClaims').replaceChildren(...(state.recentTransactions.length ? state.recentTransactions.map(transactionCard) : [claimNode('p', 'claim-empty', 'No financial activity yet.')]));
    }
    renderTransactions();
    if (summaryToo) {
      await refreshPlanning();
      if (sequence === workspaceLoadSequence && state.tab === 'reports' && reportAttempted) await refreshBusinessReports();
    }
  } catch (error) {
    if (sequence !== workspaceLoadSequence || request !== activitySequence) return;
    setClaimMessage('#businessActivityMessage', friendlyMessage(error), true);
  }
}
function openIncomeForm() {
  if (!claimPermission('finance.view_all') || !claimPermission('finance.create')) return;
  $('#businessAddDialog').close();
  $('#businessIncomeForm').reset();
  $('#businessIncomeForm button[type="submit"]').disabled = false;
  $('#businessIncomeForm').dataset.requestId = crypto.randomUUID();
  $('#incomeDate').value = workspaceToday(); $('#incomeDate').max = workspaceToday();
  $('#incomeCurrency').replaceChildren(...(state.workspaceSettings?.enabled_currencies || []).map((code) => new Option(code, code)));
  $('#incomeCurrency').value = state.workspaceSettings?.default_payment_currency || state.workspaceSettings?.reporting_currency;
  $('#incomeCategory').replaceChildren(new Option('Choose income category', ''), ...state.businessCategories.filter((item) => item.status === 'active' && ['income', 'both'].includes(item.category_type)).map((item) => new Option(item.name, item.id)));
  const scopes = new Set(state.memberScopes.map((item) => item.dimension_id));
  $('#incomeDimension').replaceChildren(new Option(scopes.size ? 'Choose assigned tag' : 'None', ''), ...state.businessDimensions.filter((item) => item.status === 'active' && (!scopes.size || scopes.has(item.id))).map((item) => new Option(item.name, item.id)));
  $('#incomeDimension').required = scopes.size > 0;
  setClaimMessage('#incomeFormMessage');
  $('#businessIncomeDialog').showModal();
}
async function saveIncome(event) {
  event.preventDefault();
  if (incomeBusy || !state.workspace || state.locked) return;
  incomeBusy = true;
  const workspaceId = state.workspace.id, sequence = workspaceLoadSequence;
  $('#businessIncomeForm button[type="submit"]').disabled = true;
  try {
    const receipt = await query('Record received income', supabase.rpc('record_business_income', {
      p_workspace_id: workspaceId, p_income_id: $('#businessIncomeForm').dataset.requestId,
      p_title: $('#incomeTitle').value, p_received_from: $('#incomeFrom').value,
      p_reference: $('#incomeReference').value, p_description: $('#incomeDescription').value,
      p_category_id: $('#incomeCategory').value, p_dimension_id: $('#incomeDimension').value || null,
      p_amount: Number($('#incomeAmount').value), p_currency: $('#incomeCurrency').value,
      p_received_on: $('#incomeDate').value, p_payment_source: $('#incomeSource').value
    }));
    if (sequence !== workspaceLoadSequence) return;
    $('#businessIncomeDialog').close();
    await refreshTransactions();
    if (sequence === workspaceLoadSequence) showIncomeDetail(receipt);
  } catch (error) { if (sequence === workspaceLoadSequence) setClaimMessage('#incomeFormMessage', friendlyMessage(error), true); }
  finally { if (sequence === workspaceLoadSequence) { incomeBusy = false; $('#businessIncomeForm button[type="submit"]').disabled = false; } }
}
function showIncomeDetail(receipt) {
  openedIncome = receipt;
  $('#incomeDetailTitle').textContent = receipt.title;
  $('#incomeDetailFields').replaceChildren(detailLine('Status', receipt.status), detailLine('Received', formatDate(receipt.received_on + 'T12:00:00')),
    detailLine('Amount', money(receipt.amount, receipt.currency)), detailLine('Locked reporting amount', money(receipt.reporting_amount, receipt.reporting_currency)),
    detailLine('Conversion', `${receipt.exchange_rate} · ${receipt.rate_provider} · ${formatDateTime(receipt.rate_effective_at)}`),
    detailLine('From', receipt.received_from || '—'), detailLine('Reference', receipt.reference), detailLine('Payment source', sourceLabel(receipt.payment_source)),
    detailLine('Category', state.businessCategories.find((item) => item.id === receipt.category_id)?.name || 'Archived category'),
    detailLine('Project, branch or team', state.businessDimensions.find((item) => item.id === receipt.dimension_id)?.name || 'None'),
    detailLine('Notes', receipt.description || '—'), detailLine('Recorded', formatDateTime(receipt.created_at)), detailLine('Void reason', receipt.void_reason || '—'), detailLine('Voided', formatDateTime(receipt.voided_at)));
  $('#incomeVoidForm').classList.toggle('hidden', receipt.status !== 'received' || !claimPermission('finance.record_payment'));
  $('#incomeVoidForm').reset(); setClaimMessage('#incomeDetailMessage');
  if (!$('#businessIncomeDetailDialog').open) $('#businessIncomeDetailDialog').showModal();
}
async function voidIncome(event) {
  event.preventDefault();
  if (!openedIncome || incomeBusy || !window.confirm('Void this income? It remains in history but is excluded from received totals.')) return;
  incomeBusy = true;
  const sequence = workspaceLoadSequence, receiptId = openedIncome.id;
  try {
    const receipt = await query('Void received income', supabase.rpc('void_business_income', { p_workspace_id: state.workspace.id, p_income_id: receiptId, p_reason: $('#incomeVoidReason').value }));
    if (sequence !== workspaceLoadSequence) return;
    await refreshTransactions();
    if (sequence === workspaceLoadSequence && openedIncome?.id === receiptId) showIncomeDetail(receipt);
  } catch (error) { if (sequence === workspaceLoadSequence) setClaimMessage('#incomeDetailMessage', friendlyMessage(error), true); }
  finally { if (sequence === workspaceLoadSequence) incomeBusy = false; }
}
async function openTransactionRecord(key) {
  const row = [...state.transactions, ...(state.recentTransactions || [])].find((item) => item.entry_key === key);
  await openBusinessSource(row);
}
async function openBusinessSource(row, messageSelector = '#businessActivityMessage') {
  if (!row || state.locked) return;
  const sequence = workspaceLoadSequence, workspaceId = state.workspace.id;
  try {
    if (row.record_type === 'budget') {
      await openBudgetDetail(row.record_id);
    } else if (row.record_type === 'spending_request') {
      await openRequestDetail(row.record_id);
    } else if (row.record_type === 'income') {
      const receipt = await query('Income record', supabase.from('business_income_receipts').select('*').eq('workspace_id', workspaceId).eq('id', row.record_id).single());
      if (sequence === workspaceLoadSequence) showIncomeDetail(receipt);
    } else if (['bill', 'bill_payment','bill_invoice'].includes(row.record_type)) {
      const id = row.parent_id || row.record_id;
      const bill = await query('Bill record', supabase.from('business_bills').select('*').eq('workspace_id', workspaceId).eq('id', id).single());
      const payments = await query('Bill payment history', supabase.from('business_bill_payments').select('*').eq('workspace_id', workspaceId).eq('bill_id', id));
      const documents = await query('Bill proof', supabase.from('business_documents').select('*').eq('workspace_id', workspaceId).eq('status', 'active').in('parent_type', ['business_bill', 'business_bill_payment']).in('parent_id', [id, ...payments.map((item) => item.id)]));
      if (sequence !== workspaceLoadSequence) return;
      state.bills = [...state.bills.filter((item) => item.id !== id), bill];
      state.billPayments = [...state.billPayments.filter((item) => item.bill_id !== id), ...payments];
      const parentIds = new Set([id, ...payments.map((item) => item.id)]);
      state.billDocuments = [...state.billDocuments.filter((item) => !parentIds.has(item.parent_id)), ...documents];
      openBillDetail(id);
    } else {
      const claim = await query('Expense record', supabase.from('business_expense_claims').select('*').eq('workspace_id', workspaceId).eq('id', row.record_id).single());
      const receipts = await query('Expense proof', supabase.from('business_documents').select('*').eq('workspace_id', workspaceId).eq('parent_type', 'expense_claim').eq('parent_id', claim.id).eq('status', 'active'));
      if (sequence !== workspaceLoadSequence) return;
      state.claims = [...state.claims.filter((item) => item.id !== claim.id), claim];
      state.claimReceipts = [...state.claimReceipts.filter((item) => item.parent_id !== claim.id), ...receipts]; openClaimDetail(claim.id);
    }
  } catch (error) { if (sequence === workspaceLoadSequence) setClaimMessage(messageSelector, friendlyMessage(error), true); }
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
  $("#businessReviewCount").textContent = String(Number(summary?.review_count || 0) + Number(state.requestSummary?.review_count || 0));
  $("#businessApprovalTabCount").textContent = String(summary?.review_count || 0);
  for (const [selector, items, empty] of [
    ["#businessClaimApprovals", reviewable, "No claims need your review."]
  ]) {
    const container = $(selector);
    container.replaceChildren(...(items.length ? items.map(claimCard) : [claimNode("p", "claim-empty", empty)]));
  }
  $$("[data-open-add], [data-open-claim]").forEach((button) => button.classList.toggle("hidden", !claimPermission("finance.create")));
  $$('[data-open-income]').forEach((button) => button.classList.toggle('hidden', !claimPermission('finance.view_all') || !claimPermission('finance.create')));
  renderFinanceSummary();
}

function monthBudgetDates(month, day = 1) {
  const [year, number] = month.split('-').map(Number);
  const start = new Date(Date.UTC(year, number - 1, day));
  const end = new Date(Date.UTC(year, number, day - 1));
  return [start.toISOString().slice(0, 10), end.toISOString().slice(0, 10)];
}
function budgetNumbers(budget, totals) {
  const planned = Number(budget.planned_amount), paid = Number(totals?.paid || 0), committed = Number(totals?.committed || 0);
  return { planned, paid, committed, remaining: planned - paid - committed, paidRemaining: planned - paid,
    percent: planned > 0 ? (paid + committed) / planned * 100 : 0 };
}
function scopedOptions(select, categories = false, whole = false) {
  const scopes = new Set(state.memberScopes.map((item) => item.dimension_id));
  const scopedBudget = whole && (!claimPermission('finance.view_all') || scopes.size > 0);
  const list = categories ? state.businessCategories.filter((item) => item.status === 'active' && ['expense', 'both'].includes(item.category_type))
    : state.businessDimensions.filter((item) => item.status === 'active' && (!scopes.size || scopes.has(item.id)) && (!whole || claimPermission('finance.view_all') || scopes.has(item.id)));
  select.replaceChildren(new Option(categories ? whole ? 'All expense categories' : 'Choose expense category' : scopedBudget || scopes.size ? 'Choose assigned tag' : whole ? 'Whole workspace' : 'None', ''), ...list.map((item) => new Option(item.name, item.id)));
  select.required = categories ? !whole : scopedBudget || scopes.size > 0;
}
function pagination(prefix, offset, count) {
  $(`#${prefix}Page`).textContent = count ? `${offset + 1}–${Math.min(offset + 50, count)} of ${count}` : '0 records';
  $(`#${prefix}Previous`).disabled = offset === 0;
  $(`#${prefix}Next`).disabled = offset + 50 >= count;
}
function planningAction(label, action, record = 'request') {
  const button = claimNode('button', 'button secondary', label); button.type = 'button';
  button.dataset[`${record}Action`] = action; return button;
}
function renderPlanning() {
  const canCreate = claimPermission('finance.create');
  $$('[data-open-request]').forEach((button) => button.classList.toggle('hidden', !canCreate));
  $('#createBusinessBudget').classList.toggle('hidden', !claimPermission('budgets.manage') || !claimPermission('budgets.view') || (!claimPermission('finance.view_all') && !state.memberScopes.length));
  $('#businessBudgetWarningCount').textContent = claimPermission('budgets.view') ? String(state.budgetSummary?.warning_count || 0) : 'Private';
  $('#businessReviewCount').textContent = String(Number(state.claimSummary?.review_count || 0) + Number(state.requestSummary?.review_count || 0));
  $('#businessRequestList').replaceChildren(...(state.requests.length ? state.requests.map((item) => {
    const card = claimNode('article', 'claim-row'), body = claimNode('div', 'claim-row-body');
    body.append(claimNode('strong', '', item.title), claimNode('small', '', `${item.submitter_name || 'Member'} · ${item.status.replaceAll('_', ' ')} · Planned ${formatDate(item.planned_on + 'T12:00:00')}`));
    const button = planningAction('View', 'view'); button.dataset.requestId = item.id;
    card.append(body, claimNode('strong', 'claim-row-amount', money(item.amount, item.currency)), button); return card;
  }) : [claimNode('p', 'claim-empty', 'No spending requests match this view.')]));
  $('#businessBudgetList').replaceChildren(...(state.budgets.length ? state.budgets.map((budget) => {
    const values = budgetNumbers(budget, budget.totals), card = claimNode('article', `budget-card${budget.status === 'active' && values.percent > 100 ? ' over' : budget.status === 'active' && values.percent >= 80 ? ' warning' : ''}`);
    const scope = [budget.category_id ? state.businessCategories.find((item) => item.id === budget.category_id)?.name || 'Archived category' : 'All categories', budget.dimension_id ? state.businessDimensions.find((item) => item.id === budget.dimension_id)?.name || 'Archived tag' : 'Workspace'].join(' · ');
    card.append(claimNode('h3', '', budget.name), claimNode('p', '', `${scope} · ${budget.status}\n${formatDate(budget.starts_on + 'T12:00:00')} – ${formatDate(budget.ends_on + 'T12:00:00')}`));
    const list = claimNode('dl', 'detail-list');
    for (const [key, value] of [['Planned', values.planned], ['Actual paid', values.paid], ['Unpaid commitments', values.committed], ['Available after commitments', values.remaining]]) list.append(detailLine(key, money(value, budget.reporting_currency)));
    const progress = claimNode('progress', ''); progress.max = 100; progress.value = Math.min(100, values.percent); progress.setAttribute('aria-label', `${values.percent.toFixed(1)}% paid or reserved`);
    const button = planningAction('View budget & sources', 'view', 'budget'); button.dataset.budgetId = budget.id;
    card.append(list, progress, claimNode('p', '', `${values.percent.toFixed(1)}% paid or reserved${values.remaining < 0 ? ' · Over target' : ''}`), button); return card;
  }) : [claimNode('p', 'claim-empty', claimPermission('budgets.view') ? 'No budgets match this view. Scope-limited members need an assigned organisation tag.' : 'Budget access is not enabled for your role.')]));
  pagination('businessRequest', requestOffset, Number(state.requestSummary?.total_count || 0));
  pagination('businessBudget', budgetOffset, Number(state.budgetSummary?.total_count || 0));
  $('#businessWorkflowPermissions').classList.toggle('hidden', !businessOwnerCanSetUp() || !state.workflowPermissionsLoaded);
  renderWorkflowPermission();
}
async function refreshPlanning() {
  const workspaceId = state.workspace?.id, sequence = workspaceLoadSequence, request = ++planningSequence;
  if (!workspaceId || state.locked) return;
  try {
    const [requests, budgets, permissions] = await Promise.all([
      query('Spending requests', supabase.rpc('business_request_feed', { p_workspace_id: workspaceId, ...requestFilters, p_offset: requestOffset })),
      query('Business budgets', supabase.rpc('business_budget_feed', { p_workspace_id: workspaceId, p_status: $('#businessBudgetStatus').value, p_offset: budgetOffset })),
      businessOwnerCanSetUp() ? query('Workflow role permissions', supabase.from('business_role_permissions').select('role,permission_code,enabled').eq('workspace_id', workspaceId).in('permission_code', ['approvals.view','approvals.review','budgets.view','budgets.manage','reports.view','reports.export'])) : Promise.resolve([])
    ]);
    if (sequence !== workspaceLoadSequence || request !== planningSequence) return;
    state.requests = requests.items || []; state.requestSummary = requests;
    state.budgets = budgets.items || []; state.budgetSummary = budgets; state.workflowRolePermissions = permissions; state.workflowPermissionsLoaded = true;
    renderPlanning();
  } catch (error) {
    if (sequence !== workspaceLoadSequence || request !== planningSequence) return;
    setClaimMessage('#businessWorkflowMessage', friendlyMessage(error), true); setClaimMessage('#businessBudgetMessage', friendlyMessage(error), true);
  }
}
function openRequestForm(existing = null) {
  if (!claimPermission('finance.create')) return;
  if ($('#businessAddDialog').open) $('#businessAddDialog').close();
  if ($('#businessRequestDetailDialog').open) $('#businessRequestDetailDialog').close();
  const form = $('#businessRequestForm'); form.reset(); form.dataset.recordId = existing?.id || crypto.randomUUID(); form.dataset.version = existing?.version || '';
  $('#businessRequestTitle').textContent = existing ? 'Edit spending request' : 'New spending request';
  $('#requestCurrency').replaceChildren(...(state.workspaceSettings?.enabled_currencies || []).map((code) => new Option(code, code)));
  $('#requestCurrency').value = existing?.currency || state.workspaceSettings?.default_payment_currency || state.workspaceSettings?.reporting_currency;
  scopedOptions($('#requestCategory'), true); scopedOptions($('#requestDimension'));
  $('#requestTitle').value = existing?.title || ''; $('#requestDescription').value = existing?.description || '';
  $('#requestAmount').value = existing?.amount || ''; $('#requestDate').value = existing?.planned_on || workspaceToday();
  if (existing) { $('#requestCategory').value = existing.category_id; $('#requestDimension').value = existing.dimension_id || ''; }
  setClaimMessage('#requestFormMessage'); form.querySelector('button[type="submit"]').disabled = false;
  $('#businessRequestDialog').showModal();
}
async function withWorkflowAction(message, action) {
  if (workflowBusy || state.locked) return;
  const sequence = workspaceLoadSequence; workflowBusy = true;
  const buttons = $$('#businessRequestForm button[type="submit"], #businessBudgetForm button[type="submit"], #requestDetailActions button, #budgetDetailActions button, #requestDecisionForm button, #budgetDecisionForm button, #requestBillForm button, #businessWorkflowPermissionForm button');
  buttons.forEach((button) => { button.disabled = true; });
  try { await action(sequence); }
  catch (error) { if (sequence === workspaceLoadSequence) setClaimMessage(message, friendlyMessage(error), true); }
  finally { if (sequence === workspaceLoadSequence) { workflowBusy = false; buttons.forEach((button) => { button.disabled = false; }); } }
}
async function saveRequest(event) {
  event.preventDefault();
  await withWorkflowAction('#requestFormMessage', async (sequence) => {
    const form = $('#businessRequestForm');
    const record = await query('Save spending request', supabase.rpc('save_business_spending_request', {
      p_workspace_id: state.workspace.id, p_request_id: form.dataset.recordId, p_expected_version: form.dataset.version ? Number(form.dataset.version) : null,
      p_title: $('#requestTitle').value, p_description: $('#requestDescription').value, p_amount: Number($('#requestAmount').value),
      p_currency: $('#requestCurrency').value, p_category_id: $('#requestCategory').value, p_dimension_id: $('#requestDimension').value || null, p_planned_on: $('#requestDate').value
    }));
    if (sequence !== workspaceLoadSequence) return;
    $('#businessRequestDialog').close(); await refreshTransactions();
    if (sequence === workspaceLoadSequence) await openRequestDetail(record.id);
  });
}
async function openRequestDetail(id) {
  const workspaceId = state.workspace?.id, sequence = workspaceLoadSequence;
  if (!workspaceId || state.locked) return;
  openedRequest = { id, loading: true };
  setClaimMessage('#requestDetailMessage');
  try {
    const result = await query('Spending request detail', supabase.rpc('business_request_detail', { p_workspace_id: workspaceId, p_request_id: id }));
    if (sequence !== workspaceLoadSequence || openedRequest?.id !== id) return;
    openedRequest = { ...result.request, bill_id: result.bill_id };
    const item = openedRequest, own = item.submitted_by === state.session.user.id;
    $('#requestDetailTitle').textContent = item.title;
    $('#requestDetailFields').replaceChildren(detailLine('Status', item.status.replaceAll('_', ' ')), detailLine('Planned purchase', formatDate(item.planned_on + 'T12:00:00')),
      detailLine('Requested', money(item.amount, item.currency)), detailLine('Locked reporting amount', money(item.reporting_amount, item.reporting_currency)),
      detailLine('Purpose', item.description), detailLine('Category', state.businessCategories.find((value) => value.id === item.category_id)?.name || 'Archived category'),
      detailLine('Organisation tag', state.businessDimensions.find((value) => value.id === item.dimension_id)?.name || 'None'),
      detailLine('Review reason', item.review_reason || '—'), detailLine('Cancellation reason', item.cancel_reason || '—'),
      detailLine('Linked supplier bill', item.bill_id || 'Not yet created'));
    const actions = $('#requestDetailActions'); actions.replaceChildren();
    if (own && ['draft','changes_requested'].includes(item.status) && claimPermission('finance.create')) actions.append(planningAction('Edit draft','edit'), planningAction('Submit for review','submit'));
    if (!own && item.status === 'submitted' && claimPermission('approvals.review')) actions.append(planningAction('Approve','approved'), planningAction('Request changes','changes_requested'), planningAction('Reject','rejected'));
    if (['draft','submitted','changes_requested','approved'].includes(item.status) && (own || claimPermission('approvals.review'))) actions.append(planningAction('Cancel request','cancel'));
    if (item.bill_id && billAccess()) actions.append(planningAction('Open linked bill','bill'));
    $('#requestDecisionForm').classList.add('hidden');
    const canBill = item.status === 'approved' && billAccess() && claimPermission('finance.create');
    $('#requestBillForm').classList.toggle('hidden', !canBill); $('#requestBillForm').reset();
    $('#requestBillSupplier').replaceChildren(new Option('Choose supplier', ''), ...state.billSuppliers.map((supplier) => new Option(supplier.name, supplier.id)));
    $('#requestBillDate').value = item.planned_on;
    $('#requestHistory').replaceChildren(...(result.history || []).map((event) => claimNode('p','claim-history-entry', `${event.action.replaceAll('.', ' ').replaceAll('_',' ')} · ${formatDateTime(event.created_at)}${event.reason ? ` · ${event.reason}` : ''}`)));
    if (!$('#businessRequestDetailDialog').open) $('#businessRequestDetailDialog').showModal();
  } catch (error) { if (sequence === workspaceLoadSequence) setClaimMessage('#businessWorkflowMessage', friendlyMessage(error), true); }
}
async function requestAction(action, confirmed = false) {
  const item = openedRequest;
  if (!item || item.loading || workflowBusy) return;
  if (action === 'edit') return openRequestForm(item);
  if (action === 'bill') {
    $('#businessRequestDetailDialog').close(); return openTransactionRecordForBill(item.bill_id);
  }
  if (['changes_requested','rejected','cancel'].includes(action) && !confirmed) {
    $('#requestDecisionForm').dataset.action = action; $('#requestDecisionForm').reset(); $('#requestDecisionForm').classList.remove('hidden'); $('#requestDecisionReason').focus(); return;
  }
  await withWorkflowAction('#requestDetailMessage', async (sequence) => {
    await query('Update spending request', supabase.rpc('transition_business_request', { p_workspace_id: state.workspace.id, p_request_id: item.id, p_expected_version: item.version,
      p_action: action, p_reason: confirmed ? $('#requestDecisionReason').value : null }));
    if (sequence !== workspaceLoadSequence) return;
    await refreshTransactions(); if (sequence === workspaceLoadSequence) await openRequestDetail(item.id);
  });
}
async function openTransactionRecordForBill(id) {
  await openBusinessSource({ record_type: 'bill', record_id: id });
}
async function createRequestBill(event) {
  event.preventDefault(); const item = openedRequest; if (!item) return;
  await withWorkflowAction('#requestDetailMessage', async (sequence) => {
    const bill = await query('Create request bill', supabase.rpc('create_business_bill_from_request', { p_workspace_id: state.workspace.id, p_request_id: item.id,
      p_supplier_id: $('#requestBillSupplier').value, p_reference: $('#requestBillReference').value, p_due_on: $('#requestBillDate').value, p_remind_days_before: Number($('#requestBillReminder').value) }));
    if (sequence !== workspaceLoadSequence) return;
    await refreshBills(); if (sequence !== workspaceLoadSequence) return;
    $('#businessRequestDetailDialog').close(); await openTransactionRecordForBill(bill.id);
  });
}
function renderBudgetPeriod() {
  const monthly = $('#budgetPeriodType').value === 'monthly';
  $('#budgetMonthField').classList.toggle('hidden', !monthly); $('#budgetMonth').required = monthly;
  $('#budgetStart').readOnly = monthly; $('#budgetEnd').readOnly = monthly;
  if (monthly && $('#budgetMonth').value) {
    const [start, end] = monthBudgetDates($('#budgetMonth').value, state.businessProfile?.period_start_day || 1);
    $('#budgetStart').value = start; $('#budgetEnd').value = end;
  }
}
function openBudgetForm(existing = null) {
  if (!claimPermission('budgets.manage') || !claimPermission('budgets.view')) return;
  if ($('#businessBudgetDetailDialog').open) $('#businessBudgetDetailDialog').close();
  const form = $('#businessBudgetForm'); form.reset(); form.dataset.recordId = existing?.id || crypto.randomUUID(); form.dataset.version = existing?.version || '';
  $('#budgetFormTitle').textContent = existing ? 'Edit draft budget' : 'Create budget';
  $('#budgetCurrencyHint').textContent = `Planned amounts use ${state.workspaceSettings?.reporting_currency}. Monthly periods start on day ${state.businessProfile?.period_start_day || 1}.`;
  scopedOptions($('#budgetCategory'), true, true); scopedOptions($('#budgetDimension'), false, true);
  $('#budgetName').value = existing?.name || ''; $('#budgetAmount').value = existing?.planned_amount || '';
  $('#budgetPeriodType').value = existing?.period_type || 'monthly';
  $('#budgetMonth').value = (existing?.starts_on || workspaceToday()).slice(0, 7);
  if (existing) { $('#budgetCategory').value = existing.category_id || ''; $('#budgetDimension').value = existing.dimension_id || ''; $('#budgetStart').value = existing.starts_on; $('#budgetEnd').value = existing.ends_on; }
  renderBudgetPeriod(); setClaimMessage('#budgetFormMessage'); form.querySelector('button[type="submit"]').disabled = false; $('#businessBudgetDialog').showModal();
}
async function saveBudget(event) {
  event.preventDefault();
  await withWorkflowAction('#budgetFormMessage', async (sequence) => {
    const form = $('#businessBudgetForm');
    const budget = await query('Save draft budget', supabase.rpc('save_business_budget', { p_workspace_id: state.workspace.id, p_budget_id: form.dataset.recordId,
      p_expected_version: form.dataset.version ? Number(form.dataset.version) : null, p_name: $('#budgetName').value, p_planned_amount: Number($('#budgetAmount').value),
      p_category_id: $('#budgetCategory').value || null, p_dimension_id: $('#budgetDimension').value || null, p_period_type: $('#budgetPeriodType').value,
      p_starts_on: $('#budgetStart').value, p_ends_on: $('#budgetEnd').value }));
    if (sequence !== workspaceLoadSequence) return;
    $('#businessBudgetDialog').close(); await refreshPlanning(); if (sequence === workspaceLoadSequence) await openBudgetDetail(budget.id);
  });
}
async function openBudgetDetail(id, reset = true) {
  const workspaceId = state.workspace?.id, sequence = workspaceLoadSequence;
  if (!workspaceId || state.locked) return;
  if (reset) budgetSourceOffset = 0;
  const offset = budgetSourceOffset; openedBudget = { id, loading: true };
  try {
    const result = await query('Budget detail', supabase.rpc('business_budget_detail', { p_workspace_id: workspaceId, p_budget_id: id, p_offset: offset }));
    if (sequence !== workspaceLoadSequence || openedBudget?.id !== id || offset !== budgetSourceOffset) return;
    openedBudget = result.budget; const budget = result.budget, values = budgetNumbers(budget, result.totals);
    $('#budgetDetailTitle').textContent = budget.name;
    $('#budgetDetailFields').replaceChildren(detailLine('Status', budget.status), detailLine('Period', `${formatDate(budget.starts_on+'T12:00:00')} – ${formatDate(budget.ends_on+'T12:00:00')}`),
      ...[['Planned',values.planned],['Actual paid',values.paid],['Unpaid commitments',values.committed],['Remaining before commitments',values.paidRemaining],['Available after commitments',values.remaining]].map(([label, amount]) => detailLine(label, money(amount,budget.reporting_currency))),
      detailLine('Status-change reason',budget.transition_reason || '—'));
    const actions = $('#budgetDetailActions'); actions.replaceChildren();
    if (claimPermission('budgets.manage')) {
      if (budget.status === 'draft') actions.append(planningAction('Edit draft','edit','budget'),planningAction('Activate','active','budget'),planningAction('Archive draft','archived','budget'));
      if (budget.status === 'active') actions.append(planningAction('Close budget','closed','budget'));
      if (budget.status === 'closed') actions.append(planningAction('Archive','archived','budget'));
    }
    $('#budgetDecisionForm').classList.add('hidden');
    $('#budgetSourceList').replaceChildren(...(result.items?.length ? result.items.map((item) => {
      const row = claimNode('article','claim-row'), body = claimNode('div','claim-row-body');
      body.append(claimNode('strong','',item.title),claimNode('small','',`${TRANSACTION_TYPES[item.record_type]} · ${formatDate(item.event_date+'T12:00:00')} · ${item.paid_value>0 ? 'Paid' : 'Committed'}`),claimNode('small','',`Original: ${money(item.amount,item.currency)} · Record ${item.record_id}`));
      row.append(body,claimNode('strong','claim-row-amount',money(item.reporting_amount,budget.reporting_currency)));
      return row;
    }) : [claimNode('p','claim-empty','No paid or committed records in this budget scope and period.')]));
    pagination('budgetSource',offset,Number(result.totals?.source_count || 0)); setClaimMessage('#budgetDetailMessage');
    if (!$('#businessBudgetDetailDialog').open) $('#businessBudgetDetailDialog').showModal();
  } catch (error) { if (sequence === workspaceLoadSequence) setClaimMessage('#businessBudgetMessage',friendlyMessage(error),true); }
}
async function budgetAction(status, confirmed = false) {
  const budget = openedBudget; if (!budget || budget.loading || workflowBusy) return;
  if (status === 'edit') return openBudgetForm(budget);
  if (status !== 'active' && !confirmed) { $('#budgetDecisionForm').dataset.status = status; $('#budgetDecisionForm').reset(); $('#budgetDecisionForm').classList.remove('hidden'); $('#budgetDecisionReason').focus(); return; }
  await withWorkflowAction('#budgetDetailMessage',async(sequence) => {
    await query('Update budget status',supabase.rpc('transition_business_budget',{p_workspace_id:state.workspace.id,p_budget_id:budget.id,p_expected_version:budget.version,p_status:status,p_reason:confirmed ? $('#budgetDecisionReason').value : null}));
    if (sequence !== workspaceLoadSequence) return;
    await refreshPlanning(); if (sequence === workspaceLoadSequence) await openBudgetDetail(budget.id);
  });
}
function renderWorkflowPermission() {
  if (!businessOwnerCanSetUp()) return;
  const setting = (state.workflowRolePermissions || []).find((item) => item.role === $('#workflowPermissionRole').value && item.permission_code === $('#workflowPermissionCode').value);
  $('#workflowPermissionEnabled').value = String(Boolean(setting?.enabled));
}
async function saveWorkflowPermission(event) {
  event.preventDefault();
  await withWorkflowAction('#workflowPermissionMessage',async(sequence) => {
    await query('Save workflow permission',supabase.rpc('set_business_workflow_permission',{p_workspace_id:state.workspace.id,p_role:$('#workflowPermissionRole').value,p_permission_code:$('#workflowPermissionCode').value,p_enabled:$('#workflowPermissionEnabled').value==='true'}));
    if (sequence !== workspaceLoadSequence) return;
    await refreshPlanning();
    if (sequence === workspaceLoadSequence) setClaimMessage('#workflowPermissionMessage','Role permission saved. Individual overrides and assigned scopes still apply.');
  });
}

function businessReportDates(preset, today, day = 1, financialMonth = 1) {
  const date = new Date(today + 'T12:00:00Z');
  let year = date.getUTCFullYear(), month = date.getUTCMonth();
  if (preset === 'financial_year') {
    const start = new Date(Date.UTC(year, financialMonth - 1, day));
    if (date < start) year--;
    return [new Date(Date.UTC(year, financialMonth - 1, day)).toISOString().slice(0,10),new Date(Date.UTC(year+1,financialMonth-1,day-1)).toISOString().slice(0,10)];
  }
  if (date.getUTCDate() < day) month--;
  if (preset === 'previous') month--;
  const start = new Date(Date.UTC(year,month,day));
  return monthBudgetDates(start.toISOString().slice(0,7),day);
}
function renderReportPeriod() {
  const preset = $('#reportPeriod').value, all = preset === 'all';
  $('#reportFrom').disabled = all; $('#reportTo').disabled = all;
  $('#reportFrom').required = !all; $('#reportTo').required = !all;
  if (!all && preset !== 'custom') {
    const dates = businessReportDates(preset,workspaceToday(),state.businessProfile?.period_start_day || 1,state.businessProfile?.financial_year_start_month || 1);
    $('#reportFrom').value = dates[0]; $('#reportTo').value = dates[1];
  }
}
function renderReportCurrency() {
  const select = $('#reportOriginalCurrency'), current = select.value;
  const currencies = [...new Set([...(state.workspaceSettings?.enabled_currencies || []),...(state.reportSnapshot?.currencies || []),current].filter(Boolean))].sort();
  const original = $('#reportCurrencyMode').value === 'original';
  select.replaceChildren(new Option(original ? 'Choose currency' : 'All currencies',''),...currencies.map(code=>new Option(code,code)));
  select.required = original;
  select.value = current || (original ? state.workspaceSettings?.reporting_currency : '');
}
function prepareBusinessReports() {
  $('#businessReportFilters').reset(); renderReportPeriod(); renderReportCurrency();
  $('#reportCategory').replaceChildren(new Option('All categories',''),...state.businessCategories.map(item=>new Option(item.name+(item.status==='active'?'':' (archived)'),item.id)));
  $('#reportDimension').replaceChildren(new Option('All tags',''),...state.businessDimensions.map(item=>new Option(item.name+(item.status==='active'?'':' (archived)'),item.id)));
  reportFilters = readBusinessReportFilters(); renderReportAccess();
}
function readBusinessReportFilters() {
  return { p_from: $('#reportFrom').disabled ? null : $('#reportFrom').value || null,p_to: $('#reportTo').disabled ? null : $('#reportTo').value || null,
    p_mode: $('#reportCurrencyMode').value,p_currency: $('#reportOriginalCurrency').value,p_category_id: $('#reportCategory').value || null,p_dimension_id: $('#reportDimension').value || null };
}
function renderReportAccess() {
  const allowed = claimPermission('reports.view');
  $('#businessReportControls').classList.toggle('hidden',!allowed);
  $('#refreshBusinessReports').disabled = !allowed || reportLoading;
  if (!allowed) setClaimMessage('#businessReportMessage','Report access is not enabled for your role. Contact the Business Owner.');
  const canExport = allowed && claimPermission('reports.export') && state.reportSnapshot?.metadata?.can_export && !state.reportStale && !reportExportBusy && !reportLoading;
  ['#exportBusinessReportCSV','#printBusinessReport','#exportReportSourcesCSV','#printReportSources'].forEach(selector=>$(selector).disabled=!canExport);
}
function reportMetric(label, value, section, detail = '') {
  const button = claimNode('button','report-metric'); button.type = 'button'; button.dataset.reportSection = section;
  button.append(claimNode('span','',label),claimNode('strong','',value),claimNode('small','',detail || 'View exact records'));
  return button;
}
function reportFigure(value, section, options = {}) {
  const button = claimNode('button','report-figure',value); button.type = 'button'; button.dataset.reportSection = section;
  if (options.groupType) { button.dataset.reportGroupType = options.groupType; button.dataset.reportGroupId = options.groupId || ''; }
  if (options.budgetId) button.dataset.reportBudgetId = options.budgetId;
  button.setAttribute('aria-label',`${REPORT_SECTIONS[section]}: ${value}. View exact records.`); return button;
}
function renderReportGroups(selector, groups, groupType, currency) {
  const nodes = (groups || []).map(group=>{
    const row = claimNode('article','report-group'), values = claimNode('div','report-group-values');
    for (const [label,key,section] of [['Paid','paid','paid'],['Committed','committed','committed']]) {
      const field = claimNode('div','');field.append(claimNode('span','',label),reportFigure(money(group[key],currency),section,{groupType,groupId:group.id}));values.append(field);
    }
    row.append(claimNode('strong','',group.name),values); return row;
  });
  $(selector).replaceChildren(...(nodes.length ? nodes : [claimNode('p','claim-empty','No paid or committed spending matches these filters.')]));
}
function renderBusinessReports() {
  renderReportAccess();
  const snapshot = state.reportSnapshot; $('#businessReportContent').classList.toggle('hidden',!snapshot);
  if (!snapshot) return;
  const { summary:s, metadata:m } = snapshot, currency = m.currency;
  $('#businessReportContext').textContent = `${REPORT_ACCESS[m.access]} · ${m.from || 'First recorded date'} – ${m.to || 'Latest recorded date'} · ${m.mode==='original'?'Original':'Stored reporting'} currency ${currency} · ${m.timezone} · Generated ${formatDateTime(m.generated_at)}`;
  $('#businessReportMetrics').replaceChildren(reportMetric('Income received',money(s.income,currency),'income'),reportMetric('Company payments',money(s.paid,currency),'paid'),reportMetric('Unpaid commitments',money(s.committed,currency),'committed'),reportMetric('Recorded difference',money(Number(s.income)-Number(s.paid),currency),'actuals','Received income less company payments'));
  $('#businessReportHealth').replaceChildren(reportMetric('Bills due',String(s.due_count),'due',`${money(s.due_amount,currency)} currently unpaid`),reportMetric('Overdue bills',String(s.overdue_count),'overdue',`${money(s.overdue_amount,currency)} currently unpaid`),reportMetric('Missing receipts / proofs',String(s.missing_count),'missing','Expense receipts, invoices and payment proofs'),reportMetric('Employee claim records',String(s.claim_count),'employee_claims',`${money(s.claimed,currency)} · includes all statuses`),reportMetric('Reimbursements paid',money(s.reimbursed,currency),'reimbursements'),reportMetric('Approved reimbursements',money(s.approved_reimbursements,currency),'approved_reimbursements','Approved and still unpaid'));
  renderReportGroups('#reportCategoryGroups',snapshot.categories,'category',currency);renderReportGroups('#reportDimensionGroups',snapshot.dimensions,'dimension',currency);
  const budgets = (snapshot.budgets || []).map(budget=>{
    const card = claimNode('article','budget-card'), values = budgetNumbers(budget,budget), list = claimNode('dl','detail-list');
    card.append(claimNode('h3','',budget.name),claimNode('p','',`Target ${budget.starts_on} – ${budget.ends_on} · Activity ${budget.activity_from} – ${budget.activity_to}`));
    for (const [label,value,section] of [['Full planned target',values.planned,'budget_plan'],['Actual paid',values.paid,'budget_paid'],['Unpaid commitments',values.committed,'budget_committed'],['Available after commitments',values.remaining,'budget_activity']]) {
      const line = claimNode('div','');line.append(claimNode('dt','',label));const cell = claimNode('dd','');cell.append(reportFigure(money(value,currency),section,{budgetId:budget.id}));line.append(cell);list.append(line);
    }
    card.append(list); return card;
  });
  $('#reportBudgetComparisons').replaceChildren(...(budgets.length ? budgets : [claimNode('p','claim-empty',m.mode==='original' ? 'Budget targets use the reporting currency. Switch to the reporting view to compare them.' : 'No active or closed budgets match this period and permitted scope. Budget-view permission is also required.')]));
  $('#reportExportAccess').textContent = m.can_export ? 'Export all matching records, including every page. Print opens a summary you can save as PDF. Larger than 10,000 records requires narrower filters.' : 'Your role has view access. The Business Owner can grant export and print permission.';
  renderReportCurrency();
}
async function refreshBusinessReports() {
  if (!state.workspace || state.locked || !claimPermission('reports.view')) { renderReportAccess(); return; }
  const workspaceId = state.workspace.id, sequence = workspaceLoadSequence, request = ++reportSequence;
  reportLoading = true; reportAttempted = true;
  reportSelection = null; state.reportSources = null; openedReportRecord = null; reportSourceSequence++;
  ['#businessReportSourcesDialog','#businessReportRecordDialog'].forEach(selector=>{if($(selector).open)$(selector).close()});
  state.reportSnapshot = null; $('#businessReportContent').classList.add('hidden');
  setClaimMessage('#businessReportMessage','Loading report…'); renderReportAccess();
  try {
    const snapshot = await query('Business report',supabase.rpc('business_report_summary',{p_workspace_id:workspaceId,...reportFilters}));
    if (sequence!==workspaceLoadSequence || request!==reportSequence) return;
    state.reportSnapshot = snapshot; state.reportStale = false; setClaimMessage('#businessReportMessage');
  } catch(error) { if(sequence===workspaceLoadSequence && request===reportSequence)setClaimMessage('#businessReportMessage',friendlyMessage(error),true); }
  finally { if(sequence===workspaceLoadSequence && request===reportSequence){reportLoading=false;renderBusinessReports();} }
}
function reportSelectionArgs(selection) {
  return {p_section:selection.section,p_group_type:selection.groupType || '',p_group_id:selection.groupId || null,p_budget_id:selection.budgetId || null};
}
function markBusinessReportStale(error) {
  if (/BUSINESS_REPORT_CHANGED/.test(error.message || '')) { state.reportStale = true; renderReportAccess(); setClaimMessage('#businessReportMessage',friendlyMessage(error),true); }
}
async function openBusinessReportSources(selection, reset = true) {
  if (!state.reportSnapshot || state.reportStale || state.locked || !claimPermission('reports.view')) return;
  if (reset) reportSourceOffset = 0;
  reportSelection = { ...selection }; const selected = reportSelection;
  const workspaceId = state.workspace.id, sequence = workspaceLoadSequence, request = ++reportSourceSequence;
  const snapshot = state.reportSnapshot, offset = reportSourceOffset;
  setClaimMessage('#reportSourcesMessage');
  try {
    const result = await query('Report source records',supabase.rpc('business_report_records',{p_workspace_id:workspaceId,...reportFilters,...reportSelectionArgs(selected),p_expected_fingerprint:snapshot.fingerprint,p_offset:offset}));
    if (sequence!==workspaceLoadSequence || request!==reportSourceSequence || state.reportSnapshot!==snapshot) return;
    state.reportSources = result;
    $('#reportSourcesTitle').textContent = REPORT_SECTIONS[selected.section];
    $('#reportSourcesContext').textContent = `${REPORT_ACCESS[result.metadata.access]} · ${result.metadata.from || 'First record'} – ${result.metadata.to || 'Latest record'} · ${result.metadata.currency} · ${result.total_count} matching records`;
    const budget = selected.budgetId ? snapshot.budgets.find(item=>item.id===selected.budgetId) : null;
    $('#reportSourcesBudget').classList.toggle('hidden',!budget);
    $('#reportSourcesBudget').textContent = budget ? `${budget.name} · Full target ${money(budget.planned_amount,budget.reporting_currency)} for ${budget.starts_on} – ${budget.ends_on}. Activity is restricted to ${budget.activity_from} – ${budget.activity_to}.` : '';
    $('#reportSourcesTotals').replaceChildren(...[['Received income',result.totals.income],['Company payments',result.totals.paid],['Unpaid commitments',result.totals.committed],['Claim-register value',result.totals.claimed]].map(([label,value])=>detailLine(label,money(value,result.metadata.currency))));
    if(selected.section==='budget_plan')$('#reportSourcesTotals').replaceChildren(detailLine('Planned target',money(budget.planned_amount,budget.reporting_currency)));
    $('#reportSourceList').replaceChildren(...(result.items.length ? result.items.map(row=>{
      const card = claimNode('article','claim-row'), body = claimNode('div','claim-row-body');
      body.append(claimNode('strong','',row.title),claimNode('small','',`${REPORT_TYPES[row.record_type]} · ${row.event_date} · ${row.status.replaceAll('_',' ')} · ${row.category_name || 'Budget scope'} · ${row.dimension_name || 'Workspace'}`),claimNode('small','',`Record ${row.record_id}`));
      const amount = result.metadata.mode==='original' ? row.original_amount : row.reporting_amount;
      const button = claimNode('button','button secondary','View record');button.type='button';button.dataset.reportEntryKey=row.entry_key;
      card.append(body,claimNode('strong','claim-row-amount',money(amount,result.metadata.currency)),button);return card;
    }) : [claimNode('p','claim-empty','No records contribute to this figure.')]));
    pagination('reportSource',offset,Number(result.total_count));renderReportAccess();
    if(!$('#businessReportSourcesDialog').open)$('#businessReportSourcesDialog').showModal();
  } catch(error) {
    if(sequence!==workspaceLoadSequence || request!==reportSourceSequence)return;
    markBusinessReportStale(error);setClaimMessage('#reportSourcesMessage',friendlyMessage(error),true);setClaimMessage('#businessReportMessage',friendlyMessage(error),true);
  }
}
function showBusinessReportRecord(key) {
  if (state.locked || state.reportStale) return;
  const row = state.reportSources?.items.find(item=>item.entry_key===key);if(!row)return;
  openedReportRecord = row;
  $('#reportRecordTitle').textContent = row.title;
  $('#reportRecordFields').replaceChildren(detailLine('Record ID',row.record_id),detailLine('Record type',REPORT_TYPES[row.record_type]),detailLine('Date',row.event_date),detailLine('Status',row.status.replaceAll('_',' ')),detailLine('Original amount',money(row.original_amount,row.currency)),detailLine('Stored reporting amount',money(row.reporting_amount,row.reporting_currency)),detailLine('Conversion snapshot',`${row.exchange_rate} · ${row.rate_provider} · ${formatDateTime(row.rate_effective_at)}`),detailLine('Category',row.category_name || 'Budget scope'),detailLine('Organisation tag',row.dimension_name || 'Workspace'),detailLine('Person / supplier',row.person_name || '—'),detailLine('Payment source',sourceLabel(row.payment_source)),detailLine('Reference',row.reference || '—'),detailLine('Receipt / proof',row.receipt_state.replaceAll('_',' ')),detailLine('Parent record',row.parent_id || '—'));
  if(row.period_end)$('#reportRecordFields').append(detailLine('Target ends',row.period_end));
  $('#openReportOriginal').classList.toggle('hidden',!row.can_open);
  setClaimMessage('#reportRecordMessage',row.can_open ? 'The original record opens with your existing financial and document permissions.' : 'This report record is read-only within your assigned scope.');
  $('#businessReportRecordDialog').showModal();
}
async function exportBusinessReport(format, selection = null) {
  const snapshot = state.reportSnapshot;
  if (!snapshot || state.reportStale || state.locked || reportLoading || reportExportBusy || !snapshot.metadata.can_export || !claimPermission('reports.export')) return;
  const selected = selection || {section:$('#reportExportSection').value};
  const sequence = workspaceLoadSequence, request = reportSequence, args = {...reportFilters}, workspaceId = state.workspace.id;
  const message = selection ? '#reportSourcesMessage' : '#businessReportMessage';
  const popup = format==='print' ? window.open('about:blank','_blank') : null;
  if (format==='print' && !popup) { setClaimMessage(message,'Allow a popup to open the printable summary.',true); return; }
  if(popup){popup.opener=null;popup.document.body.textContent='Preparing the verified report…';reportPrintWindow=popup;}
  reportExportBusy=true;renderReportAccess();setClaimMessage(message,'Preparing all matching records…');
  const finish = window.MushavoPWA?.beginOperation('business-report-export');
  try {
    const result = await query('Export business report',supabase.rpc('business_report_export',{p_workspace_id:workspaceId,...args,...reportSelectionArgs(selected),p_expected_fingerprint:snapshot.fingerprint,p_export_id:crypto.randomUUID(),p_format:format}));
    if(sequence!==workspaceLoadSequence || request!==reportSequence || state.reportSnapshot!==snapshot){if(popup&&!popup.closed)popup.close();return;}
    if(format==='csv'){
      const url = URL.createObjectURL(new Blob(['\ufeff',result.csv],{type:'text/csv;charset=utf-8'}));
      const link = document.createElement('a');link.href=url;link.download=`mushavo-business-${selected.section}-${result.metadata.from || 'all'}-${result.metadata.to || 'dates'}.csv`;document.body.append(link);link.click();link.remove();window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    } else { if(popup.closed)throw new Error('The print window was closed. Open the report again.'); renderBusinessReportPrint(popup,result);reportPrintWindow=null; }
    setClaimMessage(message,`${result.total_count} source records ${format==='csv'?'exported':'ready to print or save as PDF'}.`);
  } catch(error){if(popup&&!popup.closed)popup.close();if(sequence===workspaceLoadSequence){markBusinessReportStale(error);setClaimMessage(message,friendlyMessage(error),true);}}
  finally { finish?.();if(sequence===workspaceLoadSequence){reportExportBusy=false;reportPrintWindow=null;renderReportAccess();} }
}
function renderBusinessReportPrint(popup, report) {
  const doc = popup.document, m = report.metadata, s = report.summary;
  doc.title = `${m.workspace_name} — Business report`;
  doc.head.replaceChildren();doc.body.replaceChildren();
  const style=doc.createElement('style');style.textContent='@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:system-ui,sans-serif;color:#183438;margin:24px;font-size:12px}h1{font-size:24px;margin-bottom:8px}h2{font-size:16px;margin-top:26px}p{line-height:1.6}table{border-collapse:collapse;width:100%;margin:12px 0;table-layout:fixed}th,td{border:1px solid #b9ccca;padding:7px;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{background:#eaf5f1}thead{display:table-header-group}tr{break-inside:avoid}button{padding:12px 20px;background:#087f6d;color:white;border:0;border-radius:8px;font:inherit}small{display:block;color:#49666a}@media print{body{margin:0;font-size:9px}.print-toolbar{display:none}}';doc.head.append(style);
  const node=(tag,text)=>{const item=doc.createElement(tag);if(text!=null)item.textContent=text;return item};
  const toolbar=node('div');toolbar.className='print-toolbar';const button=node('button','Print / Save PDF');button.addEventListener('click',()=>popup.print());toolbar.append(button,node('p','Choose Save as PDF in your browser print dialog to download a PDF.'));doc.body.append(toolbar);
  doc.body.append(node('h1',m.workspace_name+' — Business report'),node('p',`${REPORT_ACCESS[m.access]} · ${m.from || 'First recorded date'} – ${m.to || 'Latest recorded date'} · ${m.mode==='original'?'Original':'Stored reporting'} currency ${m.currency} · ${m.timezone} · Generated ${formatDateTime(m.generated_at)}`));
  const table=(headers,rows)=>{const t=node('table'),head=node('thead'),tr=node('tr');headers.forEach(value=>tr.append(node('th',value)));head.append(tr);t.append(head);const body=node('tbody');rows.forEach(values=>{const r=node('tr');values.forEach(value=>r.append(node('td',value??'—')));body.append(r)});t.append(body);doc.body.append(t)};
  table(['Income received','Company payments','Unpaid commitments','Recorded difference'],[[money(s.income,m.currency),money(s.paid,m.currency),money(s.committed,m.currency),money(Number(s.income)-Number(s.paid),m.currency)]]);
  table(['Bills due','Overdue bills','Missing documents','Claim records (all statuses)','Reimbursements paid','Approved reimbursements unpaid'],[[`${s.due_count} · ${money(s.due_amount,m.currency)}`,`${s.overdue_count} · ${money(s.overdue_amount,m.currency)}`,s.missing_count,`${s.claim_count} · ${money(s.claimed,m.currency)}`,money(s.reimbursed,m.currency),money(s.approved_reimbursements,m.currency)]]);
  for(const [label,groups] of [['Spending by category',report.categories],['Spending by organisation tag',report.dimensions]]){doc.body.append(node('h2',label));table(['Scope','Actual paid','Unpaid commitments'],groups.map(group=>[group.name,money(group.paid,m.currency),money(group.committed,m.currency)]));}
  if(report.budgets.length){doc.body.append(node('h2','Budget versus filtered activity'));table(['Budget / target period / activity period','Full planned target','Actual paid','Unpaid commitments','Available after commitments'],report.budgets.map(b=>[`${b.name} · Target ${b.starts_on}–${b.ends_on} · Activity ${b.activity_from}–${b.activity_to}`,money(b.planned_amount,m.currency),money(b.paid,m.currency),money(b.committed,m.currency),money(Number(b.planned_amount)-Number(b.paid)-Number(b.committed),m.currency)]));}
  doc.body.append(node('p','Actuals exclude voided income and unpaid employee costs. Linked claims and requests are replaced by their bills and individual payments. Unpaid commitments and bills show current balances scheduled within the selected dates. Budget targets are full amounts and are not prorated or added together. Claim-register values include every status and are informational. Figures are not profit or a bank balance.'));
  doc.body.append(node('h2',`${REPORT_SECTIONS[report.section]} — ${report.total_count} exact source records`));
  table(['Date / type / status','Record / title','Original amount','Stored reporting amount','Category / tag','Income / paid / committed contribution','Claim-register value','Receipt / proof'],report.items.map(row=>[`${row.event_date}\n${REPORT_TYPES[row.record_type]}\n${row.status}`,`${row.title}\n${row.record_id}${row.parent_id?'\nParent '+row.parent_id:''}`,money(row.original_amount,row.currency),money(row.reporting_amount,row.reporting_currency),`${row.category_name || 'Budget scope'}\n${row.dimension_name || 'Workspace'}`,`${money(row.income_value,m.currency)} / ${money(row.paid_value,m.currency)} / ${money(row.commitment_value,m.currency)}`,money(row.claim_value,m.currency),row.receipt_state.replaceAll('_',' ')]));
  doc.body.append(node('small',`Snapshot ${report.fingerprint} · Private Business report. Exported records reflect the permissions and data verified at generation time.`));
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
  await refreshTransactions();
}

function openClaimForm(kind, existing = null) {
  if (!claimPermission("finance.create")) return;
  if ($("#businessAddDialog").open) $("#businessAddDialog").close();
  if ($("#businessClaimDetailDialog").open) $("#businessClaimDetailDialog").close();
  $("#businessClaimForm").reset();
  $("#businessClaimId").value = existing?.id || "";
  $("#businessClaimVersion").value = existing?.version || "";
  $("#businessClaimKind").value = kind;
  $('#businessEmployeeSourceField').classList.toggle('hidden', kind !== 'reimbursement');
  $('#businessEmployeeSource').required = kind === 'reimbursement';
  $('#businessEmployeeSource').value = existing?.employee_payment_source === 'unspecified' ? '' : existing?.employee_payment_source || '';
  $("#businessClaimDialogTitle").textContent = existing ? "Edit draft" : kind === "reimbursement" ? "New reimbursement claim" : "New company expense";
  $("#businessClaimDate").value = workspaceToday();
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
  const workspaceId = state.workspace.id, sequence=workspaceLoadSequence;
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
    const claim = await query("Save Business expense", supabase.rpc("save_business_expense_entry", {
      ...payload, p_claim_id: existingId || null,
      p_expected_version: existingId ? Number($("#businessClaimVersion").value) : null,
      p_kind: $("#businessClaimKind").value,
      p_employee_payment_source: $("#businessClaimKind").value === 'reimbursement' ? $('#businessEmployeeSource').value : 'unspecified'
    }));
    if(sequence!==workspaceLoadSequence||state.workspace?.id!==workspaceId)return;
    $("#businessClaimDialog").close();
    await refreshClaims();
    if (sequence===workspaceLoadSequence&&state.workspace?.id === workspaceId) openClaimDetail(claim.id);
  } catch (error) {
    if(sequence===workspaceLoadSequence)setClaimMessage("#businessClaimFormMessage", friendlyMessage(error), true);
  } finally { if(sequence===workspaceLoadSequence)claimBusy = false; }
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
    detailLine("Employee paid by", claim.kind === 'reimbursement' ? `${state.workspaceMembers.find((member) => member.user_id === claim.submitted_by)?.full_name || (own ? 'You' : 'Submitting member')} · ${sourceLabel(claim.employee_payment_source)}` : 'Not an employee reimbursement'),
    detailLine("Review", claim.review_reason || "—"),
    detailLine("Payment", claim.paid_at ? `${formatDate(claim.paid_at)} · ${claim.payment_reference} · ${sourceLabel(claim.payment_source)}` : "Not recorded")
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
    $('#claimPaymentSourceField').classList.toggle('hidden', action !== 'paid');
    $('#claimPaymentSource').value = '';
    $("#claimDecisionLabel").textContent = action === "paid" ? "Payment reference" : action === "rejected" ? "Reason for rejection" : "What needs to change?";
    $("#claimDecisionInput").value = "";
    $("#claimDecisionInput").maxLength = action === "paid" ? 160 : 1000;
    $("#claimDecisionPanel").classList.remove("hidden");
    $("#claimDecisionInput").focus();
    return;
  }
  const reason = confirmed && action !== "paid" ? $("#claimDecisionInput").value.trim() : null;
  const reference = confirmed && action === "paid" ? $("#claimDecisionInput").value.trim() : null;
  if (action === 'paid' && confirmed && !$('#claimPaymentSource').value) {
    setClaimMessage('#claimDetailMessage', 'Choose the company payment source.', true); return;
  }
  if (confirmed && (!reason && !reference)) {
    setClaimMessage("#claimDetailMessage", "Enter a reason or payment reference.", true);
    return;
  }
  claimBusy = true;
  try {
    const args = { p_workspace_id: claim.workspace_id, p_claim_id: claim.id, p_expected_version: claim.version };
    if (action === "submit") await query("Submit claim", supabase.rpc("submit_business_claim", args));
    else if (action === "paid") await query("Record payment", supabase.rpc("record_business_claim_payment_with_source", {
      ...args, p_paid_at: new Date().toISOString(), p_payment_reference: reference, p_payment_source: $('#claimPaymentSource').value
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
  await refreshTransactions();
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
      claimNode("small", "", `${formatDateTime(item.paid_at)} · ${item.reference} · ${sourceLabel(item.payment_source)}`));
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
    await query("Record bill payment", supabase.rpc("record_business_bill_payment_with_source", {
      p_workspace_id: bill.workspace_id, p_bill_id: bill.id,
      p_payment_id: paymentId, p_amount: Number($("#billPaymentAmount").value),
      p_paid_at: new Date().toISOString(), p_reference: $("#billPaymentReference").value, p_payment_source: $('#billPaymentSource').value
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
  $("#brandingBusinessName").value = profile?.trading_name || state.workspace?.name || "";
  renderBusinessBranding();
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
  const endOperation = window.MushavoPWA?.beginOperation?.();
  $("#businessOnboarding").querySelectorAll("button,input,select").forEach((button) => { button.disabled = true; });
  $$("[data-workspace-selector]").forEach((select) => { select.disabled = true; });
  try { await action(); }
  catch (error) {
    if (sequence === workspaceLoadSequence) setSetupMessage(friendlyMessage(error), true);
  }
  finally {
    setupBusy = false; endOperation?.();
    $("#businessOnboarding").querySelectorAll("button,input,select").forEach((button) => { button.disabled = false; });
    renderWorkspaceSelectors();
  }
}

async function saveBusinessBasics(event) {
  event.preventDefault();
  await withSetupBusy(async () => {
    if (!chosenCurrencies.size) throw new Error("Select at least one currency.");
    const workspaceId = state.workspace.id;
    const sequence = workspaceLoadSequence;
    const logoPath = await uploadBrandingDraft("setup");
    const saved = await query("Business setup", supabase.rpc("save_business_setup_with_branding", {
      p_logo_path: logoPath,
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
    applySavedBusinessBranding(saved.profile, "setup");
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

const BUSINESS_LOGO_BUCKET = 'business-logos';
let brandingBusy = false;
let brandingLoadKey = null;
const brandingDrafts = { setup: { token: 0 }, settings: { token: 0 } };

function businessInitials(name) {
  return String(name || 'Business').trim().split(/\s+/u).slice(0, 2).map(word => Array.from(word)[0] || '').join('').toLocaleUpperCase();
}
function paintBusinessMark(node, name, url) {
  node.replaceChildren();
  if (!url) { node.textContent = businessInitials(name); return; }
  const img = document.createElement('img'); img.alt = ''; img.src = url;
  img.addEventListener('error', () => { if (node.contains(img)) node.textContent = businessInitials(name); }, { once: true });
  node.append(img);
}
function resetBrandingDraft(scope) {
  const previous = brandingDrafts[scope];
  if (previous.preview) URL.revokeObjectURL(previous.preview);
  brandingDrafts[scope] = { token: previous.token + 1 };
  const input = $(`[data-logo-input="${scope}"]`); if (input) input.value = '';
}
function clearBusinessBranding() {
  resetBrandingDraft('setup'); resetBrandingDraft('settings');
  state.businessLogo = null; brandingLoadKey = null;
  setClaimMessage('#brandingMessage');
  for (const scope of ['setup','settings']) setClaimMessage(`[data-logo-message="${scope}"]`);
  $$('[data-business-name]').forEach(node => { node.textContent = 'Business'; });
  $$('[data-business-mark],[data-logo-preview]').forEach(node => node.replaceChildren());
}
function renderBusinessBranding() {
  const name = state.businessProfile?.trading_name || state.workspace?.name || 'Business';
  const path = !state.locked && state.businessProfile?.logo_storage_path;
  const cached = state.businessLogo;
  const url = cached?.workspaceId === state.workspace?.id && cached.path === path ? cached.url : null;
  $$('[data-business-name]').forEach(node => { node.textContent = name; node.title = name; });
  $$('[data-business-mark]').forEach(node => paintBusinessMark(node, name, url));
  for (const scope of ['setup', 'settings']) {
    const draft = brandingDrafts[scope];
    const node = $(`[data-logo-preview="${scope}"]`);
    if (node) paintBusinessMark(node, name, draft.remove ? null : draft.preview || url);
    const remove = $(`[data-logo-remove="${scope}"]`);
    if (remove) remove.disabled = brandingBusy || setupBusy || !(draft.file || path) || draft.remove;
  }
  $('#businessBrandingForm')?.classList.toggle('hidden', !businessOwnerCanSetUp());
  $$('[data-menu-role]').forEach(node => { node.textContent = formatRole(roleForWorkspace(state.workspace)); });
  $$('[data-menu-status]').forEach(node => { node.textContent = state.locked ? 'Access limited' : 'Active'; });
  if (path && (!url || cached.expiresAt < Date.now()) && (cached?.failedPath !== path || cached.expiresAt < Date.now())) void refreshBusinessLogo(path);
}
async function refreshBusinessLogo(path) {
  const workspaceId = state.workspace?.id, sequence = workspaceLoadSequence, userId = state.session?.user?.id;
  const key = `${userId}:${sequence}:${workspaceId}:${path}`;
  if (brandingLoadKey === key) return;
  brandingLoadKey = key;
  try {
    const signed = await query('Business logo', supabase.storage.from(BUSINESS_LOGO_BUCKET).createSignedUrl(path, 600));
    if (sequence !== workspaceLoadSequence || userId !== state.session?.user?.id || state.workspace?.id !== workspaceId || state.businessProfile?.logo_storage_path !== path) return;
    state.businessLogo = { workspaceId, path, url: signed.signedUrl, expiresAt: Date.now() + 540000 };
  } catch {
    if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId) return;
    state.businessLogo = { workspaceId, path, url: null, failedPath: path, expiresAt: Date.now() + 60000 };
  } finally { if (brandingLoadKey === key) brandingLoadKey = null; }
  if (sequence === workspaceLoadSequence && state.workspace?.id === workspaceId) renderBusinessBranding();
}
async function chooseBusinessLogo(scope) {
  const input = $(`[data-logo-input="${scope}"]`), file = input.files?.[0];
  if (!file) return;
  const sequence = workspaceLoadSequence, token = ++brandingDrafts[scope].token;
  try {
    if (!businessOwnerCanSetUp()) throw new Error('BUSINESS_ACTIVE_OWNER_REQUIRED');
    if (!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size < 1 || file.size > 2097152) throw new Error('Choose a PNG, JPG or WebP image up to 2 MB.');
    const bitmap = await createImageBitmap(file);
    const valid = bitmap.width > 0 && bitmap.height > 0 && bitmap.width <= 4096 && bitmap.height <= 4096;
    bitmap.close();
    if (!valid) throw new Error('Use a logo no larger than 4096 × 4096 pixels.');
    if (sequence !== workspaceLoadSequence || token !== brandingDrafts[scope].token) return;
    resetBrandingDraft(scope);
    brandingDrafts[scope].file = file; brandingDrafts[scope].preview = URL.createObjectURL(file);
    setClaimMessage(`[data-logo-message="${scope}"]`, 'Logo selected. Save your business details to apply it.');
    renderBusinessBranding();
  } catch (error) {
    if (sequence !== workspaceLoadSequence || token !== brandingDrafts[scope].token) return;
    input.value = ''; setClaimMessage(`[data-logo-message="${scope}"]`, friendlyMessage(error), true);
  }
}
async function uploadBrandingDraft(scope) {
  const draft = brandingDrafts[scope], workspaceId = state.workspace.id, userId = state.session.user.id, sequence = workspaceLoadSequence;
  if (draft.remove) return null;
  if (!draft.file) return state.businessProfile?.logo_storage_path || null;
  if (draft.uploadedPath) return draft.uploadedPath;
  const extension = { 'image/png':'png','image/jpeg':'jpg','image/webp':'webp' }[draft.file.type];
  const path = `${workspaceId}/${userId}/${crypto.randomUUID()}.${extension}`;
  await query('Upload Business logo', supabase.storage.from(BUSINESS_LOGO_BUCKET).upload(path, draft.file, { contentType: draft.file.type, upsert: false }));
  if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId || state.session?.user?.id !== userId) throw new Error('The workspace changed. Open its settings and try again.');
  draft.uploadedPath = path;
  return path;
}
function applySavedBusinessBranding(profile, scope) {
  const previousPath = state.businessProfile?.logo_storage_path;
  state.businessProfile = profile; state.workspace.name = profile.trading_name;
  state.workspaces = state.workspaces.map(workspace => workspace.id === profile.workspace_id ? { ...workspace, name: profile.trading_name } : workspace);
  state.businessLogo = null; resetBrandingDraft(scope);
  window.MushavoPWA?.markFormClean?.(scope === 'setup' ? '#businessBasicsForm' : '#businessBrandingForm');
  setClaimMessage(`[data-logo-message="${scope}"]`);
  renderIdentity(); renderWorkspaceSelectors();
  if (previousPath && previousPath !== profile.logo_storage_path) {
    // Never remove a newly uploaded file after an ambiguous submission response.
    // Only clean the old, unlinked file after a confirmed successful save.
    void supabase.storage.from(BUSINESS_LOGO_BUCKET).remove([previousPath]).catch(() => {});
  }
}
async function saveBusinessIdentity(event) {
  event.preventDefault();
  if (brandingBusy || !businessOwnerCanSetUp()) return;
  const sequence = workspaceLoadSequence, workspaceId = state.workspace.id, userId = state.session.user.id;
  brandingBusy = true; const endOperation = window.MushavoPWA?.beginOperation?.();
  $('#businessBrandingForm').querySelectorAll('button,input').forEach(node => { node.disabled = true; });
  try {
    const expectedVersion = state.businessProfile.version, name = $('#brandingBusinessName').value.trim();
    const path = await uploadBrandingDraft('settings');
    const saved = await query('Save Business identity', supabase.rpc('save_business_branding', { p_workspace_id: workspaceId, p_trading_name: name, p_logo_path: path, p_expected_version: expectedVersion }));
    if (sequence !== workspaceLoadSequence || state.workspace?.id !== workspaceId || state.session?.user?.id !== userId) return;
    applySavedBusinessBranding(saved, 'settings');
    setClaimMessage('#brandingMessage', 'Business name and logo saved.');
  } catch (error) { if (sequence === workspaceLoadSequence) setClaimMessage('#brandingMessage', friendlyMessage(error), true); }
  finally {
    brandingBusy = false; endOperation?.();
    $('#businessBrandingForm').querySelectorAll('button,input').forEach(node => { node.disabled = false; });
    if (sequence === workspaceLoadSequence) renderBusinessBranding();
  }
}
function openBusinessMenu() {
  renderBusinessBranding();
  const dialog = $('#businessMoreDialog');
  $$('[data-open-more]').forEach(button => button.setAttribute('aria-expanded','true'));
  if (!dialog.open) { dialog.showModal(); dialog.querySelector('.menu-scroll').scrollTop = 0; }
}

function renderIdentity() {
  renderBusinessBranding();
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
  $("#businessReportingCurrency").textContent = state.workspaceSettings?.reporting_currency || "—";
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
  const workspaceId=state.workspace?.id,sequence=workspaceLoadSequence;if(!workspaceId||state.locked)return;
  const snapshot = await query("Business team", supabase.rpc("business_team_snapshot", { p_workspace_id: workspaceId }));
  if(sequence!==workspaceLoadSequence||state.workspace?.id!==workspaceId)return;
  state.teamSnapshot=snapshot;
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

function businessBillingOwner() {
  return state.workspace?.owner_id === state.session?.user?.id && roleForWorkspace(state.workspace) === 'business_owner';
}
function renderBusinessBilling() {
  const owner = businessBillingOwner(), snapshot = owner ? state.billingSnapshot : null, config = snapshot?.settings;
  $('#businessBillingOwnerContent').classList.toggle('hidden',!snapshot);
  $('#businessBillingHistoryCard').classList.toggle('hidden',!snapshot);
  $('#subscriptionSeats').textContent = snapshot ? `${snapshot.current_limit} purchased · ${snapshot.usage} used or reserved` : 'Owner manages seats';
  const scheduled = snapshot?.renewal_scheduled;
  $('#businessNextCapacity').textContent = scheduled ? `${snapshot.subscription.business_next_member_limit} seats take effect ${formatDateTime(snapshot.subscription.business_next_effective_at)}. Invitations reserve the lower current/next capacity (${snapshot.invitation_limit}).` : '';
  const ready = owner && config?.pilot_enabled && config?.included_seats && !snapshot.suspended && !snapshot.pending && !scheduled;
  const hasPrice = period => config?.[period === 'annual' ? 'annual_base' : 'monthly_base'] != null && config?.[period === 'annual' ? 'annual_seat' : 'monthly_seat'] != null;
  $('#businessRenewSubscription').disabled = !ready || billingBusy || !['monthly','annual'].some(hasPrice);
  $('#businessBuySeats').disabled = !ready || billingBusy || state.locked || !hasPrice(state.workspaceSubscription?.billing_period) || snapshot?.current_limit>=100;
  $('#refreshBusinessBilling').disabled = !owner || billingBusy;
  $('#businessBillingAvailability').textContent = !owner ? 'Only the Business Owner can view billing and submit subscription payments.' : snapshot?.suspended ? 'This Business workspace is suspended. Contact the platform administrator. Payment cannot remove suspension.' : snapshot?.pending ? 'A payment is awaiting admin review. Access and capacity stay as currently approved until the review is complete.' : scheduled ? 'Your next term is already paid. Further changes will be available when that term starts.' : !config?.pilot_enabled || !['monthly','annual'].some(hasPrice) ? 'Pilot billing has not been configured. Contact the platform administrator; prices and included seats are not assumed.' : 'Get a quote to renew or purchase more seats. Extra seats use the current cycle and keep the same expiry date.';
  $('#businessBillingInstructions').textContent = config?.payment_instructions || 'Payment instructions are not configured yet.';
  const list = $('#businessBillingHistory');list.replaceChildren();
  for(const payment of snapshot?.history || []) {
    const card=claimNode('article',''),title=claimNode('strong','',`${payment.invoice_number} · ${payment.status.replaceAll('_',' ')}`);
    card.append(title,claimNode('strong','',money(payment.amount,payment.currency)),claimNode('small','',`${payment.kind==='extra_seats'?'Additional seats':payment.kind==='renewal'?'Subscription renewal':payment.kind==='purchase'?'Subscription purchase':'Subscription payment'} · ${payment.total_seats || payment.billable_member_count} total seats · ${payment.billing_period} · Submitted ${formatDateTime(payment.created_at)}`),claimNode('small','',`Payment ${formatDate(payment.payment_date)} · ${payment.payment_method} · Reference ${payment.reference_number}`));
    if(payment.term_start_at)card.append(claimNode('small','',`Term ${formatDateTime(payment.term_start_at)} – ${formatDateTime(payment.term_end_at)}`));
    if(payment.rejection_reason)card.append(claimNode('small','',`Review reason: ${payment.rejection_reason}`));
    if(payment.receipt_number){card.append(claimNode('small','',`Receipt ${payment.receipt_number} · Approved ${formatDateTime(payment.reviewed_at)}`));const print=claimNode('button','button secondary','Print / Save receipt PDF');print.type='button';print.dataset.billingReceipt=payment.id;card.append(print);}
    for(const proof of payment.proofs || []){const button=claimNode('button','button secondary',`View proof: ${proof.name}`);button.type='button';button.dataset.billingProof=proof.path;card.append(button);}
    list.append(card);
  }
  if(snapshot && !snapshot.history?.length)list.append(claimNode('p','muted-copy','No subscription payments submitted yet. Admin test grants do not create payment receipts.'));
  const total=snapshot?.history_count || 0;
  $('#businessBillingPage').textContent = total ? `${billingOffset+1}–${Math.min(billingOffset+20,total)} of ${total}` : '0 payments';
  $('#businessBillingPrevious').disabled = billingBusy || billingOffset===0;
  $('#businessBillingNext').disabled = billingBusy || billingOffset+20>=total;
}
async function refreshBusinessBilling() {
  if(!businessBillingOwner()) { state.billingSnapshot=null;renderBusinessBilling();return; }
  const workspaceId=state.workspace.id,sequence=workspaceLoadSequence,request=++billingSequence;
  try {
    const snapshot=await query('Business billing',supabase.rpc('business_billing_snapshot',{p_workspace_id:workspaceId,p_offset:billingOffset,p_limit:20}));
    if(sequence!==workspaceLoadSequence || request!==billingSequence)return;
    state.billingSnapshot=snapshot;state.workspaceSubscription=snapshot.subscription;
    // The latest subscription read is authoritative; do not retain an old entitlement expiry.
    if(state.workspaceEntitlement)state.workspaceEntitlement={...state.workspaceEntitlement,paid_through_at:snapshot.subscription.paid_through_at,effective_status:snapshot.suspended?'suspended':Date.parse(snapshot.subscription.paid_through_at)>Date.now()?'active':'expired'};
    const wasLocked=state.locked;renderSubscription();resolveWorkspaceLock();
    if(wasLocked&&!state.locked){await selectBusinessWorkspace(workspaceId);return;}
    renderRoute();setClaimMessage('#businessBillingMessage');
  } catch(error){if(sequence===workspaceLoadSequence && request===billingSequence){state.billingSnapshot=null;renderBusinessBilling();setClaimMessage('#businessBillingMessage',friendlyMessage(error),true);}}
}
function invalidateBusinessBillingQuote() {
  billingQuote=null;billingSubmissionId=null;$('#businessBillingQuoteCard').classList.add('hidden');setClaimMessage('#businessBillingQuoteMessage');
}
function openBusinessBillingDialog(kind) {
  if(!businessBillingOwner() || billingBusy || (kind==='extra_seats' ? $('#businessBuySeats').disabled : $('#businessRenewSubscription').disabled))return;
  billingAction=kind;invalidateBusinessBillingQuote();$('#businessBillingQuoteForm').reset();$('#businessBillingPaymentForm').reset();
  $('#businessBillingDialogTitle').textContent=kind==='extra_seats'?'Purchase more Business seats':'Renew Business subscription';
  $('#businessBillingDialogIntro').textContent=kind==='extra_seats'?'Additional seats are charged for the exact remaining portion of the current term. The expiry date stays the same.':'The next term starts at your current expiry, or at approval if your subscription has already expired. Seat quantity changes take effect when that next term starts.';
  $('#businessBillingQuantityLabel').textContent=kind==='extra_seats'?'Additional seats':'Total seats for next term';
  const config=state.billingSnapshot.settings,period=state.workspaceSubscription.billing_period || 'monthly';
  [...$('#businessBillingPeriod').options].forEach(option=>option.disabled=config[option.value==='annual'?'annual_base':'monthly_base']==null || config[option.value==='annual'?'annual_seat':'monthly_seat']==null);
  $('#businessBillingPeriod').value=[...$('#businessBillingPeriod').options].find(option=>option.value===period&&!option.disabled)?.value || [...$('#businessBillingPeriod').options].find(option=>!option.disabled)?.value;
  $('#businessBillingPeriod').disabled=kind==='extra_seats';
  $('#businessBillingQuantity').min=kind==='extra_seats'?1:Math.max(config.included_seats,state.billingSnapshot.usage);
  $('#businessBillingQuantity').max=kind==='extra_seats'?100-state.billingSnapshot.current_limit:100;
  $('#businessBillingQuantity').value=kind==='extra_seats'?1:Math.max(config.included_seats,state.billingSnapshot.current_limit,state.billingSnapshot.usage);
  $('#businessBillingPaymentDate').value=new Date().toISOString().slice(0,10);$('#businessBillingPaymentDate').max=new Date().toISOString().slice(0,10);
  $('#businessBillingDialog').showModal();
}
async function withBusinessBillingBusy(action) {
  if(billingBusy)return;
  const sequence=workspaceLoadSequence;billingBusy=true;renderBusinessBilling();
  $('#businessBillingDialog').querySelectorAll('button,input,select,textarea').forEach(node=>node.disabled=true);
  const finish=window.MushavoPWA?.beginOperation('business-subscription-payment');
  try{await action();}catch(error){if(sequence===workspaceLoadSequence)setClaimMessage('#businessBillingQuoteMessage',friendlyMessage(error),true);}
  finally{finish?.();if(sequence===workspaceLoadSequence){billingBusy=false;$('#businessBillingDialog').querySelectorAll('button,input,select,textarea').forEach(node=>node.disabled=false);$('#businessBillingPeriod').disabled=billingAction==='extra_seats';renderBusinessBilling();renderBusinessBillingQuote();}}
}
function renderBusinessBillingQuote() {
  const q=billingQuote;if(!q)return;
  const details=$('#businessBillingQuoteDetails');details.replaceChildren();
  const fields=[['Billing cycle',q.billing_period],['Total seats',q.total_seats],['Included seats',q.included_seats],['Base term price',money(q.base_amount,q.currency)],['Additional-seat price for full cycle',money(q.seat_price,q.currency)]];
  if(q.kind==='extra_seats')fields.push(['Adding seats',q.additional_seats],['Remaining term',`${(Number(q.remaining_seconds)/86400).toFixed(2)} of ${(Number(q.term_seconds)/86400).toFixed(2)} days (${(Number(q.fraction)*100).toFixed(4)}%)`],['Same expiry date',formatDateTime(q.term_end_at)]);
  else fields.push(['Next term (estimated)',`${formatDateTime(q.term_start_at)} – ${formatDateTime(q.term_end_at)}`]);
  fields.push(['Total to pay',money(q.amount,q.currency)]);
  for(const [label,value] of fields){const line=claimNode('div','');line.append(claimNode('dt','',label),claimNode('dd','',String(value)));details.append(line);}
  $('#businessBillingQuoteInstructions').textContent=q.payment_instructions;
  const expired=Date.parse(q.expires_at)<=Date.now();
  $('#businessBillingQuoteExpiry').textContent=expired?'This quote has expired. Get a fresh quote before submitting.':`Quote valid until ${formatDateTime(q.expires_at)}. Amounts are locked for 30 minutes; admin review is required.`;
  const noCharge=Number(q.amount)===0;
  ['#businessBillingPaymentMethod','#businessBillingPaymentDate','#businessBillingPaymentReference'].forEach(selector=>{$(selector).required=!noCharge;$(selector).disabled=noCharge||billingBusy;});
  $('#businessBillingPaymentProof').disabled=noCharge||billingBusy;
  $('#submitBusinessBillingPayment').disabled=expired||billingBusy;
  $('#submitBusinessBillingPayment').textContent=noCharge?'Request no-charge admin approval':'Submit for admin review';
  $('#businessBillingQuoteCard').classList.remove('hidden');
}
async function getBusinessBillingQuote(event) {
  event.preventDefault();const workspaceId=state.workspace.id,sequence=workspaceLoadSequence;
  const args={p_workspace_id:workspaceId,p_kind:billingAction,p_billing_period:$('#businessBillingPeriod').value,p_quantity:Number($('#businessBillingQuantity').value)};
  await withBusinessBillingBusy(async()=>{
    const quote=await query('Business subscription quote',supabase.rpc('business_subscription_quote',args));
    if(sequence!==workspaceLoadSequence)return;
    billingQuote=quote;billingSubmissionId=crypto.randomUUID();$('#businessBillingPaymentForm').reset();$('#businessBillingPaymentDate').value=new Date().toISOString().slice(0,10);setClaimMessage('#businessBillingQuoteMessage');renderBusinessBillingQuote();
  });
}
async function submitBusinessBillingPayment(event) {
  event.preventDefault();if(!billingQuote || Date.parse(billingQuote.expires_at)<=Date.now())return;
  const quote=billingQuote,workspaceId=state.workspace.id,sequence=workspaceLoadSequence,submissionId=billingSubmissionId;
  const proof=$('#businessBillingPaymentProof').files[0];
  const args={p_workspace_id:workspaceId,p_quote_id:quote.id,p_payment_id:submissionId,p_payment_method:$('#businessBillingPaymentMethod').value,p_payment_date:$('#businessBillingPaymentDate').value || null,p_reference_number:$('#businessBillingPaymentReference').value,p_notes:$('#businessBillingPaymentNotes').value};
  await withBusinessBillingBusy(async()=>{
    let path=null,submitted=false;
    try{
      if(proof){if(!['image/jpeg','image/png','image/webp','application/pdf'].includes(proof.type) || proof.size<1 || proof.size>10485760)throw new Error('Use a JPG, PNG, WEBP or PDF payment proof up to 10 MB.');
        path=`workspaces/${workspaceId}/${state.session.user.id}/${crypto.randomUUID()}.${proof.type==='application/pdf'?'pdf':proof.type.split('/')[1]}`;
        await query('Business payment proof upload',supabase.storage.from('subscription-proofs').upload(path,proof,{contentType:proof.type,upsert:false}));
        args.p_proof_path=path;args.p_proof_name=proof.name;args.p_proof_mime_type=proof.type;args.p_proof_size_bytes=proof.size;
      }
      if(sequence!==workspaceLoadSequence)return;
      await query('Business subscription payment',supabase.rpc('submit_business_subscription_payment',args));submitted=true;
      if(sequence!==workspaceLoadSequence)return;
      $('#businessBillingDialog').close();invalidateBusinessBillingQuote();billingOffset=0;await refreshBusinessBilling();setClaimMessage('#businessBillingMessage','Submitted for admin review. Your existing access and seats remain unchanged until approval.');
    }finally{if(path&&!submitted)await supabase.storage.from('subscription-proofs').remove([path]).catch(()=>{});}
  });
}
async function openBusinessBillingProof(path) {
  if(!businessBillingOwner() || !(state.billingSnapshot?.history || []).some(row=>(row.proofs || []).some(proof=>proof.path===path)))return;
  const sequence=workspaceLoadSequence;
  try{const signed=await query('Subscription proof',supabase.storage.from('subscription-proofs').createSignedUrl(path,60));if(sequence===workspaceLoadSequence)window.open(signed.signedUrl,'_blank','noopener,noreferrer');}
  catch(error){if(sequence===workspaceLoadSequence)setClaimMessage('#businessBillingMessage',friendlyMessage(error),true);}
}
async function printBusinessBillingReceipt(id) {
  if(!businessBillingOwner())return;
  const sequence=workspaceLoadSequence,workspaceId=state.workspace.id,popup=window.open('about:blank','_blank');
  if(!popup){setClaimMessage('#businessBillingMessage','Allow a popup to print the receipt.',true);return;}
  popup.opener=null;billingPrintWindow=popup;popup.document.body.textContent='Verifying receipt…';
  try{
    const snapshot=await query('Subscription receipt',supabase.rpc('business_billing_snapshot',{p_workspace_id:workspaceId,p_offset:billingOffset,p_limit:20}));
    if(sequence!==workspaceLoadSequence){popup.close();return;}
    const receipt=snapshot.history.find(row=>row.id===id && row.status==='approved');if(!receipt)throw new Error('Refresh billing history and select the approved receipt again.');
    const doc=popup.document,node=(tag,text)=>{const item=doc.createElement(tag);item.textContent=text;return item};doc.title=receipt.receipt_number;doc.body.replaceChildren();
    const style=doc.createElement('style');style.textContent='body{font:16px system-ui;color:#183438;margin:40px}p{line-height:1.7;overflow-wrap:anywhere}button{padding:12px}@media print{button{display:none}}';doc.head.append(style);
    const print=node('button','Print / Save PDF');print.addEventListener('click',()=>popup.print());doc.body.append(print,node('h1','Mushavo Business subscription receipt'),node('h2',receipt.receipt_number));
    for(const text of [state.workspace.name,`Invoice ${receipt.invoice_number}`,`${money(receipt.amount,receipt.currency)} · ${receipt.payment_method}`,`Payment ${formatDate(receipt.payment_date)} · Reference ${receipt.reference_number}`,`${receipt.kind==='extra_seats'?'Additional capacity':'Renewal'} · ${receipt.total_seats || receipt.billable_member_count} seats · ${receipt.billing_period}`,`Approved term ${formatDateTime(receipt.term_start_at)} – ${formatDateTime(receipt.term_end_at)}`])doc.body.append(node('p',text));
  }catch(error){popup.close();if(sequence===workspaceLoadSequence)setClaimMessage('#businessBillingMessage',friendlyMessage(error),true);}
  finally{if(sequence===workspaceLoadSequence)billingPrintWindow=null;}
}

function renderSubscription() {
  const subscription = state.workspaceSubscription;
  const entitlement = state.workspaceEntitlement;
  const status = entitlement?.effective_status || subscription?.status || "coming soon";
  $("#subscriptionPlanName").textContent = entitlement?.plan_name || state.billingSnapshot?.plan_name || "Business";
  $("#subscriptionState").textContent = status.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
  $("#subscriptionStart").textContent = formatDate(subscription?.entitlement_start_at);
  $("#subscriptionBilling").textContent = subscription?.billing_period
    ? subscription.billing_period.replace(/\b\w/g, (letter) => letter.toUpperCase())
    : "Not available";
  $("#subscriptionExpiry").textContent = formatDate(subscription?.paid_through_at || entitlement?.paid_through_at);
  $("#subscriptionCountdown").textContent = subscription ? countdown(subscription.paid_through_at || entitlement?.paid_through_at) : "Launch pending";
  renderBusinessBilling();
}

function resolveWorkspaceLock() {
  const subscription=state.workspaceSubscription;
  const status=state.workspaceEntitlement?.effective_status || subscription?.status;
  const suspended=state.workspace?.status==='suspended' || subscription?.status==='suspended' || status==='suspended';
  state.locked=suspended || !subscription?.paid_through_at || !Number.isFinite(Date.parse(subscription.paid_through_at)) || Date.parse(subscription.paid_through_at)<=Date.now() || status==='expired';
  state.lockOwner=businessBillingOwner();
  $('#businessLock').classList.toggle('hidden',!state.locked);
  $$('[data-open-add]').forEach(button=>button.disabled=state.locked);
  if(!state.locked)return;
  if(state.lockOwner){
    $('#businessLockTitle').textContent=suspended?'Business workspace suspended':'Renew your Business subscription';
    $('#businessLockMessage').textContent=suspended?'An administrator must restore this workspace. Submitting or approving a payment cannot remove suspension.':'Your Business subscription has expired. You can view billing and submit renewal; operational finance remains locked until approval.';
    $('#businessRenewalButton').classList.toggle('hidden',suspended);state.tab='subscription';
  }else{
    $('#businessLockTitle').textContent=suspended?'Business workspace suspended':'Business subscription expired';
    $('#businessLockMessage').textContent=suspended?'This Business workspace has been suspended. Contact the Business Owner.':'This Business subscription has expired. Contact the Business Owner.';
    $('#businessRenewalButton').classList.add('hidden');
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
  $$("[data-business-nav]").forEach((link) => { link.classList.toggle("active", link.dataset.businessNav === tab); if (link.dataset.businessNav === tab) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current"); });
  if (window.location.hash !== `#business/${tab}`) setWorkspaceUrl(state.workspace.id);
  document.title = `${title} | ${state.businessProfile?.trading_name || state.workspace?.name || "Business"} · Mushavo Budget`;
  if (tab==='reports' && !reportAttempted && !reportLoading && claimPermission('reports.view')) refreshBusinessReports();
}

function renderBusinessWorkspace() {
  renderWorkspaceSelectors();
  renderIdentity();
  renderTeam();
  renderSubscription();
  resolveWorkspaceLock();
  renderClaims();
  renderBills();
  renderReportAccess();
  renderPlanning();
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
  [subscriptions,entitlements]=await Promise.all([
    query('Business subscription load',supabase.from('workspace_subscriptions').select('*').eq('workspace_id',workspace.id).limit(1)),
    query('Business entitlement load',supabase.rpc('effective_workspace_entitlement',{p_workspace_id:workspace.id}))
  ]);
  if(requestSequence!==workspaceLoadSequence)return;
  state.workspaceSubscription=subscriptions[0] || null;state.workspaceEntitlement=entitlements[0] || null;resolveWorkspaceLock();
  if(state.locked){renderBusinessWorkspace();if(state.lockOwner)await refreshBusinessBilling();if(requestSequence===workspaceLoadSequence)startBusinessRealtime();return;}
  try {
    const memberId=state.memberships.find(item=>item.workspace_id===workspace.id && item.user_id===state.session.user.id)?.id;
    [settings,team,profiles,categories,dimensions,drafts,permissions,memberScopes]=await Promise.all([
      query('Business settings load',supabase.from('workspace_settings').select('*').eq('workspace_id',workspace.id).maybeSingle()),
      query('Business team load',supabase.rpc('business_team_snapshot',{p_workspace_id:workspace.id})),
      query('Business identity load',supabase.from('business_profiles').select('*').eq('workspace_id',workspace.id).maybeSingle()),
      query('Business category load',supabase.from('business_categories').select('*').eq('workspace_id',workspace.id).order('name')),
      query('Business tag load',supabase.from('business_dimensions').select('*').eq('workspace_id',workspace.id).order('name')),
      query('Business first draft load',supabase.from('business_setup_drafts').select('*').eq('workspace_id',workspace.id).maybeSingle()),
      query('Business permissions load',supabase.rpc('business_effective_permissions',{p_workspace_id:workspace.id})),
      memberId?query('Business assigned scope load',supabase.from('business_member_scopes').select('dimension_id').eq('workspace_id',workspace.id).eq('member_id',memberId)):Promise.resolve([])
    ]);
  }catch(error){if(requestSequence!==workspaceLoadSequence)return;throw error;}

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
  prepareBusinessReports();
  renderBusinessWorkspace();
  populateActivityFilters();
  if(businessBillingOwner())await refreshBusinessBilling();
  if(requestSequence!==workspaceLoadSequence)return;
  if (!state.locked) {
    await refreshClaims();
    await refreshBills();
  }
  if(requestSequence===workspaceLoadSequence)startBusinessRealtime();
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
$$('[data-open-add]').forEach((button) => button.addEventListener("click", () => { if(!state.locked)$("#businessAddDialog").showModal(); }));
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
$$('[data-payment-sources]').forEach((select) => {
  select.replaceChildren(new Option(select.hasAttribute('data-source-all') ? 'All sources' : 'Choose payment source', ''), ...Object.entries(PAYMENT_SOURCES).filter(([value]) => value !== 'unspecified' || select.hasAttribute('data-source-all')).map(([value, label]) => new Option(label, value)));
});
$$('[data-open-income]').forEach((button) => button.addEventListener('click', openIncomeForm));
$$('[data-close-income]').forEach((button) => button.addEventListener('click', () => $('#businessIncomeDialog').close()));
$$('[data-close-income-detail]').forEach((button) => button.addEventListener('click', () => $('#businessIncomeDetailDialog').close()));
$('#businessIncomeDetailDialog').addEventListener('close', () => { openedIncome = null; });
$('#businessIncomeForm').addEventListener('submit', saveIncome);
$('#incomeVoidForm').addEventListener('submit', voidIncome);
$$('[data-open-request]').forEach((button) => button.addEventListener('click', () => openRequestForm()));
$$('[data-close-request]').forEach((button) => button.addEventListener('click', () => $('#businessRequestDialog').close()));
$$('[data-close-request-detail]').forEach((button) => button.addEventListener('click', () => $('#businessRequestDetailDialog').close()));
$('#businessRequestDetailDialog').addEventListener('close', () => { if (!$('#businessRequestDetailDialog').open && !openedRequest?.loading) openedRequest = null; });
$('#businessRequestForm').addEventListener('submit', saveRequest);
$('#businessRequestList').addEventListener('click', (event) => { const button = event.target.closest('[data-request-id]'); if (button) openRequestDetail(button.dataset.requestId); });
$('#requestDetailActions').addEventListener('click', (event) => { const button = event.target.closest('[data-request-action]'); if (button) requestAction(button.dataset.requestAction); });
$('#requestDecisionForm').addEventListener('submit', (event) => { event.preventDefault(); requestAction(event.currentTarget.dataset.action, true); });
$('#requestBillForm').addEventListener('submit', createRequestBill);
$('#businessRequestFilters').addEventListener('submit', (event) => { event.preventDefault(); requestOffset = 0; requestFilters = Object.fromEntries([...new FormData(event.currentTarget)].map(([key,value]) => [`p_${key}`, value])); refreshPlanning(); });
$('#businessRequestReset').addEventListener('click', () => { $('#businessRequestFilters').reset(); requestFilters = {}; requestOffset = 0; refreshPlanning(); });
$('#businessRequestPrevious').addEventListener('click', () => { requestOffset = Math.max(0, requestOffset-50); refreshPlanning(); });
$('#businessRequestNext').addEventListener('click', () => { requestOffset += 50; refreshPlanning(); });
$('#createBusinessBudget').addEventListener('click', () => openBudgetForm());
$$('[data-close-budget]').forEach((button) => button.addEventListener('click', () => $('#businessBudgetDialog').close()));
$$('[data-close-budget-detail]').forEach((button) => button.addEventListener('click', () => $('#businessBudgetDetailDialog').close()));
$('#businessBudgetDetailDialog').addEventListener('close', () => { if (!$('#businessBudgetDetailDialog').open && !openedBudget?.loading) openedBudget = null; });
$('#businessBudgetForm').addEventListener('submit', saveBudget);
$('#budgetPeriodType').addEventListener('change', renderBudgetPeriod);
$('#budgetMonth').addEventListener('change', renderBudgetPeriod);
$('#businessBudgetList').addEventListener('click', (event) => { const button = event.target.closest('[data-budget-id]'); if (button) openBudgetDetail(button.dataset.budgetId); });
$('#budgetDetailActions').addEventListener('click', (event) => { const button = event.target.closest('[data-budget-action]'); if (button) budgetAction(button.dataset.budgetAction); });
$('#budgetDecisionForm').addEventListener('submit', (event) => { event.preventDefault(); budgetAction(event.currentTarget.dataset.status, true); });
$('#businessBudgetStatus').addEventListener('change', () => { budgetOffset = 0; refreshPlanning(); });
$('#businessBudgetPrevious').addEventListener('click', () => { budgetOffset = Math.max(0,budgetOffset-50); refreshPlanning(); });
$('#businessBudgetNext').addEventListener('click', () => { budgetOffset += 50; refreshPlanning(); });
$('#budgetSourcePrevious').addEventListener('click', () => { budgetSourceOffset = Math.max(0,budgetSourceOffset-50); if (openedBudget) openBudgetDetail(openedBudget.id,false); });
$('#budgetSourceNext').addEventListener('click', () => { budgetSourceOffset += 50; if (openedBudget) openBudgetDetail(openedBudget.id,false); });
$('#businessWorkflowPermissionForm').addEventListener('submit', saveWorkflowPermission);
$('#workflowPermissionRole').addEventListener('change', renderWorkflowPermission);
$('#workflowPermissionCode').addEventListener('change', renderWorkflowPermission);
$('#reportPeriod').addEventListener('change',renderReportPeriod);
$('#reportCurrencyMode').addEventListener('change',renderReportCurrency);
['#reportFrom','#reportTo'].forEach(selector=>$(selector).addEventListener('change',()=>{$('#reportPeriod').value='custom';}));
$('#businessReportFilters').addEventListener('submit',event=>{event.preventDefault();reportFilters=readBusinessReportFilters();refreshBusinessReports();});
$('#refreshBusinessReports').addEventListener('click',refreshBusinessReports);
$('#businessReportContent').addEventListener('click',event=>{const button=event.target.closest('[data-report-section]');if(button)openBusinessReportSources({section:button.dataset.reportSection,groupType:button.dataset.reportGroupType,groupId:button.dataset.reportGroupId,budgetId:button.dataset.reportBudgetId});});
$$('[data-close-report-sources]').forEach(button=>button.addEventListener('click',()=>$('#businessReportSourcesDialog').close()));
$$('[data-close-report-record]').forEach(button=>button.addEventListener('click',()=>$('#businessReportRecordDialog').close()));
$('#reportSourceList').addEventListener('click',event=>{const button=event.target.closest('[data-report-entry-key]');if(button)showBusinessReportRecord(button.dataset.reportEntryKey);});
$('#reportSourcePrevious').addEventListener('click',()=>{reportSourceOffset=Math.max(0,reportSourceOffset-50);if(reportSelection)openBusinessReportSources(reportSelection,false);});
$('#reportSourceNext').addEventListener('click',()=>{reportSourceOffset+=50;if(reportSelection)openBusinessReportSources(reportSelection,false);});
$('#openReportOriginal').addEventListener('click',()=>{const row=openedReportRecord;if(row?.can_open&&!state.locked&&!state.reportStale){$('#businessReportRecordDialog').close();$('#businessReportSourcesDialog').close();openBusinessSource(row,'#businessReportMessage');}});
$('#exportBusinessReportCSV').addEventListener('click',()=>exportBusinessReport('csv'));
$('#printBusinessReport').addEventListener('click',()=>exportBusinessReport('print'));
$('#exportReportSourcesCSV').addEventListener('click',()=>{if(reportSelection)exportBusinessReport('csv',reportSelection)});
$('#printReportSources').addEventListener('click',()=>{if(reportSelection)exportBusinessReport('print',reportSelection)});
$('#businessActivityFilters').addEventListener('submit', (event) => {
  event.preventDefault(); activityOffset = 0;
  activityFilters = Object.fromEntries([...new FormData(event.currentTarget)].map(([key, value]) => [`p_${key}`, ['category_id', 'dimension_id', 'from', 'to'].includes(key) ? value || null : value]));
  refreshTransactions(false);
});
$('#businessActivityReset').addEventListener('click', () => { $('#businessActivityFilters').reset(); activityFilters = {}; activityOffset = 0; refreshTransactions(false); });
$('#businessActivityPrevious').addEventListener('click', () => { activityOffset = Math.max(0, activityOffset - 50); refreshTransactions(false); });
$('#businessActivityNext').addEventListener('click', () => { activityOffset += 50; refreshTransactions(false); });
['#businessOverviewClaims', '#businessClaimActivity'].forEach((selector) => $(selector).addEventListener('click', (event) => {
  const button = event.target.closest('[data-transaction-key]'); if (button) openTransactionRecord(button.dataset.transactionKey);
}));
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
$$('[data-open-more]').forEach((button) => button.addEventListener("click", () => openBusinessMenu()));
$('#businessBrandingForm').addEventListener('submit', saveBusinessIdentity);
$$('[data-logo-input]').forEach(input => input.addEventListener('change', () => chooseBusinessLogo(input.dataset.logoInput)));
$$('[data-logo-remove]').forEach(button => button.addEventListener('click', () => {
  const scope = button.dataset.logoRemove;
  if (!businessOwnerCanSetUp() || brandingBusy || setupBusy) return;
  $(`[data-logo-input="${scope}"]`).dispatchEvent(new Event('change', { bubbles: true }));
  resetBrandingDraft(scope); brandingDrafts[scope].remove = true;
  setClaimMessage(`[data-logo-message="${scope}"]`, 'Logo will be removed when you save.'); renderBusinessBranding();
}));
$$('[data-open-more]').forEach(button => { button.setAttribute('aria-controls','businessMoreDialog'); button.setAttribute('aria-expanded','false'); button.setAttribute('aria-haspopup','dialog'); });
$('#businessMoreDialog').addEventListener('close', () => $$('[data-open-more]').forEach(button => button.setAttribute('aria-expanded','false')));
$('#businessMoreDialog').addEventListener('click', event => { const box = event.currentTarget.getBoundingClientRect(); if (event.target === event.currentTarget && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) event.currentTarget.close(); });
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

$('#businessRenewSubscription').addEventListener('click',()=>openBusinessBillingDialog('renewal'));
$('#businessBuySeats').addEventListener('click',()=>openBusinessBillingDialog('extra_seats'));
$('#businessRenewalButton').addEventListener('click',()=>{window.location.hash='#business/subscription';$('#businessMain')?.focus({preventScroll:true});});
$('#refreshBusinessBilling').addEventListener('click',refreshBusinessBilling);
$('#businessBillingQuoteForm').addEventListener('submit',getBusinessBillingQuote);
$('#businessBillingQuoteForm').addEventListener('change',invalidateBusinessBillingQuote);
$('#businessBillingPaymentForm').addEventListener('submit',submitBusinessBillingPayment);
$$('[data-close-billing-dialog]').forEach(button=>button.addEventListener('click',()=>$('#businessBillingDialog').close()));
$('#businessBillingPrevious').addEventListener('click',()=>{billingOffset=Math.max(0,billingOffset-20);refreshBusinessBilling();});
$('#businessBillingNext').addEventListener('click',()=>{billingOffset+=20;refreshBusinessBilling();});
$('#businessBillingHistory').addEventListener('click',event=>{const proof=event.target.closest('[data-billing-proof]'),receipt=event.target.closest('[data-billing-receipt]');if(proof)openBusinessBillingProof(proof.dataset.billingProof);if(receipt)printBusinessBillingReceipt(receipt.dataset.billingReceipt);});
function enforceBusinessExpiry() {
  if(!state.workspace)return;
  const wasLocked=state.locked;resolveWorkspaceLock();
  if(!wasLocked&&state.locked){
    const workspaceId=state.workspace.id,subscription=state.workspaceSubscription,entitlement=state.workspaceEntitlement,workspace=state.workspace;
    clearBusinessWorkspaceState();state.workspace=workspace;state.workspaceSubscription=subscription;state.workspaceEntitlement=entitlement;resolveWorkspaceLock();renderBusinessWorkspace();
    if(state.lockOwner)refreshBusinessBilling();
    startBusinessRealtime();
  }
  if(billingQuote)renderBusinessBillingQuote();
  if(state.workspaceSubscription)$('#subscriptionCountdown').textContent=countdown(state.workspaceSubscription.paid_through_at);
}
let businessLiveChannel=null,businessLiveEpoch=0,businessLiveTimer=null,businessLivePending=false,businessLiveAccess=false,businessLiveBusy=false,businessLiveWorkspace=null,businessLiveAccessVersion=null;
function stopBusinessRealtime() {
  businessLiveEpoch++;clearTimeout(businessLiveTimer);businessLiveTimer=null;
  const channel=businessLiveChannel;businessLiveChannel=null;businessLiveWorkspace=null;businessLiveAccessVersion=null;
  businessLivePending=false;businessLiveAccess=false;businessLiveBusy=false;
  if(channel&&supabase?.removeChannel)Promise.resolve(supabase.removeChannel(channel)).catch(()=>{});
  $('#businessLiveBanner')?.classList.add('hidden');
}
function businessLiveEditing() {
  return brandingBusy||setupBusy||teamBusy||claimBusy||billBusy||incomeBusy||workflowBusy||billingBusy||reportExportBusy||setupOpen
    ||Boolean($$('dialog[open]').length)||Boolean(window.MushavoPWA?.hasUnsavedChanges?.());
}
function queueBusinessLiveRefresh(access=false) {
  if(!state.workspace)return;
  businessLivePending=true;businessLiveAccess=businessLiveAccess||access;
  if(state.reportSnapshot){state.reportStale=true;renderReportAccess();}
  $('#businessLiveBanner')?.classList.remove('hidden');
  $('#businessLiveMessage').textContent=access?'Business access changed. Checking permissions…':'Business updates are available. Open forms are kept until you finish.';
  clearTimeout(businessLiveTimer);businessLiveTimer=setTimeout(flushBusinessLiveRefresh,750);
}
async function flushBusinessLiveRefresh() {
  businessLiveTimer=null;
  if(!businessLivePending||!state.workspace||document.hidden||!navigator.onLine)return;
  if(businessLiveBusy||businessAccessCheckBusy||(!businessLiveAccess&&businessLiveEditing())){
    businessLiveTimer=setTimeout(flushBusinessLiveRefresh,1500);return;
  }
  const epoch=businessLiveEpoch,workspaceId=state.workspace.id,sequence=workspaceLoadSequence,access=businessLiveAccess;
  businessLivePending=false;businessLiveAccess=false;businessLiveBusy=true;
  try {
    await refreshBusinessAccessState();
    if(epoch!==businessLiveEpoch||sequence!==workspaceLoadSequence||state.workspace?.id!==workspaceId)return;
    if(access){try{await selectBusinessWorkspace(workspaceId);}catch(error){if(state.workspace?.id===workspaceId){$('#businessErrorMessage').textContent=friendlyMessage(error);showOnly('businessError');}}return;}
    if(state.locked){if(businessBillingOwner())await refreshBusinessBilling();}
    else {
      const [categories,dimensions]=await Promise.all([query('Live categories',supabase.from('business_categories').select('*').eq('workspace_id',workspaceId).order('name')),query('Live organisation tags',supabase.from('business_dimensions').select('*').eq('workspace_id',workspaceId).order('name'))]);
      if(epoch!==businessLiveEpoch||sequence!==workspaceLoadSequence)return;
      state.businessCategories=categories;state.businessDimensions=dimensions;
      await refreshClaims();
      if(epoch!==businessLiveEpoch||sequence!==workspaceLoadSequence)return;
      await refreshBills();
      if(epoch!==businessLiveEpoch||sequence!==workspaceLoadSequence)return;
      await refreshBusinessTeam();
      if(businessBillingOwner())await refreshBusinessBilling();
    }
    if(epoch===businessLiveEpoch&&!businessLivePending)$('#businessLiveBanner')?.classList.add('hidden');
  }catch(error){
    if(epoch===businessLiveEpoch){businessLivePending=true;$('#businessLiveMessage').textContent='Live refresh failed. Your changes are kept. Try Refresh when connected.';}
  }finally{
    if(epoch===businessLiveEpoch){businessLiveBusy=false;if(businessLivePending&&!businessLiveTimer)businessLiveTimer=setTimeout(flushBusinessLiveRefresh,5000);}
  }
}
function startBusinessRealtime() {
  if(!state.workspace||!state.session||!supabase?.channel)return;
  const workspaceId=state.workspace.id;
  if(businessLiveWorkspace===workspaceId&&businessLiveChannel)return;
  stopBusinessRealtime();businessLiveWorkspace=workspaceId;
  const epoch=businessLiveEpoch,sequence=workspaceLoadSequence;
  const valid=()=>epoch===businessLiveEpoch&&sequence===workspaceLoadSequence&&state.workspace?.id===workspaceId;
  const changed=payload=>{
    if(!valid())return;
    // Use counters only. Operational data is always fetched through normal RLS/RPCs.
    const version=payload.new?.access_version;
    const access=businessLiveAccessVersion===null||version!==businessLiveAccessVersion;
    businessLiveAccessVersion=version;queueBusinessLiveRefresh(access);
  };
  const channel=supabase.channel(`business:${state.session.user.id}:${workspaceId}:${epoch}`);
  businessLiveChannel=channel;
  channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'business_change_signals',filter:`workspace_id=eq.${workspaceId}`},changed)
    .on('postgres_changes',{event:'UPDATE',schema:'public',table:'business_change_signals',filter:`workspace_id=eq.${workspaceId}`},changed)
    .subscribe(status=>{
      if(!valid())return;
      if(status==='SUBSCRIBED'){
        // Always catch up after connecting/reconnecting, including missed changes.
        queueBusinessLiveRefresh(false);
        query('Business change version',supabase.from('business_change_signals').select('access_version').eq('workspace_id',workspaceId).maybeSingle())
          .then(row=>{if(valid()&&businessLiveAccessVersion===null)businessLiveAccessVersion=row?.access_version??null;}).catch(()=>{});
      }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(status)){
        $('#businessLiveBanner')?.classList.remove('hidden');$('#businessLiveMessage').textContent='Live connection interrupted. Access checks continue; use Refresh to catch up.';
      }
    });
}
$('#refreshBusinessLive').addEventListener('click',()=>{queueBusinessLiveRefresh(false);flushBusinessLiveRefresh();});
window.addEventListener('online',()=>{if(state.workspace){startBusinessRealtime();queueBusinessLiveRefresh(false);}});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&businessLivePending)flushBusinessLiveRefresh();});

let businessAccessCheckBusy=false;
async function refreshBusinessAccessState() {
  if(!state.workspace || businessAccessCheckBusy)return;
  const workspaceId=state.workspace.id,sequence=workspaceLoadSequence,wasLocked=state.locked;businessAccessCheckBusy=true;
  try{
    const suspended=await query('Account access check',supabase.rpc('my_account_suspended'));
    if(sequence!==workspaceLoadSequence)return;
    if(suspended){clearBusinessWorkspaceState();showOnly('businessSuspended');return;}
    const [subscriptions,entitlements,workspace,membership]=await Promise.all([
      query('Business access subscription',supabase.from('workspace_subscriptions').select('*').eq('workspace_id',workspaceId).limit(1)),
      query('Business access entitlement',supabase.rpc('effective_workspace_entitlement',{p_workspace_id:workspaceId})),
      query('Business workspace access',supabase.from('budget_workspaces').select('*').eq('id',workspaceId).maybeSingle()),
      query('Business membership access',supabase.from('workspace_members').select('*').eq('workspace_id',workspaceId).eq('user_id',state.session.user.id).eq('status','active').maybeSingle())
    ]);
    if(sequence!==workspaceLoadSequence)return;
    if(!subscriptions[0] || !entitlements[0] || !workspace || !membership || workspace.status==='closed'){
      state.workspaces=state.workspaces.filter(item=>item.id!==workspaceId);clearBusinessWorkspaceState();showOnly('businessEmpty');return;
    }
    const previousRole=roleForWorkspace(state.workspace);
    state.workspaces=state.workspaces.map(item=>item.id===workspaceId?workspace:item);
    state.memberships=state.memberships.filter(item=>!(item.workspace_id===workspaceId&&item.user_id===state.session.user.id));state.memberships.push(membership);
    state.workspaceSubscription=subscriptions[0];state.workspaceEntitlement=entitlements[0];state.workspace=workspace;
    if(previousRole!==membership.role){await selectBusinessWorkspace(workspaceId);return;}
    if(!businessBillingOwner()){state.billingSnapshot=null;invalidateBusinessBillingQuote();if($('#businessBillingDialog').open)$('#businessBillingDialog').close();renderBusinessBilling();}
    enforceBusinessExpiry();
    renderBusinessBranding();
    if(wasLocked&&!state.locked){await selectBusinessWorkspace(workspaceId);return;}
    if(businessBillingOwner()&&state.tab==='subscription')await refreshBusinessBilling();
  }catch(error){ /* Server permissions still apply during a failed or offline access refresh. */ }
  finally{businessAccessCheckBusy=false;}
}
window.setInterval(refreshBusinessAccessState,60000);
window.setInterval(enforceBusinessExpiry,15000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){enforceBusinessExpiry();refreshBusinessAccessState();}});

$("#businessToday").textContent = new Date().toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
loadBusinessAccess();
