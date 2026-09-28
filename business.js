// Mushavo Budget Business application — Stage 3 owner setup
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

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showOnly(viewId) {
  ["businessLoading", "businessConfig", "businessSuspended", "businessNoAccess", "businessError", "businessApp"]
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
  state.locked = false;
  state.lockOwner = false;
  setupStep = "basics";
  setupOpen = false;
  setupBusy = false;
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

function countdown(value) {
  if (!value) return "Not scheduled";
  const expiry = new Date(value).getTime();
  if (!Number.isFinite(expiry)) return "—";
  const days = Math.ceil((expiry - Date.now()) / 86400000);
  if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago`;
  if (days === 0) return "Expires today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
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
  const activeMembers = state.workspaceMembers.filter((member) => member.status === "active");
  $("#businessTeamCount").textContent = `${activeMembers.length} ${activeMembers.length === 1 ? "person" : "people"}`;
  list.replaceChildren();
  activeMembers.forEach((member) => {
    const isCurrentUser = member.user_id === state.session.user.id;
    const label = isCurrentUser ? (state.profile?.full_name || state.session.user.email || "You") : "Business member";
    const article = document.createElement("article");
    article.className = "team-member";
    const avatar = document.createElement("span");
    avatar.className = "team-avatar";
    avatar.textContent = label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "BM";
    const copy = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = isCurrentUser ? `${label} (you)` : label;
    const joined = document.createElement("small");
    joined.textContent = `Joined ${formatDate(member.joined_at)}`;
    copy.append(name, joined);
    const role = document.createElement("span");
    role.className = "role-badge";
    role.textContent = formatRole(member.role);
    article.append(avatar, copy, role);
    list.append(article);
  });
  if (!activeMembers.length) {
    const empty = document.createElement("p");
    empty.className = "page-intro";
    empty.textContent = "No active Business members are available.";
    list.append(empty);
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
  showOnly("businessLoading");
  const requestSequence = workspaceLoadSequence;
  state.workspace = workspace;
  state.tab = currentTab();
  window.localStorage.setItem(selectedWorkspaceStorageKey(), workspace.id);
  setWorkspaceUrl(workspace.id);
  renderWorkspaceSelectors();

  let subscriptions, entitlements, settings, members, profiles, categories, dimensions, drafts;
  try {
    [subscriptions, entitlements, settings, members, profiles, categories, dimensions, drafts] = await Promise.all([
    query("Business subscription load", supabase.from("workspace_subscriptions").select("*").eq("workspace_id", workspace.id).limit(1)),
    query("Business entitlement load", supabase.rpc("effective_workspace_entitlement", { p_workspace_id: workspace.id })),
    query("Business settings load", supabase.from("workspace_settings").select("*").eq("workspace_id", workspace.id).maybeSingle()),
    query("Business team load", supabase.from("workspace_members").select("*").eq("workspace_id", workspace.id).eq("status", "active").order("joined_at", { ascending: true })),
    query("Business identity load", supabase.from("business_profiles").select("*").eq("workspace_id", workspace.id).maybeSingle()),
    query("Business category load", supabase.from("business_categories").select("*").eq("workspace_id", workspace.id).order("name")),
    query("Business tag load", supabase.from("business_dimensions").select("*").eq("workspace_id", workspace.id).order("name")),
    query("Business first draft load", supabase.from("business_setup_drafts").select("*").eq("workspace_id", workspace.id).maybeSingle())
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
  state.workspaceMembers = members;
  state.businessProfile = profiles || null;
  state.businessCategories = categories;
  state.businessDimensions = dimensions;
  state.setupDraft = drafts || null;
  renderBusinessWorkspace();
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

    const [profile, workspaces, memberships, currencies] = await Promise.all([
      query("Business profile load", supabase.from("profiles").select("id, full_name, email").eq("id", session.user.id).maybeSingle()),
      query("Business workspace load", supabase.from("budget_workspaces").select("*").eq("workspace_type", "business").neq("status", "closed").order("created_at", { ascending: true })),
      query("Business membership load", supabase.from("workspace_members").select("*").eq("status", "active").order("created_at", { ascending: true })),
      query("Business supported currencies load", supabase.from("supported_currencies").select("code,name").eq("is_active", true).order("code"))
    ]);
    state.profile = profile;
    state.memberships = memberships;
    state.supportedCurrencies = currencies;
    state.workspaces = authorizedBusinessWorkspaces(workspaces, memberships);
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
