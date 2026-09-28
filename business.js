// Mushavo Budget Business application shell — Stage 1
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

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function showOnly(viewId) {
  ["businessLoading", "businessConfig", "businessSuspended", "businessNoAccess", "businessError", "businessApp"]
    .forEach((id) => document.getElementById(id)?.classList.toggle("hidden", id !== viewId));
}

function friendlyMessage(error) {
  const message = String(error?.message || error || "The Business workspace could not be opened.");
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
  state.transactions = [];
  state.bills = [];
  state.requests = [];
  state.budgets = [];
  state.documents = [];
  state.auditEvents = [];
  state.locked = false;
  state.lockOwner = false;
  $("#businessLock")?.classList.add("hidden");
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
  $("#settingsLocale").textContent = state.workspaceSettings?.locale || "—";
  $("#settingsTimezone").textContent = state.workspaceSettings?.timezone || "—";
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
  renderRoute();
  showOnly("businessApp");
}

async function selectBusinessWorkspace(workspaceId) {
  const workspace = state.workspaces.find((item) => item.id === workspaceId);
  if (!workspace) throw new Error("That Business workspace is not available to this account.");

  clearBusinessWorkspaceState();
  const requestSequence = workspaceLoadSequence;
  state.workspace = workspace;
  state.tab = currentTab();
  window.localStorage.setItem(selectedWorkspaceStorageKey(), workspace.id);
  setWorkspaceUrl(workspace.id);
  renderWorkspaceSelectors();

  const [subscriptions, entitlements, settings, members] = await Promise.all([
    query("Business subscription load", supabase.from("workspace_subscriptions").select("*").eq("workspace_id", workspace.id).limit(1)),
    query("Business entitlement load", supabase.rpc("effective_workspace_entitlement", { p_workspace_id: workspace.id })),
    query("Business settings load", supabase.from("workspace_settings").select("*").eq("workspace_id", workspace.id).maybeSingle()),
    query("Business team load", supabase.from("workspace_members").select("*").eq("workspace_id", workspace.id).eq("status", "active").order("joined_at", { ascending: true }))
  ]);

  // A slower response from a previously selected company must never overwrite
  // the newly selected Business workspace.
  if (requestSequence !== workspaceLoadSequence || state.workspace?.id !== workspace.id) return;
  state.workspaceSubscription = subscriptions[0] || null;
  state.workspaceEntitlement = entitlements[0] || null;
  state.workspaceSettings = settings || null;
  state.workspaceMembers = members;
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

    const [profile, workspaces, memberships] = await Promise.all([
      query("Business profile load", supabase.from("profiles").select("id, full_name, email").eq("id", session.user.id).maybeSingle()),
      query("Business workspace load", supabase.from("budget_workspaces").select("*").eq("workspace_type", "business").neq("status", "closed").order("created_at", { ascending: true })),
      query("Business membership load", supabase.from("workspace_members").select("*").eq("status", "active").order("created_at", { ascending: true }))
    ]);
    state.profile = profile;
    state.memberships = memberships;
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
$$('[data-open-more]').forEach((button) => button.addEventListener("click", () => $("#businessMoreDialog").showModal()));
$$('[data-dialog-route]').forEach((link) => link.addEventListener("click", () => $("#businessMoreDialog").close()));
$$('[data-sign-out]').forEach((button) => button.addEventListener("click", signOut));
$$('[data-leave-business]').forEach((link) => link.addEventListener("click", leaveBusiness));
$$('[data-retry]').forEach((button) => button.addEventListener("click", loadBusinessAccess));

window.addEventListener("hashchange", () => {
  if (!state.workspace) return;
  renderRoute();
  $("#businessMoreDialog")?.close();
  $("#businessMain")?.focus({ preventScroll: true });
});

$("#businessToday").textContent = new Date().toLocaleDateString("en", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
loadBusinessAccess();
