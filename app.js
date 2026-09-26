// Mushavo Budget authenticated application — release 80
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.110.9/+esm";

const config = window.MUSHAVO_BUDGET_CONFIG || window.EXPENSE_TRACKER_CONFIG || {};
const placeholderValues = ["YOUR-PROJECT-REF", "YOUR-SUPABASE-PUBLISHABLE-KEY"];
const isConfigured =
  config.supabaseUrl &&
  config.supabasePublishableKey &&
  !placeholderValues.some((value) =>
    `${config.supabaseUrl} ${config.supabasePublishableKey}`.includes(value)
  );

const supabase = isConfigured
  ? createClient(config.supabaseUrl, config.supabasePublishableKey)
  : null;

function createPushDeviceState() {
  return {
    busy: false,
    testBusy: false,
    checked: false,
    userId: null,
    subscription: null,
    record: null,
    error: null
  };
}

const state = {
  session: null,
  profile: null,
  isAdmin: false,
  adminRole: null,
  headApproval: null,
  families: [],
  family: null,
  members: [],
  paymentItems: [],
  personalPlanAccess: [],
  freePaymentDraft: null,
  paymentRecords: [],
  familyInvitations: [],
  notifications: [],
  workspaces: [],
  workspaceMembers: [],
  workspaceSubscription: null,
  workspaceEntitlement: null,
  personalWorkspaceSubscription: null,
  personalWorkspaceEntitlement: null,
  ownedFamilySubscriptions: [],
  workspaceSettings: null,
  pushDevice: createPushDeviceState(),
  supportedCurrencies: [],
  exchangeRates: [],
  exchangeRateStatus: null,
  paymentConversions: [],
  billableMemberCount: 1,
  memberUsage: null,
  plans: [],
  planPrices: [],
  planFeatures: [],
  planLimits: [],
  renewalRequests: [],
  familySeatQuote: null,
  subscriptionInvoices: [],
  subscriptionPayments: [],
  entitlementHistory: [],
  supportTickets: [],
  supportTicketMessages: [],
  heads: [],
  adminProfiles: [],
  adminFamilies: [],
  adminMembers: [],
  adminPaymentItems: [],
  adminPaymentRecords: [],
  payments: [],
  adminNotes: [],
  adminWorkspaces: [],
  adminWorkspaceMembers: [],
  adminSubscriptions: [],
  adminPlans: [],
  adminPlanPrices: [],
  adminUserInvitations: [],
  adminPlanFeatures: [],
  adminPlanLimits: [],
  adminEnquiries: [],
  adminRenewalRequests: [],
  adminSubscriptionInvoices: [],
  adminSubscriptionPayments: [],
  adminSubscriptionProofs: [],
  adminSubscriptionReviews: [],
  adminSubscriptionMonitor: [],
  adminFinanceSettings: null,
  adminPaymentConversions: [],
  adminRateStatus: null,
  adminAnalytics: null,
  adminSupportTickets: [],
  adminSupportMessages: [],
  adminStaff: [],
  adminTab: "dashboard",
  familyTab: "dashboard",
  editingObligationId: null,
  paymentSearch: "",
  paymentSort: "due_soonest",
  paymentHistoryItemId: null,
  recordPaymentOccurrenceChoices: [],
  filterMonth: toMonthValue(new Date()),
  reportMonth: toMonthValue(new Date()),
  filterStatus: "all",
  reportCurrencyFilter: "all",
  reportViewMode: "original",
  reportReportingCurrency: null,
  workspacePlanBillingPeriod: "monthly",
  workspacePlanCurrency: null,
  workspacePlanWorkspaceId: null
};

const realtime = {
  channel: null,
  lastConnectedUserId: null,
  refreshTimer: null,
  notificationTimer: null,
  reconnectTimer: null,
  reconnectAttempts: 0,
  refreshInFlight: false,
  refreshPending: false
};

const analyticsActivity = { userId: null, lastSentAt: 0, inFlight: false };
const ANALYTICS_ACTIVITY_INTERVAL_MS = 50 * 60 * 1000;

async function recordVisibleActivity() {
  const userId = state.session?.user?.id;
  if (!userId || document.visibilityState === "hidden" || !navigator.onLine || analyticsActivity.inFlight) return;
  if (analyticsActivity.userId !== userId) {
    analyticsActivity.userId = userId;
    analyticsActivity.lastSentAt = 0;
  }
  if (analyticsActivity.lastSentAt > 0 && Date.now() - analyticsActivity.lastSentAt < ANALYTICS_ACTIVITY_INTERVAL_MS) return;
  analyticsActivity.inFlight = true;
  try {
    const { error } = await supabase.rpc("record_my_analytics_activity");
    if (error) throw error;
    if (state.session?.user?.id === userId) analyticsActivity.lastSentAt = Date.now();
  } catch (error) {
    // Analytics must never interrupt access to payments or an offline session.
    console.warn("Activity recording unavailable", error);
  } finally {
    analyticsActivity.inFlight = false;
  }
}

const dashboardDisclosureState = {
  months: new Set(),
  occurrences: new Set(),
  workloads: new Set()
};

let dashboardFitFrame = null;
let appLoadPromise = null;
let appLoadUserId = null;
let signInInProgress = false;
let toastTimer = null;
let pushRefreshPromise = null;
let pushRefreshSequence = 0;
let pushRefreshLastCheckedAt = 0;
let analyticsRequestId = 0;

const PAYMENT_PROOF_BUCKET = "payment-proofs";
const SUBSCRIPTION_PROOF_BUCKET = "subscription-proofs";
const PAYMENT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
const PAYMENT_PROOF_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const QUERY_TIMEOUT_MS = 15000;
const PUSH_READY_TIMEOUT_MS = 12000;
const PUSH_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const PUSH_OPT_IN_STORAGE_PREFIX = "mushavo-budget:push-enabled:";
const pushSupport = window.MushavoPushSupport || null;

const PLAN_FEATURE_LABELS = {
  "finance.analytics": "Finance analytics",
  "payments.recurring": "Recurring payment schedules",
  "receipts.upload": "Receipt and proof uploads",
  "reports.advanced": "Advanced reports",
  "export.csv": "CSV export",
  "export.pdf": "Print and PDF reports",
  "members.invite": "Member invitations",
  "approvals.enabled": "Approval controls",
  "audit.full_history": "Full audit history"
};

const $ = (selector) => document.querySelector(selector);

const views = {
  loading: $("#loadingView"),
  configWarning: $("#configWarning"),
  appError: $("#appErrorView"),
  auth: $("#authView"),
  setup: $("#setupView"),
  suspended: $("#suspendedView"),
  admin: $("#adminView"),
  app: $("#appView")
};

const adminTabs = new Set(["dashboard", "analytics", "households", "users", "plans", "finance", "enquiries", "support"]);
const familyTabs = new Set(["dashboard", "payments", "reports", "members", "subscription", "settings", "support"]);
const currencyNames = {
  USD: "en-US",
  ZAR: "en-ZA",
  EUR: "de-DE",
  GBP: "en-GB",
  CAD: "en-CA",
  AUD: "en-AU"
};

const PAYMENT_CURRENCIES = [
  ["AED", "United Arab Emirates Dirham"], ["AFN", "Afghan Afghani"], ["ALL", "Albanian Lek"],
  ["AMD", "Armenian Dram"], ["AOA", "Angolan Kwanza"], ["ARS", "Argentine Peso"],
  ["AUD", "Australian Dollar"], ["AWG", "Aruban Florin"], ["AZN", "Azerbaijani Manat"],
  ["BAM", "Bosnia-Herzegovina Convertible Mark"], ["BBD", "Barbadian Dollar"], ["BDT", "Bangladeshi Taka"],
  ["BHD", "Bahraini Dinar"], ["BIF", "Burundian Franc"], ["BMD", "Bermudan Dollar"],
  ["BND", "Brunei Dollar"], ["BOB", "Bolivian Boliviano"], ["BRL", "Brazilian Real"],
  ["BSD", "Bahamian Dollar"], ["BTN", "Bhutanese Ngultrum"], ["BWP", "Botswanan Pula"],
  ["BYN", "Belarusian Ruble"], ["BZD", "Belize Dollar"], ["CAD", "Canadian Dollar"],
  ["CDF", "Congolese Franc"], ["CHF", "Swiss Franc"], ["CLP", "Chilean Peso"],
  ["CNY", "Chinese Yuan"], ["COP", "Colombian Peso"], ["CRC", "Costa Rican Colón"],
  ["CUP", "Cuban Peso"], ["CVE", "Cape Verdean Escudo"], ["CZK", "Czech Koruna"],
  ["DJF", "Djiboutian Franc"], ["DKK", "Danish Krone"], ["DOP", "Dominican Peso"],
  ["DZD", "Algerian Dinar"], ["EGP", "Egyptian Pound"], ["ERN", "Eritrean Nakfa"],
  ["ETB", "Ethiopian Birr"], ["EUR", "Euro"], ["FJD", "Fijian Dollar"],
  ["FKP", "Falkland Islands Pound"], ["GBP", "British Pound"], ["GEL", "Georgian Lari"],
  ["GHS", "Ghanaian Cedi"], ["GIP", "Gibraltar Pound"], ["GMD", "Gambian Dalasi"],
  ["GNF", "Guinean Franc"], ["GTQ", "Guatemalan Quetzal"], ["GYD", "Guyanese Dollar"],
  ["HKD", "Hong Kong Dollar"], ["HNL", "Honduran Lempira"], ["HTG", "Haitian Gourde"],
  ["HUF", "Hungarian Forint"], ["IDR", "Indonesian Rupiah"], ["ILS", "Israeli New Shekel"],
  ["INR", "Indian Rupee"], ["IQD", "Iraqi Dinar"], ["IRR", "Iranian Rial"],
  ["ISK", "Icelandic Króna"], ["JMD", "Jamaican Dollar"], ["JOD", "Jordanian Dinar"],
  ["JPY", "Japanese Yen"], ["KES", "Kenyan Shilling"], ["KGS", "Kyrgyz Som"],
  ["KHR", "Cambodian Riel"], ["KMF", "Comorian Franc"], ["KPW", "North Korean Won"],
  ["KRW", "South Korean Won"], ["KWD", "Kuwaiti Dinar"], ["KYD", "Cayman Islands Dollar"],
  ["KZT", "Kazakhstani Tenge"], ["LAK", "Laotian Kip"], ["LBP", "Lebanese Pound"],
  ["LKR", "Sri Lankan Rupee"], ["LRD", "Liberian Dollar"], ["LSL", "Lesotho Loti"],
  ["LYD", "Libyan Dinar"], ["MAD", "Moroccan Dirham"], ["MDL", "Moldovan Leu"],
  ["MGA", "Malagasy Ariary"], ["MKD", "Macedonian Denar"], ["MMK", "Myanmar Kyat"],
  ["MNT", "Mongolian Tugrik"], ["MOP", "Macanese Pataca"], ["MRU", "Mauritanian Ouguiya"],
  ["MUR", "Mauritian Rupee"], ["MVR", "Maldivian Rufiyaa"], ["MWK", "Malawian Kwacha"],
  ["MXN", "Mexican Peso"], ["MYR", "Malaysian Ringgit"], ["MZN", "Mozambican Metical"],
  ["NAD", "Namibian Dollar"], ["NGN", "Nigerian Naira"], ["NIO", "Nicaraguan Córdoba"],
  ["NOK", "Norwegian Krone"], ["NPR", "Nepalese Rupee"], ["NZD", "New Zealand Dollar"],
  ["OMR", "Omani Rial"], ["PAB", "Panamanian Balboa"], ["PEN", "Peruvian Sol"],
  ["PGK", "Papua New Guinean Kina"], ["PHP", "Philippine Peso"], ["PKR", "Pakistani Rupee"],
  ["PLN", "Polish Zloty"], ["PYG", "Paraguayan Guarani"], ["QAR", "Qatari Riyal"],
  ["RON", "Romanian Leu"], ["RSD", "Serbian Dinar"], ["RUB", "Russian Ruble"],
  ["RWF", "Rwandan Franc"], ["SAR", "Saudi Riyal"], ["SBD", "Solomon Islands Dollar"],
  ["SCR", "Seychellois Rupee"], ["SDG", "Sudanese Pound"], ["SEK", "Swedish Krona"],
  ["SGD", "Singapore Dollar"], ["SHP", "St. Helena Pound"], ["SLE", "Sierra Leonean Leone"],
  ["SOS", "Somali Shilling"], ["SRD", "Surinamese Dollar"], ["SSP", "South Sudanese Pound"],
  ["STN", "São Tomé and Príncipe Dobra"], ["SVC", "Salvadoran Colón"], ["SYP", "Syrian Pound"],
  ["SZL", "Eswatini Lilangeni"], ["THB", "Thai Baht"], ["TJS", "Tajikistani Somoni"],
  ["TMT", "Turkmenistani Manat"], ["TND", "Tunisian Dinar"], ["TOP", "Tongan Paʻanga"],
  ["TRY", "Turkish Lira"], ["TTD", "Trinidad and Tobago Dollar"], ["TWD", "New Taiwan Dollar"],
  ["TZS", "Tanzanian Shilling"], ["UAH", "Ukrainian Hryvnia"], ["UGX", "Ugandan Shilling"],
  ["USD", "US Dollar"], ["UYU", "Uruguayan Peso"], ["UZS", "Uzbekistani Som"],
  ["VES", "Venezuelan Bolívar"], ["VND", "Vietnamese Dong"], ["VUV", "Vanuatu Vatu"],
  ["WST", "Samoan Tala"], ["XAF", "Central African CFA Franc"], ["XCD", "East Caribbean Dollar"],
  ["XCG", "Caribbean Guilder"], ["XOF", "West African CFA Franc"], ["XPF", "CFP Franc"],
  ["YER", "Yemeni Rial"], ["ZAR", "South African Rand"], ["ZMW", "Zambian Kwacha"],
  ["ZWG", "Zimbabwe Gold"]
];

const today = new Date();
$("#paymentDate").value = toDateValue(today);
$("#monthFilter").value = state.filterMonth;
$("#reportMonthFilter").value = state.reportMonth;
populatePaymentScheduleControls(today);
$("#recordPaymentDate").value = toDateValue(today);
$("#renewalPaymentDate").value = toDateValue(today);
renderPaymentCurrencyOptions("", "USD");

function toDateValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toMonthValue(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  return `${year}-${month}`;
}

function parseDate(value) {
  return new Date(`${value}T00:00:00`);
}

function monthStart(monthValue) {
  return `${monthValue}-01`;
}

function offsetMonthValue(monthValue, offset) {
  const date = parseDate(monthStart(monthValue));
  return toMonthValue(new Date(date.getFullYear(), date.getMonth() + offset, 1));
}

function monthDiff(fromDate, toDate) {
  return (toDate.getFullYear() - fromDate.getFullYear()) * 12 + toDate.getMonth() - fromDate.getMonth();
}

function lastDayOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}

function populatePaymentScheduleControls(selectedDate = new Date()) {
  const dueDay = $("#dueDay");
  const startMonth = $("#startMonth");
  const startYear = $("#startYear");
  if (!dueDay || !startMonth || !startYear) return;

  dueDay.innerHTML = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    return `<option value="${day}">${day}</option>`;
  }).join("");
  startMonth.innerHTML = Array.from({ length: 12 }, (_, monthIndex) => {
    const label = new Intl.DateTimeFormat("en", { month: "long" }).format(new Date(2024, monthIndex, 1));
    return `<option value="${monthIndex + 1}">${label}</option>`;
  }).join("");
  const currentYear = new Date().getFullYear();
  startYear.innerHTML = Array.from({ length: 41 }, (_, index) => currentYear - 10 + index)
    .map((year) => `<option value="${year}">${year}</option>`)
    .join("");
  setPaymentStartControls(toDateValue(selectedDate));
  updateRecurrenceControls();
}

function setPaymentStartControls(dateValue) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateValue || "") ? parseDate(dateValue) : new Date();
  const startYear = $("#startYear");
  if (startYear && !Array.from(startYear.options).some((option) => Number(option.value) === date.getFullYear())) {
    const option = document.createElement("option");
    option.value = `${date.getFullYear()}`;
    option.textContent = `${date.getFullYear()}`;
    startYear.append(option);
    Array.from(startYear.options)
      .sort((a, b) => Number(a.value) - Number(b.value))
      .forEach((yearOption) => startYear.append(yearOption));
  }
  $("#dueDay").value = `${date.getDate()}`;
  $("#startMonth").value = `${date.getMonth() + 1}`;
  $("#startYear").value = `${date.getFullYear()}`;
  syncPaymentStartDate();
}

function syncPaymentStartDate() {
  const year = Number($("#startYear")?.value);
  const month = Number($("#startMonth")?.value);
  const requestedDay = Number($("#dueDay")?.value);
  if (!year || !month || !requestedDay) return "";
  const day = Math.min(requestedDay, lastDayOfMonth(year, month - 1));
  const value = `${year}-${`${month}`.padStart(2, "0")}-${`${day}`.padStart(2, "0")}`;
  $("#startDate").value = value;
  return value;
}

function updateRecurrenceControls() {
  const recurrenceType = $("#recurrenceType")?.value || "monthly";
  const intervalField = $("#recurrenceIntervalField");
  const intervalInput = $("#recurrenceInterval");
  const customMonths = recurrenceType === "custom";
  const customDays = recurrenceType === "custom_days";
  const needsInterval = customMonths || customDays;
  if (intervalField) intervalField.classList.toggle("hidden", !needsInterval);
  if (intervalInput) {
    intervalInput.disabled = !needsInterval;
    intervalInput.max = customDays ? "3650" : "120";
    if (needsInterval && Number(intervalInput.value || 0) < 1) intervalInput.value = "1";
  }
  if ($("#recurrenceIntervalLabel")) {
    $("#recurrenceIntervalLabel").textContent = customDays
      ? "Repeat every how many days?"
      : "Repeat every how many months?";
  }
  if ($("#recurrenceIntervalHelp")) {
    $("#recurrenceIntervalHelp").textContent = customDays
      ? "For example, enter 56 for a payment due every 56 days."
      : "Enter the number of months between payments.";
  }
  if ($("#dueDayLabel")) {
    $("#dueDayLabel").textContent = customDays ? "First due day" : "Due day";
  }
  if ($("#dueDayHelp")) {
    $("#dueDayHelp").textContent = customDays
      ? "This day, together with the start month and year, anchors the repeating schedule."
      : "For shorter months, the last calendar day is used.";
  }
  syncPaymentStartDate();
}

function money(amount, currency = "USD") {
  try {
    return new Intl.NumberFormat(currencyNames[currency] || "en-US", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number(amount || 0));
  } catch (_error) {
    return `${currency} ${Number(amount || 0).toFixed(2)}`;
  }
}

const DECIMAL_SCALE_DIGITS = 12;
const DECIMAL_SCALE = 10n ** BigInt(DECIMAL_SCALE_DIGITS);

function decimalToScaled(value) {
  const normalized = `${value ?? 0}`.trim();
  const negative = normalized.startsWith("-");
  const unsigned = negative ? normalized.slice(1) : normalized;
  const [whole = "0", fraction = ""] = unsigned.split(".");
  const digits = `${whole || "0"}${fraction.padEnd(DECIMAL_SCALE_DIGITS, "0").slice(0, DECIMAL_SCALE_DIGITS)}`.replace(/^0+(?=\d)/, "");
  const scaled = BigInt(digits || "0");
  return negative ? -scaled : scaled;
}

function scaledToDecimal(value, fractionDigits = 4) {
  const negative = value < 0n;
  const absolute = negative ? -value : value;
  const whole = absolute / DECIMAL_SCALE;
  const remainder = `${absolute % DECIMAL_SCALE}`.padStart(DECIMAL_SCALE_DIGITS, "0");
  const fraction = remainder.slice(0, Math.max(0, fractionDigits)).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

function multiplyScaled(left, right) {
  return (left * right + DECIMAL_SCALE / 2n) / DECIMAL_SCALE;
}

function activeWorkspaceCurrencies() {
  const enabled = state.workspaceSettings?.enabled_currencies;
  return Array.isArray(enabled) && enabled.length ? enabled : PAYMENT_CURRENCIES.map(([code]) => code);
}

function renderPaymentCurrencyOptions(searchTerm = "", selectedCurrency = "") {
  const select = $("#obligationCurrency");
  if (!select) return;
  const queryText = searchTerm.trim().toLowerCase();
  const currentValue = selectedCurrency || select.value || "USD";
  const allowed = new Set(activeWorkspaceCurrencies());
  const catalogue = currencyCatalogue();
  const matches = catalogue.filter(([code, name]) =>
    allowed.has(code) && (!queryText || code.toLowerCase().includes(queryText) || name.toLowerCase().includes(queryText))
  );
  if (!queryText && currentValue && !matches.some(([code]) => code === currentValue)) {
    const currentCurrency = catalogue.find(([code]) => code === currentValue);
    if (currentCurrency) matches.unshift(currentCurrency);
  }
  select.innerHTML = "";
  if (matches.length) {
    matches.forEach(([code, name]) => select.append(new Option(`${code} — ${name}`, code)));
    if (matches.some(([code]) => code === currentValue)) select.value = currentValue;
  } else {
    const emptyOption = new Option("No matching currencies", "");
    emptyOption.disabled = true;
    emptyOption.selected = true;
    select.append(emptyOption);
  }
  const result = $("#currencySearchResult");
  if (result) result.textContent = `${matches.length} currenc${matches.length === 1 ? "y" : "ies"} available`;
}

function setView(viewName) {
  Object.values(views).forEach((view) => view.classList.add("hidden"));
  if (viewName) views[viewName].classList.remove("hidden");
}

function showLoading(title = "Opening your workspace", message = "Loading your latest budget...") {
  $("#loadingTitle").textContent = title;
  $("#loadingMessage").textContent = message;
  setView("loading");
}

function setSubmitting(button, isSubmitting, label) {
  if (!button) return;
  if (isSubmitting && !button.finishPwaOperation) {
    button.finishPwaOperation = window.MushavoPWA?.beginOperation();
  } else if (!isSubmitting) {
    button.finishPwaOperation?.();
    button.finishPwaOperation = null;
  }
  button.disabled = isSubmitting;
  button.textContent = label;
}

function resetSignOutButtons() {
  ["#signOutButton", "#adminSignOutButton", "#suspendedSignOutButton"].forEach((selector) => {
    const button = $(selector);
    if (button) setSubmitting(button, false, "Sign out");
  });
}

function protectSubmission(handler) {
  return async function(event) {
    const finish = window.MushavoPWA?.beginOperation();
    try {
      return await handler.call(this, event);
    } finally {
      finish?.();
    }
  };
}

function showSignupSuccessMessage() {
  const url = new URL(window.location.href);
  const signupResult = url.searchParams.get("signup");
  if (!["success", "invited"].includes(signupResult)) return;
  url.searchParams.delete("signup");
  window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  showToast(signupResult === "invited"
    ? "Your account, workspace, and subscription are ready."
    : "Account created successfully. Sign in with your new account.");
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = friendlyMessage(message);
  toast.classList.remove("hidden");
  if (toastTimer) window.clearTimeout(toastTimer);
  if (typeof toast.showPopover === "function") {
    try {
      toast.hidePopover();
    } catch (_error) {
      // The popover may not be open yet.
    }
    toast.showPopover();
  }
  toastTimer = window.setTimeout(() => {
    if (typeof toast.hidePopover === "function") {
      try {
        toast.hidePopover();
      } catch (_error) {
        // Fall back to the hidden class below.
      }
    }
    toast.classList.add("hidden");
    toastTimer = null;
  }, 4200);
}

function showAppError(error) {
  $("#appErrorMessage").textContent = friendlyMessage(error?.message) || "A database or permission error stopped the app from loading.";
  setView("appError");
}

function friendlyMessage(message = "") {
  const text = `${message}`;
  if (text.includes("ADMIN_USER_INVITATION_ACCESS_REQUIRED")) {
    return "Only a super administrator or admin staff member can send user invitations.";
  }
  if (text.includes("USER_ALREADY_REGISTERED")) {
    return "This account has completed signup. Use Registered user access instead.";
  }
  if (text.includes("ADMIN_INVITATION_DELIVERY_IN_PROGRESS")) {
    return "An invitation is being sent to this email. Wait a moment before replacing it.";
  }
  if (text.includes("ADMIN_INVITATION_ALREADY_ACTIVE")) {
    return "A setup invitation is already active for this email address.";
  }
  if (text.includes("ADMIN_INVITATION_RATE_LIMITED")) {
    return "Too many invitations were created recently. Wait before trying again.";
  }
  if (text.includes("INVITATION_EMAIL_RATE_LIMITED")) {
    return "Supabase has temporarily limited invitation emails. Configure Custom SMTP or wait before trying again.";
  }
  if (text.includes("INVITATION_EMAIL_SEND_FAILED")) {
    return "The invitation record was saved, but the email could not be sent. Check Supabase Auth email and SMTP logs.";
  }
  if (text.includes("INVITATION_SERVER_CONFIGURATION_INCOMPLETE")) {
    return "The secure invitation function is not fully configured in Supabase.";
  }
  if (text.includes("INVALID_INVITATION_EMAIL") || text.includes("INVALID_INVITATION_REQUEST")) {
    return "Check the invitation name, email, plan, dates, and limits, then try again.";
  }
  if (text.includes("INVALID_COUNTRY_CODE")) {
    return "Use a two-letter country code, such as ZW, ZA, or GB.";
  }
  if (text.includes("SUBSCRIPTION_EXPIRY_REQUIRED")) {
    return "Add a paid-through or expiry date for a paid plan.";
  }
  if (text.includes("INVALID_SUBSCRIPTION_DATE_RANGE")) {
    return "The paid-through date cannot be earlier than the plan start date.";
  }
  if (text.includes("DEFAULT_CURRENCY_MUST_BE_ENABLED")) {
    return "Choose a default currency from the workspace currencies you enabled.";
  }
  if (text.includes("INCOMPLETE_INVITATION_PAYMENT")) {
    return "Enter the payment amount, currency, date, and method.";
  }
  if (text.includes("FREE_PLAN_REQUIRES_NO_PAYMENT")) {
    return "The Free plan cannot include a subscription payment.";
  }
  if (text.includes("ACTIVE_FAMILY_MEMBERSHIP_REQUIRED")) {
    return "An active Mushavo Budget membership is required for this action.";
  }
  if (text.includes("FAMILY_LIMIT_REACHED")) {
    return "Family limit reached. Purchase another Family subscription from Family & Members to add a separate family.";
  }
  if (text.includes("FAMILY_ACCOUNT_CAP_REACHED")) {
    return "Your account has reached the maximum of 100 families. Contact support for help.";
  }
  if (text.includes("FAMILY_PLAN_REQUEST_ALREADY_PENDING")) {
    return "A Family plan request is already waiting for review. The family will be created after it is approved.";
  }
  if (text.includes("FAMILY_NAME_REQUIRED")) {
    return "Enter the name of the family you want to create.";
  }
  if (text.includes("INVALID_FAMILY_MEMBER_COUNT")) {
    return "The total number of people must be at least the number included in the Family plan.";
  }
  if (text.includes("MEMBER_LIMIT_REACHED")) {
    return "All paid family places are currently in use or reserved by pending invitations. Purchase another place before inviting someone else.";
  }
  if (text.includes("MEMBER_LIMIT_BELOW_CURRENT_USAGE")) {
    return "The selected member limit cannot be lower than the active members and pending invitations already using this family.";
  }
  if (text.includes("APPROVED_MEMBER_LIMIT_BELOW_USAGE")) {
    return "This payment cannot be approved because its paid member limit is below the family's current active member count.";
  }
  if (text.includes("ACTIVE_FAMILY_SUBSCRIPTION_REQUIRED")) {
    return "An active Family subscription is required before inviting members.";
  }
  if (text.includes("SEAT_QUOTE_CHANGED")) return "The places price changed. Refresh the quote before submitting payment.";
  if (text.includes("FAMILY_SEAT_PURCHASE_CHANGED")) return "The Family plan or available places changed before review. Reject this request and submit a new quote.";
  if (text.includes("INVALID_EXTRA_PLACE_COUNT")) return "Choose between 1 and the remaining available places.";
  if (text.includes("PARTIAL_PAYMENT_CURRENCY_MISMATCH")) {
    return "A partial payment must use the same currency as its payment item.";
  }
  if (text.includes("PAYMENT_CURRENCY_NOT_ENABLED")) {
    return "Enable this currency in Workspace currency settings before saving the payment.";
  }
  if (text.includes("DEFAULT_AND_REPORTING_CURRENCY_MUST_BE_ENABLED")) {
    return "The default and reporting currencies must both be included in the enabled currency list.";
  }
  if (text.includes("INVALID_ENABLED_CURRENCIES") || text.includes("UNSUPPORTED_CURRENCY")) {
    return "Choose at least one supported currency.";
  }
  if (text.includes("CURRENCY_SETTINGS_ACCESS_REQUIRED")) {
    return "Only the workspace owner or an authorized Business finance manager can change these currency settings.";
  }
  if (text.includes("FINANCE_CURRENCY_ACCESS_REQUIRED")) {
    return "Your admin role does not include Finance currency management.";
  }
  if (text.includes("RATE_SYNC_RATE_LIMITED")) {
    return "Rates were synced recently. Wait five minutes before starting another manual sync.";
  }
  if (text.includes("SERVER_CONFIGURATION_INCOMPLETE")) {
    return "The exchange-rate service is not configured. Add the CurrencyAPI and cron secrets to the Supabase Edge Function.";
  }
  if (text.includes("RATE_SNAPSHOT_STORE_FAILED") || text.includes("SYNC_RUN_CREATE_FAILED")) {
    return "The rate service reached the provider but could not save the result. Check the Supabase migration and function logs.";
  }
  if (text.includes("PERSONAL_PAYMENT_LIMIT_REACHED")) {
    return "Free accounts can keep up to 5 active personal payments. Family payments remain unlimited.";
  }
  if (text.includes("PAYMENT_PAUSED_BY_PLAN")) return "This payment is paused by the Free plan limit. Choose it among your five, renew Personal, or delete it.";
  if (text.includes("ACCOUNT_SUSPENDED")) return "Your account is suspended. Contact Mushavo Budget support.";
  if (
    text.includes("payment_items_recurrence_type_check") ||
    text.includes("payment_items_recurrence_interval_check")
  ) {
    return "The selected repeat schedule could not be saved. Apply the latest database update, then try again.";
  }
  if (text.includes("WORKSPACE_READ_ONLY")) {
    return "This shared workspace is read-only because its subscription is expired or suspended. The owner can renew it from Subscription.";
  }
  if (text.includes("PLAN_PRICE_NOT_CONFIGURED")) {
    return "This plan does not have an active price for the selected billing period and currency yet.";
  }
  if (text.includes("PAYMENT_AMOUNT_DOES_NOT_MATCH_INVOICE")) {
    return "The plan price or member count changed. Reopen the payment form to load the latest invoice total.";
  }
  if (text.includes("SUBSCRIPTION_REVIEW_ALREADY_PENDING")) {
    return "A subscription payment for this workspace is already waiting for review.";
  }
  if (text.includes("ADDITIONAL_SEAT_PAYMENT_REQUIRED")) {
    return "This member would use an additional paid seat. The Family Head must submit and receive approval for a Household payment covering the new seat first.";
  }
  if (text.includes("WORKSPACE_OWNER_REQUIRED")) {
    return "Only the workspace owner can complete this subscription action.";
  }
  if (text.includes("FINANCE_REVIEW_ACCESS_REQUIRED")) {
    return "Your admin role does not include subscription payment review access.";
  }
  if (text.includes("REJECTION_REASON_REQUIRED")) {
    return "Enter a reason so the workspace owner knows what must be corrected.";
  }
  if (text.includes("MEMBER_MANAGEMENT_ACCESS_REQUIRED")) {
    return "Your active membership does not currently include permission to manage family members.";
  }
  if (text.includes("CANNOT_REMOVE_FAMILY_OWNER")) {
    return "The family owner cannot be removed. Delete the entire family instead if you no longer need it.";
  }
  if (text.includes("MEMBER_NOT_FOUND")) {
    return "That member is no longer available in this family.";
  }
  if (text.includes("FAMILY_NOT_FOUND")) {
    return "That family no longer exists or you do not own it.";
  }
  if (text.includes("USER_NOT_REGISTERED")) {
    return "That user is not registered on Mushavo Budget. Ask them to sign up before sending an invitation.";
  }
  if (text.includes("CANNOT_INVITE_YOURSELF")) {
    return "You cannot invite your own email address.";
  }
  if (text.includes("PUSH_SUBSCRIPTION_ENDPOINT_CONFLICT")) {
    return "This browser subscription belongs to another signed-in account. Disable notifications for that account or reset this site's notification permission, then try again.";
  }
  if (text.includes("PUSH_PERMISSION_DENIED")) {
    return "Notifications are blocked for this site. Allow them in your browser or device settings, then return and try again.";
  }
  if (text.includes("PUSH_PERMISSION_NOT_GRANTED")) {
    return "Notification permission was not granted. You can try again whenever you are ready.";
  }
  if (text.includes("PUSH_SERVICE_WORKER_NOT_READY")) {
    return "The app service worker is not ready. Reload the page while online, then try again.";
  }
  if (text.includes("PUSH_SUBSCRIPTION_INVALID")) {
    return "The browser returned an incomplete notification subscription. Disable it and try again.";
  }
  if (text.includes("VAPID_PUBLIC_KEY_MISSING")) {
    return "Notifications are not configured on this website yet.";
  }
  if (text.includes("PUSH_SUBSCRIPTION_REQUIRED")) {
    return "Enable notifications on at least one device before sending a test.";
  }
  if (text.includes("PUSH_TEST_RATE_LIMITED")) {
    return "A test was requested recently. Wait one minute before trying again.";
  }
  if (text.includes("PUSH_TEST_DELIVERY_FAILED")) {
    return "The push service could not reach any active device. Re-enable notifications on the device and try again.";
  }
  if (text.includes("PUSH_SUBSCRIPTION_LOOKUP_FAILED") || text.includes("PUSH_TEST_RATE_LIMIT_CHECK_FAILED")) {
    return "The notification service could not check your devices. Try again shortly.";
  }
  if (text.includes("PUSH_SERVER_CONFIGURATION_INCOMPLETE")) {
    return "Test notifications are not fully configured on the server yet.";
  }
  if (text.includes("PUSH_SERVER_CONFIGURATION_INVALID")) {
    return "The server notification keys are invalid. Check the protected VAPID settings.";
  }
  if (text.includes("EDGE_FUNCTION_AUTHENTICATION")) {
    return "Your secure session has ended. Sign in again before trying this action.";
  }
  if (text.includes("ORIGIN_NOT_ALLOWED")) {
    return "Test notifications can only be sent from the official Mushavo Budget website.";
  }
  if (text.includes("ALREADY_FAMILY_MEMBER")) {
    return "That user is already part of this family.";
  }
  if (text.includes("INVITATION_ALREADY_PENDING")) {
    return "That user already has a pending invitation for this family.";
  }
  if (text.includes("INVITATION_NOT_AVAILABLE")) {
    return "This invitation is no longer available. Refresh the page to see its latest status.";
  }
  if (text.includes("FAMILY_ALREADY_EXISTS")) {
    return "You already created a family workspace.";
  }
  if (text.includes("infinite recursion")) {
    return "A database access rule needs to be updated before this workspace can open.";
  }
  if (text.includes("permission denied") || text.includes("violates row-level security")) {
    return "You do not have permission to complete that action yet.";
  }
  if (text.includes("Failed to fetch") || text.includes("NetworkError")) {
    return "The network connection failed. Check your internet connection and try again.";
  }
  if (text.includes("duplicate key")) {
    if (text.includes("family_invitations")) {
      return "That user already has a pending invite for this family.";
    }
    return "That record already exists. Update the existing one instead.";
  }
  return text;
}

function appName() {
  return "Mushavo Budget";
}

function familyCurrency() {
  return state.family?.currency || state.paymentItems[0]?.currency || "USD";
}

function hasJoinableFamilyInvitation() {
  return state.familyInvitations.some((invitation) =>
    invitation.invitee_email?.toLowerCase() === state.session?.user?.email?.toLowerCase() &&
    ["pending", "accepted"].includes(invitation.status)
  );
}

function openDrawer() {
  const activeView = state.isAdmin ? views.admin : views.app;
  activeView?.classList.add("drawer-open");
  activeView?.querySelector(".drawer-backdrop")?.classList.remove("hidden");
}

function closeDrawer() {
  [views.admin, views.app].forEach((view) => {
    view?.classList.remove("drawer-open");
    view?.querySelector(".drawer-backdrop")?.classList.add("hidden");
  });
}

function confirmAction({ title = "Are you sure?", message = "", action = "Confirm" }) {
  const dialog = $("#confirmDialog");
  $("#confirmDialogTitle").textContent = title;
  $("#confirmDialogMessage").textContent = message;
  $("#confirmDialogConfirm").textContent = action;
  dialog.showModal();
  return new Promise((resolve) => {
    const form = $("#confirmDialogForm");
    const handleSubmit = (event) => {
      event.preventDefault();
      cleanup();
      dialog.close();
      resolve(true);
    };
    const handleClose = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      form.removeEventListener("submit", handleSubmit);
      dialog.removeEventListener("close", handleClose);
    };
    form.addEventListener("submit", protectSubmission(handleSubmit));
    dialog.addEventListener("close", handleClose);
  });
}

function routeFromHash() {
  const route = window.location.hash.replace(/^#\/?/, "");
  const [area, tab] = route.split("/");
  return { area, tab };
}

function applyRouteFromHash() {
  const { area, tab } = routeFromHash();
  if (area === "admin" && adminTabs.has(tab)) state.adminTab = tab;
  if (area === "family" && familyTabs.has(tab)) state.familyTab = tab;
}

function setRoute(area, tab, replace = false) {
  const nextHash = `#${area}/${tab}`;
  if (window.location.hash === nextHash) return;
  if (replace) {
    window.history.replaceState(null, "", nextHash);
    return;
  }
  window.history.pushState(null, "", nextHash);
}

function syncRouteForWorkspace(area) {
  applyRouteFromHash();
  if (area === "admin") {
    if (!adminTabs.has(state.adminTab)) state.adminTab = "dashboard";
    setRoute("admin", state.adminTab, true);
  }
  if (area === "family") {
    if (!familyTabs.has(state.familyTab)) state.familyTab = "dashboard";
    setRoute("family", state.familyTab, true);
  }
}

function assertSupabase() {
  if (!supabase) {
    setView("configWarning");
    throw new Error("Supabase is not configured.");
  }
}

function isSameAuthUser(previousSession, nextSession) {
  return Boolean(previousSession?.user?.id && previousSession.user.id === nextSession?.user?.id);
}

function realtimeTablesForCurrentView() {
  const sharedTables = [
    "profiles", "family_heads", "families", "family_members", "payment_items", "payment_records",
    "family_invitations", "budget_workspaces", "workspace_members",
    "workspace_invitations", "workspace_subscriptions", "subscription_renewal_requests",
    "subscription_invoices", "subscription_payments", "subscription_entitlement_history",
    "support_tickets", "support_ticket_messages"
  ];
  if (!state.isAdmin) return sharedTables;
  return [...sharedTables, "plans", "plan_prices", "plan_features", "plan_limits", "payments", "enquiries", "admin_support_notes"];
}

function stopRealtime() {
  if (realtime.refreshTimer) {
    window.clearTimeout(realtime.refreshTimer);
    realtime.refreshTimer = null;
  }
  realtime.refreshInFlight = false;
  realtime.refreshPending = false;
  if (realtime.notificationTimer) window.clearTimeout(realtime.notificationTimer);
  realtime.notificationTimer = null;
  if (realtime.reconnectTimer) window.clearTimeout(realtime.reconnectTimer);
  realtime.reconnectTimer = null;
  if (!supabase || !realtime.channel) return;
  const channel = realtime.channel;
  realtime.channel = null;
  supabase.removeChannel(channel);
}

function startRealtime() {
  if (!supabase || !state.session) return;
  stopRealtime();
  if (state.session.access_token) supabase.realtime.setAuth(state.session.access_token);
  const channelName = `mushavo-budget:${state.session.user.id}:${state.isAdmin ? "admin" : "family"}`;
  const channel = supabase.channel(channelName);

  realtimeTablesForCurrentView().forEach((table) => {
    channel.on(
      "postgres_changes",
      { event: "*", schema: "public", table },
      (payload) => {
        if (table === "family_invitations") queueNotificationRefresh();
        queueRealtimeRefresh(payload);
      }
    );
  });
  // Notifications have a small dedicated refresh, so an unrelated workspace
  // query cannot delay the recipient's new invitation or unread count.
  channel.on("postgres_changes", { event: "*", schema: "public", table: "notifications" },
    () => queueNotificationRefresh());

  realtime.channel = channel.subscribe((status) => {
    if (realtime.channel !== channel) return;
    if (status === "SUBSCRIBED") {
      realtime.reconnectAttempts = 0;
      const reconnect = realtime.lastConnectedUserId === state.session?.user?.id;
      realtime.lastConnectedUserId = state.session.user.id;
      queueNotificationRefresh();
      // The first connection follows a complete startup load. Only a real
      // reconnection needs another full snapshot.
      if (reconnect) queueRealtimeRefresh({ table: "realtime", eventType: "SUBSCRIBED" });
    } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
      console.warn("Realtime disconnected; reconnecting while the app is open.", status);
      if (!realtime.reconnectTimer && state.session) {
        const delay = Math.min(30000, 1000 * 2 ** Math.min(realtime.reconnectAttempts++, 5));
        realtime.reconnectTimer = window.setTimeout(() => {
          realtime.reconnectTimer = null;
          if (state.session && navigator.onLine) startRealtime();
        }, delay);
      }
    }
  });
}

function queueNotificationRefresh() {
  if (!state.session) return;
  if (realtime.notificationTimer) window.clearTimeout(realtime.notificationTimer);
  const userId = state.session.user.id;
  realtime.notificationTimer = window.setTimeout(async () => {
    realtime.notificationTimer = null;
    try {
      await loadNotifications();
      if (state.session?.user?.id !== userId) return;
      renderNotifications();
      if (!state.isAdmin && state.familyTab === "members") {
        await loadInvitations();
        if (state.session?.user?.id === userId) renderInvitations();
      }
    } catch (error) {
      console.warn("Notification refresh failed; retrying on reconnect or resume.", error);
    }
  }, 100);
}

function queueRealtimeRefresh(payload = {}) {
  if (!state.session || appLoadPromise || document.visibilityState === "hidden" || !navigator.onLine) return;
  console.debug("Realtime refresh requested", payload.table || "app", payload.eventType || "REFRESH");
  if (realtime.refreshTimer) window.clearTimeout(realtime.refreshTimer);
  realtime.refreshTimer = window.setTimeout(() => {
    realtime.refreshTimer = null;
    refreshVisibleData().catch((error) => {
      // A background sync must not replace or obscure an already usable workspace.
      console.warn("Realtime refresh failed; the next reconnect or resume will retry.", error);
    });
  }, 180);
}

async function refreshVisibleData() {
  if (!state.session || appLoadPromise || !navigator.onLine) return;
  if (realtime.refreshInFlight) {
    realtime.refreshPending = true;
    return;
  }
  const sessionId = state.session.user.id;
  realtime.refreshInFlight = true;
  try {
    if (state.isAdmin) {
      await Promise.all([loadAdminData(), loadNotifications()]);
      if (state.session?.user?.id !== sessionId) return;
      renderAdmin();
      return;
    }
    if (await loadAccess() === false) return;
    await loadFamily();
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    if (state.familyTab === "support") await loadUserSupportData();
    if (state.session?.user?.id !== sessionId) return;
    renderFamilyApp();
  } finally {
    realtime.refreshInFlight = false;
    if (realtime.refreshPending && state.session?.user?.id === sessionId) {
      realtime.refreshPending = false;
      queueRealtimeRefresh({ table: "queued", eventType: "RETRY" });
    }
  }
}

function refreshAfterAppResume(source) {
  if (!state.session || appLoadPromise || document.visibilityState === "hidden" || !navigator.onLine) return;
  if (!realtime.channel || realtime.reconnectTimer) startRealtime();
  queueNotificationRefresh();
  queueRealtimeRefresh({ table: source, eventType: "RESUME" });
}

async function query(label, promise) {
  let timeoutId;
  try {
    const { data, error } = await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = window.setTimeout(
          () => {
            console.warn(`Request timed out: ${label}`);
            reject(new Error("The request took too long. Check your connection and try again."));
          },
          QUERY_TIMEOUT_MS
        );
      })
    ]);
    if (error) {
      console.error(label, error);
      throw new Error(error.message);
    }
    return data;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function init() {
  showLoading("Opening your workspace", "Checking your secure session...");
  if (!isConfigured) {
    setView("configWarning");
    return;
  }

  applyRouteFromHash();
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  state.session = data.session;

  supabase.auth.onAuthStateChange((event, session) => {
    if (event === "INITIAL_SESSION") return;
    const previousSession = state.session;
    state.session = session;
    // Password sign-in owns its first workspace load. Auth also emits
    // SIGNED_IN during that request; handling both would race two loaders.
    if (signInInProgress && event === "SIGNED_IN") return;

    if (session && isSameAuthUser(previousSession, session)) {
      if (session.access_token) supabase.realtime.setAuth(session.access_token);
      return;
    }

    if (session) {
      window.setTimeout(() => {
        openAuthenticatedSession(session).catch(handleLoadFailure);
      }, 0);
      return;
    }
    window.setTimeout(handleSignedOut, 0);
  });

  if (state.session) {
    await openAuthenticatedSession(state.session);
  } else {
    setView("auth");
    showSignupSuccessMessage();
  }
}

function handleSignedOut() {
  resetState();
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  setView("auth");
}

function isInvalidStoredSessionError(error) {
  const message = String(error?.message || error || "").toLowerCase();
  return message.includes("jwt issued at future")
    || message.includes("jwt expired")
    || message.includes("invalid jwt")
    || message.includes("invalid refresh token")
    || message.includes("refresh token not found");
}

function removeStoredSupabaseSession() {
  try {
    const projectRef = new URL(config.supabaseUrl).hostname.split(".")[0];
    if (projectRef) window.localStorage.removeItem(`sb-${projectRef}-auth-token`);
  } catch (_error) {
    // The normal sign-out path remains available if storage is unavailable.
  }
}

function isUnrecoverableSessionError(error) {
  return ["refresh_token_not_found", "refresh_token_already_used", "session_not_found", "session_expired", "user_not_found", "user_banned"].includes(error?.code) ||
    /invalid refresh token|refresh token not found|session not found/i.test(error?.message || "");
}

async function handleLoadFailure(error, mayRefresh = true) {
  console.error(error);
  if (state.session && mayRefresh && isInvalidStoredSessionError(error)) {
    try {
      const refreshed = await supabase.auth.refreshSession();
      if (refreshed.error) throw refreshed.error;
      if (!refreshed.data?.session) throw { code: "session_not_found", message: "Session not found" };
      state.session = refreshed.data.session;
      await openAuthenticatedSession(state.session);
      return;
    } catch (refreshError) {
      return handleLoadFailure(refreshError, false);
    }
  }
  if (isUnrecoverableSessionError(error)) {
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch (_signOutError) {
      // Remove only this project's stored session when the invalid JWT also
      // prevents Supabase from completing its normal local sign-out flow.
    }
    removeStoredSupabaseSession();
    handleSignedOut();
    showToast("Your saved session was no longer valid. Please sign in again.");
    return;
  }
  showToast(error.message);
  if (state.session) showAppError(error);
  else setView("auth");
}

function openAuthenticatedSession(session) {
  const userId = session?.user?.id;
  if (!userId) return Promise.reject(new Error("Your secure session could not be opened. Please sign in again."));
  if (appLoadPromise && appLoadUserId === userId) return appLoadPromise;

  resetState();
  state.session = session;
  appLoadUserId = userId;
  showLoading("Opening your workspace", "Loading your latest budget...");
  appLoadPromise = loadApp().then(() => {
    const url = new URL(window.location.href);
    const requestedPlan = url.searchParams.get("plan");
    if (!state.isAdmin && requestedPlan && state.plans.some((plan) => plan.code === requestedPlan)) {
      state.familyTab = "subscription";
      setRoute("family", "subscription", true);
      renderFamilyApp();
      openRenewalDialog(requestedPlan);
      url.searchParams.delete("plan");
      window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    }
  }).finally(() => {
    if (appLoadUserId === userId) {
      appLoadPromise = null;
      appLoadUserId = null;
    }
  });
  return appLoadPromise;
}

function resetState() {
  resetSignOutButtons();
  stopRealtime();
  realtime.lastConnectedUserId = null;
  analyticsActivity.userId = null;
  analyticsActivity.lastSentAt = 0;
  resetDashboardDisclosureState();
  state.session = null;
  state.profile = null;
  state.isAdmin = false;
  state.adminRole = null;
  state.headApproval = null;
  state.families = [];
  state.family = null;
  state.members = [];
  state.paymentItems = [];
  state.personalPlanAccess = [];
  state.freePaymentDraft = null;
  state.paymentRecords = [];
  state.familyInvitations = [];
  state.notifications = [];
  state.workspaces = [];
  state.workspaceMembers = [];
  state.workspaceSubscription = null;
  state.workspaceEntitlement = null;
  state.personalWorkspaceSubscription = null;
  state.personalWorkspaceEntitlement = null;
  state.ownedFamilySubscriptions = [];
  state.workspaceSettings = null;
  state.pushDevice = createPushDeviceState();
  pushRefreshSequence += 1;
  pushRefreshPromise = null;
  pushRefreshLastCheckedAt = 0;
  state.supportedCurrencies = [];
  state.exchangeRates = [];
  state.exchangeRateStatus = null;
  state.paymentConversions = [];
  state.billableMemberCount = 1;
  state.memberUsage = null;
  state.familySeatQuote = null;
  state.plans = [];
  state.planPrices = [];
  state.planFeatures = [];
  state.planLimits = [];
  state.renewalRequests = [];
  state.subscriptionInvoices = [];
  state.subscriptionPayments = [];
  state.entitlementHistory = [];
  state.supportTickets = [];
  state.supportTicketMessages = [];
  state.heads = [];
  state.adminProfiles = [];
  state.adminFamilies = [];
  state.adminMembers = [];
  state.adminPaymentItems = [];
  state.adminPaymentRecords = [];
  state.payments = [];
  state.adminNotes = [];
  state.adminWorkspaces = [];
  state.adminWorkspaceMembers = [];
  state.adminSubscriptions = [];
  state.adminPlans = [];
  state.adminPlanPrices = [];
  state.adminUserInvitations = [];
  state.adminPlanFeatures = [];
  state.adminPlanLimits = [];
  state.adminEnquiries = [];
  state.adminRenewalRequests = [];
  state.adminSubscriptionInvoices = [];
  state.adminSubscriptionPayments = [];
  state.adminSubscriptionProofs = [];
  state.adminSubscriptionReviews = [];
  state.adminSubscriptionMonitor = [];
  state.adminFinanceSettings = null;
  state.adminPaymentConversions = [];
  state.adminRateStatus = null;
  state.adminAnalytics = null;
  analyticsRequestId += 1;
  state.adminSupportTickets = [];
  state.adminSupportMessages = [];
  state.adminStaff = [];
  state.paymentSearch = "";
  state.paymentSort = "due_soonest";
  state.paymentHistoryItemId = null;
  state.recordPaymentOccurrenceChoices = [];
  state.adminTab = "dashboard";
  state.familyTab = "dashboard";
  state.editingObligationId = null;
  state.reportCurrencyFilter = "all";
  state.reportViewMode = "original";
  state.reportReportingCurrency = null;
  state.workspacePlanBillingPeriod = "monthly";
  state.workspacePlanCurrency = null;
  state.workspacePlanWorkspaceId = null;
}

async function blockUnfinishedAdminInvitationSession() {
  const profile = await query(
    "invitation profile load",
    supabase.from("profiles").select("signup_source, admin_invitation_id")
      .eq("id", state.session.user.id).maybeSingle()
  );
  if (profile?.signup_source !== "admin_invitation") return false;
  if (profile.admin_invitation_id) {
    const { data, error } = await supabase.rpc("get_my_admin_user_invitation", {
      p_invitation_id: profile.admin_invitation_id
    });
    const invitation = Array.isArray(data) ? data[0] : data;
    if (!error && invitation?.invitation_status === "provisioned" && invitation.provisioned_workspace_id) {
      return false;
    }
  }
  // Supabase Auth signs the recipient in as soon as they open the email link.
  // This identity cannot access the app until invitation setup commits.
  const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
  if (signOutError) throw signOutError;
  state.session = null;
  setView("auth");
  showToast("Finish setup using your invitation email before signing in.");
  return true;
}

async function loadApp() {
  assertSupabase();
  const startedAt = performance.now();
  const loadingUserId = state.session.user.id;
  // Opening an invitation signs its recipient into Supabase Auth. Only the
  // completed invitation may enter the app or provision any workspace.
  if (await blockUnfinishedAdminInvitationSession()) return;
  if (await query("account status load", supabase.rpc("my_account_suspended"))) {
    setView("suspended");
    return;
  }
  const settled = (promise) => promise.then(
    () => ({ ok: true }),
    (error) => ({ ok: false, error })
  );
  const profileResult = settled(ensureProfile());
  const familyResult = settled(loadFamily());
  const invitationResult = settled(loadInvitations());
  const notificationResult = settled(loadNotifications());

  if (await loadAccess({ skipAccountCheck: true }) === false) return;

  if (state.isAdmin) {
    const loadedNotifications = await notificationResult;
    if (!loadedNotifications.ok) throw loadedNotifications.error;
    await loadAdminData();
    syncRouteForWorkspace("admin");
    setView("admin");
    renderAdmin();
    await handleNotificationDeepLink();
    startRealtime();
    schedulePushNotificationRefresh(true, true);
    void recordVisibleActivity();
    profileResult.then((result) => {
      if (!result.ok) console.warn("Profile load was deferred", result.error);
    });
    console.info(`[Mushavo] Admin workspace ready in ${Math.round(performance.now() - startedAt)}ms`);
    return;
  }

  const loadedFamily = await familyResult;
  if (!loadedFamily.ok) throw loadedFamily.error;

  // Finance data can load alongside workspace plans instead of adding another
  // network round trip before the dashboard is shown.
  const financialFamilyId = state.family?.id;
  const financialResult = settled(loadFamilyFinancialData());
  await loadWorkspaceSubscriptionData();

  if (state.headApproval?.status === "suspended") {
    if (state.family?.owner_id === state.session.user.id) {
      state.family = null;
      persistSelectedFamily();
      await loadWorkspaceSubscriptionData();
    }
    showToast("A shared workspace is suspended. Your Personal workspace remains available.");
  }

  const loadedFinances = await financialResult;
  if (!loadedFinances.ok) throw loadedFinances.error;
  if (financialFamilyId !== state.family?.id) await loadFamilyFinancialData();
  await loadPersonalPlanAccess();
  syncRouteForWorkspace("family");
  if (state.familyTab === "support") await loadUserSupportData();
  setView("app");
  renderFamilyApp();
  await handleNotificationDeepLink();
  startRealtime();
  schedulePushNotificationRefresh(true, true);
  void recordVisibleActivity();
  Promise.all([profileResult, invitationResult, notificationResult]).then((results) => {
    const labels = ["Profile", "Invitations", "Notifications"];
    results.forEach((result, index) => {
      if (!result.ok) console.warn(`${labels[index]} background load failed`, result.error);
    });
    if (!state.session || state.session.user.id !== loadingUserId) return;
    renderNotifications();
    if (state.familyTab === "members") renderInvitations();
  });
  console.info(`[Mushavo] Workspace ready in ${Math.round(performance.now() - startedAt)}ms`);
}

async function ensureProfile() {
  const user = state.session.user;
  const fullName =
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Household owner";
  const email = user.email?.toLowerCase() || null;

  const existingProfile = await query(
    "profile load",
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()
  );
  if (existingProfile) {
    state.profile = existingProfile;
    if (existingProfile.full_name !== fullName || existingProfile.email !== email) {
      query(
        "profile sync",
        supabase.from("profiles").update({ full_name: fullName, email }).eq("id", user.id).select("*").single()
      ).then((profile) => {
        state.profile = profile;
      }).catch((error) => console.warn("Profile sync was deferred", error));
    }
    return;
  }

  state.profile = await query(
    "profile create",
    supabase.from("profiles").insert({ id: user.id, full_name: fullName, email }).select("*").single()
  );
}

async function loadAccess({ skipAccountCheck = false } = {}) {
  if (!skipAccountCheck && await query("account status refresh", supabase.rpc("my_account_suspended"))) {
    stopRealtime();
    setView("suspended");
    return false;
  }
  const userEmail = state.session.user.email?.toLowerCase();
  const [adminRows, headRows] = await Promise.all([
    query(
      "admin access load",
      supabase.from("app_admins").select("*").eq("user_id", state.session.user.id).limit(1)
    ),
    query(
      "head access load",
      supabase.from("family_heads").select("*").ilike("email", userEmail).limit(1)
    )
  ]);
  state.isAdmin = adminRows.length > 0;
  state.adminRole = adminRows[0]?.role || (state.isAdmin ? "super_admin" : null);
  state.headApproval = headRows[0] || null;
  return true;
}

async function loadFamily() {
  const [families, memberships] = await Promise.all([
    query(
      "families load",
      supabase.from("families").select("*").order("created_at", { ascending: true })
    ),
    query(
      "family memberships load",
      supabase.from("family_members").select("family_id, user_id, email, role, status")
    )
  ]);
  const userId = state.session.user.id;
  const userEmail = state.session.user.email?.toLowerCase();
  const joinedFamilyIds = new Set(
    memberships
      .filter((member) =>
        member.status === "active" &&
        (member.user_id === userId || member.email?.toLowerCase() === userEmail)
      )
      .map((member) => member.family_id)
  );
  state.families = families.filter((family) => family.owner_id === userId || joinedFamilyIds.has(family.id));
  const storedFamilyId = window.localStorage.getItem(selectedFamilyStorageKey());
  state.family = storedFamilyId === "__personal__"
    ? null
    : state.families.find((family) => family.id === storedFamilyId) ||
      state.families.find((family) => family.id === state.family?.id) ||
      state.families[0] ||
      null;
  persistSelectedFamily();
}

function selectedFamilyStorageKey() {
  return `mushavo-budget:selected-family:${state.session?.user?.id || "guest"}`;
}

function persistSelectedFamily() {
  const key = selectedFamilyStorageKey();
  if (state.family?.id) window.localStorage.setItem(key, state.family.id);
  else window.localStorage.setItem(key, "__personal__");
}

async function selectFamily(familyId) {
  if (familyId === "__personal__") {
    if (!state.family) return;
    state.family = null;
    state.editingObligationId = null;
    resetPaymentListView();
    persistSelectedFamily();
    await Promise.all([loadFamilyFinancialData(), loadWorkspaceSubscriptionData()]);
    renderFamilyApp();
    return;
  }
  const family = state.families.find((item) => item.id === familyId);
  if (!family || family.id === state.family?.id) return;
  state.family = family;
  state.editingObligationId = null;
  resetPaymentListView();
  persistSelectedFamily();
  await Promise.all([loadFamilyFinancialData(), loadWorkspaceSubscriptionData()]);
  renderFamilyApp();
}

function resetPaymentListView() {
  state.paymentSearch = "";
  state.paymentHistoryItemId = null;
  state.recordPaymentOccurrenceChoices = [];
  resetDashboardDisclosureState();
  if ($("#paymentHistoryDialog")?.open) $("#paymentHistoryDialog").close();
  if ($("#recordPaymentDialog")?.open) $("#recordPaymentDialog").close();
}

function resetDashboardDisclosureState() {
  dashboardDisclosureState.months.clear();
  dashboardDisclosureState.occurrences.clear();
  dashboardDisclosureState.workloads.clear();
}

async function loadFamilyData() {
  await Promise.all([loadFamilyFinancialData(), loadInvitations(), loadNotifications()]);
}

async function loadFamilyFinancialData() {
  await Promise.all([loadMembers(), loadPaymentItems(), loadPaymentRecords()]);
}

async function loadMembers() {
  if (!state.family) {
    state.members = [];
    return;
  }
  state.members = await query(
    "members load",
    supabase
      .from("family_members")
      .select("*")
      .eq("family_id", state.family.id)
      .order("created_at", { ascending: true })
  );
}

async function loadPaymentItems() {
  let request = supabase.from("payment_items").select("*");
  request = state.family
    ? request.or(`visibility.eq.personal,family_id.eq.${state.family.id}`)
    : request.eq("visibility", "personal");
  state.paymentItems = await query("payment items load", request.order("created_at", { ascending: false }));
  await loadPersonalPlanAccess();
}

async function loadPersonalPlanAccess() {
  const personalWorkspace = state.workspaces.find((workspace) =>
    workspace.workspace_type === "personal" && workspace.owner_id === state.session.user.id && workspace.status !== "closed"
  );
  state.personalPlanAccess = personalWorkspace
    ? await query("personal payment plan access", supabase.rpc("personal_payment_plan_access", { p_workspace_id: personalWorkspace.id }))
    : [];
}

function isPlanPaused(item) {
  return item.visibility === "personal" && state.personalPlanAccess.some((access) =>
    access.payment_item_id === item.id && access.plan_paused
  );
}

function isPaymentActive(item) {
  return item.status === "active" && !isPlanPaused(item);
}

async function loadPaymentRecords() {
  let request = supabase.from("payment_records").select("*");
  request = state.family
    ? request.or(`visibility.eq.personal,family_id.eq.${state.family.id}`)
    : request.eq("visibility", "personal");
  state.paymentRecords = await query(
    "payment records load",
    request.order("payment_date", { ascending: false }).order("created_at", { ascending: false })
  );
}

async function loadInvitations() {
  state.familyInvitations = await query(
    "family invitations load",
    supabase
      .from("family_invitations")
      .select("*, families(name, owner_email)")
      .order("created_at", { ascending: false })
  );
}

async function loadNotifications() {
  state.notifications = await query(
    "notifications load",
    supabase
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(30)
  );
}

async function loadUserSupportData() {
  const [tickets, messages] = await Promise.all([
    query("support tickets load", supabase.from("support_tickets").select("*").order("updated_at", { ascending: false })),
    query("support ticket messages load", supabase.from("support_ticket_messages").select("*").order("created_at", { ascending: true }))
  ]);
  state.supportTickets = tickets;
  state.supportTicketMessages = messages;
}

function currentBudgetWorkspace() {
  if (state.family) {
    return state.workspaces.find((workspace) => workspace.legacy_family_id === state.family.id) || null;
  }
  return state.workspaces.find((workspace) => workspace.workspace_type === "personal") || null;
}

function workspaceNotificationType(workspace) {
  if (workspace?.workspace_type === "household") return "Family";
  if (workspace?.workspace_type === "business") return "Business";
  return "Personal";
}

function workspaceNotificationLabel(workspace) {
  if (!workspace) return null;
  return `${workspaceNotificationType(workspace)} · ${workspace.name || "Workspace"}`;
}

function paymentItemWorkspace(item) {
  const directWorkspace = state.workspaces.find((workspace) => workspace.id === item?.workspace_id);
  if (directWorkspace) return directWorkspace;

  if (item?.visibility === "family" || item?.family_id) {
    const family = state.families.find((entry) => entry.id === item.family_id)
      || (state.family?.id === item.family_id ? state.family : null);
    const workspace = state.workspaces.find((entry) => entry.legacy_family_id === item.family_id);
    return workspace || (family ? { workspace_type: "household", name: family.name } : null);
  }

  return state.workspaces.find((workspace) =>
    workspace.workspace_type === "personal" &&
    (!item?.owner_id || workspace.owner_id === item.owner_id)
  ) || {
    workspace_type: "personal",
    name: state.profile?.full_name ? `${state.profile.full_name}'s workspace` : "My workspace"
  };
}

function paymentWorkspaceLabel(item) {
  return workspaceNotificationLabel(paymentItemWorkspace(item))
    || (item?.visibility === "family" ? "Family workspace" : "Personal workspace");
}

function paymentWorkspaceClass(item) {
  const workspaceType = paymentItemWorkspace(item)?.workspace_type;
  if (workspaceType === "household") return "family";
  if (workspaceType === "business") return "business";
  return "personal";
}

function notificationWorkspace(notification) {
  const workspace = [...state.workspaces, ...state.adminWorkspaces]
    .find((item) => item.id === notification?.workspace_id);
  if (workspace) return workspace;

  const familyId = notification?.family_id;
  if (!familyId) return null;
  const family = state.families.find((item) => item.id === familyId)
    || state.adminFamilies.find((item) => item.id === familyId)
    || state.familyInvitations.find((item) => item.family_id === familyId)?.families;
  return family ? { workspace_type: "household", name: family.name } : null;
}

async function selectNotificationWorkspace(workspaceId) {
  if (!workspaceId || state.isAdmin) return true;
  const workspace = state.workspaces.find((item) =>
    item.id === workspaceId && item.status !== "closed"
  );
  if (!workspace) return false;
  if (currentBudgetWorkspace()?.id === workspace.id) return true;

  if (workspace.workspace_type === "personal") {
    await selectFamily("__personal__");
  } else if (workspace.workspace_type === "household" && workspace.legacy_family_id) {
    if (!state.families.some((family) => family.id === workspace.legacy_family_id)) return false;
    await selectFamily(workspace.legacy_family_id);
  } else {
    return false;
  }
  return currentBudgetWorkspace()?.id === workspace.id;
}

function currentWorkspaceIsOwned() {
  return currentBudgetWorkspace()?.owner_id === state.session?.user?.id;
}

async function loadWorkspaceSubscriptionData() {
  let [workspaces, members, plans, prices, features, limits, supportedCurrencies] = await Promise.all([
    query("workspace load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: true })),
    query("workspace membership load", supabase.from("workspace_members").select("*").order("created_at", { ascending: true })),
    query("plan catalogue load", supabase.from("plans").select("*").eq("is_active", true).order("sort_order", { ascending: true })),
    query("plan prices load", supabase.from("plan_prices").select("*").eq("is_active", true).order("effective_from", { ascending: false })),
    query("plan features load", supabase.from("plan_features").select("*").eq("enabled", true)),
    query("plan limits load", supabase.from("plan_limits").select("*")),
    query("supported currencies load", supabase.from("supported_currencies").select("*").eq("is_active", true).order("code"))
  ]);
  // Existing accounts already have a Personal workspace. Only provision a
  // missing one, avoiding an extra RPC round trip on every sign-in.
  if (!workspaces.some((workspace) => workspace.workspace_type === "personal" &&
    workspace.owner_id === state.session.user.id && workspace.status !== "closed")) {
    await query("personal workspace provision", supabase.rpc("provision_my_budget_workspace"));
    [workspaces, members] = await Promise.all([
      query("workspace load after provision", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: true })),
      query("workspace membership load after provision", supabase.from("workspace_members").select("*").order("created_at", { ascending: true }))
    ]);
  }
  state.workspaces = workspaces;
  state.workspaceMembers = members;
  state.plans = plans;
  state.planPrices = prices;
  state.planFeatures = features;
  state.planLimits = limits;
  state.supportedCurrencies = supportedCurrencies;
  populateWorkspaceCreationCurrencySelects();

  const workspace = currentBudgetWorkspace();
  if (!workspace) throw new Error("Your subscription workspace could not be reconciled. Run the complete Supabase schema again.");

  const personalWorkspace = workspaces.find((item) =>
    item.workspace_type === "personal" && item.owner_id === state.session.user.id && item.status !== "closed");
  const ownedFamilyIds = workspaces.filter((item) =>
    item.workspace_type === "household" && item.owner_id === state.session.user.id && item.status !== "closed")
    .map((item) => item.id);

  const [subscriptions, entitlements, billableMemberCount, memberUsage, requests, invoices, payments, history, settings, rates, rateStatus, conversions, ownPersonalSubscription, ownPersonalEntitlement, ownedFamilySubscriptions] = await Promise.all([
    query("workspace subscription load", supabase.from("workspace_subscriptions").select("*").eq("workspace_id", workspace.id).limit(1)),
    query("workspace entitlement load", supabase.rpc("effective_workspace_entitlement", { p_workspace_id: workspace.id })),
    query("workspace seat usage load", supabase.rpc("workspace_billable_member_count", { p_workspace_id: workspace.id })),
    query("workspace member capacity load", supabase.rpc("workspace_member_usage", { p_workspace_id: workspace.id })),
    query("renewal requests load", supabase.from("subscription_renewal_requests").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("subscription invoices load", supabase.from("subscription_invoices").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("subscription payments load", supabase.from("subscription_payments").select("*").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("entitlement history load", supabase.from("subscription_entitlement_history").select("*, plans(display_name, code)").eq("workspace_id", workspace.id).order("created_at", { ascending: false })),
    query("workspace currency settings load", supabase.from("workspace_settings").select("*").eq("workspace_id", workspace.id).single()),
    query("exchange rates load", supabase.from("exchange_rate_snapshots").select("quote_currency, rate, provider_effective_at, fetched_at, provider").eq("base_currency", "USD").order("provider_effective_at", { ascending: false }).limit(500)),
    query("exchange rate status load", supabase.rpc("exchange_rate_status", { p_include_admin_details: false })),
    query("payment conversions load", supabase.from("payment_conversions").select("*").eq("workspace_id", workspace.id).order("rate_effective_at", { ascending: false })),
    personalWorkspace && workspace.id !== personalWorkspace.id
      ? query("own personal subscription load", supabase.from("workspace_subscriptions").select("*").eq("workspace_id", personalWorkspace.id).limit(1))
      : Promise.resolve([]),
    personalWorkspace && workspace.id !== personalWorkspace.id
      ? query("own personal plan load", supabase.rpc("effective_workspace_entitlement", { p_workspace_id: personalWorkspace.id }))
      : Promise.resolve([]),
    ownedFamilyIds.length
      ? query("owned family plans load", supabase.from("workspace_subscriptions").select("*").in("workspace_id", ownedFamilyIds))
      : Promise.resolve([])
  ]);
  state.workspaceSubscription = subscriptions[0] || null;
  state.workspaceEntitlement = entitlements[0] || null;
  state.personalWorkspaceSubscription = workspace.id === personalWorkspace?.id
    ? subscriptions[0] || null : ownPersonalSubscription[0] || null;
  state.personalWorkspaceEntitlement = workspace.id === personalWorkspace?.id
    ? entitlements[0] || null : ownPersonalEntitlement[0] || null;
  state.ownedFamilySubscriptions = ownedFamilySubscriptions;
  state.billableMemberCount = Number(billableMemberCount || 1);
  state.memberUsage = memberUsage[0] || {
    active_member_count: 1,
    pending_invitation_count: 0,
    used_member_count: 1,
    member_limit: Number(subscriptions[0]?.member_limit || 1),
    available_member_count: Math.max(0, Number(subscriptions[0]?.member_limit || 1) - 1)
  };
  state.renewalRequests = requests;
  state.subscriptionInvoices = invoices;
  state.subscriptionPayments = payments;
  state.entitlementHistory = history;
  state.workspaceSettings = settings;
  state.exchangeRates = rates;
  state.exchangeRateStatus = rateStatus;
  state.paymentConversions = conversions;
  const planWorkspace = workspace.owner_id === state.session.user.id
    ? workspace
    : personalWorkspace || workspace;
  const planSubscription = planWorkspace.id === workspace.id
    ? subscriptions[0]
    : ownPersonalSubscription[0];
  if (state.workspacePlanWorkspaceId !== planWorkspace.id) {
    state.workspacePlanWorkspaceId = planWorkspace.id;
    state.workspacePlanBillingPeriod = planSubscription?.billing_period === "annual" ? "annual" : "monthly";
    state.workspacePlanCurrency = planWorkspace.id === workspace.id
      ? settings?.default_payment_currency || planWorkspace.currency || null
      : planWorkspace.currency || null;
  }
}

async function loadAdminData(tab = state.adminTab) {
  if (tab === "analytics") return loadAdminAnalytics();
  const tasks = [];
  const assign = [];

  const add = (target, label, request) => {
    tasks.push(query(label, request));
    assign.push(target);
  };

  if (["dashboard", "households", "users", "support"].includes(tab)) {
    add("adminFamilies", "admin families load", supabase.from("families").select("*").order("created_at", { ascending: false }));
  }
  if (tab === "dashboard") {
    add("adminWorkspaces", "admin workspace summary load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
    add("adminProfiles", "admin registered users load", supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    add("adminMembers", "dashboard family members load", supabase.from("family_members").select("*").order("created_at", { ascending: true }));
    add("adminWorkspaceMembers", "dashboard workspace members load", supabase.from("workspace_members").select("*").order("created_at", { ascending: true }));
    add("adminSubscriptions", "admin subscriptions load", supabase.from("workspace_subscriptions").select("*").order("updated_at", { ascending: false }));
    add("adminPlans", "admin plans load", supabase.from("plans").select("*").order("sort_order", { ascending: true }));
    add("adminSubscriptionMonitor", "admin subscription monitor load", supabase.rpc("admin_subscription_monitor"));
  }
  if (["dashboard", "households", "users", "finance"].includes(tab)) {
    add("heads", "heads load", supabase.from("family_heads").select("*").order("created_at", { ascending: false }));
  }
  if (["households", "users", "finance"].includes(tab)) {
    add("adminSubscriptionMonitor", "subscription monitor load", supabase.rpc("admin_subscription_monitor"));
  }
  if (tab === "users") {
    add("adminProfiles", "registered users load", supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    add("adminMembers", "user family members load", supabase.from("family_members").select("*").order("created_at", { ascending: true }));
    add("adminWorkspaces", "user workspaces load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
    add("adminWorkspaceMembers", "user workspace membership load", supabase.from("workspace_members").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptions", "user subscriptions load", supabase.from("workspace_subscriptions").select("*").order("updated_at", { ascending: false }));
    add("adminPlans", "user plans load", supabase.from("plans").select("*").order("sort_order", { ascending: true }));
    add("adminPlanPrices", "user plan prices load", supabase.from("plan_prices").select("*").eq("is_active", true).order("effective_from", { ascending: false }));
    add("supportedCurrencies", "user supported currencies load", supabase.from("supported_currencies").select("*").eq("is_active", true).order("code"));
    if (["super_admin", "admin_staff"].includes(state.adminRole)) {
      add("adminUserInvitations", "admin user invitations load", supabase.from("admin_user_invitations").select("*").order("created_at", { ascending: false }).limit(50));
    }
  }
  if (tab === "households") {
    add("adminProfiles", "workspace owner profiles load", supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    add("adminMembers", "admin members load", supabase.from("family_members").select("*").order("created_at", { ascending: true }));
    add("adminWorkspaces", "workspace directory load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
    add("adminWorkspaceMembers", "workspace member directory load", supabase.from("workspace_members").select("*").order("created_at", { ascending: true }));
    add("adminSubscriptions", "workspace subscription directory load", supabase.from("workspace_subscriptions").select("*").order("updated_at", { ascending: false }));
    add("adminPlans", "workspace plan directory load", supabase.from("plans").select("*").order("sort_order", { ascending: true }));
  }
  if (tab === "households") {
    add("adminPaymentItems", "admin payment items load", supabase.from("payment_items").select("*").order("created_at", { ascending: false }));
    add("adminPaymentRecords", "admin payment records load", supabase.from("payment_records").select("*").order("payment_date", { ascending: false }));
  }
  if (["dashboard", "finance"].includes(tab)) {
    add(
      "payments",
      "payments load",
      supabase
        .from("payments")
        .select("*, family_heads(full_name, email, billing_status, status)")
        .order("payment_date", { ascending: false })
        .order("created_at", { ascending: false })
    );
  }
  if (tab === "support") {
    add("adminNotes", "admin notes load", supabase.from("admin_support_notes").select("*").order("created_at", { ascending: false }));
    add("adminProfiles", "support profiles load", supabase.from("profiles").select("*").order("created_at", { ascending: false }));
    add("adminWorkspaces", "support workspaces load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
    add("adminSupportTickets", "support tickets load", supabase.from("support_tickets").select("*").order("updated_at", { ascending: false }));
    add("adminSupportMessages", "support messages load", supabase.from("support_ticket_messages").select("*").order("created_at", { ascending: true }));
    add("adminStaff", "support staff load", supabase.from("app_admins").select("*").order("created_at", { ascending: true }));
  }
  if (["dashboard", "enquiries"].includes(tab)) {
    add("adminEnquiries", "public enquiries load", supabase.from("enquiries").select("*").order("created_at", { ascending: false }));
  }
  if (["plans", "finance"].includes(tab)) {
    add("adminPlans", "admin plans load", supabase.from("plans").select("*").order("sort_order", { ascending: true }));
    add("adminPlanPrices", "admin plan prices load", supabase.from("plan_prices").select("*").order("effective_from", { ascending: false }));
  }
  if (tab === "plans") {
    add("adminPlanFeatures", "admin plan features load", supabase.from("plan_features").select("*").order("feature_code"));
    add("adminPlanLimits", "admin plan limits load", supabase.from("plan_limits").select("*").order("limit_code"));
  }
  if (["dashboard", "households", "users", "finance"].includes(tab)) {
    add("adminSubscriptionPayments", "admin subscription payments load", supabase.from("subscription_payments").select("*").order("created_at", { ascending: false }));
  }
  if (["dashboard", "households", "users", "finance"].includes(tab)) {
    if (tab === "finance") {
      add("adminProfiles", "finance user profiles load", supabase.from("profiles").select("*").order("created_at", { ascending: false }));
      add("adminWorkspaces", "admin workspaces load", supabase.from("budget_workspaces").select("*").order("created_at", { ascending: false }));
      add("adminSubscriptions", "admin subscriptions load", supabase.from("workspace_subscriptions").select("*").order("updated_at", { ascending: false }));
      add("supportedCurrencies", "finance supported currencies load", supabase.from("supported_currencies").select("*").eq("is_active", true).order("code"));
      add("exchangeRates", "finance exchange rates load", supabase.from("exchange_rate_snapshots").select("quote_currency, rate, provider_effective_at, fetched_at, provider").eq("base_currency", "USD").order("provider_effective_at", { ascending: false }).limit(500));
      add("adminFinanceSettings", "admin finance currency settings load", supabase.from("admin_finance_settings").select("*").eq("id", 1).single());
      add("adminPaymentConversions", "admin payment conversions load", supabase.from("payment_conversions").select("*").is("workspace_id", null).order("rate_effective_at", { ascending: false }));
      add("adminRateStatus", "admin exchange rate status load", supabase.rpc("exchange_rate_status", { p_include_admin_details: true }));
    }
    add("adminRenewalRequests", "admin renewal requests load", supabase.from("subscription_renewal_requests").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptionInvoices", "admin subscription invoices load", supabase.from("subscription_invoices").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptionProofs", "admin subscription proofs load", supabase.from("subscription_payment_proofs").select("*").order("created_at", { ascending: false }));
    add("adminSubscriptionReviews", "admin subscription reviews load", supabase.from("subscription_payment_reviews").select("*").order("created_at", { ascending: false }));
  }

  const results = await Promise.all(tasks);
  assign.forEach((target, index) => {
    state[target] = results[index];
  });
}

function renderFamilyApp() {
  renderFamilyTabs();
  renderFamilyHeader();
  renderMemberOptions();
  renderPaymentScope();
  renderNotifications();
  const workspaceReadOnly = Boolean(state.workspaceEntitlement?.read_only || state.workspaceEntitlement?.effective_status === "suspended");
  const banner = $("#workspaceAccessBanner");
  banner.classList.toggle("hidden", !workspaceReadOnly);
  if (workspaceReadOnly) {
    banner.innerHTML = state.workspaceEntitlement?.effective_status === "suspended"
      ? "<strong>Family workspace suspended.</strong> An administrator must restore access. Your Personal workspace remains available."
      : `<strong>Family subscription expired.</strong> This workspace is read-only. ${currentWorkspaceIsOwned() ? "Renew it from Subscription." : "Ask the family head to renew it."}`;
  }
  document.querySelectorAll("[data-open-payment-item-dialog]").forEach((button) => {
    button.disabled = workspaceReadOnly;
    button.title = workspaceReadOnly ? "Renew this workspace to change payments" : "";
  });

  if (state.familyTab === "dashboard") renderDashboard();
  if (state.familyTab === "payments") renderObligations();
  if (state.familyTab === "members") {
    renderMemberAccess();
    renderMembers();
    renderInvitations();
  }
  if (state.familyTab === "settings") renderSettings();
  if (state.familyTab === "reports") renderReports();
  if (state.familyTab === "subscription") renderSubscription();
  if (state.familyTab === "support") renderUserSupport();
}

function renderFamilyTabs() {
  document.querySelectorAll("[data-family-tab]").forEach((button) => {
    button.classList.toggle("active", button.dataset.familyTab === state.familyTab);
  });
  document.querySelectorAll("[data-family-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.familyPanel !== state.familyTab);
  });
}

function renderFamilyHeader() {
  const title = state.family?.name || "Personal budget";
  $("#householdTitle").textContent = title;
  $("#mobileHouseholdTitle").textContent = title;
  const billing = state.workspaceEntitlement
    ? `${state.workspaceEntitlement.plan_name} - ${titleCase(state.workspaceEntitlement.effective_status)}`
    : hasActiveMembership() ? "Household - Active" : "Free - Active";
  $("#headBillingBadge").textContent = billing;
  $("#headBillingBadge").className = `mini-badge ${badgeClass(billing)}`;
  renderFamilySelectors();
  $("#dashboardMonthTitle").textContent = parseDate(monthStart(state.filterMonth)).toLocaleString("en", {
    month: "long",
    year: "numeric"
  });
}

function canAddMembers() {
  return canManageMembersForFamily(state.family?.id);
}

function canCreateFamily() {
  return hasActiveMembership() && ownedFamilies().length < familyLimit();
}

function hasActiveMembership() {
  return state.headApproval?.status === "active";
}

function familyLimit() {
  return Math.max(0, Number(state.headApproval?.family_limit ?? 1));
}

function ownedFamilies() {
  return state.families.filter((family) => family.owner_id === state.session?.user?.id);
}

function canManageMembersForFamily(familyId) {
  const family = state.families.find((item) => item.id === familyId);
  const activeHouseholdEntitlement = family?.id === state.family?.id
    && state.workspaceEntitlement?.plan_code === "household"
    && state.workspaceEntitlement?.effective_status === "active"
    && !state.workspaceEntitlement?.read_only;
  return Boolean(
    family &&
    family.owner_id === state.session?.user?.id &&
    activeHouseholdEntitlement
  );
}

function renderFamilySelectors() {
  document.querySelectorAll("[data-family-selector]").forEach((select) => {
    select.innerHTML = "";
    select.append(new Option("Personal budget", "__personal__"));
    state.families.forEach((family) => select.append(new Option(family.name, family.id)));
    select.value = state.family?.id || "__personal__";
    select.disabled = state.families.length === 0;
  });
}

function renderMemberAccess() {
  const allowedToCreate = canCreateFamily();
  const owned = ownedFamilies();
  const manageableFamilies = owned.filter((family) => canManageMembersForFamily(family.id));
  const selectedMemberUsage = state.memberUsage || {};
  const selectedMemberLimit = Math.max(1, Number(selectedMemberUsage.member_limit || state.workspaceSubscription?.member_limit || 1));
  const selectedActiveMembers = Number(selectedMemberUsage.active_member_count ?? state.members.filter((member) => member.status === "active").length);
  const selectedPendingInvites = Number(selectedMemberUsage.pending_invitation_count ?? state.familyInvitations.filter((invite) => invite.family_id === state.family?.id && invite.status === "pending").length);
  const selectedAvailablePlaces = Math.max(0, Number(selectedMemberUsage.available_member_count ?? selectedMemberLimit - selectedActiveMembers - selectedPendingInvites));
  const familyCount = owned.length;
  const limit = familyLimit();
  const creationNotice = $("#familyCreationNotice");
  $("#purchaseFamilySubscription").textContent = familyCount > 0
    ? "Purchase another Family subscription" : "Purchase Family subscription";
  creationNotice.classList.toggle("hidden", allowedToCreate);
  if (!allowedToCreate) {
    if (!hasActiveMembership()) {
      $("#familyCreationNoticeTitle").textContent = "Active subscription required.";
      $("#familyCreationNoticeText").textContent = "Purchase a Family subscription to create a family after payment approval. You can still join a family by invitation.";
    } else {
      $("#familyCreationNoticeTitle").textContent = "Family limit reached.";
      $("#familyCreationNoticeText").textContent = `You currently own ${familyCount} of ${limit} allowed families. Purchase another Family subscription to add a separate family. It will be created after payment approval.`;
    }
  }
  const createTitle = $("#createFamilyTitle");
  const createPanelCopy = createTitle?.parentElement?.querySelector(".muted-copy");
  const createButton = $("#memberFamilyForm").querySelector('button[type="submit"]');
  createTitle.textContent = "Create another family";
  if (createPanelCopy) createPanelCopy.textContent = "Your admin controls how many families your account may own.";
  createButton.textContent = "Create family";
  $("#memberFamilyForm").querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = !allowedToCreate;
  });
  $("#memberFamilyForm").closest(".tool-panel").classList.toggle("hidden", !allowedToCreate);
  $("#familyManagementGrid").classList.toggle("hidden", !allowedToCreate);

  const inviteFamily = $("#inviteFamily");
  const previousInviteFamily = inviteFamily.value;
  inviteFamily.innerHTML = "";
  manageableFamilies.forEach((family) => inviteFamily.append(new Option(family.name, family.id)));
  inviteFamily.value = manageableFamilies.some((family) => family.id === previousInviteFamily)
    ? previousInviteFamily
    : manageableFamilies.find((family) => family.id === state.family?.id)?.id || manageableFamilies[0]?.id || "";
  const selectedFamilyIsManageable = manageableFamilies.some((family) => family.id === state.family?.id);
  const selectedFamilyHasCapacity = !selectedFamilyIsManageable || selectedAvailablePlaces > 0;
  const allowedToInvite = manageableFamilies.length > 0 && selectedFamilyHasCapacity;
  $("#inviteMemberButton").disabled = !allowedToInvite;
  $("#inviteForm").querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = !allowedToInvite;
  });
  const memberNotice = $("#memberAccessNotice");
  memberNotice.classList.toggle("hidden", allowedToInvite);
  if (!allowedToInvite) {
    memberNotice.innerHTML = selectedFamilyIsManageable && selectedAvailablePlaces === 0
      ? `<strong>All ${selectedMemberLimit} paid places are in use.</strong> Active members and pending invitations reserve places. Use Buy more places above before inviting someone else.`
      : owned.length
        ? "<strong>Member management is locked.</strong> The subscription must be active before you can invite or remove family members."
        : "<strong>Only a family owner can manage members.</strong> You can participate in families you joined, but only their owner can invite or remove members.";
  }

  const selectedFamilyPanel = $("#selectedFamilyPanel");
  const ownsSelectedFamily = state.family?.owner_id === state.session?.user?.id;
  selectedFamilyPanel.classList.toggle("hidden", !ownsSelectedFamily);
  if (ownsSelectedFamily) {
    $("#selectedFamilyTitle").textContent = state.family.name;
    $("#selectedFamilyMeta").textContent = `${selectedActiveMembers + selectedPendingInvites} of ${selectedMemberLimit} places reserved · ${familyCount} of ${limit} family workspaces used`;
    $("#selectedFamilySubscribedAt").textContent = formatSubscriptionDate(subscriptionStartDate(state.workspaceSubscription));
    $("#selectedFamilyPaidThrough").textContent = formatSubscriptionDate(state.workspaceSubscription?.paid_through_at);
    $("#selectedFamilyMemberCount").textContent = selectedActiveMembers;
    $("#selectedFamilyMemberLimit").textContent = selectedMemberLimit;
    $("#selectedFamilyAvailableCount").textContent = selectedAvailablePlaces;
    $("#selectedFamilyPaymentCount").textContent = state.paymentItems.filter((item) => item.family_id === state.family.id && item.status !== "inactive").length;
    $("#selectedFamilyInviteCount").textContent = selectedPendingInvites;
    const placesButton = $("#purchaseFamilyPlaces");
    const pendingPurchase = state.renewalRequests.some((request) => request.status === "pending_review");
    placesButton.disabled = pendingPurchase || selectedMemberLimit >= 100
      || !canManageMembersForFamily(state.family.id);
    placesButton.textContent = pendingPurchase ? "Payment awaiting review"
      : selectedMemberLimit >= 100 ? "Place limit reached" : "Buy more places";
  }
}

function renderMemberOptions() {
  const obligationMember = $("#obligationMember");
  const recordPaidBy = $("#recordPaidBy");
  const previousPayer = recordPaidBy.value;
  obligationMember.innerHTML = `<option value="">Select responsible member</option>`;
  recordPaidBy.innerHTML = `<option value="">Select the family member who paid</option>`;

  activeMembers().forEach((member) => {
    const option = document.createElement("option");
    option.value = member.id;
    option.textContent = `${member.name} (${member.role})`;
    obligationMember.append(option);

    const payer = document.createElement("option");
    payer.value = member.id;
    payer.textContent = `${member.name} (${member.role})`;
    recordPaidBy.append(payer);
  });
  if ($("#recordPaymentDialog")?.open && activeMembers().some((member) => member.id === previousPayer)) {
    recordPaidBy.value = previousPayer;
  }
}

function renderPaymentScope() {
  const scope = $("#paymentScope");
  if (!scope) return;
  const familyOption = scope.querySelector('option[value="family"]');
  familyOption.disabled = !state.family;
  if (!state.family && scope.value === "family") scope.value = "personal";
  const responsibleMember = $("#obligationMember");
  const isFamilyPayment = Boolean(state.family && scope.value === "family");
  responsibleMember.disabled = !isFamilyPayment;
  responsibleMember.required = isFamilyPayment;
  if (isFamilyPayment && !responsibleMember.value && !state.editingObligationId) {
    responsibleMember.value = currentFamilyMember()?.id || familyOwnerMember()?.id || activeMembers()[0]?.id || "";
  }
}

function activeMembers() {
  return state.members.filter((member) => member.status !== "inactive");
}

function selectedOccurrences(items = state.paymentItems, records = state.paymentRecords) {
  return generateOccurrences(items, records, state.filterMonth).filter((occurrence) => {
    return state.filterStatus === "all" || occurrence.status === state.filterStatus;
  });
}

function previousUnpaidOccurrences(items = state.paymentItems, records = state.paymentRecords) {
  const activeItems = items.filter(isPaymentActive);
  const selectedMonth = parseDate(monthStart(state.filterMonth));
  const validStartDates = activeItems
    .map((item) => parseDate(item.start_date))
    .filter((date) => !Number.isNaN(date.getTime()) && date < selectedMonth);
  if (!validStartDates.length) return [];
  const earliestStart = validStartDates.reduce((earliest, date) => date < earliest ? date : earliest);
  const previousMonthCount = monthDiff(earliestStart, selectedMonth);
  const earliestMonth = toMonthValue(earliestStart);
  const unpaid = [];
  for (let offset = 0; offset < previousMonthCount; offset += 1) {
    unpaid.push(...generateOccurrences(activeItems, records, offsetMonthValue(earliestMonth, offset))
      .filter((occurrence) => occurrence.status !== "paid" && occurrence.outstanding > 0.00005));
  }
  return unpaid.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function generateOccurrences(items, records, monthValue) {
  const targetDate = parseDate(monthStart(monthValue));
  return items
    .filter(isPaymentActive)
    .flatMap((item) => {
      if (item.recurrence_type === "custom_days") {
        return dailyOccurrenceDatesInMonth(item, monthValue)
          .map((dueDate) => occurrenceForItem(item, records, targetDate, dueDate));
      }
      return isItemDueInMonth(item, targetDate)
        ? [occurrenceForItem(item, records, targetDate)]
        : [];
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function dateValueToUtcDayNumber(value) {
  const [year, month, day] = `${value}`.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}

function utcDayNumberToDateValue(dayNumber) {
  const date = new Date(dayNumber * 86400000);
  return `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, "0")}-${`${date.getUTCDate()}`.padStart(2, "0")}`;
}

function dailyOccurrenceDatesInMonth(item, monthValue) {
  const intervalDays = Math.max(Number(item.recurrence_interval || 1), 1);
  const startDay = dateValueToUtcDayNumber(item.start_date);
  const targetStartDay = dateValueToUtcDayNumber(monthStart(monthValue));
  const targetDate = parseDate(monthStart(monthValue));
  const targetEndDay = dateValueToUtcDayNumber(
    `${monthValue}-${`${lastDayOfMonth(targetDate.getFullYear(), targetDate.getMonth())}`.padStart(2, "0")}`
  );
  if (!Number.isFinite(startDay) || startDay > targetEndDay) return [];
  const firstStep = Math.max(0, Math.ceil((targetStartDay - startDay) / intervalDays));
  const dates = [];
  for (let day = startDay + firstStep * intervalDays; day <= targetEndDay; day += intervalDays) {
    dates.push(utcDayNumberToDateValue(day));
  }
  return dates;
}

function isItemDueInMonth(item, targetDate) {
  const start = parseDate(item.start_date);
  const diff = monthDiff(start, targetDate);
  if (diff < 0) return false;
  if (item.recurrence_type === "once") return diff === 0;
  if (item.recurrence_type === "yearly") return diff % 12 === 0;
  if (item.recurrence_type === "quarterly") return diff % 3 === 0;
  const interval = item.recurrence_type === "custom" ? Number(item.recurrence_interval || 1) : 1;
  return diff % Math.max(interval, 1) === 0;
}

function occurrenceForItem(item, records, targetDate, explicitDueDate = null) {
  const year = targetDate.getFullYear();
  const monthIndex = targetDate.getMonth();
  const day = Math.min(Number(item.due_day || 1), lastDayOfMonth(year, monthIndex));
  const dueDate = explicitDueDate || toDateValue(new Date(year, monthIndex, day));
  const periodStart = explicitDueDate || toDateValue(new Date(year, monthIndex, 1));
  const paid = records
    .filter((record) => record.payment_item_id === item.id && record.period_start === periodStart)
    .reduce((sum, record) => sum + Number(record.amount || 0), 0);
  const amount = Number(item.amount || 0);
  const outstanding = Math.max(amount - paid, 0);
  const status = occurrenceStatus(item, dueDate, paid, amount);
  return {
    key: `${item.id}:${periodStart}`,
    item,
    dueDate,
    periodStart,
    amount,
    paid,
    outstanding,
    status
  };
}

function occurrenceStatus(item, dueDate, paid, amount) {
  if (paid >= amount) return "paid";
  if (paid > 0) return "partial";
  const todayDate = parseDate(toDateValue(new Date()));
  const due = parseDate(dueDate);
  const days = Math.ceil((due - todayDate) / 86400000);
  if (days < 0) return "overdue";
  if (days <= Number(item.reminder_days_before ?? 3)) return "due-soon";
  return "upcoming";
}

function occurrenceCardStateClass(occurrence) {
  if (occurrence.status === "paid" || occurrence.outstanding <= 0.00005) return "payment-complete";
  const todayDay = dateValueToUtcDayNumber(toDateValue(new Date()));
  const dueDay = dateValueToUtcDayNumber(occurrence.dueDate);
  const reminderDays = Math.max(Number(occurrence.item.reminder_days_before ?? 3), 0);
  if (Number.isFinite(todayDay) && Number.isFinite(dueDay) && dueDay - todayDay <= reminderDays) {
    return "payment-reminder-active";
  }
  return "";
}

function renderDashboard() {
  const occurrences = selectedOccurrences();
  const previousUnpaid = previousUnpaidOccurrences();
  const attentionOccurrences = [...previousUnpaid, ...occurrences];
  const dueRows = occurrences.map((item) => ({ amount: item.amount, currency: item.item.currency }));
  const paidRows = occurrences.map((item) => ({ amount: item.paid, currency: item.item.currency }));
  const outstandingRows = attentionOccurrences.map((item) => ({ amount: item.outstanding, currency: item.item.currency }));
  const overdue = attentionOccurrences.filter((item) => item.status === "overdue");
  const myDue = myOccurrences(attentionOccurrences).filter((item) => item.status !== "paid");
  const dueSummary = dashboardAmountSummary(dueRows);
  const paidSummary = dashboardAmountSummary(paidRows);
  const outstandingSummary = dashboardAmountSummary(outstandingRows);
  const currencyCount = new Set(dueRows.map((row) => row.currency)).size;
  const percentage = dueSummary.scaled != null && dueSummary.scaled > 0n && paidSummary.scaled != null
    ? Math.min(Number((paidSummary.scaled * 10000n) / dueSummary.scaled) / 100, 100)
    : currencyCount <= 1
      ? (() => {
        const due = occurrences.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        const paid = occurrences.reduce((sum, item) => sum + Number(item.paid || 0), 0);
        return due > 0 ? Math.min((paid / due) * 100, 100) : 0;
      })()
      : occurrences.length ? (occurrences.filter((item) => item.status === "paid").length / occurrences.length) * 100 : 0;

  $("#dueAmount").textContent = dueSummary.text;
  $("#outstandingAmount").textContent = outstandingSummary.text;
  $("#outstandingText").textContent = attentionOccurrences.some((item) => item.outstanding > 0)
    ? outstandingSummary.converted
      ? `Converted to ${outstandingSummary.currency}`
      : outstandingSummary.scaled == null
        ? "Original currencies"
        : "Still outstanding"
    : "All clear";
  $("#overdueCount").textContent = overdue.length;
  $("#overdueText").textContent = overdue.length ? "Needs follow-up" : "No overdue dues";
  $("#myDueCount").textContent = myDue.length;
  $("#paidMeter").style.width = `${percentage}%`;
  $("#paidProgressText").textContent = occurrences.length ? `${Math.round(percentage)}% paid this month` : "No dues yet";

  renderPriorityDueList(occurrences, previousUnpaid);
  renderMemberResponsibility(attentionOccurrences);
  scheduleDashboardTextFit();
}

function scheduleDashboardTextFit() {
  if (dashboardFitFrame) cancelAnimationFrame(dashboardFitFrame);
  dashboardFitFrame = requestAnimationFrame(() => {
    dashboardFitFrame = null;
    const isMobile = window.matchMedia("(max-width: 680px)").matches;
    document.querySelectorAll("[data-fit-text]").forEach((element) => {
      element.style.removeProperty("font-size");
      if (!isMobile || element.clientWidth <= 0) return;
      const minimum = Number(element.dataset.fitMin || 11);
      let size = Number.parseFloat(window.getComputedStyle(element).fontSize);
      while (element.scrollWidth > element.clientWidth && size > minimum) {
        size = Math.max(minimum, size - 0.5);
        element.style.fontSize = `${size}px`;
      }
    });
  });
}

function renderPriorityDueList(occurrences, previousUnpaid = []) {
  const list = $("#priorityDueList");
  const statusPriority = { overdue: 0, partial: 1, "due-soon": 2, upcoming: 3, paid: 4 };
  const monthGroups = [];

  if (previousUnpaid.length) {
    monthGroups.push({
      monthOffset: -1,
      monthValue: "previous-unpaid",
      label: "Earlier months",
      title: "Previous unpaid",
      occurrences: previousUnpaid,
      alwaysExpanded: true
    });
  }

  for (let monthOffset = 0; monthOffset <= 6; monthOffset += 1) {
    const monthValue = offsetMonthValue(state.filterMonth, monthOffset);
    const monthOccurrences = (monthOffset === 0
      ? occurrences
      : generateOccurrences(state.paymentItems, state.paymentRecords, monthValue))
      .filter((item) => state.filterStatus === "all" || item.status === state.filterStatus)
      .sort((a, b) => statusPriority[a.status] - statusPriority[b.status] || a.dueDate.localeCompare(b.dueDate));

    monthGroups.push({ monthOffset, monthValue, occurrences: monthOccurrences });
  }

  list.innerHTML = "";
  monthGroups.forEach((group, groupIndex) => {
    const section = document.createElement("section");
    const isCurrentMonth = group.monthOffset === 0;
    const isExpanded = group.alwaysExpanded || isCurrentMonth || dashboardDisclosureState.months.has(group.monthValue);
    section.className = `due-month-group month-accent-${groupIndex % 4}${isExpanded ? " expanded" : " collapsed"}`;
    section.dataset.month = group.monthValue;
    const monthTitle = group.title || parseDate(monthStart(group.monthValue)).toLocaleString("en", {
      month: "long",
      year: "numeric"
    });
    const totalOutstanding = dashboardAmountSummary(group.occurrences.map((occurrence) => ({
      currency: occurrence.item.currency,
      amount: occurrence.outstanding
    }))).text;
    const summary = group.occurrences.length
      ? `${group.occurrences.length} payment${group.occurrences.length === 1 ? "" : "s"} · ${totalOutstanding} outstanding`
      : "No payments scheduled";
    section.innerHTML = `
      <button class="due-month-header" type="button" ${group.alwaysExpanded || isCurrentMonth ? "disabled" : "data-toggle-due-month"} aria-expanded="${isExpanded}" aria-controls="due-month-${group.monthValue}">
        <div>
          <span>${group.label || (group.monthOffset === 0 ? "Selected month" : "Upcoming month")}</span>
          <h4>${escapeHtml(monthTitle)}</h4>
        </div>
        <span class="due-month-summary"><small title="${escapeHtml(summary)}">${escapeHtml(summary)}</small>${group.alwaysExpanded || isCurrentMonth ? "" : '<span class="accordion-chevron" aria-hidden="true">⌄</span>'}</span>
      </button>
      <div id="due-month-${group.monthValue}" class="due-month-items" ${isExpanded ? "" : "hidden"}></div>
    `;
    const items = section.querySelector(".due-month-items");
    if (group.occurrences.length) {
      group.occurrences.forEach((occurrence) => items.append(renderOccurrenceCard(occurrence, true, true)));
    } else {
      items.innerHTML = emptyState("No payments this month", "There are no scheduled payments for this month and filter.");
    }
    list.append(section);
  });
}

function renderMemberResponsibility(occurrences) {
  const list = $("#memberResponsibilityList");
  const rows = activeMembers().map((member) => {
    const assigned = occurrences.filter((occurrence) => effectiveResponsibleMember(occurrence.item)?.id === member.id);
    return {
      member,
      key: member.id,
      name: member.name,
      role: member.role,
      assigned,
      overdueCount: assigned.filter((item) => item.status === "overdue").length,
      partialCount: assigned.filter((item) => item.status === "partial").length,
      dueSoonCount: assigned.filter((item) => item.status === "due-soon").length
    };
  }).filter((row) => row.assigned.length > 0);

  const householdAssigned = occurrences.filter((occurrence) =>
    occurrence.item.visibility === "family" && !effectiveResponsibleMember(occurrence.item)
  );
  if (householdAssigned.length) {
    rows.push({
      member: null,
      key: "household",
      name: "Household account",
      role: "Unassigned family payments",
      assigned: householdAssigned,
      overdueCount: householdAssigned.filter((item) => item.status === "overdue").length,
      partialCount: householdAssigned.filter((item) => item.status === "partial").length,
      dueSoonCount: householdAssigned.filter((item) => item.status === "due-soon").length
    });
  }

  if (!rows.length) {
    list.innerHTML = emptyState("No assigned dues", "Assign members to recurring obligations to see responsibility totals.");
    return;
  }

  const statusRank = { overdue: 0, partial: 1, "due soon": 2, "on track": 3, paid: 4 };
  rows.forEach((row) => {
    row.totalSummary = dashboardAmountSummary(row.assigned.map((item) => ({
      amount: item.amount,
      currency: item.item.currency
    })));
    row.paidSummary = dashboardAmountSummary(row.assigned.map((item) => ({
      amount: Math.min(item.paid, item.amount),
      currency: item.item.currency
    })));
    row.outstandingSummary = dashboardAmountSummary(row.assigned.map((item) => ({
      amount: item.outstanding,
      currency: item.item.currency
    })));
    row.hasOutstanding = row.assigned.some((item) => item.outstanding > 0);
    row.progress = row.totalSummary.scaled != null && row.totalSummary.scaled > 0n && row.paidSummary.scaled != null
      ? Math.min(Number((row.paidSummary.scaled * 10000n) / row.totalSummary.scaled) / 100, 100)
      : row.assigned.length
        ? row.assigned.reduce((sum, item) => sum + (item.amount > 0 ? Math.min(item.paid / item.amount, 1) : 1), 0) / row.assigned.length * 100
        : 0;
    row.status = row.overdueCount
      ? "overdue"
      : row.partialCount
        ? "partial"
        : row.dueSoonCount
          ? "due soon"
          : row.hasOutstanding
            ? "on track"
            : "paid";
  });
  rows.sort((a, b) =>
    statusRank[a.status] - statusRank[b.status]
    || compareScaledDescending(a.outstandingSummary.scaled, b.outstandingSummary.scaled)
    || a.name.localeCompare(b.name)
  );

  list.innerHTML = "";
  rows.forEach((row) => {
    const nextDue = row.assigned
      .filter((occurrence) => occurrence.status !== "paid")
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
    const item = document.createElement("article");
    item.className = "workload-card";
    const detailsId = `workload-details-${row.key}`;
    const isExpanded = dashboardDisclosureState.workloads.has(row.key);
    item.innerHTML = `
      <div class="workload-header">
        <div class="avatar" style="background:${escapeHtml(row.member?.avatar_color || "#0F766E")}">${memberInitials(row.name)}</div>
        <div class="workload-identity">
          <strong title="${escapeHtml(row.name)}">${escapeHtml(row.name)}</strong>
          <span title="${escapeHtml(row.role || "Family member")}">${escapeHtml(row.role || "Family member")}</span>
        </div>
        <div class="workload-status">${statusBadge(row.status)}</div>
      </div>
      <div class="workload-metrics">
        <div><span>Assigned</span><strong>${row.assigned.length}</strong></div>
        <div><span>Total due</span><strong data-fit-text data-fit-min="10">${row.totalSummary.text}</strong></div>
        <div><span>Paid</span><strong data-fit-text data-fit-min="10">${row.paidSummary.text}</strong></div>
        <div><span>Outstanding</span><strong data-fit-text data-fit-min="10">${row.outstandingSummary.text}</strong></div>
      </div>
      <div class="workload-progress">
        <div class="meter small-meter"><span style="width:${row.progress}%"></span></div>
        <span>${Math.round(row.progress)}% paid${row.overdueCount ? ` &middot; ${row.overdueCount} overdue` : ""}</span>
      </div>
      <div class="workload-next" title="${escapeHtml(nextDue ? `${nextDue.item.name}, due ${nextDue.dueDate}` : "All assigned payments are paid")}">
        <strong>Next</strong>
        <span>${nextDue ? `${escapeHtml(nextDue.item.name)} &middot; ${nextDue.dueDate}` : "All assigned payments are paid"}</span>
      </div>
      <div class="workload-actions">
        <button type="button" data-toggle-workload="${row.key}" aria-expanded="${isExpanded}" aria-controls="${detailsId}">${isExpanded ? "Hide payments" : "View payments"}</button>
      </div>
      <div id="${detailsId}" class="workload-details${isExpanded ? "" : " hidden"}">
        ${row.assigned
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
          .map((occurrence) => `
            <div class="workload-detail-row">
              <div>
                <strong title="${escapeHtml(occurrence.item.name)}">${escapeHtml(occurrence.item.name)}</strong>
                <span>${occurrence.dueDate} &middot; ${escapeHtml(occurrence.status)}</span>
              </div>
              <strong data-fit-text data-fit-min="10">${money(occurrence.outstanding, occurrence.item.currency)}</strong>
              ${occurrence.status !== "paid" ? `<button type="button" data-record-payment="${occurrence.key}">Record</button>` : ""}
            </div>
          `).join("")}
      </div>
    `;
    list.append(item);
  });
}

function renderObligations() {
  const list = $("#obligationsList");
  const searchInput = $("#paymentSearch");
  const sortSelect = $("#paymentSort");
  const clearButton = $("#clearPaymentSearch");
  const resultsCount = $("#paymentResultsCount");
  if (searchInput && searchInput.value !== state.paymentSearch) searchInput.value = state.paymentSearch;
  if (sortSelect) sortSelect.value = state.paymentSort;
  if (clearButton) clearButton.hidden = !state.paymentSearch;
  if (!state.paymentItems.length) {
    if (resultsCount) resultsCount.textContent = "0 payments";
    list.innerHTML = emptyState("No recurring obligations", "Add rent, utilities, school fees, subscriptions, or family contributions.");
    return;
  }

  const occurrenceChoices = new Map(
    state.paymentItems.map((item) => [item.id, recordableOccurrencesForItem(item)])
  );
  const search = state.paymentSearch.trim().toLowerCase();
  const visibleItems = state.paymentItems
    .filter((item) => !search || paymentItemSearchText(item).includes(search))
    .sort((left, right) => comparePaymentItems(left, right, occurrenceChoices));

  if (resultsCount) {
    resultsCount.textContent = search
      ? `${visibleItems.length} of ${state.paymentItems.length} payment${state.paymentItems.length === 1 ? "" : "s"}`
      : `${visibleItems.length} payment${visibleItems.length === 1 ? "" : "s"}`;
  }
  if (!visibleItems.length) {
    list.innerHTML = emptyState("No matching payments", "Try another name, category, currency, member, or recurrence.");
    return;
  }
  list.innerHTML = "";
  visibleItems.forEach((item) => list.append(renderObligationCard(item, occurrenceChoices.get(item.id) || [])));
}

function paymentItemSearchText(item) {
  const member = effectiveResponsibleMember(item);
  return [
    item.name,
    item.category,
    item.currency,
    member?.name,
    member?.role,
    recurrenceLabel(item),
    paymentScheduleLabel(item),
    item.visibility,
    item.status
  ].filter(Boolean).join(" ").toLowerCase();
}

function comparePaymentItems(left, right, occurrenceChoices) {
  const byName = left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
  if (state.paymentSort === "name_asc") return byName;
  if (state.paymentSort === "name_desc") return -byName;
  if (state.paymentSort === "newest" || state.paymentSort === "oldest") {
    const direction = state.paymentSort === "newest" ? -1 : 1;
    return direction * `${left.created_at || ""}`.localeCompare(`${right.created_at || ""}`) || byName;
  }
  if (state.paymentSort === "amount_asc" || state.paymentSort === "amount_desc") {
    const currencyOrder = `${left.currency || ""}`.localeCompare(`${right.currency || ""}`);
    if (currencyOrder) return currencyOrder;
    const direction = state.paymentSort === "amount_asc" ? 1 : -1;
    return direction * (Number(left.amount || 0) - Number(right.amount || 0)) || byName;
  }
  const leftDue = preferredRecordOccurrence(occurrenceChoices.get(left.id) || [])?.dueDate || "9999-12-31";
  const rightDue = preferredRecordOccurrence(occurrenceChoices.get(right.id) || [])?.dueDate || "9999-12-31";
  const inactiveOrder = Number(left.status === "inactive") - Number(right.status === "inactive");
  return inactiveOrder || leftDue.localeCompare(rightDue) || byName;
}

function renderObligationCard(item, occurrenceChoices = []) {
  const member = effectiveResponsibleMember(item);
  const workspaceLabel = paymentWorkspaceLabel(item);
  const workspaceClass = paymentWorkspaceClass(item);
  const occurrence = preferredRecordOccurrence(occurrenceChoices);
  const workspaceReadOnly = Boolean(state.workspaceEntitlement?.read_only || state.workspaceEntitlement?.effective_status === "suspended");
  const planPaused = isPlanPaused(item);
  const isPaused = item.status === "inactive" || planPaused;
  const recordDisabled = workspaceReadOnly || isPaused || !occurrence;
  const recordReason = workspaceReadOnly
    ? "Renew this workspace to record payments"
    : isPaused
      ? planPaused ? "Renew Personal or select this among your five Free payments" : "Reactivate this payment before recording it"
      : !occurrence
        ? "No outstanding payment period is available"
        : "";
  const article = document.createElement("article");
  article.className = "record-card payment-management-card";
  article.dataset.paymentItemId = item.id;
  article.innerHTML = `
    <div class="record-main">
      <strong>${escapeHtml(item.name)}</strong>
      <span>${escapeHtml(item.category)} &middot; ${recurrenceLabel(item)} &middot; ${paymentScheduleLabel(item)}</span>
      <div class="badge-row">
        ${statusBadge(planPaused ? "paused by plan limit" : item.status || "active")}
        <span class="mini-badge payment-workspace-badge ${workspaceClass}">${escapeHtml(workspaceLabel)}</span>
        <span class="mini-badge">${escapeHtml(member?.name || "No assigned member")}</span>
        <span class="mini-badge reminder-badge">Daily reminder · ${item.reminder_days_before ?? 0} day${Number(item.reminder_days_before ?? 0) === 1 ? "" : "s"} before</span>
      </div>
    </div>
    <div class="record-side">
      <div class="payment-card-amount">
        <strong>${money(item.amount, item.currency)}</strong>
        ${occurrence && !isPaused ? `<small>${occurrence.status === "overdue" ? "Overdue" : occurrence.status === "partial" ? "Part-paid period" : "Next due"}: ${escapeHtml(occurrence.dueDate)}</small>` : ""}
      </div>
      <div class="row-actions payment-card-actions">
        <button class="primary payment-record-action" type="button" data-record-payment-item="${item.id}" ${recordDisabled ? "disabled" : ""} title="${escapeHtml(recordReason)}">Record payment</button>
        <button type="button" data-open-payment-history="${item.id}">History</button>
        <button type="button" data-edit-obligation="${item.id}" ${workspaceReadOnly || planPaused ? "disabled" : ""}>Edit</button>
        <details class="payment-more-menu">
          <summary role="button">More</summary>
          <div class="payment-more-menu-list">
            <button type="button" data-toggle-obligation="${item.id}" data-next-status="${item.status === "inactive" ? "active" : "inactive"}" ${workspaceReadOnly || planPaused ? "disabled" : ""}>
              ${item.status === "inactive" ? "Reactivate" : "Pause"}
            </button>
            <button class="danger-text" type="button" data-delete-obligation="${item.id}" ${workspaceReadOnly ? "disabled" : ""}>Delete</button>
          </div>
        </details>
      </div>
    </div>
  `;
  return article;
}

async function handleNotificationDeepLink() {
  const url = new URL(window.location.href);
  const notificationId = url.searchParams.get("notification_id");
  if (notificationId && state.notifications.some((item) => item.id === notificationId)) {
    await query(
      "notification deep link read",
      supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notificationId)
    );
    state.notifications = state.notifications.map((item) => item.id === notificationId
      ? { ...item, read_at: new Date().toISOString() }
      : item);
    url.searchParams.delete("notification_id");
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
    renderNotifications();
  }

  const workspaceId = url.searchParams.get("workspace");
  if (workspaceId && !await selectNotificationWorkspace(workspaceId)) {
    showToast("This notification belongs to a workspace you cannot currently open.");
    return;
  }

  const subscriptionPaymentId = url.searchParams.get("subscription_payment");
  if (subscriptionPaymentId && state.isAdmin) {
    const payment = state.adminSubscriptionPayments.find((item) => item.id === subscriptionPaymentId);
    if (!payment || (workspaceId && payment.workspace_id !== workspaceId)) {
      showToast("This subscription payment is no longer available to your account.");
      return;
    }
    state.adminTab = "finance";
    setRoute("admin", "finance", true);
    renderAdmin();
    requestAnimationFrame(() => openSubscriptionPaymentDetails(subscriptionPaymentId));
    return;
  }

  const paymentItemId = url.searchParams.get("payment_item");
  if (!paymentItemId) return;

  const paymentItem = state.paymentItems.find((item) => item.id === paymentItemId);
  if (!paymentItem || (workspaceId && paymentItem.workspace_id !== workspaceId)) {
    showToast("This payment is no longer available in that workspace.");
    return;
  }

  if (state.familyTab !== "payments") {
    state.familyTab = "payments";
    setRoute("family", "payments", true);
    renderFamilyApp();
  }

  const target = document.querySelector(`[data-payment-item-id="${CSS.escape(paymentItemId)}"]`);
  if (!target) return;
  requestAnimationFrame(() => {
    target.classList.add("notification-deep-link-target");
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => target.classList.remove("notification-deep-link-target"), 6000);
  });
}

function renderSchedule() {
  const list = $("#scheduleList");
  const occurrences = selectedOccurrences();
  if (!occurrences.length) {
    list.innerHTML = emptyState("No dues for this view", "Change the month or status filter, or add a recurring obligation.");
    return;
  }
  list.innerHTML = "";
  occurrences.forEach((occurrence) => list.append(renderOccurrenceCard(occurrence, true)));
}

function renderMyPayments() {
  const list = $("#myPaymentsList");
  const occurrences = myOccurrences(selectedOccurrences());
  if (!occurrences.length) {
    list.innerHTML = emptyState("No payments assigned to you", "Your assigned obligations appear here when your member email matches your login email.");
    return;
  }
  list.innerHTML = "";
  occurrences.forEach((occurrence) => list.append(renderOccurrenceCard(occurrence, true)));
}

function myOccurrences(occurrences) {
  const userId = state.session.user.id;
  const matchingMember = currentFamilyMember();
  return occurrences.filter((occurrence) =>
    (occurrence.item.visibility === "personal" && occurrence.item.owner_id === userId) ||
    (matchingMember && effectiveResponsibleMember(occurrence.item)?.id === matchingMember.id)
  );
}

function renderOccurrenceCard(occurrence, withAction = false, collapsible = false) {
  const member = effectiveResponsibleMember(occurrence.item);
  const workspaceLabel = paymentWorkspaceLabel(occurrence.item);
  const workspaceClass = paymentWorkspaceClass(occurrence.item);
  const responsibleLabel = member?.name || (workspaceClass === "personal" ? "Personal account" : "Household account");
  const payerLabel = occurrence.status === "paid" ? occurrencePayerLabel(occurrence) : "";
  const article = document.createElement("article");
  const stateClass = occurrenceCardStateClass(occurrence);
  if (collapsible) {
    const detailsId = `occurrence-details-${occurrence.key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
    const isExpanded = dashboardDisclosureState.occurrences.has(occurrence.key);
    article.className = `record-card occurrence-card${stateClass ? ` ${stateClass}` : ""}${isExpanded ? " expanded" : ""}`;
    article.dataset.occurrenceKey = occurrence.key;
    article.innerHTML = `
      <button class="occurrence-summary-button" type="button" data-toggle-occurrence-details aria-expanded="${isExpanded}" aria-controls="${detailsId}">
        <span class="date-chip">
          <strong>${parseDate(occurrence.dueDate).getDate()}</strong>
          <span>${parseDate(occurrence.dueDate).toLocaleString("en", { month: "short" })}</span>
        </span>
        <span class="occurrence-summary-copy">
          <strong class="occurrence-name" title="${escapeHtml(occurrence.item.name)}">${escapeHtml(occurrence.item.name)}</strong>
          <span class="payment-workspace-badge ${workspaceClass}" title="${escapeHtml(workspaceLabel)}">${escapeHtml(workspaceLabel)}</span>
          <span class="occurrence-summary-meta">Due ${escapeHtml(occurrence.dueDate)} · ${escapeHtml(occurrence.status)}${payerLabel ? ` · ${escapeHtml(payerLabel)}` : ""}</span>
        </span>
        <strong class="occurrence-amount" data-fit-text data-fit-min="10">${money(occurrence.amount, occurrence.item.currency)}</strong>
        <span class="accordion-chevron" aria-hidden="true">⌄</span>
      </button>
      <div id="${detailsId}" class="occurrence-card-details" ${isExpanded ? "" : "hidden"}>
        <dl class="occurrence-facts">
          <div><dt>Responsible</dt><dd>${escapeHtml(responsibleLabel)}</dd></div>
          <div><dt>Category</dt><dd>${escapeHtml(occurrence.item.category)}</dd></div>
          <div><dt>Paid</dt><dd>${money(occurrence.paid, occurrence.item.currency)}</dd></div>
          <div><dt>Outstanding</dt><dd>${money(occurrence.outstanding, occurrence.item.currency)}</dd></div>
        </dl>
        <div class="occurrence-detail-footer">
          <div class="badge-row">${statusBadge(occurrence.status)}${payerLabel ? `<span class="mini-badge paid-by-badge">${escapeHtml(payerLabel)}</span>` : ""}<span class="mini-badge">Daily reminder from ${occurrence.item.reminder_days_before ?? 3} day${Number(occurrence.item.reminder_days_before ?? 3) === 1 ? "" : "s"} before</span></div>
          ${withAction ? `<div class="row-actions"><button type="button" data-edit-obligation="${occurrence.item.id}">Edit</button>${occurrence.status !== "paid" ? `<button class="primary" type="button" data-record-payment="${occurrence.key}">Record payment</button>` : '<span class="paid-label">Paid in full</span>'}</div>` : ""}
        </div>
      </div>
    `;
    return article;
  }
  article.className = `record-card${stateClass ? ` ${stateClass}` : ""}`;
  article.innerHTML = `
    <div class="date-chip">
      <strong>${parseDate(occurrence.dueDate).getDate()}</strong>
      <span>${parseDate(occurrence.dueDate).toLocaleString("en", { month: "short" })}</span>
    </div>
    <div class="record-main">
      <strong class="occurrence-name" title="${escapeHtml(occurrence.item.name)}">${escapeHtml(occurrence.item.name)}</strong>
      <span class="occurrence-meta" title="${escapeHtml(responsibleLabel)} · ${escapeHtml(occurrence.item.category)} · ${money(occurrence.outstanding, occurrence.item.currency)} outstanding">${escapeHtml(responsibleLabel)} &middot; ${escapeHtml(occurrence.item.category)} &middot; ${money(occurrence.outstanding, occurrence.item.currency)} outstanding</span>
      <div class="badge-row">
        <span class="mini-badge payment-workspace-badge ${workspaceClass}">${escapeHtml(workspaceLabel)}</span>
        ${statusBadge(occurrence.status)}
        ${payerLabel ? `<span class="mini-badge paid-by-badge">${escapeHtml(payerLabel)}</span>` : ""}
        <span class="mini-badge">${money(occurrence.paid, occurrence.item.currency)} paid</span>
      </div>
    </div>
    <div class="record-side">
      <strong class="occurrence-amount" data-fit-text data-fit-min="10">${money(occurrence.amount, occurrence.item.currency)}</strong>
      ${withAction ? `<div class="row-actions"><button type="button" data-edit-obligation="${occurrence.item.id}">Edit</button>${occurrence.status !== "paid" ? `<button class="primary" type="button" data-record-payment="${occurrence.key}">Record payment</button>` : '<span class="paid-label">Paid in full</span>'}</div>` : ""}
    </div>
  `;
  return article;
}

function occurrencePayerLabel(occurrence) {
  const names = state.paymentRecords
    .filter((record) => record.payment_item_id === occurrence.item.id && record.period_start === occurrence.periodStart)
    .map((record) => {
      const people = paymentRecordPeople(record);
      return people.payerName && people.payerName !== "Member not recorded"
        ? people.payerName
        : !record.family_id && record.visibility !== "family" ? people.recorderName : "";
    })
    .filter(Boolean);
  const uniqueNames = [...new Set(names)];
  return uniqueNames.length ? `Paid by ${uniqueNames.join(", ")}` : "";
}

function renderMembers() {
  const list = $("#membersList");
  if (!state.members.length) {
    list.innerHTML = emptyState("No family members yet", "Invite registered users and they will appear here after accepting.");
    return;
  }
  list.innerHTML = "";
  state.members.forEach((member) => {
    const assignedCount = state.paymentItems.filter((item) => item.responsible_member_id === member.id).length;
    const isOwner = member.role === "Owner" || member.user_id === state.family?.owner_id;
    const isSignedInUser =
      member.user_id === state.session.user.id ||
      member.email?.toLowerCase() === state.session.user.email?.toLowerCase();
    const canRemove = canAddMembers() && member.status === "active" && !isOwner && !isSignedInUser;
    const item = document.createElement("article");
    item.className = "record-card";
    item.innerHTML = `
      <div class="avatar" style="background:${escapeHtml(member.avatar_color || "#2563EB")}">${memberInitials(member.name)}</div>
      <div class="record-main">
        <strong>${escapeHtml(member.name)}</strong>
        <span>${escapeHtml(member.role)} &middot; ${escapeHtml(member.email || "No email")} &middot; ${escapeHtml(member.phone || "No phone")}</span>
        <div class="badge-row">${statusBadge(member.status === "inactive" ? "removed" : "active")}<span class="mini-badge">${assignedCount} assigned</span></div>
      </div>
      <div class="record-side">
        ${canRemove ? `<button type="button" data-remove-member="${member.id}">Remove from family</button>` : ""}
      </div>
    `;
    list.append(item);
  });
}

function renderInvitations() {
  const list = $("#invitationsList");
  if (!list) return;
  if (!state.familyInvitations.length) {
    list.innerHTML = emptyState("No family invitations", "Invites you send or receive will appear here.");
    return;
  }
  list.innerHTML = "";
  state.familyInvitations.forEach((invite) => {
    const incoming = invite.invitee_email?.toLowerCase() === state.session.user.email?.toLowerCase();
    const canCancel = invite.status === "pending" && canManageMembersForFamily(invite.family_id);
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(invite.families?.name || state.family?.name || "Family")}</strong>
        <span>${incoming ? "You were invited" : `Invited ${escapeHtml(invite.invitee_email)}`} &middot; ${escapeHtml(invite.role)} &middot; ${new Date(invite.created_at).toLocaleDateString()}</span>
        <div class="badge-row">${statusBadge(invite.status)}</div>
      </div>
      <div class="record-side">
        ${incoming && invite.status === "pending" ? `<div class="row-actions"><button class="primary" type="button" data-accept-invite="${invite.id}">Accept</button><button type="button" data-reject-invite="${invite.id}">Reject</button></div>` : ""}
        ${canCancel ? `<button type="button" data-cancel-family-invite="${escapeHtml(invite.id)}">Cancel invitation</button>` : ""}
      </div>
    `;
    list.append(article);
  });
}

function renderSettings() {
  const entitlement = state.personalWorkspaceEntitlement;
  const plan = entitlement
    ? `${entitlement.plan_name} - ${titleCase(entitlement.effective_status)}`
    : hasJoinableFamilyInvitation() ? "Family member - Free" : "Active - Free";
  const paymentCount = state.paymentItems.filter((item) => item.visibility === "personal" && isPaymentActive(item)).length;
  const canManageAnyFamily = ownedFamilies().some((family) => canManageMembersForFamily(family.id));
  $("#settingsPlanBadge").textContent = plan;
  $("#settingsPlanBadge").className = `mini-badge ${badgeClass(plan)}`;
  $("#settingsPaymentLimit").textContent = entitlement?.active_payment_limit == null
    ? "Unlimited Personal payments"
    : `${paymentCount}/${entitlement.active_payment_limit} active personal payments used`;
  $("#settingsMemberAccess").textContent = canManageAnyFamily ? "Can invite family members" : "Can join invited families";
  $("#settingsEmail").textContent = state.session.user.email || "-";
  renderPushNotificationSettings();
  schedulePushNotificationRefresh(false, true);
  renderWorkspaceCurrencySettings();
}

function currentPushSupportStatus() {
  if (!pushSupport) return { supported: false, code: "helper-missing" };
  return pushSupport.supportStatus(window, navigator);
}

function currentPushPermission() {
  return "Notification" in window ? window.Notification.permission : "unavailable";
}

function pushSupportCopy(code) {
  if (code === "ios-install-required") {
    return {
      title: "Install the app first",
      message: "On iPhone or iPad, Web Push is available only from an installed Home Screen app.",
      help: "Open this website in Safari, tap Share, choose Add to Home Screen, then open Mushavo Budget from its new icon."
    };
  }
  if (code === "insecure") {
    return {
      title: "A secure connection is required",
      message: "Notifications only work when Mushavo Budget is opened over HTTPS.",
      help: "Open https://mushavobudget.com and try again."
    };
  }
  return {
    title: "Notifications are not supported here",
    message: "This browser does not provide the Web Push features Mushavo Budget needs.",
    help: "Try the latest Chrome, Edge, Firefox, or an installed Home Screen app on iPhone or iPad."
  };
}

function permissionLabel(permission) {
  if (permission === "granted") return "Allowed by browser";
  if (permission === "denied") return "Blocked by browser";
  if (permission === "default") return "Not requested";
  return "Unavailable";
}

function renderPushNotificationSettings() {
  const panel = $("#pushDeviceStatus");
  if (!panel) return;

  const badge = $("#pushPermissionBadge");
  const title = $("#pushDeviceStatusTitle");
  const message = $("#pushDeviceStatusMessage");
  const help = $("#pushDeviceHelp");
  const enableButton = $("#enablePushNotificationsButton");
  const testButton = $("#sendTestPushButton");
  const disableButton = $("#disablePushNotificationsButton");
  const permission = currentPushPermission();
  const support = currentPushSupportStatus();
  const enabled = Boolean(state.pushDevice.subscription && state.pushDevice.record);
  const hasBrowserSubscription = Boolean(state.pushDevice.subscription);

  $("#pushPermissionValue").textContent = permissionLabel(permission);
  $("#pushDeviceLabel").textContent = pushSupport?.deviceLabel(navigator, window) || "This browser";
  panel.setAttribute("aria-busy", `${state.pushDevice.busy || !state.pushDevice.checked}`);
  enableButton.hidden = true;
  testButton.hidden = true;
  testButton.textContent = "Send test notification";
  disableButton.hidden = !hasBrowserSubscription;
  enableButton.disabled = state.pushDevice.busy || state.pushDevice.testBusy;
  testButton.disabled = state.pushDevice.busy || state.pushDevice.testBusy;
  disableButton.disabled = state.pushDevice.busy || state.pushDevice.testBusy;
  help.classList.add("hidden");
  help.textContent = "";

  let level = "ready";
  let badgeText = "Ready";
  let titleText = "Ready to enable";
  let messageText = permission === "granted"
    ? "Browser permission is allowed, but Mushavo Budget reminders are disabled on this device. Press Enable notifications to reconnect it."
    : "Press Enable notifications when you want payment reminders on this device.";

  if (!support.supported) {
    const copy = pushSupportCopy(support.code);
    level = "unavailable";
    badgeText = support.code === "ios-install-required" ? "Install required" : "Unavailable";
    titleText = copy.title;
    messageText = copy.message;
    help.textContent = copy.help;
    help.classList.remove("hidden");
  } else if (state.pushDevice.error) {
    level = "error";
    badgeText = "Needs attention";
    titleText = "This device could not be checked";
    messageText = friendlyMessage(state.pushDevice.error);
    enableButton.hidden = permission === "denied";
  } else if (state.pushDevice.busy || state.pushDevice.testBusy) {
    level = "checking";
    badgeText = "Working";
    titleText = state.pushDevice.testBusy ? "Sending a test notification" : "Updating this device";
    messageText = state.pushDevice.testBusy
      ? "The protected test service is contacting your active devices."
      : "Please keep this page open for a moment.";
    if (state.pushDevice.testBusy) {
      testButton.textContent = "Sending test…";
      testButton.hidden = false;
    }
  } else if (!state.pushDevice.checked) {
    level = "checking";
    badgeText = "Checking";
    titleText = "Checking this device";
    messageText = "Looking for an existing browser subscription.";
  } else if (permission === "denied") {
    level = "blocked";
    badgeText = "Blocked";
    titleText = "Notifications are blocked";
    messageText = "Mushavo Budget will not ask again while this browser permission is blocked.";
    help.textContent = pushSupport.isIosDevice(navigator)
      ? "Open your device Settings, find Notifications, allow Mushavo Budget, then return to the installed app."
      : "Open this site's browser settings, change Notifications to Allow, then reload this page.";
    help.classList.remove("hidden");
  } else if (enabled) {
    level = "enabled";
    badgeText = "Enabled";
    titleText = "Notifications enabled on this device";
    messageText = "This browser is securely linked to the account currently signed in.";
    testButton.hidden = false;
    disableButton.hidden = false;
  } else if (permission === "granted" && hasBrowserSubscription) {
    level = "ready";
    badgeText = "Link required";
    titleText = "Finish linking this device";
    messageText = "The browser has permission, but its subscription is not linked to this account.";
    enableButton.textContent = "Finish enabling";
    enableButton.hidden = false;
    disableButton.hidden = false;
  } else {
    enableButton.textContent = "Enable notifications";
    enableButton.hidden = false;
  }

  badge.textContent = badgeText;
  badge.dataset.level = level;
  panel.dataset.level = level;
  title.textContent = titleText;
  message.textContent = messageText;
  renderAdminPushNotificationSettings();
}

function renderAdminPushNotificationSettings() {
  const panel = $("#adminPushNotificationControls");
  if (!panel) return;
  panel.classList.toggle("hidden", !state.isAdmin);
  if (!state.isAdmin) return;

  const permission = currentPushPermission();
  const support = currentPushSupportStatus();
  const enabled = Boolean(state.pushDevice.subscription && state.pushDevice.record);
  const hasBrowserSubscription = Boolean(state.pushDevice.subscription);
  const badge = $("#adminPushPermissionBadge");
  const title = $("#adminPushDeviceTitle");
  const message = $("#adminPushDeviceMessage");
  const enableButton = $("#adminEnablePushNotificationsButton");
  const testButton = $("#adminSendTestPushButton");
  const disableButton = $("#adminDisablePushNotificationsButton");

  enableButton.hidden = true;
  testButton.hidden = true;
  disableButton.hidden = !hasBrowserSubscription;
  enableButton.disabled = state.pushDevice.busy || state.pushDevice.testBusy;
  testButton.disabled = state.pushDevice.busy || state.pushDevice.testBusy;
  disableButton.disabled = state.pushDevice.busy || state.pushDevice.testBusy;

  let level = "ready";
  let badgeText = "Ready";
  let titleText = "Admin alerts are ready to enable";
  let messageText = "Enable protected platform alerts on this device.";

  if (!support.supported) {
    const copy = pushSupportCopy(support.code);
    level = "unavailable";
    badgeText = support.code === "ios-install-required" ? "Install required" : "Unavailable";
    titleText = copy.title;
    messageText = copy.message;
  } else if (state.pushDevice.error) {
    level = "error";
    badgeText = "Needs attention";
    titleText = "This admin device could not be checked";
    messageText = friendlyMessage(state.pushDevice.error);
    enableButton.hidden = permission === "denied";
  } else if (state.pushDevice.busy || state.pushDevice.testBusy || !state.pushDevice.checked) {
    level = "checking";
    badgeText = "Checking";
    titleText = state.pushDevice.testBusy ? "Sending a protected test" : "Checking this admin device";
    messageText = "Please keep this page open for a moment.";
    testButton.hidden = !state.pushDevice.testBusy;
  } else if (permission === "denied") {
    level = "blocked";
    badgeText = "Blocked";
    titleText = "Notifications are blocked";
    messageText = "Allow notifications in this browser's site settings, then reload Mushavo Budget.";
  } else if (enabled) {
    level = "enabled";
    badgeText = "Enabled";
    titleText = "Admin notifications enabled on this device";
    messageText = "Subscription reviews, support tickets, and enquiries can reach this signed-in admin account.";
    testButton.hidden = false;
    disableButton.hidden = false;
  } else if (permission === "granted" && hasBrowserSubscription) {
    badgeText = "Link required";
    titleText = "Finish linking this admin device";
    messageText = "The browser has permission, but its subscription is not linked to this admin account.";
    enableButton.textContent = "Finish enabling";
    enableButton.hidden = false;
    disableButton.hidden = false;
  } else {
    enableButton.textContent = "Enable notifications";
    enableButton.hidden = false;
  }

  badge.textContent = badgeText;
  badge.dataset.level = level;
  title.textContent = titleText;
  message.textContent = messageText;
}

function withPushTimeout(promise) {
  let timeoutId;
  const timeout = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => reject(new Error("PUSH_SERVICE_WORKER_NOT_READY")), PUSH_READY_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timeoutId));
}

async function activeServiceWorkerRegistration() {
  const current = await navigator.serviceWorker.getRegistration("/");
  if (current?.active) return current;
  if (window.__MUSHAVO_PWA_READY__) {
    const pwaRegistration = await withPushTimeout(Promise.resolve(window.__MUSHAVO_PWA_READY__));
    if (pwaRegistration?.active) return pwaRegistration;
  }
  const ready = await withPushTimeout(navigator.serviceWorker.ready);
  if (!ready?.active) throw new Error("PUSH_SERVICE_WORKER_NOT_READY");
  return ready;
}

async function findOwnPushSubscriptionRecord(endpoint) {
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, device_label, updated_at, disabled_at, failure_count, last_success_at")
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function pushOptInStorageKey(userId) {
  return `${PUSH_OPT_IN_STORAGE_PREFIX}${userId}`;
}

function hasRememberedPushOptIn(userId) {
  if (!userId) return false;
  try {
    return window.localStorage.getItem(pushOptInStorageKey(userId)) === "true";
  } catch (_error) {
    return false;
  }
}

function rememberPushOptIn(userId) {
  if (!userId) return;
  try {
    window.localStorage.setItem(pushOptInStorageKey(userId), "true");
  } catch (_error) {
    // Private browsing can block storage. The current device still works.
  }
}

function forgetPushOptIn(userId) {
  if (!userId) return;
  try {
    window.localStorage.removeItem(pushOptInStorageKey(userId));
  } catch (_error) {
    // A blocked storage cleanup must not prevent an explicit disable or sign-out.
  }
}

function shouldAutomaticallyRecoverPushSubscription(autoRecover, permission, record, rememberedOptIn) {
  return Boolean(autoRecover && permission === "granted" && (record || rememberedOptIn));
}

async function reconcileCurrentPushSubscription(subscription, record) {
  if (!subscription) return { subscription: null, record: null };

  const permissionGranted = currentPushPermission() === "granted";
  if (permissionGranted && record && !record.disabled_at) return { subscription, record };

  // A missing record can belong to another account. A disabled record points
  // at an endpoint the push provider has permanently rejected. Remove either
  // stale browser subscription before creating a fresh, private device link.
  if (record) await deleteOwnPushRecord(subscription, record);
  await subscription.unsubscribe();
  await clearApplicationBadge();
  return { subscription: null, record: null };
}

async function replaceCurrentPushSubscription(registration, browserSubscription, ownRecord, userId) {
  if (ownRecord) await deleteOwnPushRecord(browserSubscription, ownRecord);
  if (browserSubscription) await browserSubscription.unsubscribe();
  await clearApplicationBadge();
  if (state.session?.user?.id !== userId) throw new Error("PUSH_ACCOUNT_CHANGED");

  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: pushSupport.base64UrlToUint8Array(config.vapidPublicKey)
  });
  try {
    const record = await saveCurrentPushSubscription(subscription);
    rememberPushOptIn(userId);
    return { subscription, record };
  } catch (error) {
    try {
      await subscription.unsubscribe();
    } catch (_unsubscribeError) {
      // The unlinked subscription can be removed during the next recovery check.
    }
    throw error;
  }
}

async function refreshPushNotificationSettings({ autoRecover = false } = {}) {
  const userId = state.session?.user?.id;
  if (!userId) return;
  const sequence = ++pushRefreshSequence;
  const support = currentPushSupportStatus();
  state.pushDevice = {
    ...createPushDeviceState(),
    userId,
    checked: !support.supported
  };
  renderPushNotificationSettings();
  if (!support.supported) return;

  try {
    const registration = await activeServiceWorkerRegistration();
    const browserSubscription = await registration.pushManager.getSubscription();
    const ownRecord = browserSubscription
      ? await findOwnPushSubscriptionRecord(browserSubscription.endpoint)
      : null;
    const permission = currentPushPermission();
    let subscription;
    let record;
    if (permission === "granted" && ownRecord && !ownRecord.disabled_at) {
      subscription = browserSubscription;
      record = ownRecord;
      rememberPushOptIn(userId);
    } else if (shouldAutomaticallyRecoverPushSubscription(
      autoRecover,
      permission,
      ownRecord,
      hasRememberedPushOptIn(userId)
    )) {
      ({ subscription, record } = await replaceCurrentPushSubscription(
        registration,
        browserSubscription,
        ownRecord,
        userId
      ));
    } else {
      ({ subscription, record } = await reconcileCurrentPushSubscription(
        browserSubscription,
        ownRecord
      ));
    }
    if (sequence !== pushRefreshSequence || state.session?.user?.id !== userId) return;
    state.pushDevice = {
      busy: false,
      checked: true,
      userId,
      subscription,
      record,
      error: null
    };
  } catch (error) {
    if (sequence !== pushRefreshSequence || state.session?.user?.id !== userId) return;
    state.pushDevice = {
      ...createPushDeviceState(),
      checked: true,
      userId,
      error
    };
  }
  renderPushNotificationSettings();
}

function schedulePushNotificationRefresh(force = false, autoRecover = false) {
  const userId = state.session?.user?.id;
  if (!userId) return;
  const recentlyChecked = Date.now() - pushRefreshLastCheckedAt < PUSH_REFRESH_INTERVAL_MS;
  if (!force && recentlyChecked && state.pushDevice.checked && state.pushDevice.userId === userId) return;
  if (pushRefreshPromise) return;
  pushRefreshLastCheckedAt = Date.now();
  pushRefreshPromise = refreshPushNotificationSettings({ autoRecover })
    .catch((error) => console.warn("Push subscription check failed", friendlyMessage(error?.message)))
    .finally(() => {
      pushRefreshPromise = null;
    });
}

async function saveCurrentPushSubscription(subscription) {
  const userId = state.session?.user?.id;
  if (!userId) throw new Error("Your secure session has ended. Sign in again.");
  const keys = pushSupport.subscriptionPayload(subscription);
  const metadata = {
    p256dh: keys.p256dh,
    auth: keys.auth,
    device_label: pushSupport.deviceLabel(navigator, window),
    user_agent: String(navigator.userAgent || "Unknown browser").slice(0, 1024)
  };
  const existing = await findOwnPushSubscriptionRecord(keys.endpoint);
  let response;
  if (existing) {
    response = await supabase
      .from("push_subscriptions")
      .update(metadata)
      .eq("id", existing.id)
      .select("id, endpoint, device_label, updated_at, disabled_at, failure_count, last_success_at")
      .single();
  } else {
    response = await supabase
      .from("push_subscriptions")
      .insert({ user_id: userId, endpoint: keys.endpoint, ...metadata })
      .select("id, endpoint, device_label, updated_at, disabled_at, failure_count, last_success_at")
      .single();
  }
  if (response.error) {
    if (pushSupport.isEndpointConflict(response.error)) {
      const concurrentOwnRecord = await findOwnPushSubscriptionRecord(keys.endpoint);
      if (!concurrentOwnRecord) throw new Error("PUSH_SUBSCRIPTION_ENDPOINT_CONFLICT");
      response = await supabase
        .from("push_subscriptions")
        .update(metadata)
        .eq("id", concurrentOwnRecord.id)
        .select("id, endpoint, device_label, updated_at, disabled_at, failure_count, last_success_at")
        .single();
      if (response.error) throw response.error;
    } else {
      throw response.error;
    }
  }
  return response.data;
}

async function enablePushNotifications() {
  if (state.pushDevice.busy || !state.session) return;
  const support = currentPushSupportStatus();
  if (!support.supported) {
    renderPushNotificationSettings();
    return;
  }

  state.pushDevice.busy = true;
  state.pushDevice.error = null;
  renderPushNotificationSettings();
  let subscription = null;
  let createdSubscription = false;
  try {
    let permission = currentPushPermission();
    if (permission === "default") {
      permission = await window.Notification.requestPermission();
    }
    if (permission === "denied") throw new Error("PUSH_PERMISSION_DENIED");
    if (permission !== "granted") throw new Error("PUSH_PERMISSION_NOT_GRANTED");

    const registration = await activeServiceWorkerRegistration();
    subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      const existingRecord = await findOwnPushSubscriptionRecord(subscription.endpoint);
      const reconciled = await reconcileCurrentPushSubscription(subscription, existingRecord);
      subscription = reconciled.subscription;
    }
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: pushSupport.base64UrlToUint8Array(config.vapidPublicKey)
      });
      createdSubscription = true;
    }
    state.pushDevice.subscription = subscription;
    const record = await saveCurrentPushSubscription(subscription);
    state.pushDevice = {
      busy: false,
      checked: true,
      userId: state.session.user.id,
      subscription,
      record,
      error: null
    };
    rememberPushOptIn(state.session.user.id);
    showToast("Notifications enabled on this device.");
  } catch (error) {
    if (createdSubscription && subscription) {
      try {
        await subscription.unsubscribe();
        state.pushDevice.subscription = null;
      } catch (_unsubscribeError) {
        // The unlinked browser subscription can still be removed with Disable.
      }
    }
    state.pushDevice.checked = true;
    state.pushDevice.error = error?.message === "PUSH_PERMISSION_DENIED" ? null : error;
    showToast(error.message);
  } finally {
    state.pushDevice.busy = false;
    renderPushNotificationSettings();
  }
}

async function deleteOwnPushRecord(subscription, record = null) {
  let request = supabase.from("push_subscriptions").delete();
  if (subscription?.endpoint) request = request.eq("endpoint", subscription.endpoint);
  else if (record?.id) request = request.eq("id", record.id);
  else return;
  const { error } = await request;
  if (error) throw error;
}

async function clearApplicationBadge() {
  if (typeof navigator.clearAppBadge !== "function") return;
  try {
    await navigator.clearAppBadge();
  } catch (_error) {
    // Badge support is optional and must not block notification cleanup.
  }
}

async function removeCurrentDevicePush({ requireDatabaseCleanup = true } = {}) {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  const registration = await navigator.serviceWorker.getRegistration("/");
  if (!registration) return;
  const subscription = await registration.pushManager.getSubscription();
  const record = state.pushDevice.record;
  if (requireDatabaseCleanup) await deleteOwnPushRecord(subscription, record);
  if (subscription) {
    try {
      await subscription.unsubscribe();
    } catch (error) {
      if (!requireDatabaseCleanup) throw error;
      console.warn("Browser push unsubscribe failed after the protected database row was removed.");
    }
  }
  await clearApplicationBadge();
}

async function disablePushNotifications() {
  if (state.pushDevice.busy || !state.session) return;
  state.pushDevice.busy = true;
  state.pushDevice.error = null;
  renderPushNotificationSettings();
  try {
    await removeCurrentDevicePush();
    forgetPushOptIn(state.session.user.id);
    state.pushDevice = {
      ...createPushDeviceState(),
      checked: true,
      userId: state.session.user.id
    };
    showToast("Notifications disabled on this device.");
  } catch (error) {
    state.pushDevice.checked = true;
    state.pushDevice.error = error;
    showToast(error.message);
  } finally {
    state.pushDevice.busy = false;
    renderPushNotificationSettings();
  }
}

async function pushFunctionErrorCode(error) {
  try {
    const payload = await error?.context?.json?.();
    return payload?.error || error?.message || "PUSH_TEST_DELIVERY_FAILED";
  } catch (_contextError) {
    return error?.message || "PUSH_TEST_DELIVERY_FAILED";
  }
}

async function refreshSessionForProtectedFunction() {
  const { data, error } = await supabase.auth.refreshSession();
  const session = data?.session;
  if (error || !session?.access_token) {
    throw new Error("EDGE_FUNCTION_AUTHENTICATION_FAILED");
  }
  state.session = session;
  return session.access_token;
}

async function sendTestPushNotification() {
  if (state.pushDevice.busy || state.pushDevice.testBusy || !state.session) return;
  if (!state.pushDevice.subscription || !state.pushDevice.record) {
    showToast("Enable notifications on this device before sending a test.");
    return;
  }

  state.pushDevice.testBusy = true;
  state.pushDevice.error = null;
  renderPushNotificationSettings();
  try {
    const accessToken = await refreshSessionForProtectedFunction();
    const { data, error } = await supabase.functions.invoke("send-test-push", {
      body: {},
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (error) throw new Error(await pushFunctionErrorCode(error));
    if (data?.error) throw new Error(data.error);
    const delivered = Number(data?.delivered || 0);
    showToast(delivered === 1
      ? "Test notification sent to your active device."
      : `Test notification sent to ${delivered} active devices.`);
  } catch (error) {
    showToast(friendlyMessage(error?.message));
  } finally {
    state.pushDevice.testBusy = false;
    renderPushNotificationSettings();
  }
}

async function signOutSafely(button = null) {
  if (!supabase || !state.session) return;
  setSubmitting(button, true, "Signing out…");
  try {
    await removeCurrentDevicePush();
    forgetPushOptIn(state.session.user.id);
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch (error) {
    showToast(`Sign-out stopped: ${friendlyMessage(error?.message)}`);
  } finally {
    // This DOM button survives sign-out and is reused after the next sign-in.
    setSubmitting(button, false, "Sign out");
  }
}

function currencyCatalogue() {
  return state.supportedCurrencies.length
    ? state.supportedCurrencies.map((item) => [item.code, item.name])
    : PAYMENT_CURRENCIES;
}

function populateCurrencySelect(select, selectedValues, allowedCodes = null) {
  if (!select) return;
  const selected = new Set(Array.isArray(selectedValues) ? selectedValues : [selectedValues].filter(Boolean));
  const allowed = allowedCodes ? new Set(allowedCodes) : null;
  select.innerHTML = "";
  currencyCatalogue().forEach(([code, name]) => {
    if (allowed && !allowed.has(code)) return;
    const option = new Option(`${code} — ${name}`, code);
    option.selected = selected.has(code);
    select.append(option);
  });
}

function populateWorkspaceCreationCurrencySelects() {
  [$("#familyCurrency"), $("#memberFamilyCurrency")].forEach((select) => {
    if (!select) return;
    populateCurrencySelect(select, select.value || "USD");
  });
}

function canManageCurrentWorkspaceCurrencies() {
  const workspace = currentBudgetWorkspace();
  if (!workspace) return false;
  if (workspace.owner_id === state.session?.user?.id) return true;
  return state.workspaceMembers.some((member) =>
    member.workspace_id === workspace.id && member.user_id === state.session?.user?.id && member.status === "active" &&
    ["business_owner", "business_admin", "finance_manager"].includes(member.role)
  );
}

function renderWorkspaceCurrencySettings() {
  const settings = state.workspaceSettings || {
    default_payment_currency: "USD",
    enabled_currencies: ["USD"],
    reporting_currency: "USD",
    conversion_enabled: false
  };
  populateCurrencySelect($("#workspaceEnabledCurrencies"), settings.enabled_currencies);
  populateCurrencySelect($("#workspaceDefaultCurrency"), settings.default_payment_currency, settings.enabled_currencies);
  populateCurrencySelect($("#workspaceReportingCurrency"), settings.reporting_currency, settings.enabled_currencies);
  $("#workspaceConversionEnabled").checked = Boolean(settings.conversion_enabled);
  renderWorkspaceCurrencyPicker();
  const canManage = canManageCurrentWorkspaceCurrencies();
  $("#workspaceCurrencySettingsForm").querySelectorAll("input, select, button").forEach((field) => {
    field.disabled = !canManage;
  });
  $("#saveWorkspaceCurrencyButton").title = canManage ? "" : "Only an authorized workspace finance manager can change these settings.";
  const presentation = rateStatusPresentation();
  $("#workspaceRateStatus").textContent = presentation.text;
  $("#workspaceRateStatus").dataset.level = presentation.level;
}

function renderWorkspaceCurrencyPicker() {
  const optionList = $("#workspaceCurrencyOptions");
  const chipList = $("#workspaceCurrencyChips");
  const count = $("#workspaceCurrencyCount");
  if (!optionList || !chipList || !count) return;
  const search = $("#workspaceCurrencySearch")?.value.trim().toLowerCase() || "";
  const enabled = new Set(selectedOptions($("#workspaceEnabledCurrencies")));
  const defaultCurrency = $("#workspaceDefaultCurrency").value;
  const reportingCurrency = $("#workspaceReportingCurrency").value;
  const protectedCodes = new Set([defaultCurrency, reportingCurrency].filter(Boolean));
  const canManage = canManageCurrentWorkspaceCurrencies();
  const catalogue = currencyCatalogue();
  const orderedEnabled = [...enabled].sort((left, right) => {
    if (left === defaultCurrency) return -1;
    if (right === defaultCurrency) return 1;
    return left.localeCompare(right);
  });

  count.textContent = `${orderedEnabled.length} selected`;
  chipList.innerHTML = orderedEnabled.map((code) => {
    const name = catalogue.find(([itemCode]) => itemCode === code)?.[1] || code;
    const labels = [code === defaultCurrency ? "Default" : "", code === reportingCurrency && code !== defaultCurrency ? "Reporting" : ""].filter(Boolean);
    return `<span class="currency-chip${protectedCodes.has(code) ? " default" : ""}">
      <strong>${escapeHtml(code)}</strong><span>${escapeHtml(name)}</span>
      ${labels.map((label) => `<em>${escapeHtml(label)}</em>`).join("")}
      ${protectedCodes.has(code)
        ? ""
        : `<button type="button" data-remove-workspace-currency="${escapeHtml(code)}" aria-label="Remove ${escapeHtml(code)}" ${canManage ? "" : "disabled"}>&times;</button>`}
    </span>`;
  }).join("");

  const matches = catalogue.filter(([code, name]) =>
    !search || code.toLowerCase().includes(search) || name.toLowerCase().includes(search)
  );
  optionList.innerHTML = matches.length
    ? matches.map(([code, name]) => {
        const selected = enabled.has(code);
        const locked = protectedCodes.has(code);
        return `<label class="currency-option${selected ? " selected" : ""}">
          <input type="checkbox" value="${escapeHtml(code)}" ${selected ? "checked" : ""} ${locked || !canManage ? "disabled" : ""} />
          <span><strong>${escapeHtml(code)}</strong><small>${escapeHtml(name)}</small></span>
          ${locked ? `<em>${code === defaultCurrency ? "Default" : "Reporting"}</em>` : ""}
        </label>`;
      }).join("")
    : `<p class="currency-picker-empty">No currencies match your search.</p>`;
}

function setWorkspaceCurrencySelected(code, shouldEnable) {
  const select = $("#workspaceEnabledCurrencies");
  const option = [...select.options].find((item) => item.value === code);
  if (!option) return;
  const protectedCodes = new Set([$("#workspaceDefaultCurrency").value, $("#workspaceReportingCurrency").value]);
  if (!shouldEnable && protectedCodes.has(code)) return;
  option.selected = shouldEnable;
  refreshWorkspaceCurrencyDependentOptions();
}

function selectedOptions(select) {
  return [...select.selectedOptions].map((option) => option.value);
}

function refreshWorkspaceCurrencyDependentOptions() {
  const enabled = selectedOptions($("#workspaceEnabledCurrencies"));
  const defaultValue = $("#workspaceDefaultCurrency").value;
  const reportingValue = $("#workspaceReportingCurrency").value;
  populateCurrencySelect($("#workspaceDefaultCurrency"), enabled.includes(defaultValue) ? defaultValue : enabled[0], enabled);
  populateCurrencySelect($("#workspaceReportingCurrency"), enabled.includes(reportingValue) ? reportingValue : enabled[0], enabled);
  renderWorkspaceCurrencyPicker();
}

async function saveWorkspaceCurrencySettings(event) {
  event.preventDefault();
  const workspace = currentBudgetWorkspace();
  const button = event.submitter || $("#saveWorkspaceCurrencyButton");
  if (!workspace) return;
  const enabledCurrencies = selectedOptions($("#workspaceEnabledCurrencies"));
  if (!enabledCurrencies.length) {
    showToast("Select at least one workspace currency.");
    return;
  }
  try {
    setSubmitting(button, true, "Saving...");
    await query("workspace currency settings save", supabase.rpc("save_workspace_currency_settings", {
      p_workspace_id: workspace.id,
      p_default_payment_currency: $("#workspaceDefaultCurrency").value,
      p_enabled_currencies: enabledCurrencies,
      p_reporting_currency: $("#workspaceReportingCurrency").value,
      p_conversion_enabled: $("#workspaceConversionEnabled").checked
    }));
    if ($("#workspaceConversionEnabled").checked) {
      await query("workspace historical conversion backfill", supabase.rpc("backfill_workspace_currency_conversions", {
        p_workspace_id: workspace.id
      }));
    }
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    window.MushavoPWA?.markFormClean("#workspaceCurrencySettingsForm");
    showToast("Workspace currency settings saved. Existing amounts were not changed.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setSubmitting(button, false, "Save currency settings");
  }
}

function titleCase(value) {
  return `${value || ""}`.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function activePriceFor(planId, billingPeriod, currency = null) {
  return state.planPrices.find((price) =>
    price.plan_id === planId &&
    price.billing_period === billingPeriod &&
    price.is_active &&
    (!currency || price.currency === currency)
  ) || null;
}

function includedMemberSeats(plan) {
  const configured = state.planLimits.find((limit) =>
    limit.plan_id === plan?.id && limit.limit_code === "included_member_seats"
  );
  if (configured?.limit_value != null) return Math.max(1, Number(configured.limit_value));
  return plan?.code === "household" ? 4 : plan?.code === "business" ? 6 : 1;
}

function activePaymentLimitForPlan(plan) {
  const configured = state.planLimits.find((limit) =>
    limit.plan_id === plan?.id && limit.limit_code === "active_planned_payments"
  );
  return configured?.limit_value == null ? null : Number(configured.limit_value);
}

function featureLabelsForPlan(plan) {
  return state.planFeatures
    .filter((feature) => feature.plan_id === plan?.id && feature.enabled)
    .map((feature) => PLAN_FEATURE_LABELS[feature.feature_code] || titleCase(feature.feature_code));
}

function featureDisplayForPlan(plan) {
  const configured = state.planFeatures.filter((feature) => feature.plan_id === plan?.id);
  const configuredByCode = new Map(configured.map((feature) => [feature.feature_code, feature.enabled]));
  const featureCodes = [...new Set([...Object.keys(PLAN_FEATURE_LABELS), ...configured.map((feature) => feature.feature_code)])];
  return featureCodes.map((featureCode) => ({
    label: PLAN_FEATURE_LABELS[featureCode] || titleCase(featureCode),
    enabled: configuredByCode.get(featureCode) === true
  }));
}

function workspaceComparablePlans() {
  return state.plans.filter((plan) => plan.is_active !== false);
}

function workspacePlanWorkspace() {
  const selectedWorkspace = currentBudgetWorkspace();
  if (selectedWorkspace?.owner_id === state.session?.user?.id) return selectedWorkspace;
  return state.workspaces?.find((workspace) =>
    workspace.workspace_type === "personal" && workspace.owner_id === state.session?.user?.id && workspace.status !== "closed"
  ) || selectedWorkspace;
}

function workspacePlanSubscription(workspace = workspacePlanWorkspace()) {
  return workspace?.id === currentBudgetWorkspace()?.id
    ? state.workspaceSubscription
    : state.personalWorkspaceSubscription;
}

function workspacePlanEntitlement(workspace = workspacePlanWorkspace()) {
  return workspace?.id === currentBudgetWorkspace()?.id
    ? state.workspaceEntitlement
    : state.personalWorkspaceEntitlement;
}

function isCurrentWorkspacePlan(plan, workspace = workspacePlanWorkspace()) {
  const entitlement = workspacePlanEntitlement(workspace);
  const subscription = workspacePlanSubscription(workspace);
  if (plan.workspace_type !== workspace?.workspace_type ||
      plan.code !== entitlement?.plan_code) return false;
  // Free access has no recurring billing period.
  return plan.code === "free" ||
    subscription?.billing_period === state.workspacePlanBillingPeriod;
}

function workspacePlanCurrencies(plans) {
  return [...new Set(state.planPrices
    .filter((price) => price.is_active && plans.some((plan) => plan.id === price.plan_id))
    .map((price) => price.currency)
    .filter(Boolean)
  )].sort();
}

function syncWorkspacePlanControls(plans, workspace = workspacePlanWorkspace()) {
  const currencies = workspacePlanCurrencies(plans);
  const currencySelect = $("#workspacePlanCurrency");
  if (!currencies.includes(state.workspacePlanCurrency)) {
    const preferred = workspace?.id === currentBudgetWorkspace()?.id
      ? state.workspaceSettings?.default_payment_currency || workspace?.currency
      : workspace?.currency;
    state.workspacePlanCurrency = currencies.includes(preferred)
      ? preferred
      : currencies.includes("USD")
        ? "USD"
        : currencies[0] || null;
  }
  currencySelect.innerHTML = currencies.length
    ? currencies.map((currency) => `<option value="${escapeHtml(currency)}">${escapeHtml(currency)}</option>`).join("")
    : '<option value="">No configured currency</option>';
  currencySelect.value = state.workspacePlanCurrency || "";
  currencySelect.disabled = !currencies.length;
  document.querySelectorAll("[data-workspace-plan-period]").forEach((button) => {
    const active = button.dataset.workspacePlanPeriod === state.workspacePlanBillingPeriod;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
}

function extraMemberBillingMonths(price) {
  return price?.billing_period === "annual" ? 12 : 1;
}

function planInvoiceTotal(plan, price, memberCountOverride = null, workspace = currentBudgetWorkspace()) {
  if (!plan || !price) return 0;
  const includedSeats = includedMemberSeats(plan);
  const relevantMemberCount = memberCountOverride == null
    ? workspace?.id === currentBudgetWorkspace()?.id && workspace?.workspace_type === plan.workspace_type
      ? Math.max(
        Number(state.billableMemberCount || 1),
        Number(state.memberUsage?.member_limit || state.workspaceSubscription?.member_limit || 1)
      )
      : includedSeats
    : Math.max(includedSeats, Number(memberCountOverride || includedSeats));
  const extraSeats = ["household", "business"].includes(plan.code)
    ? Math.max(0, relevantMemberCount - includedSeats)
    : 0;
  return Number(price.amount || 0)
    + extraSeats * Number(price.extra_member_amount || 0) * extraMemberBillingMonths(price);
}

function formatSubscriptionDate(value, fallback = "Unavailable") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback
    : date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function subscriptionStartDate(subscription) {
  if (!subscription?.billing_period) return null;
  // A Personal workspace can predate its paid plan. The first approved
  // entitlement is the actual purchase date, even after later renewals.
  const approvedStarts = state.entitlementHistory
    .filter((entry) => entry.workspace_id === subscription.workspace_id && entry.reason?.startsWith("Approved subscription payment "))
    .map((entry) => entry.effective_from)
    .filter(Boolean).sort();
  return approvedStarts[0] || subscription.billing_anchor_at || subscription.entitlement_start_at || null;
}

function subscriptionTimeRemaining(paidThrough, referenceDate = new Date()) {
  if (!paidThrough) return "No expiry";
  const expiry = new Date(paidThrough).getTime();
  if (!Number.isFinite(expiry)) return "Expiry unavailable";
  const remaining = expiry - referenceDate.getTime();
  if (remaining <= 0) return "Expired";
  if (remaining < 86400000) return "Less than 1 day left";
  const days = Math.ceil(remaining / 86400000);
  return `${days} ${days === 1 ? "day" : "days"} left`;
}

function renderSubscriptionTimeRemaining() {
  const subscription = state.workspaceSubscription;
  const paidThrough = subscription?.billing_period ? subscription.paid_through_at : null;
  const countdown = $("#subscriptionCountdown");
  countdown.textContent = subscriptionTimeRemaining(paidThrough);
  const expired = Boolean(paidThrough && new Date(paidThrough).getTime() <= Date.now());
  const endingSoon = Boolean(paidThrough && !expired && new Date(paidThrough).getTime() - Date.now() <= 7 * 86400000);
  countdown.closest(".subscription-expiry-highlight").classList.toggle("is-expired", expired);
  countdown.closest(".subscription-expiry-highlight").classList.toggle("is-ending", endingSoon);
  $("#subscriptionExpiryHint").textContent = !paidThrough
    ? "Free plan has no expiry date"
    : expired ? "The paid period has ended" : "Until the paid-through date below";
}

function renderSubscription() {
  const workspace = currentBudgetWorkspace();
  const entitlement = state.workspaceEntitlement;
  if (!workspace || !entitlement) return;
  const ownedFamilyPlans = state.workspaces
    .filter((item) => item.workspace_type === "household" && item.owner_id === state.session.user.id && item.status !== "closed")
    .map((item) => {
      const subscription = state.ownedFamilySubscriptions.find((entry) => entry.workspace_id === item.id);
      const plan = state.plans.find((entry) => entry.id === subscription?.plan_id);
      const status = subscription?.paid_through_at && new Date(subscription.paid_through_at) < new Date()
        ? "Expired" : titleCase(subscription?.status || "Unavailable");
      return { workspace: item, plan, status, subscription };
    });
  const personalPlan = state.personalWorkspaceEntitlement;
  $("#ownedPersonalPlanName").textContent = personalPlan?.plan_name || "Free";
  $("#ownedPersonalPlanDetail").textContent = `Your own Personal workspace · ${titleCase(personalPlan?.effective_status || "active")}${state.personalWorkspaceSubscription?.paid_through_at && state.personalWorkspaceSubscription?.billing_period ? ` · Paid through ${formatSubscriptionDate(state.personalWorkspaceSubscription.paid_through_at)}` : " · No expiry"}`;
  $("#ownedFamilyPlanName").textContent = ownedFamilyPlans.length
    ? ownedFamilyPlans.length === 1 ? ownedFamilyPlans[0].plan?.display_name || "Family" : `${ownedFamilyPlans.length} Family workspaces`
    : "None";
  $("#ownedFamilyPlanDetail").textContent = ownedFamilyPlans.length
    ? "Subscriptions you own and manage."
    : "No Family workspace purchased by you. Joining another family does not change your plan.";
  $("#ownedFamilyPlanList").innerHTML = ownedFamilyPlans.map(({ workspace: owned, plan, status, subscription }) =>
    `<div class="owned-family-plan-row"><strong>${escapeHtml(owned.name)}</strong><small>${escapeHtml(plan?.display_name || "Family plan")} · ${escapeHtml(status)}${subscription?.billing_period ? ` · ${escapeHtml(titleCase(subscription.billing_period))}` : ""}${subscription?.paid_through_at ? ` · Paid through ${escapeHtml(formatSubscriptionDate(subscription.paid_through_at))}` : ""}</small></div>`).join("");
  $("#startOwnFamilyPlan").textContent = ownedFamilyPlans.length ? "Start another Family plan" : "Start your own Family plan";
  const joinedFamily = workspace.workspace_type === "household" && !currentWorkspaceIsOwned();
  $("#joinedFamilyAccessCard").hidden = !joinedFamily;
  if (joinedFamily) {
    $("#joinedFamilyAccessName").textContent = workspace.name;
    $("#joinedFamilyAccessDetail").textContent = `${entitlement.plan_name} workspace access · ${titleCase(entitlement.effective_status)} · Plan managed by the family owner. You have not purchased this plan.`;
  }
  $("#subscriptionWorkspaceOwnershipCaption").textContent = joinedFamily
    ? "Family workspace · Plan managed and paid for by the family owner"
    : `${workspace.workspace_type === "household" ? "Family" : "Personal"} workspace · Your subscription`;
  $("#ownedWorkspacePlansPanel").hidden = false;
  $("#ownedWorkspaceBillingHistory").hidden = joinedFamily;
  const activeItems = state.paymentItems.filter((item) => item.workspace_id === workspace.id && isPaymentActive(item)).length;
  const tracksMemberPlaces = ["household", "business"].includes(workspace.workspace_type);
  const memberLimit = Math.max(1, Number(state.memberUsage?.member_limit || state.workspaceSubscription?.member_limit || 1));
  const memberUsage = Number(state.memberUsage?.used_member_count || state.billableMemberCount || 1);
  const limitText = tracksMemberPlaces
    ? `${memberUsage} / ${memberLimit}`
    : entitlement.active_payment_limit == null
      ? `${activeItems} active`
      : `${activeItems} / ${entitlement.active_payment_limit}`;
  $("#subscriptionPlanName").textContent = entitlement.plan_name;
  $("#subscriptionStatusText").textContent = titleCase(entitlement.effective_status);
  $("#subscriptionStatusText").className = `subscription-status ${entitlement.effective_status === "active" ? "is-active" : "is-inactive"}`;
  $("#subscriptionBillingPeriod").textContent = entitlement.plan_code === "free"
    ? "No recurring billing"
    : state.workspaceSubscription?.billing_period
      ? `${titleCase(state.workspaceSubscription.billing_period)} billing`
      : "Billing period unavailable";
  $("#subscriptionWorkspaceName").textContent = workspace.name;
  $("#subscriptionWorkspaceType").textContent = `${workspace.workspace_type === "household" ? "Family" : "Personal"} workspace`;
  $("#subscriptionStartedAt").textContent = formatSubscriptionDate(subscriptionStartDate(state.workspaceSubscription), "No paid subscription");
  const paidThrough = state.workspaceSubscription?.billing_period ? state.workspaceSubscription.paid_through_at : null;
  $("#subscriptionPaidThrough").textContent = paidThrough
    ? formatSubscriptionDate(paidThrough)
    : "No expiry";
  $("#subscriptionPaidThroughHint").textContent = paidThrough
    ? "End of the current paid period" : "Free plan has no expiry date";
  renderSubscriptionTimeRemaining();
  $("#subscriptionUsage").textContent = limitText;
  $("#subscriptionUsageCaption").textContent = tracksMemberPlaces
    ? `${Number(state.memberUsage?.active_member_count || 1)} active · ${Number(state.memberUsage?.pending_invitation_count || 0)} pending · ${Number(state.memberUsage?.available_member_count || 0)} available`
    : "Active payment items";
  $("#openRenewalButton").hidden = !currentWorkspaceIsOwned();

  const notice = $("#subscriptionAccessNotice");
  const expiredPersonal = workspace.workspace_type === "personal" && entitlement.plan_code === "free"
    && state.workspaceSubscription?.plan_id !== state.plans.find((plan) => plan.code === "free")?.id;
  notice.classList.toggle("hidden", entitlement.effective_status === "active" && !entitlement.read_only && !expiredPersonal);
  if (!notice.classList.contains("hidden")) {
    notice.innerHTML = expiredPersonal
      ? "<strong>Personal plan expired.</strong><span>Your five chosen payments remain active. Extra payments are paused, cannot be edited or recorded, and send no reminders. You can delete them or renew Personal.</span>"
      : entitlement.effective_status === "suspended"
      ? "<strong>Workspace suspended.</strong><span>Access can only be restored by an authorized Mushavo Budget administrator. A payment submission does not automatically remove a suspension.</span>"
      : `<strong>Subscription expired.</strong><span>Your data remains stored. This Family workspace is read-only until its owner renews it${currentWorkspaceIsOwned() ? "." : ". Ask the family head to renew."}</span>`;
  }
  renderFreePaymentSelection();
  renderWorkspacePlans();
  renderRenewalHistory();
  renderEntitlementHistory();
}

function renderFreePaymentSelection() {
  const panel = $("#freePaymentSelection");
  const entitlement = state.personalWorkspaceEntitlement;
  const items = state.paymentItems.filter((item) => item.visibility === "personal" && item.status === "active")
    .sort((a, b) => `${a.created_at}`.localeCompare(`${b.created_at}`) || a.id.localeCompare(b.id));
  const limit = Number(entitlement?.active_payment_limit ?? 5);
  const show = items.length > limit && entitlement?.effective_status === "active";
  panel.classList.toggle("hidden", !show);
  if (!show) { state.freePaymentDraft = null; return; }
  if (!state.freePaymentDraft) {
    const selected = state.personalPlanAccess.filter((row) => row.selected_for_free)
      .map((row) => row.payment_item_id);
    const choices = [...new Set([...selected, ...items.map((item) => item.id)])].slice(0, limit);
    state.freePaymentDraft = new Set(choices);
  }
  $("#freePaymentChoices").innerHTML = items.map((item) => `
    <label class="free-payment-choice"><input type="checkbox" data-free-payment-id="${item.id}" ${state.freePaymentDraft.has(item.id) ? "checked" : ""} />
      <span>${escapeHtml(item.name)}</span><small>${isPlanPaused(item) ? "Paused by plan limit" : "Active"}</small></label>
  `).join("");
  $("#freePaymentSelectionCount").textContent = `${state.freePaymentDraft.size} of ${limit} selected`;
  $("#saveFreePaymentSelection").disabled = state.freePaymentDraft.size !== limit;
}

async function saveFreePaymentSelection() {
  const personalWorkspace = state.workspaces.find((workspace) =>
    workspace.workspace_type === "personal" && workspace.owner_id === state.session.user.id && workspace.status === "active"
  );
  if (!personalWorkspace || state.freePaymentDraft?.size !== Number(state.personalWorkspaceEntitlement?.active_payment_limit ?? 5)) return;
  try {
    await query("free payment selection", supabase.rpc("set_personal_free_payment_selection", {
      p_workspace_id: personalWorkspace.id, p_payment_ids: [...state.freePaymentDraft]
    }));
    state.freePaymentDraft = null;
    await loadPersonalPlanAccess();
    renderFamilyApp();
    showToast("Your five Free payments were saved.");
  } catch (error) { showToast(friendlyMessage(error.message)); }
}

function renderWorkspacePlans() {
  const list = $("#workspacePlanList");
  const workspace = workspacePlanWorkspace();
  const selectedWorkspace = currentBudgetWorkspace();
  const usesSelectedWorkspace = workspace?.id === selectedWorkspace?.id;
  const plans = workspaceComparablePlans();
  syncWorkspacePlanControls(plans, workspace);
  const workspaceTypeLabel = workspace?.workspace_type === "household" ? "Family" : titleCase(workspace?.workspace_type);
  $("#workspacePlansTitle").textContent = "All available plans";
  $("#workspacePlansDescription").textContent = `Viewing your ${workspaceTypeLabel.toLowerCase()} workspace. Each workspace has its own subscription.`;
  $("#workspacePlanPricingNote").textContent = state.workspacePlanCurrency
    ? `Showing ${titleCase(state.workspacePlanBillingPeriod)} prices in ${state.workspacePlanCurrency}.`
    : "No active price currency is configured for these plans.";
  if (!plans.length) {
    list.innerHTML = emptyState("No plans available", "An administrator must publish a plan for this workspace type.");
    return;
  }
  const cards = plans.map((plan) => {
    const price = activePriceFor(plan.id, state.workspacePlanBillingPeriod, state.workspacePlanCurrency);
    const appliesToSelectedWorkspace = plan.workspace_type === workspace?.workspace_type;
    const current = isCurrentWorkspacePlan(plan, workspace);
    const startsNewFamily = workspace?.workspace_type === "personal" && plan.workspace_type === "household";
    const pending = usesSelectedWorkspace && state.renewalRequests.some((request) =>
      request.requested_plan_id === plan.id && request.status === "pending_review" &&
      state.subscriptionInvoices.some((invoice) => invoice.id === request.invoice_id && invoice.billing_period === state.workspacePlanBillingPeriod)
    );
    const canSelect = workspace?.owner_id === state.session?.user?.id && plan.code !== "free" && plan.available_for_purchase !== false && (appliesToSelectedWorkspace || startsNewFamily);
    const planWorkspaceLabel = plan.workspace_type === "household" ? "Family" : titleCase(plan.workspace_type);
    const includedSeats = includedMemberSeats(plan);
    const paymentLimit = activePaymentLimitForPlan(plan);
    const features = featureDisplayForPlan(plan);
    const total = price ? planInvoiceTotal(plan, price, null, workspace) : 0;
    const periodLabel = state.workspacePlanBillingPeriod === "annual" ? "year" : "month";
    const priceText = plan.code === "free" ? "Free" : price ? money(total, price.currency) : "Price unavailable";
    const extraMember = price && Number(price.extra_member_amount) > 0
      ? `<span>Additional person: ${money(price.extra_member_amount, price.currency)} per month</span>`
      : "";
    const stateBadge = current
      ? '<span class="workspace-plan-state current">Current plan</span>'
      : pending
        ? '<span class="workspace-plan-state pending">Awaiting approval</span>'
        : plan.is_featured
          ? '<span class="workspace-plan-state recommended">Recommended</span>'
          : "";
    const action = current && plan.code === "free"
      ? '<button type="button" disabled>Current plan</button>'
      : canSelect
        ? `<button class="${plan.is_featured && !current ? "primary" : ""}" type="button" data-select-renewal-plan="${escapeHtml(plan.code)}" ${price && !pending ? "" : "disabled"}>${pending ? "Awaiting approval" : current ? "Renew plan" : startsNewFamily ? "Start Family plan" : "Choose plan"}</button>`
        : workspace?.owner_id === state.session?.user?.id
          ? `<small class="workspace-plan-owner-note">${!appliesToSelectedWorkspace ? `Select a ${escapeHtml(planWorkspaceLabel)} workspace to manage this plan.` : plan.code === "free" ? "Included with a free Personal workspace." : "This plan is not currently available for purchase."}</small>`
          : '<small class="workspace-plan-owner-note">Only the workspace owner can change this plan.</small>';
    return `<article class="plan-card workspace-plan-card${current ? " current" : ""}${pending ? " pending" : ""}">
      <div class="workspace-plan-top"><span class="workspace-plan-type">${escapeHtml(planWorkspaceLabel)}</span>${stateBadge}</div>
      <h4>${escapeHtml(plan.display_name)}</h4>
      <p>${escapeHtml(plan.marketing_summary || plan.description)}</p>
      <div class="workspace-plan-price"><strong>${escapeHtml(priceText)}</strong>${price && plan.code !== "free" ? `<span> / ${periodLabel}</span>` : ""}</div>
      <div class="workspace-plan-meta"><span>${includedSeats} ${includedSeats === 1 ? "person" : "people"} included</span><span>${paymentLimit == null ? "Unlimited payment items" : `${paymentLimit} active personal payments`}</span>${extraMember}</div>
      <ul class="workspace-plan-features">${features.map((feature) => `<li class="${feature.enabled ? "available" : "unavailable"}">${escapeHtml(feature.label)}</li>`).join("")}</ul>
      ${startsNewFamily ? '<small class="workspace-plan-separate-note">Creates a separate Family workspace with its own plan.</small>' : ""}
      ${action}
    </article>`;
  }).join("");
  list.innerHTML = `<div class="workspace-plan-grid">${cards}</div>`;
}

async function openWorkspacePlanSelection(planCode) {
  const workspace = workspacePlanWorkspace();
  if (workspace?.id !== currentBudgetWorkspace()?.id) {
    const selected = await selectNotificationWorkspace(workspace?.id);
    if (!selected) throw new Error("Your Personal workspace could not be selected.");
  }
  openRenewalDialog(planCode);
}

function renderRenewalHistory() {
  const list = $("#renewalHistoryList");
  if (!state.renewalRequests.length) {
    list.innerHTML = emptyState("No payment requests", "Submitted payments and review decisions will appear here.");
    return;
  }
  list.innerHTML = "";
  state.renewalRequests.forEach((request) => {
    const invoice = state.subscriptionInvoices.find((item) => item.id === request.invoice_id);
    const payment = state.subscriptionPayments.find((item) => item.renewal_request_id === request.id);
    const memberLimitSummary = request.purchase_kind === "extra_places"
      ? `<small>${Number(request.seat_count || 0)} extra place(s) · ${Number(invoice?.billable_member_count || 1)} places total · plan ends ${escapeHtml(new Date(request.seat_expiry_at).toLocaleDateString())}</small>`
      : ["household", "business"].includes(invoice?.plan_code)
      ? `<small>${request.provision_workspace_on_approval ? `New family: ${escapeHtml(request.requested_workspace_name || "Family workspace")} &middot; ` : ""}${Number(invoice?.billable_member_count || 1)} total paid place${Number(invoice?.billable_member_count || 1) === 1 ? "" : "s"}</small>`
      : "";
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `<div class="record-main"><strong>${request.purchase_kind === "extra_places" ? "Additional Family places" : escapeHtml(invoice?.plan_name || "Subscription")}</strong><span>${escapeHtml(invoice?.invoice_number || "Invoice pending")} &middot; ${titleCase(invoice?.billing_period)} &middot; ${new Date(request.created_at).toLocaleDateString()}</span>${memberLimitSummary}${request.rejection_reason ? `<small>${escapeHtml(request.rejection_reason)}</small>` : ""}<div class="badge-row">${statusBadge(request.status)}</div></div><div class="record-side"><strong>${invoice ? money(invoice.total_amount, invoice.currency) : ""}</strong>${payment?.receipt_number ? `<small>Receipt ${escapeHtml(payment.receipt_number)}</small>` : ""}</div>`;
    list.append(article);
  });
}

function renderEntitlementHistory() {
  const list = $("#entitlementHistoryList");
  if (!state.entitlementHistory.length) {
    list.innerHTML = emptyState("No plan history", "The initial entitlement will appear after the complete schema is applied.");
    return;
  }
  list.innerHTML = "";
  state.entitlementHistory.forEach((entry) => {
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `<div class="record-main"><strong>${escapeHtml(entry.plans?.display_name || "Plan")}</strong><span>${escapeHtml(entry.reason)} &middot; ${new Date(entry.effective_from).toLocaleDateString()}</span><div class="badge-row">${statusBadge(entry.status)}</div></div><div class="record-side">${entry.effective_until ? `<small>Through ${new Date(entry.effective_until).toLocaleDateString()}</small>` : "<small>No expiry</small>"}</div>`;
    list.append(article);
  });
}

function renderNotifications() {
  const unreadCount = state.notifications.filter((item) => !item.read_at).length;
  const dueReminderCount = notificationDueOccurrences().length;
  const alertCount = unreadCount + dueReminderCount;
  syncApplicationBadge(alertCount);
  if ($("#notificationCount")) $("#notificationCount").textContent = alertCount;
  document.querySelectorAll("[data-notification-count]").forEach((badge) => {
    badge.textContent = alertCount > 99 ? "99+" : alertCount;
    badge.classList.toggle("hidden", alertCount === 0);
  });
  document.querySelectorAll("[data-open-notifications]").forEach((button) => {
    button.setAttribute("aria-label", alertCount ? `Open notifications, ${alertCount} alerts` : "Open notifications");
  });
  if ($("#notificationDialogTitle")) {
    $("#notificationDialogTitle").textContent = state.isAdmin ? "Admin notifications" : "Notifications";
  }

  renderNotificationList($("#notificationsList"));
  renderNotificationList($("#notificationDialogList"), true);
}

function syncApplicationBadge(alertCount) {
  const count = Math.max(0, Math.floor(Number(alertCount) || 0));
  let badgeUpdate;
  if (count > 0 && typeof navigator.setAppBadge === "function") {
    badgeUpdate = navigator.setAppBadge(count);
  } else if (count === 0 && typeof navigator.clearAppBadge === "function") {
    badgeUpdate = navigator.clearAppBadge();
  } else {
    return;
  }
  Promise.resolve(badgeUpdate).catch(() => {
    // Badging is optional and must not interrupt the in-app notification count.
  });
}

function renderNotificationList(list, compact = false) {
  if (!list) return;
  const dueReminders = state.isAdmin ? [] : notificationDueOccurrences();
  if (!state.notifications.length && !dueReminders.length) {
    list.innerHTML = state.isAdmin
      ? emptyState("No admin notifications", "Subscription reviews, support tickets, and public enquiries will appear here.")
      : emptyState("No notifications", "Invites and payment reminders will appear here.");
    return;
  }
  list.innerHTML = "";
  dueReminders.forEach((occurrence) => {
    const workspace = state.workspaces.find((item) => item.id === occurrence.item.workspace_id)
      || currentBudgetWorkspace();
    const workspaceLabel = workspaceNotificationLabel(workspace);
    const article = document.createElement("article");
    article.className = `record-card${compact ? " notification-card" : ""}`;
    article.dataset.notificationPaymentItemId = occurrence.item.id;
    article.dataset.notificationPaymentDueDate = occurrence.dueDate;
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(occurrence.item.name)}</strong>
        <span>${money(occurrence.outstanding, occurrence.item.currency)} outstanding &middot; due ${occurrence.dueDate}</span>
        <div class="badge-row">${workspaceLabel ? `<span class="mini-badge">${escapeHtml(workspaceLabel)}</span>` : ""}${statusBadge(occurrence.status)}<span class="mini-badge">Payment reminder</span></div>
      </div>
      <div class="record-side"><button class="primary" type="button" data-record-payment="${occurrence.key}">Record payment</button></div>
    `;
    list.append(article);
  });
  state.notifications.forEach((notification) => {
    const invitation = notification.invitation_id
      ? state.familyInvitations.find((item) => item.id === notification.invitation_id)
      : null;
    const isPendingInvite = invitation
      && invitation.status === "pending"
      && invitation.invitee_email?.toLowerCase() === state.session.user.email?.toLowerCase();
    const workspaceLabel = workspaceNotificationLabel(notificationWorkspace(notification));
    const article = document.createElement("article");
    article.className = `record-card${compact ? " notification-card" : ""}`;
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(notification.title)}</strong>
        <span>${escapeHtml(notification.body)}</span>
        <small>${new Date(notification.created_at).toLocaleString()}</small>
        <div class="badge-row">${workspaceLabel ? `<span class="mini-badge">${escapeHtml(workspaceLabel)}</span>` : ""}${statusBadge(notification.read_at ? "read" : "new")}</div>
      </div>
      <div class="record-side">
        ${isPendingInvite ? `<div class="row-actions"><button class="primary" type="button" data-accept-invite="${invitation.id}">Accept</button><button type="button" data-reject-invite="${invitation.id}">Reject</button></div>` : ""}
        ${notification.url ? `<button type="button" data-open-notification="${notification.id}">Open</button>` : ""}
        ${notification.read_at ? "" : `<button type="button" data-read-notification="${notification.id}">Mark read</button>`}
      </div>
    `;
    list.append(article);
  });
}

function notificationDueOccurrences() {
  const currentMonth = toMonthValue(new Date());
  const todayValue = toDateValue(new Date());
  const todayDate = parseDate(todayValue);
  return [
    ...generateOccurrences(state.paymentItems, state.paymentRecords, currentMonth),
    ...generateOccurrences(state.paymentItems, state.paymentRecords, offsetMonthValue(currentMonth, 1))
  ]
    .filter((occurrence) => {
      if (occurrence.outstanding <= 0) return false;
      const daysUntilDue = Math.ceil((parseDate(occurrence.dueDate) - todayDate) / 86400000);
      return daysUntilDue >= 0 && daysUntilDue <= Number(occurrence.item.reminder_days_before ?? 3);
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 8);
}

function openInviteMemberDialog() {
  const button = $("#inviteMemberButton");
  if (button.disabled) {
    showToast("Only an active family owner with member access can send invitations.");
    return;
  }
  const dialog = $("#inviteMemberDialog");
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => $("#inviteEmail").focus(), 0);
}

function openNotificationDialog() {
  renderNotifications();
  if (state.isAdmin) {
    renderAdminPushNotificationSettings();
    schedulePushNotificationRefresh(false, true);
  }
  const dialog = $("#notificationDialog");
  if (dialog && !dialog.open) dialog.showModal();
}

function eligibleRenewalPlans() {
  const workspace = currentBudgetWorkspace();
  return state.plans.filter((plan) => {
    if (plan.code === "free" || plan.available_for_purchase === false) return false;
    if (plan.workspace_type === workspace?.workspace_type) return true;
    return workspace?.workspace_type === "personal" && plan.workspace_type === "household";
  });
}

async function startAdditionalFamilyPurchase() {
  const endOperation = window.MushavoPWA?.beginOperation?.();
  const button = $("#purchaseFamilySubscription");
  button.disabled = true;
  try {
    // New families are purchased from the owner's Personal workspace, never by
    // renewing the currently selected family's subscription.
    await selectFamily("__personal__");
    await loadWorkspaceSubscriptionData();
    state.familyTab = "subscription";
    window.location.hash = "family/subscription";
    renderFamilyApp();
    const pending = state.renewalRequests.some((request) =>
      request.provision_workspace_on_approval && request.status === "pending_review");
    if (pending) {
      showToast("A Family plan request is already waiting for review. View it in Payment review history.");
      $("#renewalHistoryList").closest("details").open = true;
      return;
    }
    const plan = eligibleRenewalPlans().find((item) => item.workspace_type === "household");
    if (!plan) throw new Error("No Family plan is available for purchase yet.");
    openRenewalDialog(plan.code);
  } catch (error) {
    showToast(friendlyMessage(error.message));
  } finally {
    button.disabled = false;
    endOperation?.();
  }
}

async function refreshFamilySeatQuote(forSubmission = false) {
  const count = Number($("#familySeatsCount").value);
  const workspaceId = currentBudgetWorkspace()?.id;
  if (!Number.isInteger(count) || count < 1 || count > 100 || !workspaceId) {
    state.familySeatQuote = null;
    $("#familySeatsQuote").textContent = "Enter a valid number of additional places.";
    $("#familySeatsSubmit").disabled = true;
    return null;
  }
  $("#familySeatsSubmit").disabled = true;
  const quote = await query("Family places quote", supabase.rpc("family_extra_place_quote", {
    p_workspace_id: workspaceId, p_count: count
  }));
  if (workspaceId !== currentBudgetWorkspace()?.id || count !== Number($("#familySeatsCount").value)) return null;
  state.familySeatQuote = quote;
  $("#familySeatsCount").max = `${Math.max(1, 100 - Number(quote.current_limit))}`;
  $("#familySeatsQuote").innerHTML = `
    <div><span>Family plan</span><strong>${escapeHtml(titleCase(quote.billing_period))}</strong></div>
    <div><span>Current places → after approval</span><strong>${Number(quote.current_limit)} → ${Number(quote.target_limit)}</strong></div>
    <div><span>Current billing month</span><strong>${quote.current_half_charge ? money(Number(quote.monthly_price) * count / 2, quote.currency) : money(0, quote.currency)}</strong></div>
    <div><span>Full months remaining</span><strong>${Number(quote.full_months_remaining)} × ${money(Number(quote.monthly_price) * count, quote.currency)}</strong></div>
    <div><span>Existing renewal date</span><strong>${escapeHtml(new Date(quote.paid_through_at).toLocaleDateString())}</strong></div>
    <div class="invoice-total"><span>Due now</span><strong>${money(quote.amount, quote.currency)}</strong></div>`;
  const free = Number(quote.amount) === 0;
  $("#familySeatsPaymentFields").classList.toggle("hidden", free);
  for (const field of ["#familySeatsMethod", "#familySeatsPaymentDate", "#familySeatsReference", "#familySeatsProof"]) {
    $(field).disabled = free;
  }
  $("#familySeatsPaymentDate").required = !free;
  $("#familySeatsReference").required = !free;
  $("#familySeatsSubmit").textContent = free ? "Request free remaining days" : "Submit payment for review";
  if (!forSubmission) $("#familySeatsSubmit").disabled = false;
  return quote;
}

async function openFamilySeatsDialog() {
  if (!state.family || !canManageMembersForFamily(state.family.id)
      || state.renewalRequests.some((request) => request.status === "pending_review")) {
    showToast("An active Family workspace without a pending payment is required.");
    return;
  }
  $("#familySeatsCount").value = "1";
  $("#familySeatsPaymentDate").value = toDateValue(new Date());
  $("#familySeatsDialog").showModal();
  try {
    await refreshFamilySeatQuote();
  } catch (error) {
    $("#familySeatsQuote").textContent = friendlyMessage(error.message);
  }
}

async function submitFamilySeats(event) {
  event.preventDefault();
  const button = $("#familySeatsSubmit");
  const workspaceId = currentBudgetWorkspace()?.id;
  const displayed = state.familySeatQuote;
  let proofPath = null;
  let submitted = false;
  try {
    setSubmitting(button, true, "Submitting...");
    const quote = await refreshFamilySeatQuote(true);
    if (!quote || !displayed || quote.workspace_id !== displayed.workspace_id
      || quote.amount !== displayed.amount
      || quote.paid_through_at !== displayed.paid_through_at
      || quote.current_limit !== displayed.current_limit
      || quote.monthly_price !== displayed.monthly_price
      || quote.current_half_charge !== displayed.current_half_charge
      || quote.full_months_remaining !== displayed.full_months_remaining) {
      showToast("The quote changed. Please review the new amount before submitting.");
      return;
    }
    const proof = Number(quote.amount) > 0 ? $("#familySeatsProof").files[0] || null : null;
    if (proof) proofPath = await uploadSubscriptionProof(proof, workspaceId);
    await query("Family places request", supabase.rpc("submit_family_extra_places", {
      p_workspace_id: workspaceId,
      p_count: Number(quote.additional_count),
      p_expected_amount: Number(quote.amount),
      p_payment_method: Number(quote.amount) > 0 ? $("#familySeatsMethod").value : null,
      p_payment_date: Number(quote.amount) > 0 ? $("#familySeatsPaymentDate").value : null,
      p_reference_number: Number(quote.amount) > 0 ? $("#familySeatsReference").value.trim() : null,
      p_notes: $("#familySeatsNotes").value.trim() || null,
      p_proof_path: proofPath,
      p_proof_name: proof?.name || null,
      p_proof_mime_type: proof?.type || null,
      p_proof_size_bytes: proof?.size || null
    }));
    submitted = true;
    $("#familySeatsDialog").close();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    showToast("Extra places requested. You can invite more members after approval.");
  } catch (error) {
    if (proofPath && !submitted) await supabase.storage.from(SUBSCRIPTION_PROOF_BUCKET).remove([proofPath]).catch(() => {});
    showToast(friendlyMessage(error.message));
  } finally {
    setSubmitting(button, false, "Submit payment for review");
  }
}

function openRenewalDialog(planCode = null) {
  if (!currentWorkspaceIsOwned()) {
    showToast("Only the workspace owner can submit a subscription payment.");
    return;
  }
  const plans = eligibleRenewalPlans();
  if (!plans.length) {
    showToast("No paid plan is available for this workspace yet.");
    return;
  }
  const select = $("#renewalPlan");
  select.innerHTML = "";
  plans.forEach((plan) => select.append(new Option(plan.display_name, plan.code)));
  select.value = plans.some((plan) => plan.code === planCode)
    ? planCode
    : plans.some((plan) => plan.code === state.workspaceEntitlement?.plan_code)
      ? state.workspaceEntitlement.plan_code
      : plans[0].code;
  $("#renewalPeriod").value = state.workspacePlanBillingPeriod;
  if (state.workspacePlanCurrency) {
    $("#renewalCurrency").innerHTML = `<option value="${escapeHtml(state.workspacePlanCurrency)}">${escapeHtml(state.workspacePlanCurrency)}</option>`;
    $("#renewalCurrency").value = state.workspacePlanCurrency;
  }
  const selectedPlan = plans.find((plan) => plan.code === select.value);
  const selectedWorkspace = currentBudgetWorkspace();
  const startsNewFamily = selectedWorkspace?.workspace_type === "personal" && selectedPlan?.workspace_type === "household";
  const managesMemberLimit = startsNewFamily || selectedWorkspace?.workspace_type === selectedPlan?.workspace_type && ["household", "business"].includes(selectedPlan?.workspace_type);
  if (managesMemberLimit) {
    $("#renewalFamilyMemberCount").value = `${startsNewFamily
      ? includedMemberSeats(selectedPlan)
      : Math.max(
        includedMemberSeats(selectedPlan),
        Number(state.memberUsage?.member_limit || state.workspaceSubscription?.member_limit || state.billableMemberCount || 1)
      )}`;
  }
  $("#renewalPaymentDate").value = toDateValue(new Date());
  updateRenewalQuote();
  const dialog = $("#renewalDialog");
  if (!dialog.open) dialog.showModal();
}

function updateRenewalQuote() {
  const plan = state.plans.find((item) => item.code === $("#renewalPlan").value);
  const workspace = currentBudgetWorkspace();
  const startsNewFamily = workspace?.workspace_type === "personal" && plan?.workspace_type === "household";
  const managesMemberLimit = startsNewFamily || (
    workspace?.workspace_type === plan?.workspace_type && ["household", "business"].includes(plan?.workspace_type)
  );
  const period = $("#renewalPeriod").value;
  const availablePrices = state.planPrices.filter((price) => price.plan_id === plan?.id && price.billing_period === period && price.is_active);
  const currencySelect = $("#renewalCurrency");
  const previousCurrency = currencySelect.value;
  currencySelect.innerHTML = "";
  availablePrices.forEach((price) => currencySelect.append(new Option(price.currency, price.currency)));
  if (availablePrices.some((price) => price.currency === previousCurrency)) currencySelect.value = previousCurrency;
  const price = availablePrices.find((item) => item.currency === currencySelect.value) || availablePrices[0] || null;
  if (price) currencySelect.value = price.currency;
  const includedSeats = includedMemberSeats(plan);
  const memberCountInput = $("#renewalFamilyMemberCount");
  const minimumMemberCount = startsNewFamily
    ? includedSeats
    : Math.max(includedSeats, Number(state.memberUsage?.used_member_count || state.billableMemberCount || 1));
  memberCountInput.min = `${minimumMemberCount}`;
  if (managesMemberLimit && Number(memberCountInput.value || 0) < minimumMemberCount) {
    memberCountInput.value = `${Math.max(minimumMemberCount, Number(state.memberUsage?.member_limit || state.workspaceSubscription?.member_limit || minimumMemberCount))}`;
  }
  const requestedMemberCount = managesMemberLimit
    ? Math.max(minimumMemberCount, Number(memberCountInput.value || minimumMemberCount))
    : null;
  const total = planInvoiceTotal(plan, price, requestedMemberCount);
  $("#renewalFamilyNameField").classList.toggle("hidden", !startsNewFamily);
  $("#renewalFamilyMembersField").classList.toggle("hidden", !managesMemberLimit);
  $("#renewalFamilyName").required = startsNewFamily;
  memberCountInput.required = managesMemberLimit;
  $("#renewalDialogTitle").textContent = startsNewFamily ? "Start a Family plan" : "Submit payment for review";
  $("#renewalDialogDescription").textContent = startsNewFamily
    ? `Enter the family name and the total number of people. The base plan includes ${includedSeats} people, including the Family Head.`
    : managesMemberLimit
      ? "Choose the total number of paid places for this workspace. Active members and pending invitations cannot be removed from the calculation."
      : "Submitting payment does not activate access automatically. Authorized finance staff will review it.";
  $("#renewalAmount").value = price ? total.toFixed(2) : "";
  $("#renewalSubmitButton").disabled = !price;
  const extraSeats = managesMemberLimit
    ? Math.max(0, requestedMemberCount - includedSeats)
    : Math.max(0, Number(state.billableMemberCount || 1) - includedSeats);
  const extraMemberPeriodPrice = Number(price?.extra_member_amount || 0) * extraMemberBillingMonths(price);
  $("#renewalFamilyMembersHelp").textContent = price
    ? period === "annual"
      ? `The base price includes ${includedSeats} people: 1 Family Head and ${Math.max(0, includedSeats - 1)} other members. Each additional person costs ${money(price.extra_member_amount, price.currency)} per month, which is ${money(extraMemberPeriodPrice, price.currency)} for one year.`
      : `The base price includes ${includedSeats} people: 1 Family Head and ${Math.max(0, includedSeats - 1)} other members. Each additional person costs ${money(price.extra_member_amount, price.currency)} per month.`
    : `The base price includes ${includedSeats} people in total, including the Family Head.`;
  const totalPeopleOnPlan = managesMemberLimit
    ? requestedMemberCount
    : Math.max(includedSeats, Number(state.billableMemberCount || 1));
  $("#renewalInvoiceSummary").innerHTML = price
    ? `<div><span>Total people on this plan</span><strong>${totalPeopleOnPlan}</strong></div><div><span>Included in base price</span><strong>${includedSeats} people</strong></div><div><span>Base plan</span><strong>${money(price.amount, price.currency)}</strong></div><div><span>Additional people (${extraSeats})</span><strong>${money(extraSeats * extraMemberPeriodPrice, price.currency)}</strong></div><div class="invoice-total"><span>Total submitted</span><strong>${money(total, price.currency)}</strong></div>`
    : `<strong>Price not configured.</strong><span>An administrator must publish a ${period} price before this plan can be purchased.</span>`;
}

async function uploadSubscriptionProof(file, workspaceId) {
  validateProofFile(file);
  const extension = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const path = `workspaces/${workspaceId}/${state.session.user.id}/${crypto.randomUUID()}.${extension || "bin"}`;
  const { error } = await supabase.storage.from(SUBSCRIPTION_PROOF_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw new Error(error.message);
  return path;
}

async function submitSubscriptionRenewal(event) {
  event.preventDefault();
  const workspace = currentBudgetWorkspace();
  const plan = state.plans.find((item) => item.code === $("#renewalPlan").value);
  const period = $("#renewalPeriod").value;
  const currency = $("#renewalCurrency").value;
  const price = activePriceFor(plan?.id, period, currency);
  const proof = $("#renewalProof").files[0] || null;
  const submitButton = $("#renewalSubmitButton");
  const startsNewFamily = workspace?.workspace_type === "personal" && plan?.workspace_type === "household";
  const managesMemberLimit = startsNewFamily || (
    workspace?.workspace_type === plan?.workspace_type && ["household", "business"].includes(plan?.code)
  );
  const includedSeats = includedMemberSeats(plan);
  const requestedMemberCount = Number($("#renewalFamilyMemberCount").value || includedSeats);
  const minimumMemberCount = startsNewFamily
    ? includedSeats
    : Math.max(includedSeats, Number(state.memberUsage?.used_member_count || state.billableMemberCount || 1));
  const amount = planInvoiceTotal(plan, price, managesMemberLimit ? requestedMemberCount : null);
  const familyName = $("#renewalFamilyName").value.trim();
  let proofPath = null;
  try {
    if (!workspace || !plan || !price) throw new Error("Choose a plan with an active price.");
    if (startsNewFamily && !familyName) throw new Error("FAMILY_NAME_REQUIRED");
    if (managesMemberLimit && (!Number.isInteger(requestedMemberCount) || requestedMemberCount < minimumMemberCount || requestedMemberCount > 100)) {
      throw new Error("INVALID_FAMILY_MEMBER_COUNT");
    }
    setSubmitting(submitButton, true, "Submitting...");
    if (proof) proofPath = await uploadSubscriptionProof(proof, workspace.id);
    const request = startsNewFamily
      ? supabase.rpc("submit_family_plan_request", {
        p_personal_workspace_id: workspace.id,
        p_family_name: familyName,
        p_total_member_count: requestedMemberCount,
        p_plan_code: plan.code,
        p_billing_period: period,
        p_currency: currency,
        p_amount: amount,
        p_payment_method: $("#renewalMethod").value,
        p_payment_date: $("#renewalPaymentDate").value,
        p_reference_number: $("#renewalReference").value.trim(),
        p_notes: $("#renewalNotes").value.trim() || null,
        p_proof_path: proofPath,
        p_proof_name: proof?.name || null,
        p_proof_mime_type: proof?.type || null,
        p_proof_size_bytes: proof?.size || null
      })
      : supabase.rpc("submit_subscription_renewal", {
      p_workspace_id: workspace.id,
      p_plan_code: plan.code,
      p_total_member_count: managesMemberLimit ? requestedMemberCount : null,
      p_billing_period: period,
      p_currency: currency,
      p_amount: amount,
      p_payment_method: $("#renewalMethod").value,
      p_payment_date: $("#renewalPaymentDate").value,
      p_reference_number: $("#renewalReference").value.trim(),
      p_notes: $("#renewalNotes").value.trim() || null,
      p_proof_path: proofPath,
      p_proof_name: proof?.name || null,
      p_proof_mime_type: proof?.type || null,
      p_proof_size_bytes: proof?.size || null
      });
    await query("subscription payment submit", request);
    $("#renewalForm").reset();
    $("#renewalDialog").close();
    await loadWorkspaceSubscriptionData();
    renderSubscription();
    showToast(startsNewFamily
      ? "Family plan submitted for review. The family will be created after approval."
      : "Payment submitted for review. Access changes only after approval.");
  } catch (error) {
    if (proofPath) await supabase.storage.from(SUBSCRIPTION_PROOF_BUCKET).remove([proofPath]).catch(() => {});
    showToast(error.message);
  } finally {
    setSubmitting(submitButton, false, "Submit for review");
    updateRenewalQuote();
  }
}

async function inviteMember(event) {
  event.preventDefault();
  assertSupabase();
  const familyId = $("#inviteFamily").value;
  if (!familyId) {
    showToast("Choose the family you want this user to join.");
    return;
  }
  if (!canManageMembersForFamily(familyId)) {
    showToast("Your active membership must include member access before you can send invitations.");
    return;
  }
  const email = $("#inviteEmail").value.trim().toLowerCase();
  if (!email) {
    showToast("Enter the member email address.");
    return;
  }
  try {
    await query(
      "family invitation create",
      supabase.rpc("invite_family_member", {
        p_family_id: familyId,
        p_email: email,
        p_role: $("#inviteRole").value
      })
    );
    $("#inviteForm").reset();
    $("#inviteMemberDialog").close();
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    showToast("Invitation sent.");
  } catch (error) {
    showToast(error.message);
  }
}

async function respondToInvitation(invitationId, status) {
  const invitation = state.familyInvitations.find((item) => item.id === invitationId);
  if (!invitation) return;
  try {
    await query(
      "invitation response",
      supabase.rpc("respond_to_family_invitation", {
        p_invitation_id: invitationId,
        p_accept: status === "accepted"
      })
    );
    if (status === "accepted") {
      window.localStorage.setItem(selectedFamilyStorageKey(), invitation.family_id);
    }
    await loadAccess();
    await loadFamily();
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    showToast(status === "accepted" ? "Family invitation accepted." : "Family invitation rejected.");
  } catch (error) {
    showToast(error.message);
  }
}

async function cancelFamilyInvitation(invitationId) {
  const invitation = state.familyInvitations.find((item) => item.id === invitationId);
  if (!invitation || invitation.status !== "pending") return;
  try {
    await query("family invitation cancel", supabase.rpc("cancel_family_invitation", {
      p_invitation_id: invitationId
    }));
    await Promise.all([loadInvitations(), loadNotifications(), loadWorkspaceSubscriptionData()]);
    renderFamilyApp();
    showToast("Invitation cancelled. You can invite this person again.");
  } catch (error) {
    showToast(error.message);
  }
}

async function createFamilyWorkspace(name, monthlyBudget, currency) {
  if (!canCreateFamily()) {
    showToast(hasActiveMembership()
      ? "Family limit reached. Purchase another Family subscription from Family & Members."
      : "An active subscription is required to create a family.");
    return null;
  }
  const familyId = await query(
    "family create",
    supabase.rpc("create_family_workspace", {
      p_name: name,
      p_monthly_budget: Number(monthlyBudget || 0),
      p_currency: currency
    })
  );
  window.localStorage.setItem(selectedFamilyStorageKey(), familyId);
  return familyId;
}

function paymentItemsForReportWorkspace() {
  const workspace = currentBudgetWorkspace();
  if (!workspace) return [];
  return state.paymentItems.filter((item) => {
    if (item.workspace_id) return item.workspace_id === workspace.id;
    if (workspace.workspace_type === "personal") {
      return item.visibility === "personal" && item.owner_id === state.session?.user?.id;
    }
    return item.visibility === "family" && item.family_id === workspace.legacy_family_id;
  });
}

function paymentRecordsForReportWorkspace(items) {
  const workspace = currentBudgetWorkspace();
  if (!workspace) return [];
  const paymentItemIds = new Set(items.map((item) => item.id));
  return state.paymentRecords.filter((record) => {
    if (record.workspace_id) return record.workspace_id === workspace.id;
    return paymentItemIds.has(record.payment_item_id);
  });
}

function renderReports() {
  const workspace = currentBudgetWorkspace();
  const hasAnalytics = Boolean(
    state.workspaceEntitlement?.finance_analytics &&
    state.workspaceEntitlement?.effective_status === "active" &&
    !state.workspaceEntitlement?.read_only
  );
  const workspaceLabel = workspace?.name || (state.family ? state.family.name : "Personal budget");
  const workspaceTypeLabel = workspace?.workspace_type === "household" ? "Family" : titleCase(workspace?.workspace_type || "personal");
  const periodLabel = parseDate(monthStart(state.reportMonth)).toLocaleString("en", { month: "long", year: "numeric" });
  $("#reportMonthFilter").value = state.reportMonth;
  $("#reportPeriodLabel").textContent = hasAnalytics
    ? `${workspaceLabel} payment performance for ${periodLabel}.`
    : `${workspaceLabel} report access for ${periodLabel}.`;
  $("#reportsLockEyebrow").textContent = `${workspaceTypeLabel} reports`;
  $("#reportsLockTitle").textContent = `${workspaceLabel} reports are locked`;
  $("#reportsLockText").textContent = `The selected ${workspaceTypeLabel.toLowerCase()} workspace does not have an active analytics plan. Choose another workspace above or upgrade this workspace.`;
  $("#reportsLockNotice").classList.toggle("hidden", hasAnalytics);
  document.querySelector(".report-summary-grid").classList.toggle("hidden", !hasAnalytics);
  document.querySelector(".report-analysis-grid").classList.toggle("hidden", !hasAnalytics);
  $("#reportRatePanel").classList.toggle("hidden", !hasAnalytics);
  if (!hasAnalytics) return;
  const allReportItems = paymentItemsForReportWorkspace();
  const availableCurrencies = [...new Set(allReportItems.map((item) => item.currency || "USD"))].sort();
  const currencyFilter = $("#reportCurrencyFilter");
  const currentFilter = availableCurrencies.includes(state.reportCurrencyFilter) ? state.reportCurrencyFilter : "all";
  currencyFilter.innerHTML = '<option value="all">All currencies</option>';
  availableCurrencies.forEach((currency) => currencyFilter.append(new Option(currency, currency)));
  state.reportCurrencyFilter = currentFilter;
  currencyFilter.value = currentFilter;
  const conversionAvailable = Boolean(state.workspaceSettings?.conversion_enabled);
  $("#reportViewMode").disabled = !conversionAvailable;
  if (!conversionAvailable) state.reportViewMode = "original";
  $("#reportViewMode").value = state.reportViewMode;
  const enabledReportingCurrencies = activeWorkspaceCurrencies();
  const configuredReportingCurrency = state.workspaceSettings?.reporting_currency || "USD";
  if (!enabledReportingCurrencies.includes(state.reportReportingCurrency)) {
    state.reportReportingCurrency = configuredReportingCurrency;
  }
  populateCurrencySelect($("#reportReportingCurrency"), state.reportReportingCurrency, enabledReportingCurrencies);
  $("#reportReportingCurrency").disabled = !conversionAvailable || state.reportViewMode !== "converted";
  const reportItems = allReportItems.filter((item) => currentFilter === "all" || item.currency === currentFilter);
  const reportRecords = paymentRecordsForReportWorkspace(reportItems);
  const occurrences = generateOccurrences(reportItems, reportRecords, state.reportMonth);
  const paid = occurrences.filter((item) => item.status === "paid").length;
  const partial = occurrences.filter((item) => item.status === "partial").length;
  const overdue = occurrences.filter((item) => item.status === "overdue").length;
  const paidRate = occurrences.length ? Math.round((paid / occurrences.length) * 100) : 0;
  $("#paidRate").textContent = `${paidRate}%`;
  $("#reportCompletionCaption").textContent = `${paid} of ${occurrences.length} payments completed`;
  const dueRows = occurrences.map((item) => ({ currency: item.item.currency, amount: item.amount }));
  const paidRows = occurrences.map((item) => ({ currency: item.item.currency, amount: item.paid }));
  const outstandingRows = occurrences.map((item) => ({ currency: item.item.currency, amount: item.outstanding }));
  $("#reportDueTotal").textContent = formatReportMoney(dueRows);
  $("#reportPaidTotal").textContent = formatReportMoney(paidRows);
  $("#reportOutstandingTotal").textContent = formatReportMoney(outstandingRows);
  $("#reportOverdueCaption").textContent = `${overdue} overdue payment${overdue === 1 ? "" : "s"}`;
  $("#partialCount").textContent = partial;
  $("#activeObligationCount").textContent = reportItems.filter((item) => item.status !== "inactive").length;
  $("#yearExpected").textContent = formatReportMoney(estimateYearTotals(reportItems));
  $("#collectionProgressRing").style.setProperty("--progress", `${paidRate * 3.6}deg`);
  $("#collectionProgressValue").textContent = `${paidRate}%`;
  $("#collectionProgressTitle").textContent = !occurrences.length
    ? "No payments due"
    : paidRate === 100
      ? "Everything is paid"
      : paidRate >= 70
        ? "Good progress this month"
        : "Payments need attention";
  $("#collectionProgressText").textContent = !occurrences.length
    ? "Add a payment to begin tracking monthly reliability."
    : `${occurrences.length - paid} payment${occurrences.length - paid === 1 ? " remains" : "s remain"}; ${partial} partial and ${overdue} overdue.`;
  renderStatusAnalysis(occurrences);
  renderReportTrend(reportItems, reportRecords);
  renderCategoryReport(occurrences);
  renderPaymentRecordList(reportRecords);
  renderReportRatePanel();
}

function formatReportMoney(rows) {
  if (state.reportViewMode !== "converted") return formatCurrencyTotals(rows);
  return formatConvertedTotal(rows, reportReportingCurrency()) || "Rate unavailable";
}

function reportReportingCurrency() {
  return state.reportReportingCurrency || selectedReportingCurrency();
}

function renderReportRatePanel() {
  const presentation = rateStatusPresentation();
  const converted = state.reportViewMode === "converted";
  $("#reportRateTitle").textContent = converted
    ? `Converted estimates in ${reportReportingCurrency()}`
    : "Original currency totals";
  $("#reportRateText").textContent = converted
    ? `${presentation.text} Completed payment conversions are locked; unpaid balances use the latest stored rate.`
    : "Amounts are grouped by their original currency. Change Money view to compare them in one reporting currency.";
  $("#reportRatePanel").dataset.level = converted ? presentation.level : "original";
}

function renderStatusAnalysis(occurrences) {
  const list = $("#reportStatusList");
  const rows = [
    { label: "Paid", className: "paid", count: occurrences.filter((item) => item.status === "paid").length },
    { label: "Partial", className: "partial", count: occurrences.filter((item) => item.status === "partial").length },
    { label: "Overdue", className: "overdue", count: occurrences.filter((item) => item.status === "overdue").length },
    { label: "Upcoming", className: "upcoming", count: occurrences.filter((item) => ["due-soon", "upcoming"].includes(item.status)).length }
  ];
  list.innerHTML = rows.map((row) => {
    const percentage = occurrences.length ? Math.round((row.count / occurrences.length) * 100) : 0;
    return `<div class="status-analysis-row ${row.className}"><div><span>${row.label}</span><strong>${row.count}</strong></div><div class="meter"><span style="width:${percentage}%"></span></div><small>${percentage}%</small></div>`;
  }).join("");
}

function renderReportTrend(reportItems, reportRecords) {
  const list = $("#reportTrendList");
  const months = Array.from({ length: 6 }, (_, index) => offsetMonthValue(state.reportMonth, index - 5));
  list.innerHTML = months.map((monthValue) => {
    const occurrences = generateOccurrences(reportItems, reportRecords, monthValue);
    const completed = occurrences.filter((item) => item.status === "paid").length;
    const percentage = occurrences.length ? Math.round((completed / occurrences.length) * 100) : 0;
    const label = parseDate(monthStart(monthValue)).toLocaleString("en", { month: "short", year: "2-digit" });
    return `<div class="trend-row"><span>${label}</span><div class="meter"><span style="width:${percentage}%"></span></div><strong>${percentage}%</strong><small>${completed}/${occurrences.length}</small></div>`;
  }).join("");
}

function estimateYearTotals(items) {
  return items.filter((item) => item.status !== "inactive").reduce((rows, item) => {
    let multiplier = 12;
    if (item.recurrence_type === "once") multiplier = 1;
    if (item.recurrence_type === "quarterly") multiplier = 4;
    if (item.recurrence_type === "yearly") multiplier = 1;
    if (item.recurrence_type === "custom") multiplier = Math.ceil(12 / Math.max(Number(item.recurrence_interval || 1), 1));
    if (item.recurrence_type === "custom_days") multiplier = Math.ceil(365 / Math.max(Number(item.recurrence_interval || 1), 1));
    rows.push({ currency: item.currency, amount: Number(item.amount || 0) * multiplier });
    return rows;
  }, []);
}

function renderCategoryReport(occurrences) {
  const list = $("#categoryReportList");
  const rows = Object.values(occurrences.reduce((acc, occurrence) => {
    const target = state.reportViewMode === "converted" ? reportReportingCurrency() : occurrence.item.currency;
    const due = state.reportViewMode === "converted"
      ? convertAmountScaled(occurrence.amount, occurrence.item.currency, target)
      : decimalToScaled(occurrence.amount);
    const outstanding = state.reportViewMode === "converted"
      ? convertAmountScaled(occurrence.outstanding, occurrence.item.currency, target)
      : decimalToScaled(occurrence.outstanding);
    const key = `${occurrence.item.category}:${target}`;
    acc[key] ||= { name: occurrence.item.category, amount: 0n, outstanding: 0n, currency: target, missingRate: false };
    if (due == null || outstanding == null) acc[key].missingRate = true;
    else {
      acc[key].amount += due;
      acc[key].outstanding += outstanding;
    }
    return acc;
  }, {}));
  if (!rows.length) {
    list.innerHTML = emptyState("No category data", "Reports update when monthly obligations exist.");
    return;
  }
  const max = rows.reduce((largest, row) => row.amount > largest ? row.amount : largest, 1n);
  list.innerHTML = "";
  rows.forEach((row) => {
    const item = document.createElement("article");
    item.className = "breakdown-item";
    item.innerHTML = `
      <div class="category-chip">${escapeHtml(row.name.slice(0, 2).toUpperCase())}</div>
      <div>
        <strong>${escapeHtml(row.name)}</strong>
        <span>${row.missingRate ? "Rate unavailable" : `${money(scaledToDecimal(row.amount), row.currency)} due &middot; ${money(scaledToDecimal(row.outstanding), row.currency)} outstanding`}</span>
        <div class="meter small-meter"><span style="width:${Number((row.amount * 100n) / max)}%"></span></div>
      </div>
    `;
    list.append(item);
  });
}

function renderPaymentRecordList(reportRecords) {
  const list = $("#paymentRecordsList");
  if (!reportRecords.length) {
    list.innerHTML = emptyState("No payment records", "Partial and full payments will appear here after they are saved.");
    return;
  }
  list.innerHTML = "";
  reportRecords.slice(0, 20).forEach((record) => list.append(renderFamilyPaymentRecord(record)));
}

function renderFamilyPaymentRecord(record) {
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === record.payment_item_id);
  const article = document.createElement("article");
  const recordCurrency = record.currency || item?.currency || familyCurrency();
  const locked = lockedConversionFor("payment_record", record.id, reportReportingCurrency());
  article.className = "record-card";
  article.innerHTML = `
    <div class="date-chip"><strong>${parseDate(record.payment_date).getDate()}</strong><span>${parseDate(record.payment_date).toLocaleString("en", { month: "short" })}</span></div>
    <div class="record-main">
      <strong>${escapeHtml(item?.name || "Payment")}</strong>
      <span>${escapeHtml(paymentRecordAttribution(record))} &middot; ${escapeHtml(record.payment_method || "Method not set")} &middot; ${escapeHtml(record.reference_number || "No reference")}</span>
      ${record.notes ? `<small>${escapeHtml(record.notes)}</small>` : ""}
      ${record.proof_name ? `<small>Proof: ${escapeHtml(record.proof_name)}${record.proof_size_bytes ? ` &middot; ${formatFileSize(record.proof_size_bytes)}` : ""}</small>` : ""}
    </div>
    <div class="record-side">
      <strong>${money(record.amount, recordCurrency)}</strong>
      ${locked ? `<small>${money(locked.converted_amount, locked.reporting_currency)} at locked rate ${escapeHtml(locked.exchange_rate)}</small>` : ""}
      <div class="row-actions">
        ${record.proof_path ? `<button type="button" data-open-proof="${record.id}">View proof</button>` : ""}
        <button type="button" data-delete-record="${record.id}" ${item && (isPlanPaused(item) || state.workspaceEntitlement?.read_only) ? "disabled" : ""}>Delete</button>
      </div>
    </div>
  `;
  return article;
}

function analyticsFilterValues() {
  const today = new Date().toISOString().slice(0, 10);
  const period = $("#analyticsPeriod").value;
  const start = new Date(`${today}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - Number(period === "all" ? 1 : period || 30) + 1);
  return {
    p_from: period === "all" ? "2020-01-01" : start.toISOString().slice(0, 10), p_to: today,
    p_country: $("#analyticsCountry").value || null,
    p_plan: $("#analyticsPlan").value || null,
    p_workspace_type: $("#analyticsWorkspace").value || null,
    p_subscription_status: $("#analyticsStatus").value || null,
    p_billing_period: $("#analyticsBilling").value || null,
    p_currency: $("#analyticsCurrency").value || null
  };
}

async function loadAdminAnalytics() {
  const requestId = ++analyticsRequestId;
  $("#analyticsMessage").textContent = "Loading analytics…";
  $("#analyticsResults").classList.add("hidden");
  try {
    const report = await query("admin analytics load", supabase.rpc("admin_analytics_page", analyticsFilterValues()));
    if (requestId === analyticsRequestId && state.isAdmin) state.adminAnalytics = report;
  } catch (error) {
    if (requestId === analyticsRequestId) {
      state.adminAnalytics = null;
      $("#analyticsMessage").textContent = `Analytics could not load: ${friendlyMessage(error.message)}`;
    }
    throw error;
  }
}

function analyticsCountryName(code) {
  if (!code || code === "unknown") return "Country not supplied";
  try { return new Intl.DisplayNames(["en"], { type: "region" }).of(code) || code; }
  catch (_error) { return code; }
}

function updateAnalyticsSelect(selector, rows) {
  const element = $(selector);
  const previous = element.value;
  element.innerHTML = `<option value="">${escapeHtml(element.options[0].textContent)}</option>` + rows.map(([code, label]) =>
    `<option value="${escapeHtml(code)}">${escapeHtml(label)}</option>`).join("");
  element.value = previous;
}

function analyticsDataTable(title, headers, rows) {
  if (!rows.length) return "";
  return `<details class="analytics-data"><summary>View data: ${escapeHtml(title)}</summary><div class="analytics-table-scroll"><table><thead><tr>${headers.map((header) => `<th scope="col">${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div></details>`;
}

function analyticsBars(rows, labelKey, numberKey, valueLabel = (value) => String(value), limit = 12, groupKey = null) {
  const shown = rows.slice(-limit);
  const maximum = Math.max(1, ...shown.map((row) => Number(row[numberKey] || 0)));
  if (!shown.length) return `<p class="muted-copy">No results for these filters.</p>`;
  return `<div class="analytics-bars" aria-hidden="true">${shown.map((row) => {
    const value = Number(row[numberKey] || 0);
    const scale = groupKey ? Math.max(1, ...shown.filter((other) => other[groupKey] === row[groupKey]).map((other) => Number(other[numberKey] || 0))) : maximum;
    return `<div class="analytics-bar-row"><span>${escapeHtml(row[labelKey])}</span><div class="analytics-track"><span style="width:${Math.max(0, Math.min(100, value / scale * 100))}%"></span></div><strong>${escapeHtml(valueLabel(value, row))}</strong></div>`;
  }).join("")}</div>`;
}

function analyticsTrendChart(rows) {
  if (!rows.length) return `<p class="muted-copy">Activity history will appear here after users open the app.</p>`;
  const maximum = Math.max(1, ...rows.map((row) => Number(row.active || 0)), ...rows.map((row) => Number(row.signups || 0)));
  const points = (key) => rows.map((row, index) =>
    `${10 + index * 540 / Math.max(1, rows.length - 1)},${105 - Number(row[key] || 0) / maximum * 90}`).join(" ");
  return `<div class="analytics-trend"><svg viewBox="0 0 560 120" preserveAspectRatio="none" role="img" aria-label="Active users in teal and new registrations in blue over the selected period"><path d="M10 105H550" stroke="#cbd5e1" fill="none"/><polyline points="${points("active")}" stroke="#0f766e" stroke-width="3" fill="none" vector-effect="non-scaling-stroke"/><polyline points="${points("signups")}" stroke="#2563eb" stroke-width="2.5" fill="none" vector-effect="non-scaling-stroke"/></svg><div class="analytics-legend"><span>● Active users</span><span>● New registrations</span></div></div>`;
}

function analyticsPanel(title, content, table = "", target = null, note = "") {
  return `<section class="ledger-panel analytics-panel"><div class="panel-heading"><div><h3>${escapeHtml(title)}</h3>${note ? `<p class="muted-copy">${escapeHtml(note)}</p>` : ""}</div>${target ? `<button type="button" data-admin-tab="${target}">View details</button>` : ""}</div>${content}${table}</section>`;
}

function renderAdminAnalytics() {
  const report = state.adminAnalytics;
  if (!report) return;
  const filters = report.filters || {};
  updateAnalyticsSelect("#analyticsCountry", (filters.countries || []).map((code) => [code, analyticsCountryName(code)]));
  updateAnalyticsSelect("#analyticsPlan", (filters.plans || []).map((plan) => [plan.code, plan.name]));
  updateAnalyticsSelect("#analyticsCurrency", (filters.currencies || []).map((code) => [code, code]));
  const count = (value) => Number(value || 0).toLocaleString();
  const users = report.users || {};
  const planName = (code) => (filters.plans || []).find((plan) => plan.code === code)?.name || code;
  const cards = [
    ["Registered users", users.total, "Completed accounts in scope"],
    ["New users", users.new, "Joined during this period"],
    ["Active users", users.active, "Visible sessions during this period"],
    ["Paying customers", report.paid_customers, "Owners with active paid workspaces"],
    ["Active workspaces", report.active_workspaces, "Personal, Family, and Business"],
    ["Paid conversion", report.owner_users ? `${(Number(report.paid_customers || 0) / Number(report.owner_users) * 100).toFixed(1)}%` : "0%", "Paying owners / registered owners"],
    ["Renewals due", report.renewals_due, "Active paid workspaces due in 30 days"],
    ["Pending reviews", report.pending_reviews, "Payments needing approval"]
  ];
  const overview = `<section class="stats-grid analytics-stats" aria-label="Analytics overview">${cards.map(([label, value, detail]) => `<article class="stat-card"><span class="stat-label">${escapeHtml(label)}</span><strong>${typeof value === "number" ? count(value) : escapeHtml(value)}</strong><small>${escapeHtml(detail)}</small></article>`).join("")}</section>`;
  const trend = report.trend || [];
  const countries = report.countries || [];
  const plans = report.plans || [];
  const statuses = report.subscription_statuses || [];
  const billing = report.billing_periods || [];
  const revenue = report.revenue_by_currency || [];
  const monthly = report.revenue_by_month || [];
  const runRate = report.run_rate_by_currency || [];
  const currencies = report.workspace_currencies || [];
  const engagement = report.workspace_engagement || {};
  const ops = report.operations || {};
  const panels = [
    analyticsPanel("Users and activity", `<p class="analytics-summary">Never active: <strong>${count(users.never_active)}</strong> · Active in 7 / 30 / 90 days: <strong>${count(users.active_last_7_days)} / ${count(users.active_last_30_days)} / ${count(users.active_last_90_days)}</strong></p>${analyticsTrendChart(trend)}`, analyticsDataTable("user trend", ["Period", "New users", "Active users"], trend.map((row) => [row.date, count(row.signups), count(row.active)])), "users", "Activity history starts with Version 4.8.0."),
    analyticsPanel("Countries", analyticsBars(countries.slice(0, 10).map((row) => ({ ...row, label: analyticsCountryName(row.code) })), "label", "users", count), analyticsDataTable("countries", ["Country", "Users", "New", "Paying owners"], countries.map((row) => [analyticsCountryName(row.code), count(row.users), count(row.new), count(row.paying)])), "users", "Accounts without a country are shown separately."),
    analyticsPanel("Plans and subscriptions", `${analyticsBars(plans.map((row) => ({ ...row, label: planName(row.code) })), "label", "count", count)}<p class="analytics-summary">${statuses.map((row) => `${escapeHtml(titleCase(row.status))} ${count(row.count)}`).join(" · ") || "No subscriptions"}</p>`, analyticsDataTable("plans and billing", ["Group", "Name", "Workspaces"], [...plans.map((row) => ["Plan", planName(row.code), count(row.count)]), ...statuses.map((row) => ["Status", titleCase(row.status), count(row.count)]), ...billing.map((row) => ["Billing", titleCase(row.period || "None"), count(row.count)])]), "households"),
    analyticsPanel("Collected revenue", `${analyticsBars(revenue.map((row) => ({ ...row, label: row.currency })), "label", "amount", (value, row) => money(value, row.currency))}<p class="analytics-summary">Locked reporting total: <strong>${escapeHtml(money(report.reporting_total, report.reporting_currency))}</strong>${Number(report.reporting_missing) ? ` · ${count(report.reporting_missing)} payments lack a locked conversion` : ""}</p>`, analyticsDataTable("collected payments", ["Currency", "Amount", "Approved payments"], revenue.map((row) => [row.currency, money(row.amount, row.currency), count(row.payments)])), "finance", "Approved subscription payments. Mixed currencies use locked conversions only."),
    analyticsPanel("Revenue by month", analyticsBars(monthly.map((row) => ({ ...row, label: `${row.date} · ${row.currency}` })), "label", "amount", (value, row) => money(value, row.currency), 18, "currency"), analyticsDataTable("monthly revenue", ["UTC month", "Currency", "Collected"], monthly.map((row) => [row.date, row.currency, money(row.amount, row.currency)])), "finance", "Each currency uses its own chart scale."),
    analyticsPanel("Monthly run rate", runRate.length ? `<div class="analytics-amounts">${runRate.map((row) => `<span>${escapeHtml(money(row.amount, row.currency))} / month</span>`).join("")}</div>` : `<p class="muted-copy">No active paid workspaces with paid invoices.</p>`, analyticsDataTable("monthly run rate", ["Currency", "Estimate per month"], runRate.map((row) => [row.currency, money(row.amount, row.currency)])), "finance", "Latest paid invoice per active workspace; annual invoices divided by 12."),
    analyticsPanel("Workspace currencies", analyticsBars(currencies.map((row) => ({ ...row, label: row.currency })), "label", "workspaces", count), analyticsDataTable("default currencies", ["Default currency", "Workspaces"], currencies.map((row) => [row.currency, count(row.workspaces)])) + analyticsDataTable("enabled currencies", ["Enabled currency", "Workspaces"], (report.enabled_currencies || []).map((row) => [row.currency, count(row.workspaces)])), "households", `Active workspace types: ${(report.workspace_types || []).map((row) => `${adminWorkspaceTypeLabel(row.type)} ${count(row.count)}`).join(" · ") || "None"}.`),
    analyticsPanel("Workspace engagement", `<div class="analytics-operations"><span>Payment schedules <strong>${count(engagement.payment_items)}</strong></span><span>Active members, including owners <strong>${count(engagement.active_members)}</strong></span><span>Workspaces without payments <strong>${count(engagement.without_payments)}</strong></span></div>`, "", "households", "Current totals for workspaces matching these filters."),
    analyticsPanel("Operational health", `<div class="analytics-operations"><span>Invitations awaiting setup <strong>${count(ops.invitations_waiting)}</strong></span><span>Failed invitations <strong>${count(ops.invitations_failed)}</strong></span><span>Pending reviews <strong>${count(ops.pending_reviews_global)}</strong></span><span>Open support tickets <strong>${count(ops.support_open)}</strong></span><span>Open enquiries <strong>${count(ops.enquiries_open)}</strong></span><span>Latest currency sync <strong>${ops.last_exchange_rate_success_at ? escapeHtml(new Date(ops.last_exchange_rate_success_at).toLocaleString()) : "No successful sync yet"}</strong></span></div>`, "", "dashboard", "Current platform totals; filters do not change these figures.")
  ];
  const extra = [
    analyticsDataTable("signup sources", ["Source", "Users"], (report.signup_sources || []).map((row) => [titleCase(String(row.source).replace(/_/g, " ")), count(row.users)])),
    analyticsDataTable("revenue by plan", ["Plan", "Currency", "Collected"], (report.revenue_by_plan || []).map((row) => [planName(row.plan), row.currency, money(row.amount, row.currency)])),
    analyticsDataTable("revenue by country", ["Country", "Currency", "Collected"], (report.revenue_by_country || []).map((row) => [analyticsCountryName(row.country), row.currency, money(row.amount, row.currency)])),
    analyticsDataTable("payment statuses", ["Status", "Payments"], (report.payment_statuses || []).map((row) => [titleCase(row.status), count(row.count)])),
    analyticsDataTable("invitation funnel (platform-wide)", ["Step", "Invitations"], [["Sent", count(ops.invitations_sent)], ["Accepted", count(ops.invitations_accepted)]])
  ].join("");
  $("#analyticsResults").innerHTML = overview + `<div class="analytics-grid">${panels.join("")}</div><section class="ledger-panel analytics-extra"><h3>More breakdowns</h3>${extra || "No breakdowns yet."}</section>`;
  $("#analyticsResults").classList.remove("hidden");
  $("#analyticsMessage").textContent = `Showing ${report.from} to ${report.to} (UTC). Updated ${new Date(report.generated_at).toLocaleString()}.`;
}

function renderAdmin() {
  renderAdminTabs();
  renderAdminEnquiryBadge();
  renderNotifications();
  if (state.adminTab === "dashboard") renderAdminSummary();
  if (state.adminTab === "analytics") renderAdminAnalytics();
  if (state.adminTab === "households") renderAdminFamilies();
  if (state.adminTab === "users") renderHeads();
  if (state.adminTab === "plans") renderAdminPlans();
  if (state.adminTab === "finance") {
    renderAdminFinanceCurrencyPanel();
    renderPaymentHeadOptions();
    renderPlatformPayments();
    renderSubscriptionReviews();
    renderSubscriptionPaymentHistory();
  }
  if (state.adminTab === "enquiries") renderAdminEnquiries();
  if (state.adminTab === "support") {
    renderAdminNoteOptions();
    renderAdminNotes();
    renderAdminSupport();
  }
}

function adminReportingCurrency() {
  return state.adminFinanceSettings?.reporting_currency || "USD";
}

function approvedAdminPaymentRows() {
  return [
    ...state.payments.filter((payment) => adminFinanceRecordVisible(payment, "platform_payment")).map((payment) => ({
      entity_type: "platform_payment", entity_id: payment.id, amount: payment.amount,
      currency: payment.currency, at: payment.payment_date
    })),
    ...state.adminSubscriptionPayments.filter((payment) => payment.status === "approved" && adminFinanceRecordVisible(payment, "subscription_payment")).map((payment) => ({
      entity_type: "subscription_payment", entity_id: payment.id, amount: payment.amount,
      currency: payment.currency, at: payment.reviewed_at || payment.payment_date
    }))
  ];
}

function adminFinanceFilterValues() {
  return {
    currency: $("#adminFinanceCurrencyFilter")?.value || "all",
    status: $("#adminFinanceStatusFilter")?.value || "all",
    type: $("#adminFinanceTypeFilter")?.value || "all",
    from: $("#adminFinanceFromDate")?.value || "",
    to: $("#adminFinanceToDate")?.value || "",
    search: ($("#adminFinanceSearch")?.value || "").trim().toLowerCase()
  };
}

function adminFinanceRecordVisible(payment, type) {
  const filters = adminFinanceFilterValues();
  const status = type === "platform_payment" ? "approved" : payment.status;
  const date = payment.payment_date || payment.created_at?.slice(0, 10) || "";
  if (filters.type !== "all" && filters.type !== type) return false;
  if (filters.currency !== "all" && payment.currency !== filters.currency) return false;
  if (filters.status !== "all" && status !== filters.status) return false;
  if (filters.from && date < filters.from) return false;
  if (filters.to && date > filters.to) return false;
  if (filters.search) {
    const workspace = state.adminWorkspaces.find((row) => row.id === payment.workspace_id);
    const owner = state.adminProfiles.find((row) => row.id === workspace?.owner_id);
    const haystack = [payment.reference_number, workspace?.name, owner?.email,
      payment.family_heads?.full_name, payment.family_heads?.email].filter(Boolean).join(" ").toLowerCase();
    if (!haystack.includes(filters.search)) return false;
  }
  return true;
}

function lockedConversionFor(entityType, entityId, reportingCurrency) {
  const source = state.isAdmin ? state.adminPaymentConversions : state.paymentConversions;
  return source.find((row) =>
    row.entity_type === entityType && row.entity_id === entityId && row.reporting_currency === reportingCurrency
  ) || null;
}

function adminConvertedPaymentTotal(rows, targetCurrency) {
  let total = 0n;
  for (const row of rows) {
    const locked = lockedConversionFor(row.entity_type, row.entity_id, targetCurrency);
    if (locked) total += decimalToScaled(locked.converted_amount);
    else {
      const converted = convertAmountScaled(row.amount, row.currency, targetCurrency, row.at);
      if (converted == null) return null;
      total += converted;
    }
  }
  return total;
}

function renderAdminFinanceCurrencyPanel() {
  const settings = state.adminFinanceSettings || {
    reporting_currency: "USD",
    enabled_receipt_currencies: ["USD"],
    conversion_enabled: true
  };
  populateCurrencySelect($("#adminEnabledCurrencies"), settings.enabled_receipt_currencies);
  populateCurrencySelect($("#adminReportingCurrency"), settings.reporting_currency, settings.enabled_receipt_currencies);
  $("#adminConversionEnabled").checked = Boolean(settings.conversion_enabled);
  populateCurrencySelect($("#paymentCurrency"), $("#paymentCurrency").value || settings.reporting_currency, settings.enabled_receipt_currencies);
  const filterSelect = $("#adminFinanceCurrencyFilter");
  const filterValue = filterSelect.value || "all";
  filterSelect.innerHTML = '<option value="all">All currencies</option>';
  settings.enabled_receipt_currencies.forEach((currency) => filterSelect.append(new Option(currency, currency)));
  filterSelect.value = settings.enabled_receipt_currencies.includes(filterValue) ? filterValue : "all";

  const status = state.adminRateStatus || {};
  const presentation = rateStatusPresentation(status);
  $("#adminRateProvider").textContent = "CurrencyAPI";
  $("#adminRateLastSuccess").textContent = status.last_success_at ? new Date(status.last_success_at).toLocaleString() : "Never";
  $("#adminRateEffectiveAt").textContent = status.provider_effective_at ? new Date(status.provider_effective_at).toLocaleString() : "Unavailable";
  $("#adminRateCurrencyCount").textContent = Number(status.currencies_updated || 0);
  $("#adminRateLastAttempt").textContent = status.last_attempt_at
    ? `${new Date(status.last_attempt_at).toLocaleString()} · ${titleCase(status.last_attempt_status || "unknown")}`
    : "Never";
  $("#adminRateAlert").classList.remove("hidden");
  $("#adminRateAlert").dataset.level = presentation.level;
  $("#adminRateAlert").textContent = status.safe_error_summary
    ? `${presentation.text} Last safe error: ${status.safe_error_summary}`
    : presentation.text;

  const rows = approvedAdminPaymentRows();
  $("#adminOriginalCurrencyTotals").textContent = rows.length
    ? formatCurrencyTotals(rows)
    : "No received payments";
  const converted = settings.conversion_enabled ? adminConvertedPaymentTotal(rows, settings.reporting_currency) : null;
  $("#adminConvertedCurrencyTotal").textContent = !settings.conversion_enabled
    ? "Consolidated conversion is disabled"
    : converted == null
      ? "Converted total unavailable until matching rates exist"
      : `${money(scaledToDecimal(converted), settings.reporting_currency)} locked reporting total`;
}

function refreshAdminCurrencyDependentOptions() {
  const enabled = selectedOptions($("#adminEnabledCurrencies"));
  const reporting = $("#adminReportingCurrency").value;
  populateCurrencySelect($("#adminReportingCurrency"), enabled.includes(reporting) ? reporting : enabled[0], enabled);
}

async function saveAdminFinanceCurrencySettings(event) {
  event.preventDefault();
  const button = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  try {
    setSubmitting(button, true, "Saving...");
    await query("admin finance currency settings save", supabase.rpc("save_admin_finance_currency_settings", {
      p_reporting_currency: $("#adminReportingCurrency").value,
      p_enabled_receipt_currencies: selectedOptions($("#adminEnabledCurrencies")),
      p_conversion_enabled: $("#adminConversionEnabled").checked
    }));
    if ($("#adminConversionEnabled").checked) {
      await query("admin historical conversion backfill", supabase.rpc("backfill_currency_conversions"));
    }
    await loadAdminData("finance");
    renderAdmin();
    window.MushavoPWA?.markFormClean("#adminCurrencySettingsForm");
    showToast("Finance currency settings saved.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  } finally {
    setSubmitting(button, false, "Save Finance currencies");
  }
}

async function syncExchangeRates() {
  const button = $("#syncExchangeRatesButton");
  try {
    setSubmitting(button, true, "Syncing...");
    const accessToken = await refreshSessionForProtectedFunction();
    const { data, error } = await supabase.functions.invoke("sync-exchange-rates", {
      body: { source: "admin_manual" },
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (error) {
      const payload = await error.context?.json?.().catch(() => null);
      throw new Error(payload?.error || error.message || "RATE_SYNC_FAILED");
    }
    if (!data || !["success", "partial_failure"].includes(data.status)) throw new Error(data?.error || "RATE_SYNC_FAILED");
    await loadAdminData("finance");
    renderAdmin();
    showToast(`${Number(data.rates_stored || 0)} exchange rates stored.`);
  } catch (error) {
    showToast(friendlyMessage(error.message || "Exchange-rate sync failed."));
  } finally {
    setSubmitting(button, false, "Sync rates now");
  }
}

function renderAdminPlans() {
  const list = $("#adminPlanList");
  const priceSelect = $("#planPricePlan");
  const selectedPricePlan = priceSelect.value;
  priceSelect.innerHTML = state.adminPlans
    .filter((plan) => plan.code !== "free")
    .map((plan) => `<option value="${escapeHtml(plan.code)}">${escapeHtml(plan.display_name)} (${titleCase(plan.workspace_type)})</option>`)
    .join("");
  if ([...priceSelect.options].some((option) => option.value === selectedPricePlan)) priceSelect.value = selectedPricePlan;
  list.innerHTML = "";
  state.adminPlans.forEach((plan) => {
    const activePrices = state.adminPlanPrices.filter((price) => price.plan_id === plan.id && price.is_active);
    const includedSeats = state.adminPlanLimits.find((limit) => limit.plan_id === plan.id && limit.limit_code === "included_member_seats")?.limit_value || 1;
    const enabledFeatures = state.adminPlanFeatures.filter((feature) => feature.plan_id === plan.id && feature.enabled).length;
    const card = document.createElement("article");
    card.className = "plan-card";
    card.innerHTML = `
      <div class="plan-card-heading"><div><span class="mini-badge">${titleCase(plan.workspace_type)}</span>${plan.is_public ? '<span class="mini-badge active">Public</span>' : '<span class="mini-badge">Hidden</span>'}${plan.is_featured ? '<span class="mini-badge active">Recommended</span>' : ""}</div><h4>${escapeHtml(plan.display_name)}</h4></div>
      <p>${escapeHtml(plan.marketing_summary || plan.description)}</p>
      <small>${Number(includedSeats)} ${Number(includedSeats) === 1 ? "person" : "people"} included &middot; ${enabledFeatures} enabled features &middot; ${plan.is_active ? "Active" : "Archived"}</small>
      <div class="plan-price-list">
        ${activePrices.length ? activePrices.map((price) => `<div><strong>${titleCase(price.billing_period)}</strong><span>${money(price.amount, price.currency)} base${Number(price.extra_member_amount) ? ` &middot; ${money(price.extra_member_amount, price.currency)} per extra member/month` : ""}</span></div>`).join("") : "<span>No active prices configured.</span>"}
      </div>
      <button type="button" data-edit-plan-definition="${plan.id}">Edit plan</button>
    `;
    list.append(card);
  });
}

function resetPlanDefinitionForm() {
  const form = $("#planDefinitionForm");
  form.reset();
  $("#planDefinitionId").value = "";
  $("#planDefinitionCode").readOnly = false;
  $("#planDefinitionSeats").value = "1";
  $("#planDefinitionSort").value = "0";
  $("#planDefinitionCta").value = "Choose plan";
  $("#planDefinitionActive").checked = true;
  $("#planDefinitionPurchasable").checked = true;
  $("#planDefinitionTitle").textContent = "Add a plan";
  $("#planDefinitionSubmit").textContent = "Save plan";
  $("#cancelPlanEditButton").classList.add("hidden");
}

function editPlanDefinition(planId) {
  const plan = state.adminPlans.find((item) => item.id === planId);
  if (!plan) return;
  const includedSeats = state.adminPlanLimits.find((limit) => limit.plan_id === plan.id && limit.limit_code === "included_member_seats")?.limit_value || 1;
  const paymentLimit = state.adminPlanLimits.find((limit) => limit.plan_id === plan.id && limit.limit_code === "active_planned_payments")?.limit_value;
  const features = new Set(state.adminPlanFeatures.filter((feature) => feature.plan_id === plan.id && feature.enabled).map((feature) => feature.feature_code));
  $("#planDefinitionId").value = plan.id;
  $("#planDefinitionName").value = plan.display_name || "";
  $("#planDefinitionCode").value = plan.code || "";
  $("#planDefinitionCode").readOnly = true;
  $("#planDefinitionType").value = plan.workspace_type;
  $("#planDefinitionSeats").value = String(includedSeats);
  $("#planDefinitionPaymentLimit").value = paymentLimit == null ? "" : String(paymentLimit);
  $("#planDefinitionSort").value = String(plan.sort_order || 0);
  $("#planDefinitionDescription").value = plan.description || "";
  $("#planDefinitionMarketing").value = plan.marketing_summary || plan.description || "";
  $("#planDefinitionCta").value = plan.cta_label || "Choose plan";
  $("#planDefinitionActive").checked = Boolean(plan.is_active);
  $("#planDefinitionPublic").checked = Boolean(plan.is_public);
  $("#planDefinitionFeatured").checked = Boolean(plan.is_featured);
  $("#planDefinitionPurchasable").checked = plan.available_for_purchase !== false;
  document.querySelectorAll('[name="planFeature"]').forEach((input) => { input.checked = features.has(input.value); });
  $("#planDefinitionTitle").textContent = `Edit ${plan.display_name}`;
  $("#planDefinitionSubmit").textContent = "Save plan changes";
  $("#cancelPlanEditButton").classList.remove("hidden");
  const disclosure = document.querySelector(".plan-definition-panel");
  if (disclosure) disclosure.open = true;
  $("#planDefinitionForm").scrollIntoView({ behavior: "smooth", block: "start" });
}

async function savePlanDefinition(event) {
  event.preventDefault();
  const button = event.submitter || $("#planDefinitionSubmit");
  const paymentLimitValue = $("#planDefinitionPaymentLimit").value.trim();
  const featureCodes = [...document.querySelectorAll('[name="planFeature"]:checked')].map((input) => input.value);
  try {
    setSubmitting(button, true, "Saving...");
    await query("plan definition save", supabase.rpc("save_plan_definition", {
      p_plan_id: $("#planDefinitionId").value || null,
      p_code: $("#planDefinitionCode").value.trim().toLowerCase(),
      p_display_name: $("#planDefinitionName").value.trim(),
      p_description: $("#planDefinitionDescription").value.trim(),
      p_marketing_summary: $("#planDefinitionMarketing").value.trim(),
      p_workspace_type: $("#planDefinitionType").value,
      p_included_member_seats: Number($("#planDefinitionSeats").value),
      p_active_payment_limit: paymentLimitValue ? Number(paymentLimitValue) : null,
      p_is_active: $("#planDefinitionActive").checked,
      p_is_public: $("#planDefinitionPublic").checked,
      p_is_featured: $("#planDefinitionFeatured").checked,
      p_available_for_purchase: $("#planDefinitionPurchasable").checked,
      p_cta_label: $("#planDefinitionCta").value.trim(),
      p_sort_order: Number($("#planDefinitionSort").value || 0),
      p_feature_codes: featureCodes
    }));
    resetPlanDefinitionForm();
    await loadAdminData("plans");
    renderAdminPlans();
    showToast("Plan saved. Published changes now appear on the public Pricing page.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  } finally {
    setSubmitting(button, false, $("#planDefinitionId").value ? "Save plan changes" : "Save plan");
  }
}

function renderSubscriptionReviews() {
  const list = $("#subscriptionReviewList");
  const pending = state.adminSubscriptionPayments.filter((payment) =>
    payment.status === "pending_review" && adminFinanceRecordVisible(payment, "subscription_payment")
  );
  if (!pending.length) {
    list.innerHTML = emptyState("No payments waiting", "New user proof submissions will appear here for finance review.");
    return;
  }
  list.innerHTML = "";
  pending.forEach((payment) => {
    const request = state.adminRenewalRequests.find((item) => item.id === payment.renewal_request_id);
    const invoice = state.adminSubscriptionInvoices.find((item) => item.id === request?.invoice_id);
    const workspace = state.adminWorkspaces.find((item) => item.id === payment.workspace_id);
    const proof = state.adminSubscriptionProofs.find((item) => item.payment_id === payment.id);
    const canReview = ["super_admin", "admin_staff", "finance_staff"].includes(state.adminRole);
    const article = document.createElement("article");
    article.className = "record-card subscription-review-card subscription-payment-row";
    article.innerHTML = `
      <div class="record-main"><strong>${escapeHtml(request?.provision_workspace_on_approval ? request.requested_workspace_name || "New Family workspace" : workspace?.name || "Workspace")}</strong><span>${request?.purchase_kind === "extra_places" ? "Additional Family places" : escapeHtml(invoice?.plan_name || "Plan")} &middot; ${titleCase(invoice?.billing_period)} &middot; reference ${escapeHtml(payment.reference_number)}</span><small>${request?.purchase_kind === "extra_places" ? `Adds ${Number(request.seat_count)} place(s) without extending the existing renewal date.` : request?.provision_workspace_on_approval ? `Creates a new Family workspace for ${Number(invoice?.billable_member_count || 1)} people after approval.` : "Renews or changes the selected workspace plan."} Submitted ${new Date(payment.created_at).toLocaleString()} by an authenticated workspace owner.</small><div class="badge-row">${statusBadge(payment.status)}${request?.purchase_kind === "extra_places" ? '<span class="mini-badge">extra places</span>' : ""}${request?.provision_workspace_on_approval ? '<span class="mini-badge">new family</span>' : ""}${proof ? '<span class="mini-badge">proof attached</span>' : ""}</div></div>
      <div class="record-side"><strong>${money(payment.amount, payment.currency)}</strong><div class="row-actions"><button type="button" data-view-subscription-payment="${payment.id}">View details</button>${proof ? `<button type="button" data-open-subscription-proof="${proof.id}">View proof</button>` : ""}${canReview ? `<button class="primary" type="button" data-review-subscription="${payment.id}" data-review-decision="approved">Approve</button><button type="button" data-review-subscription="${payment.id}" data-review-decision="rejected">Reject</button>` : '<span class="mini-badge">Read only</span>'}</div></div>
    `;
    list.append(article);
  });
}

function renderSubscriptionPaymentHistory() {
  const list = $("#subscriptionPaymentHistoryList");
  if (!list) return;
  const history = state.adminSubscriptionPayments.filter((payment) =>
    payment.status !== "pending_review" && adminFinanceRecordVisible(payment, "subscription_payment")
  );
  if (!history.length) {
    list.innerHTML = emptyState("No reviewed subscription payments", "Approved and rejected payments will remain here after review.");
    return;
  }
  list.innerHTML = "";
  history.forEach((payment) => {
    const request = state.adminRenewalRequests.find((item) => item.id === payment.renewal_request_id);
    const invoice = state.adminSubscriptionInvoices.find((item) => item.id === request?.invoice_id);
    const workspace = state.adminWorkspaces.find((item) => item.id === payment.workspace_id);
    const owner = state.adminProfiles.find((profile) => profile.id === workspace?.owner_id);
    const proof = state.adminSubscriptionProofs.find((item) => item.payment_id === payment.id);
    const locked = lockedConversionFor("subscription_payment", payment.id, adminReportingCurrency());
    const article = document.createElement("article");
    article.className = "record-card subscription-payment-row";
    article.innerHTML = `
      <div class="record-main">
        <strong>${escapeHtml(workspace?.name || request?.requested_workspace_name || "Subscription")}</strong>
        <span>${escapeHtml(owner?.email || "Owner unavailable")} &middot; ${escapeHtml(invoice?.plan_name || "Plan")} &middot; ${titleCase(invoice?.billing_period)}</span>
        <small>${escapeHtml(payment.reference_number || "No reference")} &middot; ${new Date(payment.payment_date || payment.created_at).toLocaleDateString()}${invoice ? ` &middot; ${Number(invoice.billable_member_count || 1)} paid place${Number(invoice.billable_member_count || 1) === 1 ? "" : "s"}` : ""}</small>
        <div class="badge-row">${statusBadge(payment.status)}${payment.receipt_number ? `<span class="mini-badge">${escapeHtml(payment.receipt_number)}</span>` : ""}${proof ? '<span class="mini-badge">proof attached</span>' : ""}</div>
      </div>
      <div class="record-side"><strong>${money(payment.amount, payment.currency)}</strong>${locked ? `<small>${money(locked.converted_amount, locked.reporting_currency)} at locked rate ${escapeHtml(locked.exchange_rate)}</small>` : ""}<div class="row-actions"><button type="button" data-view-subscription-payment="${payment.id}">View details</button>${proof ? `<button type="button" data-open-subscription-proof="${proof.id}">View proof</button>` : ""}${payment.status === "approved" && !locked ? `<button type="button" data-manual-conversion="${payment.id}" data-conversion-entity="subscription_payment">Enter manual rate</button>` : ""}</div></div>
    `;
    list.append(article);
  });
}

async function saveManualConversion(entityType, entityId) {
  const payment = entityType === "subscription_payment"
    ? state.adminSubscriptionPayments.find((row) => row.id === entityId)
    : state.payments.find((row) => row.id === entityId);
  if (!payment) return;
  const target = adminReportingCurrency();
  const raw = window.prompt(`Enter how many ${target} equal 1 ${payment.currency}. This locked rate will be used only for this completed payment:`);
  if (raw == null) return;
  const rate = Number(raw);
  if (!Number.isFinite(rate) || rate <= 0) {
    showToast("Enter a positive exchange rate.");
    return;
  }
  try {
    await query("manual payment conversion save", supabase.rpc("save_manual_payment_conversion", {
      p_entity_type: entityType,
      p_entity_id: entityId,
      p_reporting_currency: target,
      p_exchange_rate: rate,
      p_converted_amount: Number(payment.amount) * rate
    }));
    await loadAdminData("finance");
    renderAdmin();
    showToast("Manual exchange rate saved and locked to this payment.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  }
}

function adminMonitorForWorkspace(workspaceId) {
  return state.adminSubscriptionMonitor.find((row) => row.workspace_id === workspaceId) || null;
}

function formatAdminDate(value, fallback = "Not set") {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toLocaleString();
}

function adminDetailRows(rows) {
  return `<dl class="admin-detail-list">${rows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${value}</dd></div>`).join("")}</dl>`;
}

function showAdminDetails({ eyebrow, title, subtitle = "", body }) {
  $("#adminDetailsEyebrow").textContent = eyebrow;
  $("#adminDetailsDialogTitle").textContent = title;
  $("#adminDetailsSubtitle").textContent = subtitle;
  $("#adminDetailsBody").innerHTML = body;
  const dialog = $("#adminDetailsDialog");
  if (!dialog.open) dialog.showModal();
}

function openAdminUserDetails(profileId, emailValue = "") {
  const email = `${emailValue || ""}`.toLowerCase();
  const profile = state.adminProfiles.find((item) => item.id === profileId)
    || state.adminProfiles.find((item) => (item.email || "").toLowerCase() === email)
    || null;
  const head = state.heads.find((item) => item.user_id === profile?.id)
    || state.heads.find((item) => (item.email || "").toLowerCase() === (profile?.email || email).toLowerCase())
    || null;
  const ownerId = profile?.id || head?.user_id || null;
  const ownerEmail = profile?.email || head?.email || email || "Email unavailable";
  const monitors = state.adminSubscriptionMonitor.filter((row) =>
    row.owner_id === ownerId || (row.owner_email || "").toLowerCase() === ownerEmail.toLowerCase()
  );
  const ownedFamilyRows = monitors.filter((row) => row.workspace_type === "household");
  const workspaceIds = new Set(monitors.map((row) => row.workspace_id));
  const payments = state.adminSubscriptionPayments.filter((payment) => workspaceIds.has(payment.workspace_id));
  const fullName = profile?.full_name || head?.full_name || ownerEmail.split("@")[0] || "Mushavo user";
  const workspaceHtml = monitors.length
    ? monitors.map((row) => `<article class="admin-detail-card"><div><strong>${escapeHtml(row.workspace_name)}</strong><span>${escapeHtml(row.plan_name || "Plan not set")} &middot; ${titleCase(row.subscription_status || "not set")}</span>${row.paid_through_at ? `<small>Paid through ${new Date(row.paid_through_at).toLocaleDateString()} &middot; ${escapeHtml(adminExpiryCountdown(row.paid_through_at))}</small>` : ""}${row.workspace_type === "household" ? `<small>${Number(row.active_member_count || 0)} active + ${Number(row.pending_invitation_count || 0)} pending / ${Number(row.member_limit || 1)} paid places &middot; ${Number(row.available_member_count || 0)} available</small>` : ""}</div><button type="button" data-view-admin-workspace="${row.workspace_id}">View workspace</button></article>`).join("")
    : emptyState("No workspaces", "This user does not currently own a workspace visible to the subscription monitor.");
  const paymentsHtml = payments.length
    ? payments.slice(0, 10).map((payment) => `<article class="admin-detail-card"><div><strong>${money(payment.amount, payment.currency)}</strong><span>${titleCase(payment.status)} &middot; ${escapeHtml(payment.reference_number || "No reference")}</span><small>${formatAdminDate(payment.created_at)}</small></div><button type="button" data-view-subscription-payment="${payment.id}">View payment</button></article>`).join("")
    : emptyState("No subscription payments", "This user has no submitted subscription payments.");
  showAdminDetails({
    eyebrow: "User monitoring",
    title: fullName,
    subtitle: ownerEmail,
    body: `<section class="admin-detail-section"><h4>Account and access</h4>${adminDetailRows([
      ["Account ID", `<code>${escapeHtml(profile?.id || head?.user_id || "Not registered")}</code>`],
      ["Email", escapeHtml(ownerEmail)],
      ["Registered", escapeHtml(formatAdminDate(profile?.created_at, profile ? "Registered" : "Login not registered"))],
      ["Last active", escapeHtml(formatAdminDate(profile?.last_active_at))],
      ["Timezone", escapeHtml(profile?.timezone || "Not set")],
      ["Account status", statusBadge(head?.status || "free signup")],
      ["Family workspaces", `<strong>${ownedFamilyRows.length} / ${Number(head?.family_limit ?? 0)}</strong>`],
      ["Member management", statusBadge(head?.can_add_members ? "unlocked" : "locked")]
    ])}</section><section class="admin-detail-section"><h4>Workspaces and paid places</h4><div class="admin-detail-stack">${workspaceHtml}</div></section><section class="admin-detail-section"><h4>Subscription payments</h4><div class="admin-detail-stack">${paymentsHtml}</div></section>`
  });
}

function openAdminWorkspaceDetails(workspaceId) {
  const workspace = state.adminWorkspaces.find((item) => item.id === workspaceId);
  const monitor = adminMonitorForWorkspace(workspaceId);
  if (!workspace && !monitor) return;
  const familyId = workspace?.legacy_family_id || monitor?.family_id;
  const workspaceType = monitor?.workspace_type || workspace?.workspace_type || "personal";
  const owner = state.adminProfiles.find((profile) => profile.id === (workspace?.owner_id || monitor?.owner_id));
  const workspaceMembers = state.adminWorkspaceMembers.filter((member) => member.workspace_id === workspaceId);
  const familyMembers = state.adminMembers.filter((member) => member.family_id === familyId);
  const payments = state.adminSubscriptionPayments.filter((payment) => payment.workspace_id === workspaceId);
  const itemCount = state.adminPaymentItems.filter((item) =>
    item.status !== "inactive" && (item.workspace_id === workspaceId || (familyId && item.family_id === familyId))
  ).length;
  const membersHtml = workspaceMembers.length
    ? workspaceMembers.map((member) => {
      const profile = state.adminProfiles.find((item) => item.id === member.user_id);
      const name = profile?.full_name || profile?.email?.split("@")[0] || "Workspace member";
      const email = profile?.email || "Email unavailable";
      return `<article class="admin-detail-card"><div><strong>${escapeHtml(name)}</strong><span>${escapeHtml(email)} &middot; ${escapeHtml(titleCase(member.role))}</span><small>Joined ${formatAdminDate(member.joined_at || member.created_at)}</small></div><div class="row-actions">${statusBadge(member.status)}<button type="button" data-view-admin-user="${member.user_id}" data-view-admin-user-email="${escapeHtml(email)}">View member</button></div></article>`;
    }).join("")
    : familyMembers.length
      ? familyMembers.map((member) => `<article class="admin-detail-card"><div><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.email || "No email")} &middot; ${escapeHtml(member.role)}</span></div><div class="row-actions">${statusBadge(member.status)}<button type="button" data-view-admin-user="${member.user_id || ""}" data-view-admin-user-email="${escapeHtml(member.email || "")}">View member</button></div></article>`).join("")
      : owner
        ? `<article class="admin-detail-card"><div><strong>${escapeHtml(owner.full_name || owner.email?.split("@")[0] || "Account owner")}</strong><span>${escapeHtml(owner.email || "Email unavailable")} &middot; Owner</span></div><div class="row-actions">${statusBadge("active")}<button type="button" data-view-admin-user="${owner.id}" data-view-admin-user-email="${escapeHtml(owner.email || "")}">View owner</button></div></article>`
        : emptyState("No member directory", "No account members are connected to this workspace.");
  const paymentsHtml = payments.length
    ? payments.map((payment) => `<article class="admin-detail-card"><div><strong>${money(payment.amount, payment.currency)}</strong><span>${titleCase(payment.status)} &middot; ${escapeHtml(payment.reference_number || "No reference")}</span></div><button type="button" data-view-subscription-payment="${payment.id}">View payment</button></article>`).join("")
    : emptyState("No subscription payments", "No subscription payments are connected to this workspace.");
  const subscriptionRows = [
    ["Plan", escapeHtml(monitor?.plan_name || "Not set")],
    ["Subscription status", statusBadge(monitor?.subscription_status || "not set")],
    ["Billing period", escapeHtml(titleCase(monitor?.billing_period || "not set"))],
    ["Paid through", escapeHtml(formatAdminDate(monitor?.paid_through_at))]
  ];
  if (workspaceType !== "personal") {
    subscriptionRows.push(
      ["Paid places", `<strong>${Number(monitor?.member_limit || 1)}</strong>`],
      ["Active members", `<strong>${Number(monitor?.active_member_count || 0)}</strong>`],
      ["Pending invitations", `<strong>${Number(monitor?.pending_invitation_count || 0)}</strong>`],
      ["Available places", `<strong>${Number(monitor?.available_member_count || 0)}</strong>`]
    );
  }
  showAdminDetails({
    eyebrow: "Workspace monitoring",
    title: monitor?.workspace_name || workspace?.name || "Workspace",
    subtitle: owner?.email || monitor?.owner_email || "Owner email unavailable",
    body: `<section class="admin-detail-section"><h4>Workspace account</h4>${adminDetailRows([
      ["Workspace type", escapeHtml(adminWorkspaceTypeLabel(workspaceType))],
      ["Workspace status", statusBadge(workspace?.status || "active")],
      ["Owner", escapeHtml(owner?.full_name || owner?.email || monitor?.owner_email || "Unavailable")],
      ["Active payment items", `<strong>${itemCount}</strong>`],
      ["Created", escapeHtml(formatAdminDate(workspace?.created_at))],
      ["Last updated", escapeHtml(formatAdminDate(workspace?.updated_at))]
    ])}</section><section class="admin-detail-section"><h4>Subscription${workspaceType === "personal" ? "" : " and capacity"}</h4>${adminDetailRows(subscriptionRows)}</section><section class="admin-detail-section"><h4>${workspaceType === "personal" ? "Account member" : "Members"}</h4><div class="admin-detail-stack">${membersHtml}</div></section><section class="admin-detail-section"><h4>Subscription payment history</h4><div class="admin-detail-stack">${paymentsHtml}</div></section>`
  });
}

function openAdminLegacyFamilyDetails(familyId) {
  const family = state.adminFamilies.find((item) => item.id === familyId);
  if (!family) return;
  const head = findHeadForFamily(family);
  const members = state.adminMembers.filter((member) => member.family_id === familyId);
  const itemCount = state.adminPaymentItems.filter((item) => item.family_id === familyId && item.status !== "inactive").length;
  const membersHtml = members.length
    ? members.map((member) => `<article class="admin-detail-card"><div><strong>${escapeHtml(member.name)}</strong><span>${escapeHtml(member.email || "No email")} &middot; ${escapeHtml(member.role)}</span></div><div class="row-actions">${statusBadge(member.status)}<button type="button" data-view-admin-user="${member.user_id || ""}" data-view-admin-user-email="${escapeHtml(member.email || "")}">View member</button></div></article>`).join("")
    : emptyState("No members", "No members are connected to this legacy family record.");
  showAdminDetails({
    eyebrow: "Legacy family record",
    title: family.name,
    subtitle: family.owner_email || "Owner email unavailable",
    body: `<section class="admin-detail-section"><h4>Workspace status</h4>${adminDetailRows([
      ["Record type", "Family awaiting workspace migration"],
      ["Owner", escapeHtml(head?.full_name || family.owner_email || "Unavailable")],
      ["Account status", statusBadge(head?.status || "not set")],
      ["Billing status", statusBadge(head?.billing_status || "not set")],
      ["Active payment items", `<strong>${itemCount}</strong>`],
      ["Created", escapeHtml(formatAdminDate(family.created_at))]
    ])}</section><section class="admin-detail-section"><h4>Members</h4><div class="admin-detail-stack">${membersHtml}</div></section>`
  });
}

function openSubscriptionPaymentDetails(paymentId) {
  const payment = state.adminSubscriptionPayments.find((item) => item.id === paymentId);
  if (!payment) return;
  const request = state.adminRenewalRequests.find((item) => item.id === payment.renewal_request_id);
  const invoice = state.adminSubscriptionInvoices.find((item) => item.id === request?.invoice_id);
  const workspace = state.adminWorkspaces.find((item) => item.id === payment.workspace_id);
  const owner = state.adminProfiles.find((profile) => profile.id === workspace?.owner_id);
  const proof = state.adminSubscriptionProofs.find((item) => item.payment_id === payment.id);
  const review = state.adminSubscriptionReviews.find((item) => item.payment_id === payment.id);
  const reviewer = state.adminProfiles.find((profile) => profile.id === review?.reviewer_id);
  showAdminDetails({
    eyebrow: "Subscription payment",
    title: invoice?.invoice_number || "Payment details",
    subtitle: `${workspace?.name || request?.requested_workspace_name || "Workspace"} · ${owner?.email || "Owner unavailable"}`,
    body: `<section class="admin-detail-section"><h4>Invoice</h4>${adminDetailRows([
      ["Purchase", request?.purchase_kind === "extra_places" ? "Additional Family places" : escapeHtml(invoice?.plan_name || "Not set")],
      ["Billing period", escapeHtml(titleCase(invoice?.billing_period || "not set"))],
      ...(request?.purchase_kind === "extra_places" ? [["Existing expiry", escapeHtml(formatAdminDate(request.seat_expiry_at))]] : []),
      ["Base amount", invoice ? `<strong>${money(invoice.base_amount, invoice.currency)}</strong>` : "Not available"],
      ["Paid places", `<strong>${Number(invoice?.billable_member_count || 1)}</strong>`],
      ["Included places", `<strong>${Number(invoice?.included_member_count || 1)}</strong>`],
      ["Additional places", `<strong>${Number(invoice?.extra_member_count || 0)}</strong>`],
      ["Total", `<strong>${money(payment.amount, payment.currency)}</strong>`]
    ])}</section><section class="admin-detail-section"><h4>Payment and review</h4>${adminDetailRows([
      ["Status", statusBadge(payment.status)],
      ["Method", escapeHtml(payment.payment_method || "Not set")],
      ["Payment date", escapeHtml(formatAdminDate(payment.payment_date))],
      ["Reference", escapeHtml(payment.reference_number || "Not set")],
      ["Receipt", escapeHtml(payment.receipt_number || "Not issued")],
      ["Submitted", escapeHtml(formatAdminDate(payment.created_at))],
      ["Reviewed", escapeHtml(formatAdminDate(review?.created_at))],
      ["Reviewer", escapeHtml(reviewer?.email || review?.reviewer_id || "Not reviewed")],
      ["Decision reason", escapeHtml(review?.reason || request?.rejection_reason || "No reason recorded")]
    ])}${payment.notes ? `<p class="admin-detail-note"><strong>Notes</strong><span>${escapeHtml(payment.notes)}</span></p>` : ""}${proof ? `<div class="admin-detail-actions"><button type="button" data-open-subscription-proof="${proof.id}">View payment proof</button></div>` : ""}</section>`
  });
}

async function savePlanPrice(event) {
  event.preventDefault();
  const submitButton = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  const currency = $("#planPriceCurrency").value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) {
    showToast("Enter a three-letter ISO currency code, such as USD, ZAR, or ZWG.");
    return;
  }
  try {
    setSubmitting(submitButton, true, "Saving...");
    await query("plan price save", supabase.rpc("save_plan_price", {
      p_plan_code: $("#planPricePlan").value,
      p_billing_period: $("#planPricePeriod").value,
      p_currency: currency,
      p_amount: Number($("#planPriceAmount").value),
      p_extra_member_amount: Number($("#planPriceExtra").value || 0)
    }));
    $("#planPriceForm").reset();
    $("#planPriceCurrency").value = currency;
    $("#planPriceExtra").value = "0";
    await loadAdminData("plans");
    renderAdminPlans();
    showToast("Plan price published. Earlier invoices keep their original price snapshots.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setSubmitting(submitButton, false, "Save active price");
  }
}

async function reviewSubscriptionPayment(paymentId, decision) {
  let reason = null;
  if (decision === "rejected") {
    reason = window.prompt("Reason shown to the workspace owner:");
    if (!reason?.trim()) return;
  }
  try {
    await query("subscription payment review", supabase.rpc("review_subscription_payment", {
      p_payment_id: paymentId,
      p_decision: decision,
      p_reason: reason
    }));
    await loadAdminData("finance");
    renderAdmin();
    showToast(decision === "approved"
      ? "Payment approved. Reports, subscription access, and purchased member places are now active."
      : "Payment rejected with the supplied reason.");
  } catch (error) {
    showToast(error.message);
  }
}

async function openSubscriptionProof(proofId) {
  const proof = state.adminSubscriptionProofs.find((item) => item.id === proofId);
  if (!proof) return;
  try {
    const signed = await query("subscription proof link", supabase.storage.from(SUBSCRIPTION_PROOF_BUCKET).createSignedUrl(proof.storage_path, 60));
    window.open(signed.signedUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    showToast(error.message);
  }
}

function renderAdminTabs() {
  document.querySelectorAll("[data-admin-tab]").forEach((button) => {
    if (button.dataset.adminTab === "plans") {
      button.classList.toggle("hidden", !["super_admin", "admin_staff"].includes(state.adminRole));
    }
    if (button.dataset.adminTab === "enquiries") {
      button.classList.toggle("hidden", !["super_admin", "admin_staff", "support_staff"].includes(state.adminRole));
    }
    if (button.dataset.adminTab === "support") {
      button.classList.toggle("hidden", !["super_admin", "admin_staff", "support_staff"].includes(state.adminRole));
    }
    button.classList.toggle("active", button.dataset.adminTab === state.adminTab);
  });
  document.querySelectorAll("[data-admin-panel]").forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.adminPanel !== state.adminTab);
  });
}

function renderAdminEnquiryBadge() {
  const badge = $("#adminEnquiryBadge");
  if (!badge) return;
  const count = state.adminEnquiries.filter((enquiry) => ["new", "in_progress"].includes(enquiry.status)).length;
  badge.textContent = String(count);
  badge.classList.toggle("hidden", count === 0);
}

function renderAdminSummary() {
  $("#adminEmail").textContent = state.session.user.email || "-";
  const now = new Date();
  const expiryLimit = new Date(now);
  expiryLimit.setUTCDate(expiryLimit.getUTCDate() + 30);
  const paidPlanIds = new Set(state.adminPlans.filter((plan) => plan.code !== "free").map((plan) => plan.id));
  const activePaidSubscriptions = state.adminSubscriptions.filter((subscription) =>
    ["active", "grace"].includes(subscription.status) && paidPlanIds.has(subscription.plan_id)
  );
  const expiringSubscriptions = state.adminSubscriptionMonitor.filter((row) => {
    if (!["active", "grace"].includes(row.subscription_status) || !row.paid_through_at) return false;
    const paidThrough = new Date(row.paid_through_at);
    return paidThrough >= now && paidThrough <= expiryLimit;
  });
  const pendingReviews = state.adminSubscriptionPayments.filter((payment) => payment.status === "pending_review");
  $("#adminRegisteredUsers").textContent = state.adminProfiles.length;
  $("#adminActiveSubscriptions").textContent = activePaidSubscriptions.length;
  $("#adminExpiringSubscriptions").textContent = expiringSubscriptions.length;
  $("#adminPendingReviews").textContent = pendingReviews.length;
  $("#adminFamilyCount").textContent = state.adminWorkspaces.filter((workspace) => workspace.status === "active").length;
  const approvedSubscriptionPayments = state.adminSubscriptionPayments.filter((payment) => payment.status === "approved");
  $("#adminRevenueTotal").textContent = formatCurrencyTotals([...state.payments, ...approvedSubscriptionPayments]);
  $("#adminPaymentCount").textContent = `${state.payments.length + approvedSubscriptionPayments.length} approved payments`;
  renderAdminAttention(expiringSubscriptions, pendingReviews);
  renderRecentPlatformPayments();
}

function renderAdminAttention(expiringSubscriptions, pendingReviews) {
  const list = $("#adminAttentionList");
  const rows = [
    ...pendingReviews.map((payment) => ({ kind: "payment", payment, at: payment.created_at })),
    ...expiringSubscriptions.map((subscription) => ({ kind: "expiry", subscription, at: subscription.paid_through_at }))
  ].sort((left, right) => new Date(left.at || 0) - new Date(right.at || 0)).slice(0, 8);
  if (!rows.length) {
    list.innerHTML = emptyState("No urgent subscription issues", "Expiring subscriptions and pending payment reviews will appear here.");
    return;
  }
  list.innerHTML = rows.map((row) => {
    if (row.kind === "payment") {
      const workspace = state.adminWorkspaces.find((item) => item.id === row.payment.workspace_id);
      const owner = state.adminProfiles.find((profile) => profile.id === workspace?.owner_id);
      const ownerEmail = owner?.email || "Owner unavailable";
      return `<article class="compact-activity-row admin-attention-row"><div><strong>${escapeHtml(owner?.full_name || ownerEmail.split("@")[0] || "Account owner")}</strong><span>${escapeHtml(workspace?.name || "Subscription payment")}</span><small>${escapeHtml(ownerEmail)} &middot; Payment proof awaiting review</small></div><div class="admin-activity-actions"><span class="mini-badge pending_review">Pending review</span><button type="button" data-view-admin-user="${owner?.id || workspace?.owner_id || ""}" data-view-admin-user-email="${escapeHtml(ownerEmail === "Owner unavailable" ? "" : ownerEmail)}">View</button></div></article>`;
    }
    const owner = state.adminProfiles.find((profile) => profile.id === row.subscription.owner_id)
      || state.adminProfiles.find((profile) => (profile.email || "").toLowerCase() === (row.subscription.owner_email || "").toLowerCase());
    const ownerEmail = owner?.email || row.subscription.owner_email || "Owner unavailable";
    return `<article class="compact-activity-row admin-attention-row"><div><strong>${escapeHtml(owner?.full_name || ownerEmail.split("@")[0] || "Account owner")}</strong><span>${escapeHtml(row.subscription.workspace_name || "Workspace")}</span><small>${escapeHtml(ownerEmail)} &middot; Paid through ${new Date(row.subscription.paid_through_at).toLocaleDateString()}</small></div><div class="admin-activity-actions"><span class="mini-badge expiry-countdown">${escapeHtml(adminExpiryCountdown(row.subscription.paid_through_at))}</span><button type="button" data-view-admin-user="${owner?.id || row.subscription.owner_id || ""}" data-view-admin-user-email="${escapeHtml(ownerEmail === "Owner unavailable" ? "" : ownerEmail)}">View</button></div></article>`;
  }).join("");
}

function adminExpiryCountdown(value, referenceDate = new Date()) {
  const expiry = new Date(value);
  if (Number.isNaN(expiry.getTime())) return "Expiry unavailable";
  const referenceDay = Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate());
  const expiryDay = Date.UTC(expiry.getUTCFullYear(), expiry.getUTCMonth(), expiry.getUTCDate());
  const days = Math.round((expiryDay - referenceDay) / 86400000);
  if (days > 1) return `${days} days left`;
  if (days === 1) return "1 day left";
  if (days === 0) return "Expires today";
  if (days === -1) return "1 day overdue";
  return `${Math.abs(days)} days overdue`;
}

function adminWorkspaceTypeLabel(type) {
  if (type === "household") return "Family";
  return titleCase(type || "workspace");
}

function adminWorkspaceStatusKey(workspace, monitor, planCode) {
  if (workspace.status === "closed") return "closed";
  if (workspace.status === "suspended") return "suspended";
  if (monitor?.subscription_status === "suspended") return "suspended";
  if (monitor?.subscription_status === "expired") return "expired";
  if (planCode === "free") return "free";
  if (monitor?.subscription_status === "active") return "active";
  return "unconfigured";
}

function adminWorkspaceDirectoryRows() {
  const ownerWorkspaceCounts = new Map();
  state.adminWorkspaces.forEach((workspace) => {
    ownerWorkspaceCounts.set(workspace.owner_id, (ownerWorkspaceCounts.get(workspace.owner_id) || 0) + 1);
  });

  const rows = state.adminWorkspaces.map((workspace) => {
    const monitor = adminMonitorForWorkspace(workspace.id);
    const subscription = state.adminSubscriptions.find((item) => item.workspace_id === workspace.id);
    const plan = state.adminPlans.find((item) => item.id === subscription?.plan_id);
    const owner = state.adminProfiles.find((profile) => profile.id === workspace.owner_id);
    const family = state.adminFamilies.find((item) => item.id === workspace.legacy_family_id);
    const type = workspace.workspace_type || monitor?.workspace_type || "personal";
    const planCode = monitor?.plan_code || plan?.code || (type === "personal" ? "free" : "unconfigured");
    const planName = monitor?.plan_name || plan?.display_name || (type === "personal" ? "Free" : "Plan not set");
    const memberLimit = Math.max(1, Number(monitor?.member_limit || 1));
    const activeMembers = Number(monitor?.active_member_count || 0);
    const pendingInvitations = Number(monitor?.pending_invitation_count || 0);
    const usedMembers = Number(monitor?.used_member_count ?? activeMembers + pendingInvitations);
    const itemCount = state.adminPaymentItems.filter((item) =>
      item.status !== "inactive" && (item.workspace_id === workspace.id || (family && item.family_id === family.id))
    ).length;
    const ownerName = owner?.full_name || family?.owner_name || owner?.email?.split("@")[0] || "Account owner";
    const ownerEmail = owner?.email || family?.owner_email || monitor?.owner_email || "Email unavailable";
    return {
      workspace,
      monitor,
      family,
      id: workspace.id,
      type,
      typeLabel: adminWorkspaceTypeLabel(type),
      name: workspace.name,
      ownerId: workspace.owner_id,
      ownerName,
      ownerEmail,
      ownerWorkspaceCount: ownerWorkspaceCounts.get(workspace.owner_id) || 1,
      planCode,
      planName,
      subscriptionStatus: monitor?.subscription_status || subscription?.status || "not set",
      statusKey: adminWorkspaceStatusKey(workspace, monitor, planCode),
      billingPeriod: monitor?.billing_period || subscription?.billing_period,
      paidThroughAt: monitor?.paid_through_at || subscription?.paid_through_at,
      memberLimit,
      activeMembers,
      pendingInvitations,
      usedMembers,
      itemCount,
      createdAt: workspace.created_at
    };
  });

  const mappedFamilyIds = new Set(state.adminWorkspaces.map((workspace) => workspace.legacy_family_id).filter(Boolean));
  state.adminFamilies.filter((family) => !mappedFamilyIds.has(family.id)).forEach((family) => {
    const head = findHeadForFamily(family);
    const memberCount = state.adminMembers.filter((member) => member.family_id === family.id && member.status !== "inactive").length;
    rows.push({
      workspace: { status: head?.status === "suspended" ? "suspended" : "active" },
      monitor: null,
      family,
      id: null,
      type: "household",
      typeLabel: "Family",
      name: family.name,
      ownerId: family.owner_id,
      ownerName: head?.full_name || family.owner_email?.split("@")[0] || "Account owner",
      ownerEmail: family.owner_email || head?.email || "Email unavailable",
      ownerWorkspaceCount: state.adminFamilies.filter((item) => item.owner_id === family.owner_id).length || 1,
      planCode: "legacy",
      planName: head?.billing_status || "Legacy family",
      subscriptionStatus: head?.status || "not set",
      statusKey: head?.status === "suspended" ? "suspended" : "unconfigured",
      billingPeriod: null,
      paidThroughAt: null,
      memberLimit: Math.max(1, memberCount),
      activeMembers: memberCount,
      pendingInvitations: 0,
      usedMembers: memberCount,
      itemCount: state.adminPaymentItems.filter((item) => item.family_id === family.id && item.status !== "inactive").length,
      createdAt: family.created_at
    });
  });
  return rows;
}

function renderAdminWorkspaceSummary(rows) {
  const activeRows = rows.filter((row) => row.workspace?.status === "active");
  const paidRows = activeRows.filter(adminWorkspaceIsPaid);
  const updateType = (type, countSelector, paidSelector) => {
    const typeRows = activeRows.filter((row) => row.type === type);
    const paidCount = typeRows.filter(adminWorkspaceIsPaid).length;
    $(countSelector).textContent = typeRows.length;
    $(paidSelector).textContent = `${paidCount} paid · ${typeRows.length - paidCount} free/unpaid`;
  };

  $("#adminWorkspaceTotal").textContent = activeRows.length;
  $("#adminWorkspaceAll").textContent = `${rows.length} total ${rows.length === 1 ? "record" : "records"}`;
  updateType("personal", "#adminWorkspacePersonal", "#adminWorkspacePersonalPaid");
  updateType("household", "#adminWorkspaceFamily", "#adminWorkspaceFamilyPaid");
  updateType("business", "#adminWorkspaceBusiness", "#adminWorkspaceBusinessPaid");
  $("#adminWorkspacePaid").textContent = paidRows.length;
}

function adminWorkspaceIsPaid(row) {
  return row.workspace?.status === "active"
    && row.statusKey === "active"
    && !["free", "unconfigured", "legacy"].includes(row.planCode);
}

function syncAdminWorkspacePlanFilter(rows) {
  const select = $("#adminWorkspacePlanFilter");
  const previousValue = select.value || "all";
  const plans = [...new Map(rows.map((row) => [row.planCode, row.planName])).entries()]
    .filter(([code]) => code && code !== "unconfigured")
    .sort((left, right) => left[1].localeCompare(right[1]));
  select.innerHTML = '<option value="all">All plans</option>';
  plans.forEach(([code, name]) => select.append(new Option(name, code)));
  select.value = plans.some(([code]) => code === previousValue) ? previousValue : "all";
}

function adminWorkspaceDetailCard(row) {
  const isShared = row.type !== "personal";
  const usagePercent = isShared ? Math.min(100, Math.round((row.usedMembers / Math.max(1, row.memberLimit)) * 100)) : 0;
  const workspaceStatus = row.workspace.status || "active";
  const planStatus = row.statusKey === "free" ? "free" : row.subscriptionStatus;
  const billingCopy = row.billingPeriod
    ? `${titleCase(row.billingPeriod)} billing${row.paidThroughAt ? ` &middot; Paid through ${new Date(row.paidThroughAt).toLocaleDateString()}` : ""}`
    : row.statusKey === "free" ? "No paid subscription required" : "Billing not configured";
  const usageHtml = isShared
    ? `<strong>${row.usedMembers} of ${row.memberLimit} places used</strong><small>${row.activeMembers} active${row.pendingInvitations ? ` &middot; ${row.pendingInvitations} pending` : ""}</small><div class="admin-workspace-meter" aria-label="${usagePercent}% of paid places used"><span style="width:${usagePercent}%"></span></div>`
    : `<strong>${row.itemCount} active ${row.itemCount === 1 ? "payment" : "payments"}</strong><small>Personal workspace usage</small>`;
  const action = row.id
    ? `<button type="button" data-view-admin-workspace="${row.id}">View details</button>`
    : `<button type="button" data-view-admin-legacy-family="${row.family.id}">View details</button>`;
  return `<article class="admin-workspace-child workspace-type-${row.type}">
    <div><strong>${escapeHtml(row.name)}</strong><div class="badge-row">${statusBadge(workspaceStatus)}${statusBadge(planStatus)}</div></div>
    <div><span class="admin-workspace-field-label">Plan</span><strong>${escapeHtml(row.planName)}</strong><small>${billingCopy}</small></div>
    <div><span class="admin-workspace-field-label">Usage</span>${usageHtml}</div>
    <div class="admin-workspace-child-action"><small>Created ${row.createdAt ? new Date(row.createdAt).toLocaleDateString() : "date unavailable"}</small>${action}</div>
  </article>`;
}

function renderAdminFamilies() {
  const list = $("#adminFamiliesList");
  const allRows = adminWorkspaceDirectoryRows();
  renderAdminWorkspaceSummary(allRows);
  syncAdminWorkspacePlanFilter(allRows);

  const search = ($("#adminHouseholdSearch").value || "").trim().toLowerCase();
  const typeFilter = $("#adminWorkspaceTypeFilter").value;
  const statusFilter = $("#adminWorkspaceStatusFilter").value;
  const planFilter = $("#adminWorkspacePlanFilter").value;
  const sort = $("#adminWorkspaceSort").value;
  const rows = allRows.filter((row) => {
    const searchText = `${row.name} ${row.typeLabel} ${row.ownerName} ${row.ownerEmail} ${row.planName} ${row.planCode}`.toLowerCase();
    return (!search || searchText.includes(search))
      && (typeFilter === "all" || row.type === typeFilter)
      && (statusFilter === "all" || row.statusKey === statusFilter)
      && (planFilter === "all" || row.planCode === planFilter);
  });

  rows.sort((left, right) => {
    if (sort === "oldest") return new Date(left.createdAt || 0) - new Date(right.createdAt || 0);
    if (sort === "name") return left.name.localeCompare(right.name);
    if (sort === "owner") return left.ownerName.localeCompare(right.ownerName);
    if (sort === "type") return left.typeLabel.localeCompare(right.typeLabel) || left.name.localeCompare(right.name);
    return new Date(right.createdAt || 0) - new Date(left.createdAt || 0);
  });

  $("#adminWorkspaceDirectoryMeta").textContent = rows.length === allRows.length
    ? `${allRows.length} ${allRows.length === 1 ? "workspace" : "workspaces"}`
    : `${rows.length} of ${allRows.length} workspaces`;

  if (!rows.length) {
    list.innerHTML = emptyState("No matching workspaces", "Change or reset the directory filters to see more results.");
    return;
  }

  const ownerGroups = new Map();
  rows.forEach((row) => {
    const key = row.ownerId || row.ownerEmail || row.ownerName;
    if (!ownerGroups.has(key)) ownerGroups.set(key, { ownerName: row.ownerName, ownerEmail: row.ownerEmail, rows: [] });
    ownerGroups.get(key).rows.push(row);
  });
  const typeOrder = ["personal", "household", "business"];
  list.innerHTML = [...ownerGroups.values()].map((group) => {
    const typeSections = typeOrder.map((type) => {
      const typeRows = group.rows.filter((row) => row.type === type);
      if (!typeRows.length) return "";
      const label = type === "household" ? "Family" : titleCase(type);
      return `<details class="admin-workspace-type-group">
        <summary><span><strong>${label} workspace${typeRows.length === 1 ? "" : "s"}</strong><small>${typeRows.length} ${typeRows.length === 1 ? "entry" : "entries"}</small></span><span class="mini-badge">${typeRows.length}</span></summary>
        <div class="admin-workspace-children">${typeRows.map(adminWorkspaceDetailCard).join("")}</div>
      </details>`;
    }).join("");
    return `<article class="admin-owner-group"><header><div><strong>${escapeHtml(group.ownerName)}</strong><small>${escapeHtml(group.ownerEmail)}</small></div><span class="mini-badge">${group.rows.length} workspace${group.rows.length === 1 ? "" : "s"}</span></header>${typeSections}</article>`;
  }).join("");
}

function localDateValue(date = new Date()) {
  const local = new Date(date.getTime() - (date.getTimezoneOffset() * 60 * 1000));
  return local.toISOString().slice(0, 10);
}

function canSendAdminInvitations() {
  return ["super_admin", "admin_staff"].includes(state.adminRole);
}

function refreshAdminInvitationDefaultCurrency() {
  const enabledSelect = $("#adminInviteEnabledCurrencies");
  const defaultSelect = $("#adminInviteDefaultCurrency");
  if (!enabledSelect || !defaultSelect) return;
  const enabled = selectedOptions(enabledSelect);
  const current = defaultSelect.value;
  defaultSelect.innerHTML = '<option value="">No default yet</option>';
  currencyCatalogue().forEach(([code, name]) => {
    if (!enabled.includes(code)) return;
    defaultSelect.append(new Option(`${code} — ${name}`, code));
  });
  defaultSelect.value = enabled.includes(current) ? current : (enabled.length === 1 ? enabled[0] : "");
}

function refreshAdminInvitationPlanFields() {
  const plan = state.adminPlans.find((item) => item.id === $("#adminInvitePlan")?.value);
  const period = $("#adminInviteBillingPeriod")?.value || "monthly";
  const subscriptionCurrency = $("#adminInviteSubscriptionCurrency");
  if (!plan || !subscriptionCurrency) return;
  const currentCurrency = subscriptionCurrency.value;
  const pricedCurrencies = [...new Set(state.adminPlanPrices
    .filter((price) => price.plan_id === plan.id && price.billing_period === period && price.is_active)
    .map((price) => price.currency))];
  const allowedCurrencies = pricedCurrencies.length ? pricedCurrencies : currencyCatalogue().map(([code]) => code);
  populateCurrencySelect(subscriptionCurrency, allowedCurrencies.includes(currentCurrency) ? currentCurrency : (allowedCurrencies.includes("USD") ? "USD" : allowedCurrencies[0]), allowedCurrencies);
  const paidThrough = $("#adminInvitePaidThrough");
  paidThrough.required = plan.code !== "free";
  paidThrough.closest("label").classList.toggle("required-field", plan.code !== "free");
  const paymentReceived = $("#adminInvitePaymentReceived");
  paymentReceived.disabled = plan.code === "free";
  if (plan.code === "free") paymentReceived.checked = false;
  toggleAdminInvitationPaymentFields();
  if (plan.workspace_type === "household" && Number($("#adminInviteFamilyLimit").value || 0) === 0) {
    $("#adminInviteFamilyLimit").value = "1";
  }
  refreshAdminInvitationQuote();
}

function refreshAdminInvitationQuote() {
  const plan = state.adminPlans.find((item) => item.id === $("#adminInvitePlan")?.value);
  const period = $("#adminInviteBillingPeriod")?.value;
  const currency = $("#adminInviteSubscriptionCurrency")?.value;
  const hint = $("#adminInvitePriceHint");
  if (!hint) return;
  const now = new Date().toISOString();
  const price = state.adminPlanPrices.find((item) =>
    item.plan_id === plan?.id && item.billing_period === period && item.currency === currency
    && item.is_active && item.effective_from <= now
    && (!item.effective_until || item.effective_until > now)
  );
  hint.textContent = price
    ? `Plan quote: ${money(price.amount, currency)} for ${period}. A recorded payment must match this full amount and currency; partial or discounted payments cannot be recorded here.`
    : "No current plan price is configured for this billing period and currency.";
  if (price && $("#adminInvitePaymentReceived").checked) {
    $("#adminInvitePaymentAmount").value = Number(price.amount).toFixed(2);
    $("#adminInvitePaymentCurrency").value = currency;
  }
}

function toggleAdminInvitationPaymentFields() {
  const received = $("#adminInvitePaymentReceived")?.checked || false;
  const fields = $("#adminInvitePaymentFields");
  if (!fields) return;
  fields.hidden = !received;
  ["#adminInvitePaymentAmount", "#adminInvitePaymentCurrency", "#adminInvitePaymentDate", "#adminInvitePaymentMethod"].forEach((selector) => {
    $(selector).required = received;
  });
  if (received) refreshAdminInvitationQuote();
}

function renderAdminInvitationForm() {
  const form = $("#adminInvitationForm");
  const panel = $("#adminInvitationPanel")?.closest("details");
  if (!form || !panel) return;
  const canInvite = canSendAdminInvitations();
  panel.classList.toggle("hidden", !canInvite);
  if (!canInvite) return;

  const planSelect = $("#adminInvitePlan");
  const currentPlan = planSelect.value;
  planSelect.innerHTML = state.adminPlans
    .filter((plan) => plan.is_active)
    .map((plan) => `<option value="${escapeHtml(plan.id)}">${escapeHtml(plan.display_name)} (${titleCase(plan.workspace_type)})</option>`)
    .join("");
  if ([...planSelect.options].some((option) => option.value === currentPlan)) planSelect.value = currentPlan;

  if (!$("#adminInviteStartDate").value) $("#adminInviteStartDate").value = localDateValue();
  if (!$("#adminInvitePaymentDate").value) $("#adminInvitePaymentDate").value = localDateValue();
  const enabledValues = selectedOptions($("#adminInviteEnabledCurrencies"));
  populateCurrencySelect($("#adminInviteEnabledCurrencies"), enabledValues);
  populateCurrencySelect($("#adminInvitePaymentCurrency"), $("#adminInvitePaymentCurrency").value || "USD");
  refreshAdminInvitationDefaultCurrency();
  refreshAdminInvitationPlanFields();
  toggleAdminInvitationPaymentFields();
  $("#adminInvitationSubmit").disabled = !state.adminPlans.some((plan) => plan.is_active);
}

function renderAdminUserInvitations() {
  const list = $("#adminInvitationList");
  const meta = $("#adminInvitationMeta");
  const panel = list?.closest(".admin-invitation-list-panel");
  if (!list || !meta || !panel) return;
  const canInvite = canSendAdminInvitations();
  panel.classList.toggle("hidden", !canInvite);
  if (!canInvite) return;
  const invitations = state.adminUserInvitations || [];
  meta.textContent = `${invitations.length} invitation${invitations.length === 1 ? "" : "s"}`;
  if (!invitations.length) {
    list.innerHTML = emptyState("No manual invitations yet", "New secure invitations will appear here with their delivery status.");
    return;
  }
  list.innerHTML = invitations.map((invitation) => {
    const payment = invitation.payment_received
      ? `<span class="mini-badge active">Payment ${escapeHtml(money(invitation.payment_amount, invitation.payment_currency))}</span>`
      : '<span class="mini-badge">No payment recorded</span>';
    const deliveryNote = invitation.status === "failed" && invitation.last_error_code
      ? `<small>${escapeHtml(friendlyMessage(invitation.last_error_code))}</small>`
      : `<small>${invitation.sent_at ? `Sent ${escapeHtml(new Date(invitation.sent_at).toLocaleString())}` : `Created ${escapeHtml(new Date(invitation.created_at).toLocaleString())}`}</small>`;
    return `<article class="record-row admin-invitation-row">
      <div class="record-main"><strong>${escapeHtml(invitation.full_name)}</strong><span>${escapeHtml(invitation.email)}</span>${deliveryNote}</div>
      <div class="record-side"><span>${escapeHtml(invitation.plan_name)} · ${titleCase(invitation.billing_period)}</span><small>${escapeHtml(invitation.workspace_name)} · ${escapeHtml(invitation.subscription_currency)}</small></div>
      <div class="admin-invitation-status badge-row">${statusBadge(invitation.status)}${payment}</div>
    </article>`;
  }).join("");
}

async function adminInvitationFunctionErrorCode(error) {
  try {
    const payload = await error?.context?.json?.();
    return payload?.error || error?.message || "INVITATION_EMAIL_SEND_FAILED";
  } catch (_contextError) {
    return error?.message || "INVITATION_EMAIL_SEND_FAILED";
  }
}

async function sendAdminUserInvitation(event) {
  event.preventDefault();
  if (!canSendAdminInvitations()) {
    showToast(friendlyMessage("ADMIN_USER_INVITATION_ACCESS_REQUIRED"));
    return;
  }
  const form = event.currentTarget;
  const submit = $("#adminInvitationSubmit");
  const paymentReceived = $("#adminInvitePaymentReceived").checked;
  const enabledCurrencies = selectedOptions($("#adminInviteEnabledCurrencies"));
  const payload = {
    full_name: $("#adminInviteName").value.trim(),
    email: $("#adminInviteEmail").value.trim().toLowerCase(),
    country_code: $("#adminInviteCountry").value.trim().toUpperCase() || null,
    plan_id: $("#adminInvitePlan").value,
    billing_period: $("#adminInviteBillingPeriod").value,
    subscription_currency: $("#adminInviteSubscriptionCurrency").value,
    entitlement_start_date: $("#adminInviteStartDate").value,
    paid_through_date: $("#adminInvitePaidThrough").value || null,
    enabled_currencies: enabledCurrencies,
    default_currency: $("#adminInviteDefaultCurrency").value || null,
    family_limit: Number($("#adminInviteFamilyLimit").value || 0),
    can_add_members: $("#adminInviteCanAddMembers").checked,
    payment_received: paymentReceived,
    payment_amount: paymentReceived ? Number($("#adminInvitePaymentAmount").value) : null,
    payment_currency: paymentReceived ? $("#adminInvitePaymentCurrency").value : null,
    payment_date: paymentReceived ? $("#adminInvitePaymentDate").value : null,
    payment_method: paymentReceived ? $("#adminInvitePaymentMethod").value.trim() : null,
    payment_reference: paymentReceived ? $("#adminInvitePaymentReference").value.trim() : null,
    payment_notes: paymentReceived ? $("#adminInvitePaymentNotes").value.trim() : null
  };
  if (enabledCurrencies.length && !payload.default_currency) {
    showToast("Choose a default workspace currency or clear the optional workspace currency selection.");
    return;
  }
  if (paymentReceived) {
    const now = new Date().toISOString();
    const price = state.adminPlanPrices.find((item) =>
      item.plan_id === payload.plan_id
      && item.billing_period === payload.billing_period
      && item.currency === payload.subscription_currency
      && item.is_active
      && item.effective_from <= now
      && (!item.effective_until || item.effective_until > now)
    );
    if (!price || payload.payment_currency !== payload.subscription_currency
      || Math.round(payload.payment_amount * 100) !== Math.round(Number(price.amount) * 100)) {
      showToast("A recorded payment must match the selected plan's full quoted price and currency.");
      return;
    }
  }
  setSubmitting(submit, true, "Sending invitation…");
  try {
    const accessToken = await refreshSessionForProtectedFunction();
    const { data, error } = await supabase.functions.invoke("invite-admin-user", {
      body: payload,
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (error) throw new Error(await adminInvitationFunctionErrorCode(error));
    if (data?.error) throw new Error(data.error);
    form.reset();
    await loadAdminData("users");
    renderAdmin();
    showToast(data?.status === "replaced"
      ? `A new setup link was sent to ${payload.email}. The previous invitation is no longer valid.`
      : `Secure invitation sent to ${payload.email}.`);
  } catch (error) {
    showToast(friendlyMessage(error?.message));
  } finally {
    setSubmitting(submit, false, "Send secure invitation");
  }
}

function renderHeads() {
  renderAdminInvitationForm();
  renderAdminUserInvitations();
  const list = $("#headsList");
  const allDirectoryUsers = adminDirectoryUsers();
  const search = ($("#adminUserSearch")?.value || "").trim().toLowerCase();
  const directoryUsers = allDirectoryUsers.filter(({ profile, head, fullName, email }) => {
    if (!search) return true;
    const ownedWorkspaceIds = new Set(
      profile ? state.adminWorkspaces.filter((workspace) => workspace.owner_id === profile.id).map((workspace) => workspace.id) : []
    );
    const joinedWorkspaceIds = new Set(
      profile ? state.adminWorkspaceMembers.filter((member) => member.user_id === profile.id).map((member) => member.workspace_id) : []
    );
    const workspaces = state.adminWorkspaces.filter((workspace) => ownedWorkspaceIds.has(workspace.id) || joinedWorkspaceIds.has(workspace.id));
    const monitors = state.adminSubscriptionMonitor.filter((row) =>
      ownedWorkspaceIds.has(row.workspace_id)
      || joinedWorkspaceIds.has(row.workspace_id)
      || row.owner_id === profile?.id
      || (row.owner_email || "").toLowerCase() === email.toLowerCase()
    );
    const legacyFamilies = state.adminFamilies.filter((family) =>
      (family.owner_email || "").toLowerCase() === email.toLowerCase()
    );
    const searchText = [
      fullName,
      email,
      head?.status,
      head?.billing_status,
      head?.can_add_members ? "members unlocked" : "members locked",
      ...workspaces.flatMap((workspace) => [workspace.name, workspace.workspace_type, workspace.status]),
      ...legacyFamilies.flatMap((family) => [family.name, "family", "household"]),
      ...monitors.flatMap((row) => [row.workspace_name, row.workspace_type, row.plan_name, row.plan_code, row.subscription_status, row.billing_period])
    ].filter(Boolean).join(" ").toLowerCase();
    return searchText.includes(search);
  });
  $("#adminUserDirectoryMeta").textContent = search
    ? `${directoryUsers.length} of ${allDirectoryUsers.length} users · ${state.adminProfiles.length} registered`
    : `${allDirectoryUsers.length} total · ${state.adminProfiles.length} registered`;
  if (!directoryUsers.length) {
    list.innerHTML = search
      ? emptyState("No matching users", "Try a different name, email, workspace, plan, or status.")
      : emptyState("No users yet", "Registered accounts and users added by an administrator will appear here.");
    return;
  }
  list.innerHTML = "";
  directoryUsers.forEach(({ profile, head, fullName, email }) => {
    const ownedCount = state.adminFamilies.filter((family) =>
      (family.owner_email || "").toLowerCase() === email.toLowerCase()
    ).length;
    const ownedWorkspaces = profile ? state.adminWorkspaces.filter((workspace) => workspace.owner_id === profile.id) : [];
    const joinedWorkspaceIds = new Set(profile ? state.adminWorkspaceMembers.filter((member) => member.user_id === profile.id && member.status === "active").map((member) => member.workspace_id) : []);
    const joinedCount = state.adminWorkspaces.filter((workspace) => joinedWorkspaceIds.has(workspace.id) && workspace.owner_id !== profile?.id).length;
    const planNames = ownedWorkspaces.map((workspace) => {
      const subscription = state.adminSubscriptions.find((item) => item.workspace_id === workspace.id);
      const plan = state.adminPlans.find((item) => item.id === subscription?.plan_id);
      return `${workspace.name}: ${plan?.display_name || "Not set"}`;
    });
    const ownedMonitors = state.adminSubscriptionMonitor.filter((row) =>
      row.owner_id === profile?.id || (row.owner_email || "").toLowerCase() === email.toLowerCase()
    );
    const familySeatUsage = ownedMonitors
      .filter((row) => row.workspace_type === "household")
      .reduce((totals, row) => ({ used: totals.used + Number(row.used_member_count || 0), limit: totals.limit + Number(row.member_limit || 0) }), { used: 0, limit: 0 });
    const article = document.createElement("details");
    article.className = "admin-user-row";
    article.innerHTML = `
      <summary><div class="record-main"><strong>${escapeHtml(fullName)}</strong><span>${escapeHtml(email)}</span></div><div class="admin-user-summary-counts"><span>${ownedWorkspaces.length} owned</span><span>${joinedCount} joined</span>${statusBadge(profile?.account_status === "suspended" ? "account suspended" : head?.status || (profile ? "registered" : "not registered"))}</div></summary>
      <div class="admin-user-details">
        <div class="record-main">
          <small>${profile?.created_at ? `Registered ${new Date(profile.created_at).toLocaleDateString()}` : "Login not registered yet"}${planNames.length ? ` &middot; ${escapeHtml(planNames.join("; "))}` : ""}</small>
          <div class="badge-row">${statusBadge(profile ? "registered" : "not registered")}${head ? statusBadge(head.can_add_members ? "members unlocked" : "members locked") : ""}<span class="mini-badge">${ownedCount}/${Number(head?.family_limit ?? 0)} families</span>${familySeatUsage.limit ? `<span class="mini-badge">${familySeatUsage.used}/${familySeatUsage.limit} family places</span>` : ""}</div>
        </div>
        <div class="record-side">
        <button type="button" data-view-admin-user="${profile?.id || ""}" data-view-admin-user-email="${escapeHtml(email)}">View details</button>
        ${head ? `<div class="row-actions">
          <label class="inline-number-control">Family limit<input data-family-limit-input="${head.id}" type="number" min="0" max="100" step="1" value="${Number(head.family_limit ?? 1)}" /></label>
          <button type="button" data-save-family-limit="${head.id}">Save limit</button>
          <button type="button" data-toggle-member-access="${head.id}" data-next-member-access="${head.can_add_members ? "false" : "true"}">${head.can_add_members ? "Lock members" : "Unlock members"}</button>
          <button type="button" data-toggle-head="${head.id}" data-next-status="${head.status === "active" ? "suspended" : "active"}">${head.status === "active" ? "Suspend owned families" : "Reactivate owned families"}</button>
          <button type="button" data-delete-head="${head.id}">Revoke access</button>
        </div>` : `<button type="button" data-configure-profile="${profile.id}">Configure access</button>`}
        ${profile && profile.id !== state.session.user.id ? `<button type="button" data-toggle-account="${profile.id}" data-next-account-status="${profile.account_status === "suspended" ? "active" : "suspended"}">${profile.account_status === "suspended" ? "Reactivate account" : "Suspend account"}</button>` : ""}
        </div>
      </div>
    `;
    list.append(article);
  });
}

function adminDirectoryUsers() {
  const headsByUserId = new Map(
    state.heads.filter((head) => head.user_id).map((head) => [head.user_id, head])
  );
  const headsByEmail = new Map(
    state.heads.map((head) => [(head.email || "").toLowerCase(), head])
  );
  const includedHeadIds = new Set();
  const rows = state.adminProfiles.map((profile) => {
    const email = (profile.email || "").toLowerCase();
    const head = headsByUserId.get(profile.id) || headsByEmail.get(email) || null;
    if (head) includedHeadIds.add(head.id);
    return {
      profile,
      head,
      fullName: profile.full_name || head?.full_name || email.split("@")[0] || "Mushavo user",
      email,
      createdAt: profile.created_at
    };
  });

  state.heads
    .filter((head) => !includedHeadIds.has(head.id))
    .forEach((head) => rows.push({
      profile: null,
      head,
      fullName: head.full_name,
      email: (head.email || "").toLowerCase(),
      createdAt: head.created_at
    }));

  return rows.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
}

function renderPaymentHeadOptions() {
  const select = $("#paymentHead");
  select.innerHTML = `<option value="">Choose user</option>`;
  state.heads.forEach((head) => {
    const option = document.createElement("option");
    option.value = head.id;
    option.textContent = `${head.full_name} - ${head.email}`;
    option.dataset.amount = head.monthly_fee || 0;
    option.dataset.currency = head.fee_currency || "USD";
    select.append(option);
  });
}

function renderRecentPlatformPayments() {
  const list = $("#recentPaymentsList");
  const recent = [
    ...state.adminSubscriptionPayments.map((payment) => ({ type: "subscription", payment, at: payment.reviewed_at || payment.created_at })),
    ...state.payments.map((payment) => ({ type: "legacy", payment, at: payment.payment_date || payment.created_at }))
  ].sort((left, right) => new Date(right.at || 0) - new Date(left.at || 0)).slice(0, 5);
  if (!recent.length) {
    list.innerHTML = emptyState("No platform payments", "Record subscription payments in Finance.");
    return;
  }
  list.innerHTML = recent.map((entry) => {
    if (entry.type === "legacy") {
      const payment = entry.payment;
      const head = state.heads.find((item) => item.id === payment.family_head_id);
      const ownerEmail = head?.email || payment.family_heads?.email || "Owner unavailable";
      const owner = state.adminProfiles.find((profile) => profile.id === head?.user_id)
        || state.adminProfiles.find((profile) => (profile.email || "").toLowerCase() === ownerEmail.toLowerCase());
      return `<article class="compact-activity-row finance-activity-row"><div><strong>${escapeHtml(owner?.full_name || head?.full_name || payment.family_heads?.full_name || "Unknown user")}</strong><span>${escapeHtml(ownerEmail)}</span><small>${escapeHtml(payment.payment_method || "Method not set")} &middot; ${escapeHtml(payment.reference_number || "No reference")}</small></div><div class="admin-activity-actions"><strong>${money(payment.amount, payment.currency)}</strong>${statusBadge("approved")}<button type="button" data-view-admin-user="${owner?.id || head?.user_id || ""}" data-view-admin-user-email="${escapeHtml(ownerEmail === "Owner unavailable" ? "" : ownerEmail)}">View</button></div></article>`;
    }
    const payment = entry.payment;
    const workspace = state.adminWorkspaces.find((item) => item.id === payment.workspace_id);
    const owner = state.adminProfiles.find((profile) => profile.id === workspace?.owner_id);
    const ownerEmail = owner?.email || "Owner unavailable";
    return `<article class="compact-activity-row finance-activity-row"><div><strong>${escapeHtml(owner?.full_name || ownerEmail.split("@")[0] || "Account owner")}</strong><span>${escapeHtml(workspace?.name || "Subscription")}</span><small>${escapeHtml(ownerEmail)} &middot; ${escapeHtml(payment.reference_number || "No reference")}</small></div><div class="admin-activity-actions"><strong>${money(payment.amount, payment.currency)}</strong>${statusBadge(payment.status)}<button type="button" data-view-admin-user="${owner?.id || workspace?.owner_id || ""}" data-view-admin-user-email="${escapeHtml(ownerEmail === "Owner unavailable" ? "" : ownerEmail)}">View</button></div></article>`;
  }).join("");
}

function renderPlatformPayments() {
  const list = $("#paymentsList");
  const payments = state.payments.filter((payment) => adminFinanceRecordVisible(payment, "platform_payment"));
  if (!payments.length) {
    list.innerHTML = emptyState("No legacy payment notes", "New subscription payments are submitted by workspace owners and reviewed above.");
    return;
  }
  list.innerHTML = "";
  payments.forEach((payment) => list.append(renderPlatformPayment(payment, true)));
}

function renderPlatformPayment(payment, withActions = false) {
  const article = document.createElement("article");
  const locked = lockedConversionFor("platform_payment", payment.id, adminReportingCurrency());
  article.className = "record-card";
  article.innerHTML = `
    <div class="date-chip"><strong>${parseDate(payment.payment_date).getDate()}</strong><span>${parseDate(payment.payment_date).toLocaleString("en", { month: "short" })}</span></div>
    <div class="record-main"><strong>${escapeHtml(payment.family_heads?.full_name || "Unknown user")}</strong><span>${escapeHtml(payment.family_heads?.email || "")} &middot; ${escapeHtml(payment.payment_method)} &middot; ${escapeHtml(payment.reference_number || "No reference")}</span></div>
    <div class="record-side"><strong>${money(payment.amount, payment.currency)}</strong>${locked ? `<small>${money(locked.converted_amount, locked.reporting_currency)} locked</small>` : ""}${withActions ? `<div class="row-actions">${!locked ? `<button type="button" data-manual-conversion="${payment.id}" data-conversion-entity="platform_payment">Enter manual rate</button>` : ""}<button type="button" data-delete-payment="${payment.id}">Delete</button></div>` : ""}</div>
  `;
  return article;
}

function renderAdminNoteOptions() {
  const select = $("#adminNoteFamily");
  select.innerHTML = `<option value="">Choose household</option>`;
  state.adminFamilies.forEach((family) => {
    const option = document.createElement("option");
    option.value = family.id;
    option.textContent = `${family.name} - ${family.owner_email || "No email"}`;
    select.append(option);
  });
}

function renderAdminNotes() {
  const list = $("#adminNotesList");
  if (!state.adminNotes.length) {
    list.innerHTML = emptyState("No support notes", "Notes about access, payments, or reminder issues will appear here.");
    return;
  }
  list.innerHTML = "";
  state.adminNotes.forEach((note) => {
    const family = state.adminFamilies.find((item) => item.id === note.family_id);
    const article = document.createElement("article");
    article.className = "record-card";
    article.innerHTML = `
      <div class="record-main"><strong>${escapeHtml(family?.name || "Household")}</strong><span>${new Date(note.created_at).toLocaleString()}</span><small>${escapeHtml(note.note)}</small></div>
      <div class="record-side"><button type="button" data-delete-admin-note="${note.id}">Delete</button></div>
    `;
    list.append(article);
  });
}

function supportTicketCode(ticket) {
  return `MB-${String(ticket.id || "").replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function supportCategoryLabel(value) {
  const labels = {
    account_access: "Account or access",
    subscription_payment: "Subscription or payment",
    notifications: "Notifications",
    technical: "Technical problem",
    other: "Other",
    waiting_customer: "Waiting for customer"
  };
  return labels[value] || titleCase(value || "other");
}

function supportMessagesFor(ticketId, adminView = false) {
  const source = adminView ? state.adminSupportMessages : state.supportTicketMessages;
  return source.filter((message) => message.ticket_id === ticketId && (adminView || !message.is_internal));
}

function supportMessageTimeline(ticket, adminView = false) {
  const messages = supportMessagesFor(ticket.id, adminView);
  if (!messages.length) return '<p class="muted-copy support-no-replies">No replies yet.</p>';
  return `<div class="support-message-timeline">${messages.map((message) => {
    const isCustomer = message.author_id === ticket.customer_id;
    return `<article class="support-message ${isCustomer ? "customer" : "staff"}${message.is_internal ? " internal" : ""}"><header><strong>${message.is_internal ? "Internal note" : isCustomer ? "Customer" : "Mushavo Support"}</strong><small>${new Date(message.created_at).toLocaleString()}</small></header><p>${escapeHtml(message.body).replace(/\n/g, "<br />")}</p></article>`;
  }).join("")}</div>`;
}

async function createUserSupportTicket(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  const workspace = currentBudgetWorkspace();
  try {
    setSubmitting(button, true, "Submitting...");
    await query("support ticket create", supabase.from("support_tickets").insert({
      customer_id: state.session.user.id,
      workspace_id: workspace?.id || null,
      created_by: state.session.user.id,
      subject: $("#supportSubject").value.trim(),
      description: $("#supportDescription").value.trim(),
      category: $("#supportCategory").value,
      priority: $("#supportPriority").value
    }));
    form.reset();
    await loadUserSupportData();
    renderUserSupport();
    showToast("Support ticket submitted.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  } finally {
    setSubmitting(button, false, "Submit support ticket");
  }
}

async function saveSupportReply(event, ticketId, adminView) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  const body = form.querySelector("textarea").value.trim();
  const internal = adminView && Boolean(form.querySelector('[name="internal"]')?.checked);
  if (!body) return;
  try {
    setSubmitting(button, true, "Sending...");
    await query("support reply create", supabase.from("support_ticket_messages").insert({
      ticket_id: ticketId,
      author_id: state.session.user.id,
      body,
      is_internal: internal
    }));
    if (adminView && !internal) {
      await query("support ticket waiting update", supabase.from("support_tickets").update({ status: "waiting_customer" }).eq("id", ticketId));
      await loadAdminData("support");
      renderAdminSupport();
    } else if (adminView) {
      await loadAdminData("support");
      renderAdminSupport();
    } else {
      await loadUserSupportData();
      renderUserSupport();
    }
    showToast(internal ? "Internal note saved." : "Reply sent.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  } finally {
    setSubmitting(button, false, internal ? "Save internal note" : "Send reply");
  }
}

function renderUserSupport() {
  const list = $("#supportTicketList");
  if (!list) return;
  $("#supportTicketMeta").textContent = `${state.supportTickets.length} ${state.supportTickets.length === 1 ? "ticket" : "tickets"}`;
  if (!state.supportTickets.length) {
    list.innerHTML = emptyState("No support tickets", "Your submitted requests and replies will appear here.");
    return;
  }
  list.innerHTML = state.supportTickets.map((ticket) => `<details class="support-ticket-card priority-${ticket.priority}">
    <summary><div><span class="support-ticket-code">${supportTicketCode(ticket)}</span><strong>${escapeHtml(ticket.subject)}</strong><small>${supportCategoryLabel(ticket.category)} &middot; Updated ${new Date(ticket.updated_at).toLocaleString()}</small></div><div class="badge-row">${statusBadge(ticket.priority)}<span class="mini-badge ${badgeClass(ticket.status)}">${escapeHtml(supportCategoryLabel(ticket.status))}</span></div></summary>
    <div class="support-ticket-body"><p>${escapeHtml(ticket.description).replace(/\n/g, "<br />")}</p>${supportMessageTimeline(ticket)}${ticket.status === "closed" ? '<p class="notice">This ticket is closed.</p>' : `<form class="support-reply-form" data-user-support-reply="${ticket.id}"><label>Reply<textarea maxlength="4000" required placeholder="Add more information or answer Support"></textarea></label><button class="primary" type="submit">Send reply</button></form>`}</div>
  </details>`).join("");
  list.querySelectorAll("[data-user-support-reply]").forEach((form) => form.addEventListener("submit", protectSubmission((event) => saveSupportReply(event, form.dataset.userSupportReply, false))));
}

function renderAdminSupportWorkspaceOptions() {
  const select = $("#adminSupportWorkspace");
  const selected = select.value;
  select.innerHTML = '<option value="">Choose workspace</option>' + state.adminWorkspaces.map((workspace) => {
    const owner = state.adminProfiles.find((profile) => profile.id === workspace.owner_id);
    return `<option value="${workspace.id}" data-owner-id="${workspace.owner_id}">${escapeHtml(workspace.name)} — ${escapeHtml(owner?.email || "Owner unavailable")}</option>`;
  }).join("");
  if ([...select.options].some((option) => option.value === selected)) select.value = selected;
}

function filteredAdminSupportTickets() {
  const search = ($("#adminSupportSearch")?.value || "").trim().toLowerCase();
  const status = $("#adminSupportStatus")?.value || "all";
  const priority = $("#adminSupportPriority")?.value || "all";
  return state.adminSupportTickets.filter((ticket) => {
    const workspace = state.adminWorkspaces.find((item) => item.id === ticket.workspace_id);
    const customer = state.adminProfiles.find((profile) => profile.id === ticket.customer_id);
    const haystack = `${supportTicketCode(ticket)} ${ticket.subject} ${ticket.description} ${workspace?.name || ""} ${customer?.full_name || ""} ${customer?.email || ""}`.toLowerCase();
    return (!search || haystack.includes(search)) && (status === "all" || ticket.status === status) && (priority === "all" || ticket.priority === priority);
  });
}

async function createAdminSupportTicket(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = event.submitter;
  const option = $("#adminSupportWorkspace").selectedOptions[0];
  try {
    setSubmitting(button, true, "Creating...");
    await query("admin support ticket create", supabase.from("support_tickets").insert({
      customer_id: option.dataset.ownerId,
      workspace_id: option.value,
      created_by: state.session.user.id,
      assigned_admin_id: state.session.user.id,
      subject: $("#adminSupportSubject").value.trim(),
      description: $("#adminSupportDescription").value.trim(),
      category: $("#adminSupportCategory").value,
      priority: $("#adminSupportTicketPriority").value,
      status: "in_progress"
    }));
    form.reset();
    await loadAdminData("support");
    renderAdminSupport();
    showToast("Support ticket created.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  } finally {
    setSubmitting(button, false, "Create ticket");
  }
}

async function saveAdminSupportTicket(ticketId, button) {
  const card = button.closest(".support-ticket-card");
  try {
    setSubmitting(button, true, "Saving...");
    await query("support ticket update", supabase.from("support_tickets").update({
      status: card.querySelector("[data-support-status]").value,
      priority: card.querySelector("[data-support-priority]").value,
      assigned_admin_id: card.querySelector("[data-support-assignee]").value || null
    }).eq("id", ticketId));
    await loadAdminData("support");
    renderAdminSupport();
    showToast("Support ticket updated.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  } finally {
    setSubmitting(button, false, "Save changes");
  }
}

function renderAdminSupport() {
  renderAdminSupportWorkspaceOptions();
  $("#adminSupportOpen").textContent = state.adminSupportTickets.filter((ticket) => ticket.status === "open").length;
  $("#adminSupportProgress").textContent = state.adminSupportTickets.filter((ticket) => ticket.status === "in_progress").length;
  $("#adminSupportWaiting").textContent = state.adminSupportTickets.filter((ticket) => ticket.status === "waiting_customer").length;
  $("#adminSupportResolved").textContent = state.adminSupportTickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length;
  const tickets = filteredAdminSupportTickets();
  $("#adminSupportMeta").textContent = `${tickets.length} of ${state.adminSupportTickets.length} tickets`;
  const list = $("#adminSupportList");
  if (!tickets.length) {
    list.innerHTML = emptyState("No matching support tickets", "New customer requests will appear here.");
    return;
  }
  const staffOptions = (selected) => '<option value="">Unassigned</option>' + state.adminStaff.map((staff) => {
    const profile = state.adminProfiles.find((item) => item.id === staff.user_id);
    return `<option value="${staff.user_id}"${staff.user_id === selected ? " selected" : ""}>${escapeHtml(profile?.full_name || staff.email || staff.role)} (${supportCategoryLabel(staff.role)})</option>`;
  }).join("");
  list.innerHTML = tickets.map((ticket) => {
    const workspace = state.adminWorkspaces.find((item) => item.id === ticket.workspace_id);
    const customer = state.adminProfiles.find((profile) => profile.id === ticket.customer_id);
    return `<details class="support-ticket-card priority-${ticket.priority}"><summary><div><span class="support-ticket-code">${supportTicketCode(ticket)}</span><strong>${escapeHtml(ticket.subject)}</strong><small>${escapeHtml(customer?.full_name || "Customer")} &middot; ${escapeHtml(customer?.email || "Email unavailable")} &middot; ${escapeHtml(workspace?.name || "No workspace")}</small></div><div class="badge-row">${statusBadge(ticket.priority)}<span class="mini-badge ${badgeClass(ticket.status)}">${escapeHtml(supportCategoryLabel(ticket.status))}</span></div></summary>
      <div class="support-ticket-body"><p>${escapeHtml(ticket.description).replace(/\n/g, "<br />")}</p><div class="support-ticket-controls"><label>Status<select data-support-status>${["open", "in_progress", "waiting_customer", "resolved", "closed"].map((value) => `<option value="${value}"${ticket.status === value ? " selected" : ""}>${supportCategoryLabel(value)}</option>`).join("")}</select></label><label>Priority<select data-support-priority>${["low", "normal", "high", "urgent"].map((value) => `<option value="${value}"${ticket.priority === value ? " selected" : ""}>${titleCase(value)}</option>`).join("")}</select></label><label>Assigned to<select data-support-assignee>${staffOptions(ticket.assigned_admin_id)}</select></label><button type="button" data-save-support-ticket="${ticket.id}">Save changes</button></div>${supportMessageTimeline(ticket, true)}<form class="support-reply-form" data-admin-support-reply="${ticket.id}"><label>Reply or note<textarea maxlength="4000" required placeholder="Write a customer reply or internal note"></textarea></label><label class="checkbox-label"><input type="checkbox" name="internal" /> Internal note only</label><button class="primary" type="submit">Send reply</button></form></div>
    </details>`;
  }).join("");
  list.querySelectorAll("[data-save-support-ticket]").forEach((button) => button.addEventListener("click", () => saveAdminSupportTicket(button.dataset.saveSupportTicket, button)));
  list.querySelectorAll("[data-admin-support-reply]").forEach((form) => form.addEventListener("submit", protectSubmission((event) => saveSupportReply(event, form.dataset.adminSupportReply, true))));
}

function enquiryLabel(value) {
  const labels = {
    subscription_renewal: "Subscription renewal", setup_help: "Setup help",
    country_availability: "Country availability", in_progress: "In progress"
  };
  return labels[value] || titleCase(value);
}

function syncAdminEnquiryCountryFilter() {
  const field = $("#adminEnquiryCountry");
  if (!field) return;
  const selected = field.value || "all";
  const countries = [...new Set(state.adminEnquiries.map((item) => item.country_name).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
  field.innerHTML = '<option value="all">All countries</option>' + countries
    .map((country) => `<option value="${escapeHtml(country)}">${escapeHtml(country)}</option>`).join("");
  field.value = countries.includes(selected) ? selected : "all";
}

function filteredAdminEnquiries() {
  const search = ($("#adminEnquirySearch")?.value || "").trim().toLowerCase();
  const status = $("#adminEnquiryStatus")?.value || "all";
  const country = $("#adminEnquiryCountry")?.value || "all";
  return state.adminEnquiries.filter((enquiry) => {
    const haystack = `${enquiry.full_name} ${enquiry.email} ${enquiry.message}`.toLowerCase();
    return (!search || haystack.includes(search))
      && (status === "all" || enquiry.status === status)
      && (country === "all" || enquiry.country_name === country);
  });
}

function renderAdminEnquiries() {
  $("#adminEnquiryNew").textContent = String(state.adminEnquiries.filter((item) => item.status === "new").length);
  $("#adminEnquiryProgress").textContent = String(state.adminEnquiries.filter((item) => item.status === "in_progress").length);
  $("#adminEnquiryResolved").textContent = String(state.adminEnquiries.filter((item) => item.status === "resolved").length);
  $("#adminEnquiryArchived").textContent = String(state.adminEnquiries.filter((item) => item.status === "archived").length);
  renderAdminEnquiryBadge();
  syncAdminEnquiryCountryFilter();
  const rows = filteredAdminEnquiries();
  $("#adminEnquiryMeta").textContent = `${rows.length} of ${state.adminEnquiries.length} enquiries`;
  const list = $("#adminEnquiryList");
  if (!rows.length) {
    list.innerHTML = emptyState("No matching enquiries", "New messages from the public Contact page will appear here.");
    return;
  }
  list.innerHTML = "";
  rows.forEach((enquiry) => {
    const article = document.createElement("details");
    article.className = "record-card enquiry-card";
    const replySubject = encodeURIComponent(`Mushavo Budget ${enquiryLabel(enquiry.enquiry_type)} enquiry`);
    const safeMessage = escapeHtml(enquiry.message).replace(/\n/g, "<br />");
    article.innerHTML = `
      <summary><div class="record-main"><strong>${escapeHtml(enquiry.full_name)}</strong><span>${escapeHtml(enquiry.email)} &middot; ${escapeHtml(enquiry.country_name || "Country not provided")}</span><small class="enquiry-preview">${escapeHtml(enquiry.message)}</small></div><div class="badge-row"><span class="mini-badge ${badgeClass(enquiry.status)}">${escapeHtml(enquiryLabel(enquiry.status))}</span><span class="mini-badge">${escapeHtml(enquiryLabel(enquiry.enquiry_type))}</span></div></summary>
      <div class="enquiry-detail-body"><div class="record-main"><a class="enquiry-email" href="mailto:${encodeURIComponent(enquiry.email)}?subject=${replySubject}">${escapeHtml(enquiry.email)}</a><p class="enquiry-message">${safeMessage}</p><small>Submitted ${escapeHtml(formatAdminDate(enquiry.created_at))}</small></div>
      <div class="record-side enquiry-actions">
        <div class="enquiry-status-actions" aria-label="Update enquiry status">
          ${[["new", "Mark New"], ["in_progress", "In Progress"], ["resolved", "Resolved"], ["archived", "Archive"]].map(([value, label]) => `<button type="button" data-enquiry-status="${enquiry.id}" data-status="${value}"${enquiry.status === value ? ' class="active" disabled aria-current="true"' : ""}>${label}</button>`).join("")}
        </div>
        <a class="button-link" href="mailto:${encodeURIComponent(enquiry.email)}?subject=${replySubject}">Reply by email</a>
      </div></div>`;
    article.querySelectorAll("[data-enquiry-status]").forEach((button) => button.addEventListener("click", () => updateEnquiry(enquiry.id, { status: button.dataset.status })));
    list.append(article);
  });
}

async function updateEnquiry(enquiryId, changes) {
  try {
    await query("enquiry update", supabase.from("enquiries").update(changes).eq("id", enquiryId));
    await loadAdminData("enquiries");
    renderAdminEnquiries();
    showToast("Enquiry updated.");
  } catch (error) {
    showToast(friendlyMessage(error.message));
  }
}

async function signIn(event) {
  event.preventDefault();
  assertSupabase();
  const email = $("#email").value.trim();
  const password = $("#password").value;
  if (!email || !password) {
    showToast("Enter an email and password.");
    return;
  }
  const submitButton = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  let signedInSession = null;
  try {
    signInInProgress = true;
    if (submitButton) {
      submitButton.disabled = true;
      submitButton.textContent = "Signing in...";
    }
    showLoading("Signing you in", "Verifying your account...");
    const authData = await query("sign in", supabase.auth.signInWithPassword({ email, password }));
    if (!authData.session) throw new Error("Sign-in completed without a session. Please try again.");
    signedInSession = authData.session;
    await openAuthenticatedSession(signedInSession);
    showToast("Signed in.");
  } catch (error) {
    if (signedInSession) await handleLoadFailure(error);
    else {
      setView("auth");
      showToast(error.message);
    }
  } finally {
    signInInProgress = false;
    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent = "Sign in";
    }
  }
}

async function createFamily(event) {
  event.preventDefault();
  assertSupabase();
  const name = $("#familyName").value.trim();
  if (!name) return;
  try {
    const created = await createFamilyWorkspace(
      name,
      $("#familyBudget").value,
      $("#familyCurrency").value
    );
    if (!created) return;
    await loadApp();
    showToast("Household created.");
  } catch (error) {
    showToast(error.message);
  }
}

async function createFamilyFromMembers(event) {
  event.preventDefault();
  assertSupabase();
  const name = $("#memberFamilyName").value.trim();
  if (!name) return;
  try {
    const created = await createFamilyWorkspace(
      name,
      $("#memberFamilyBudget").value,
      $("#memberFamilyCurrency").value
    );
    if (!created) return;
    $("#memberFamilyForm").reset();
    await loadApp();
    showToast("Family created.");
  } catch (error) {
    showToast(error.message);
  }
}

function openFamilyNameDialog() {
  if (!state.family || state.family.owner_id !== state.session?.user?.id) {
    showToast("Only the Family Head can edit the family name.");
    return;
  }
  $("#editableFamilyName").value = state.family.name || "";
  const dialog = $("#familyNameDialog");
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => $("#editableFamilyName").focus(), 0);
}

async function saveFamilyName(event) {
  event.preventDefault();
  const familyName = $("#editableFamilyName").value.trim();
  const submitButton = event.submitter || event.currentTarget.querySelector('button[type="submit"]');
  if (!state.family || state.family.owner_id !== state.session?.user?.id) {
    showToast("Only the Family Head can edit the family name.");
    return;
  }
  if (!familyName) {
    showToast("Enter a family name.");
    return;
  }
  try {
    setSubmitting(submitButton, true, "Saving...");
    await query("family name update", supabase.from("families").update({ name: familyName }).eq("id", state.family.id));
    $("#familyNameDialog").close();
    await Promise.all([loadFamily(), loadWorkspaceSubscriptionData()]);
    await loadFamilyData();
    renderFamilyApp();
    showToast("Family name updated.");
  } catch (error) {
    showToast(error.message);
  } finally {
    setSubmitting(submitButton, false, "Save family name");
  }
}

async function saveObligation(event) {
  event.preventDefault();
  assertSupabase();
  const amount = Number($("#obligationAmount").value);
  const scope = $("#paymentScope").value;
  if (!amount || amount <= 0) {
    showToast("Enter an amount due above zero.");
    return;
  }
  if (scope === "family" && !state.family) {
    showToast("Create or join a family before saving a family payment.");
    return;
  }
  if (scope === "family" && !$("#obligationMember").value) {
    showToast("Choose the family member responsible for this payment.");
    $("#obligationMember").focus();
    return;
  }
  const recurrenceType = $("#recurrenceType").value;
  const recurrenceInterval = ["custom", "custom_days"].includes(recurrenceType)
    ? Number($("#recurrenceInterval").value)
    : 1;
  const maximumInterval = recurrenceType === "custom_days" ? 3650 : 120;
  if (!Number.isInteger(recurrenceInterval) || recurrenceInterval < 1 || recurrenceInterval > maximumInterval) {
    showToast(`Enter a repeat interval between 1 and ${maximumInterval}.`);
    $("#recurrenceInterval").focus();
    return;
  }
  const startDate = syncPaymentStartDate();
  if (!startDate) {
    showToast("Choose the due day, start month, and start year.");
    return;
  }
  const editingItem = state.paymentItems.find((item) => item.id === state.editingObligationId);
  const usesNewPersonalSlot = scope === "personal" && (
    !editingItem || editingItem.visibility !== "personal" || editingItem.status === "inactive"
  );
  if (usesNewPersonalSlot && state.personalWorkspaceEntitlement?.plan_code === "free" && userCreatedPersonalPaymentCount() >= 5) {
    showToast("Free accounts can keep up to 5 active personal payments. Family payments remain unlimited.");
    return;
  }
  const payload = {
    family_id: scope === "family" ? state.family.id : null,
    owner_id: state.session.user.id,
    visibility: scope,
    name: $("#obligationName").value.trim(),
    category: $("#obligationCategory").value,
    amount,
    currency: $("#obligationCurrency").value,
    responsible_member_id: scope === "family" ? $("#obligationMember").value || null : null,
    recurrence_type: recurrenceType,
    recurrence_interval: recurrenceInterval,
    due_day: Number($("#dueDay").value || 1),
    start_date: startDate,
    reminder_days_before: Number($("#reminderDays").value || 0),
    notes: $("#obligationNotes").value.trim() || null,
    status: "active",
    created_by: state.session.user.id
  };
  if (!payload.name) {
    showToast("Enter a payment name.");
    return;
  }
  try {
    if (state.editingObligationId) {
      await query("payment item update", supabase.from("payment_items").update(payload).eq("id", state.editingObligationId));
      showToast("Payment updated.");
    } else {
      await query("payment item create", supabase.from("payment_items").insert(payload));
      showToast("Payment saved.");
    }
    $("#paymentItemDialog").close();
    resetObligationForm();
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
  } catch (error) {
    showToast(error.message);
  }
}

function openPaymentItemDialog() {
  if (state.workspaceEntitlement?.read_only || state.workspaceEntitlement?.effective_status === "suspended") {
    showToast("This shared workspace is read-only. The owner must renew it before payments can be changed.");
    return;
  }
  resetObligationForm();
  const dialog = $("#paymentItemDialog");
  if (!dialog.open) dialog.showModal();
  window.setTimeout(() => $("#obligationName").focus(), 0);
}

function startEditObligation(itemId) {
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === itemId);
  if (!item) return;
  if (isPlanPaused(item)) {
    showToast("This payment is paused by the Free plan limit. You can delete it or select it among your five.");
    return;
  }
  state.editingObligationId = item.id;
  state.familyTab = "payments";
  setRoute("family", "payments");
  renderFamilyApp();
  $("#obligationTitle").textContent = "Edit payment";
  $("#obligationSubmitButton").textContent = "Save changes";
  $("#obligationName").value = item.name;
  $("#obligationAmount").value = item.amount;
  $("#obligationCurrencySearch").value = "";
  renderPaymentCurrencyOptions("", item.currency);
  $("#paymentScope").value = item.visibility || (item.family_id ? "family" : "personal");
  $("#obligationCategory").value = item.category;
  $("#obligationMember").value = item.responsible_member_id || "";
  $("#recurrenceType").value = item.recurrence_type;
  $("#recurrenceInterval").value = item.recurrence_interval || 1;
  setPaymentStartControls(item.start_date);
  $("#dueDay").value = `${item.due_day || 1}`;
  updateRecurrenceControls();
  $("#reminderDays").value = item.reminder_days_before || 0;
  $("#obligationNotes").value = item.notes || "";
  const dialog = $("#paymentItemDialog");
  if (!dialog.open) dialog.showModal();
}

function resetObligationForm() {
  state.editingObligationId = null;
  $("#obligationForm").reset();
  setPaymentStartControls(toDateValue(new Date()));
  $("#recurrenceInterval").value = 1;
  $("#reminderDays").value = 3;
  $("#obligationCurrencySearch").value = "";
  renderPaymentCurrencyOptions("", state.workspaceSettings?.default_payment_currency || state.family?.currency || "USD");
  $("#paymentScope").value = state.family ? "family" : "personal";
  $("#obligationTitle").textContent = "Add payment";
  $("#obligationSubmitButton").textContent = "Add payment";
  updateRecurrenceControls();
  renderPaymentScope();
}

function hasPaidPlan() {
  return Boolean(
    state.workspaceEntitlement &&
    state.workspaceEntitlement.plan_code !== "free" &&
    state.workspaceEntitlement.effective_status === "active" &&
    !state.workspaceEntitlement.read_only
  );
}

function userCreatedPersonalPaymentCount() {
  const userId = state.session?.user?.id;
  return state.paymentItems.filter((item) =>
    item.created_by === userId &&
    item.visibility === "personal" &&
    item.status !== "inactive"
  ).length;
}

function recordableOccurrencesForItem(item) {
  if (!item || !isPaymentActive(item)) return [];
  const todayValue = toDateValue(new Date());
  const currentMonth = toMonthValue(new Date());
  const byKey = new Map();
  const addOccurrences = (occurrences) => {
    occurrences.forEach((occurrence) => {
      if (occurrence.outstanding > 0.00005) byKey.set(occurrence.key, occurrence);
    });
  };

  for (let offset = -12; offset <= 0; offset += 1) {
    addOccurrences(generateOccurrences([item], state.paymentRecords, offsetMonthValue(currentMonth, offset)));
  }

  state.paymentRecords
    .filter((record) => record.payment_item_id === item.id && record.period_start)
    .forEach((record) => {
      const targetMonth = `${record.period_start}`.slice(0, 7);
      const targetDate = parseDate(monthStart(targetMonth));
      const occurrence = item.recurrence_type === "custom_days"
        ? occurrenceForItem(item, state.paymentRecords, targetDate, record.period_start)
        : occurrenceForItem(item, state.paymentRecords, targetDate);
      addOccurrences([occurrence]);
    });

  if (item.recurrence_type === "once" && item.start_date) {
    addOccurrences(generateOccurrences([item], state.paymentRecords, item.start_date.slice(0, 7)));
  }

  let nextUpcoming = null;
  for (let offset = 0; item.recurrence_type !== "once" && offset <= 120 && !nextUpcoming; offset += 1) {
    nextUpcoming = generateOccurrences([item], state.paymentRecords, offsetMonthValue(currentMonth, offset))
      .find((occurrence) => occurrence.outstanding > 0.00005 && occurrence.dueDate > todayValue) || null;
  }
  if (nextUpcoming) addOccurrences([nextUpcoming]);

  const choices = [...byKey.values()].sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  const partial = choices.filter((occurrence) => occurrence.paid > 0 && occurrence.outstanding > 0);
  const recentDue = choices
    .filter((occurrence) => occurrence.dueDate <= todayValue && occurrence.paid <= 0)
    .slice(-12);
  const next = choices.find((occurrence) => occurrence.dueDate > todayValue);
  return [...new Map([...partial, ...recentDue, ...(next ? [next] : [])].map((occurrence) => [occurrence.key, occurrence])).values()]
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate));
}

function preferredRecordOccurrence(choices) {
  if (!choices.length) return null;
  const todayValue = toDateValue(new Date());
  const currentMonth = toMonthValue(new Date());
  const partial = choices.filter((occurrence) => occurrence.paid > 0 && occurrence.outstanding > 0)
    .sort((left, right) => left.dueDate.localeCompare(right.dueDate))[0];
  if (partial) return partial;
  const current = choices.find((occurrence) => occurrence.dueDate.slice(0, 7) === currentMonth);
  if (current) return current;
  const overdue = choices.filter((occurrence) => occurrence.dueDate < todayValue).at(-1);
  return overdue || choices.find((occurrence) => occurrence.dueDate >= todayValue) || choices[0];
}

function populateRecordPaymentPeriods(choices, selectedKey) {
  const field = $("#recordPaymentPeriodField");
  const select = $("#recordPaymentPeriod");
  select.innerHTML = choices.map((occurrence) => `
    <option value="${escapeHtml(occurrence.key)}">
      Due ${escapeHtml(occurrence.dueDate)} — ${escapeHtml(money(occurrence.outstanding, occurrence.item.currency))} outstanding
    </option>
  `).join("");
  select.value = selectedKey;
  field.hidden = choices.length <= 1;
}

function applyRecordPaymentOccurrence(occurrence, preservePayer = false) {
  if (!occurrence) return;
  const selectedPayer = preservePayer ? $("#recordPaidBy").value : null;
  $("#recordItemId").value = occurrence.item.id;
  $("#recordPeriodStart").value = occurrence.periodStart;
  $("#recordDueDate").value = occurrence.dueDate;
  $("#recordPaymentTitle").textContent = `Record ${occurrence.item.name}`;
  $("#recordPaymentMeta").textContent = `${money(occurrence.outstanding, occurrence.item.currency)} outstanding, due ${occurrence.dueDate}`;
  $("#recordOutstanding").value = occurrence.outstanding.toFixed(4);
  $("#recordCurrency").value = occurrence.item.currency;
  $("#recordPaymentType").value = "full";
  $("#recordAmount").value = `${Number(occurrence.outstanding.toFixed(4))}`;
  $("#recordAmount").max = occurrence.outstanding.toFixed(4);
  $("#recordAmount").readOnly = true;
  const isFamilyPayment = occurrence.item.visibility === "family" || Boolean(occurrence.item.family_id);
  $("#recordPaidByField").hidden = !isFamilyPayment;
  $("#recordPaidBy").required = isFamilyPayment;
  $("#recordPaidBy").value = isFamilyPayment
    ? (selectedPayer && activeMembers().some((member) => member.id === selectedPayer)
        ? selectedPayer : currentFamilyMember()?.id || "")
    : "";
}

function showRecordPaymentDialog(choices, selectedOccurrence) {
  state.recordPaymentOccurrenceChoices = choices;
  $("#recordPaymentForm").reset();
  populateRecordPaymentPeriods(choices, selectedOccurrence.key);
  applyRecordPaymentOccurrence(selectedOccurrence);
  $("#recordPaymentDate").value = toDateValue(new Date());
  const dialog = $("#recordPaymentDialog");
  if (!dialog.open) dialog.showModal();
}

function openRecordPaymentForItem(itemId) {
  if (state.workspaceEntitlement?.read_only || state.workspaceEntitlement?.effective_status === "suspended") {
    showToast("This shared workspace is read-only. The owner must renew it before payments can be recorded.");
    return;
  }
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === itemId);
  if (!item) return;
  if (item.status === "inactive") {
    showToast("Reactivate this payment before recording it.");
    return;
  }
  if (isPlanPaused(item)) {
    showToast("This payment is paused by the Free plan limit. Select it among your five or renew Personal.");
    return;
  }
  const choices = recordableOccurrencesForItem(item);
  const selectedOccurrence = preferredRecordOccurrence(choices);
  if (!selectedOccurrence) {
    showToast("There is no outstanding period available for this payment.");
    return;
  }
  showRecordPaymentDialog(choices, selectedOccurrence);
}

function openRecordPayment(key) {
  if (state.workspaceEntitlement?.read_only || state.workspaceEntitlement?.effective_status === "suspended") {
    showToast("This shared workspace is read-only. The owner must renew it before payments can be recorded.");
    return;
  }
  const periodStart = key.slice(key.lastIndexOf(":") + 1);
  const occurrences = generateOccurrences(state.paymentItems, state.paymentRecords, periodStart.slice(0, 7));
  const occurrence = occurrences.find((item) => item.key === key);
  if (!occurrence) return;
  const choices = recordableOccurrencesForItem(occurrence.item);
  if (!choices.some((choice) => choice.key === occurrence.key)) choices.push(occurrence);
  choices.sort((left, right) => left.dueDate.localeCompare(right.dueDate));
  showRecordPaymentDialog(choices, occurrence);
}

function paymentHistoryRecordStatus(record, item) {
  const samePeriod = state.paymentRecords
    .filter((candidate) => candidate.payment_item_id === item.id && candidate.period_start === record.period_start)
    .sort((left, right) => `${left.payment_date || ""}:${left.created_at || ""}`.localeCompare(`${right.payment_date || ""}:${right.created_at || ""}`));
  let cumulative = 0;
  for (const candidate of samePeriod) {
    cumulative += Number(candidate.amount || 0);
    if (candidate.id === record.id) break;
  }
  return cumulative + 0.00005 >= Number(item.amount || 0) ? "Paid in full" : "Partial";
}

function renderPaymentHistoryRecord(record, item) {
  const recordCurrency = record.currency || item.currency;
  const status = paymentHistoryRecordStatus(record, item);
  const workspaceReadOnly = Boolean(state.workspaceEntitlement?.read_only || state.workspaceEntitlement?.effective_status === "suspended");
  const article = document.createElement("article");
  article.className = "payment-history-record";
  article.innerHTML = `
    <div class="payment-history-record-date">
      <strong>${parseDate(record.payment_date).getDate()}</strong>
      <span>${parseDate(record.payment_date).toLocaleString("en", { month: "short", year: "numeric" })}</span>
    </div>
    <div class="payment-history-record-main">
      <div class="payment-history-record-title">
        <strong>${money(record.amount, recordCurrency)}</strong>
        <span class="mini-badge ${status === "Paid in full" ? "paid" : "partial"}">${status}</span>
      </div>
      <span>Due ${escapeHtml(record.due_date || record.period_start)} &middot; ${escapeHtml(paymentRecordAttribution(record))}</span>
      <span>${escapeHtml(record.payment_method || "Method not set")} &middot; ${escapeHtml(record.reference_number || "No reference")}</span>
      ${record.notes ? `<small>${escapeHtml(record.notes)}</small>` : ""}
      ${record.proof_name ? `<small>Proof: ${escapeHtml(record.proof_name)}${record.proof_size_bytes ? ` &middot; ${formatFileSize(record.proof_size_bytes)}` : ""}</small>` : ""}
    </div>
    <div class="payment-history-record-actions">
      ${record.proof_path ? `<button type="button" data-open-proof="${record.id}">View proof</button>` : ""}
      <button class="danger-text" type="button" data-delete-record="${record.id}" ${workspaceReadOnly || isPlanPaused(item) ? "disabled" : ""}>Delete</button>
    </div>
  `;
  return article;
}

function renderPaymentHistory() {
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === state.paymentHistoryItemId);
  if (!item) return;
  const records = state.paymentRecords
    .filter((record) => record.payment_item_id === item.id)
    .sort((left, right) => `${right.payment_date || ""}:${right.created_at || ""}`.localeCompare(`${left.payment_date || ""}:${left.created_at || ""}`));
  $("#paymentHistoryTitle").textContent = `${item.name} history`;
  $("#paymentHistoryMeta").textContent = `${item.category} · ${recurrenceLabel(item)} · ${money(item.amount, item.currency)} per payment`;
  $("#paymentHistoryCount").textContent = `${records.length}`;
  $("#paymentHistoryTotal").textContent = records.length
    ? formatCurrencyTotals(records.map((record) => ({
      amount: record.amount,
      currency: record.currency || item.currency
    })))
    : money(0, item.currency);
  $("#paymentHistoryLatest").textContent = records.length ? parseDate(records[0].payment_date).toLocaleDateString() : "None";
  const list = $("#paymentHistoryList");
  if (!records.length) {
    list.innerHTML = emptyState("No payment history yet", "Use Record payment to save the first payment for this item.");
    return;
  }
  list.innerHTML = "";
  records.forEach((record) => list.append(renderPaymentHistoryRecord(record, item)));
}

function openPaymentHistory(itemId) {
  if (!state.paymentItems.some((item) => item.id === itemId)) return;
  state.paymentHistoryItemId = itemId;
  renderPaymentHistory();
  const dialog = $("#paymentHistoryDialog");
  if (!dialog.open) dialog.showModal();
}

async function savePaymentRecord(event) {
  event.preventDefault();
  const item = state.paymentItems.find((paymentItem) => paymentItem.id === $("#recordItemId").value);
  const amount = Number($("#recordAmount").value || 0);
  const outstanding = Number($("#recordOutstanding").value || 0);
  const proofFile = $("#recordProof").files?.[0] || null;
  if (!item || amount <= 0) {
    showToast("Choose a payment and enter an amount.");
    return;
  }
  if (amount > outstanding + 0.005) {
    showToast(`The payment cannot be more than the ${money(outstanding, item.currency)} outstanding balance.`);
    return;
  }
  if ((item.visibility === "family" || item.family_id) && !activeMembers().some((member) =>
    member.id === $("#recordPaidBy").value && member.family_id === item.family_id)) {
    showToast("Choose an active member of this family who paid.");
    return;
  }
  if (proofFile && !PAYMENT_PROOF_TYPES.has(proofFile.type)) {
    showToast("Proof must be a JPG, PNG, WebP, or PDF file.");
    return;
  }
  if (proofFile && proofFile.size > PAYMENT_PROOF_MAX_BYTES) {
    showToast("Proof of payment must be 10 MB or smaller.");
    return;
  }

  let uploadedProof = null;
  try {
    if (proofFile) uploadedProof = await uploadPaymentProof(item, proofFile);
    await query(
      "payment record create",
      supabase.from("payment_records").insert({
        family_id: item.family_id || null,
        owner_id: state.session.user.id,
        visibility: item.visibility || (item.family_id ? "family" : "personal"),
        payment_item_id: item.id,
        period_start: $("#recordPeriodStart").value,
        due_date: $("#recordDueDate").value,
        paid_by_member_id: item.visibility === "family" || item.family_id ? $("#recordPaidBy").value || null : null,
        amount,
        currency: item.currency,
        payment_date: $("#recordPaymentDate").value,
        payment_method: $("#recordMethod").value,
        reference_number: $("#recordReference").value.trim() || null,
        notes: $("#recordNotes").value.trim() || null,
        proof_path: uploadedProof?.path || null,
        proof_name: uploadedProof?.name || null,
        proof_mime_type: uploadedProof?.type || null,
        proof_size_bytes: uploadedProof?.size || null,
        recorded_by: state.session.user.id
      })
    );
    $("#recordPaymentDialog").close();
    $("#recordPaymentForm").reset();
    await loadPaymentRecords();
    renderFamilyApp();
    showToast(amount + 0.005 >= outstanding ? "Payment recorded as paid in full." : "Partial payment recorded.");
  } catch (error) {
    if (uploadedProof?.path) {
      await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove([uploadedProof.path]).catch(() => {});
    }
    showToast(error.message);
  }
}

async function uploadPaymentProof(item, file) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "receipt";
  const userId = state.session.user.id;
  const path = item.visibility === "family"
    ? `families/${item.family_id}/${state.family.owner_id}/${userId}/${crypto.randomUUID()}-${safeName}`
    : `personal/${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false
  });
  if (error) throw error;
  return { path, name: file.name, type: file.type, size: file.size };
}

async function openPaymentProof(recordId) {
  const record = state.paymentRecords.find((item) => item.id === recordId);
  if (!record?.proof_path) return;
  try {
    const { data, error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).createSignedUrl(record.proof_path, 60);
    if (error) throw error;
    const link = document.createElement("a");
    link.href = data.signedUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.click();
  } catch (error) {
    showToast(error.message);
  }
}

async function deletePaymentRecord(recordId) {
  const record = state.paymentRecords.find((item) => item.id === recordId);
  const openHistoryItemId = state.paymentHistoryItemId;
  try {
    await query("payment_records delete", supabase.from("payment_records").delete().eq("id", recordId));
    let proofCleanupFailed = false;
    if (record?.proof_path) {
      const { error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove([record.proof_path]);
      proofCleanupFailed = Boolean(error);
    }
    await loadPaymentRecords();
    renderFamilyApp();
    if (openHistoryItemId && $("#paymentHistoryDialog").open) renderPaymentHistory();
    showToast(proofCleanupFailed ? "Payment deleted. The receipt file still needs admin cleanup." : "Payment record deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deletePaymentItem(itemId) {
  const proofPaths = state.paymentRecords
    .filter((record) => record.payment_item_id === itemId && record.proof_path)
    .map((record) => record.proof_path);
  try {
    if (state.paymentHistoryItemId === itemId && $("#paymentHistoryDialog").open) $("#paymentHistoryDialog").close();
    await query("payment item delete", supabase.from("payment_items").delete().eq("id", itemId));
    let proofCleanupFailed = false;
    if (proofPaths.length) {
      const { error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove(proofPaths);
      proofCleanupFailed = Boolean(error);
    }
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    state.freePaymentDraft = null;
    renderFamilyApp();
    showToast(proofCleanupFailed
      ? "Payment deleted. Some receipt files still need admin cleanup."
      : "Payment and its receipt files were deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

async function addHead(event) {
  event.preventDefault();
  const email = $("#headEmail").value.trim().toLowerCase();
  const matchingProfile = state.adminProfiles.find((profile) => (profile.email || "").toLowerCase() === email);
  const payload = {
    user_id: matchingProfile?.id || null,
    full_name: $("#headName").value.trim(),
    email,
    created_by: state.session.user.id,
    family_limit: Math.max(0, Number($("#headFamilyLimit").value || 0)),
    can_add_members: $("#headCanAddMembers").checked,
    status: "active"
  };
  if (!payload.full_name || !email) return;
  if (!Number.isInteger(payload.family_limit) || payload.family_limit < 0 || payload.family_limit > 100) {
    showToast("Enter a whole-number family limit between 0 and 100.");
    return;
  }
  try {
    const existingRows = await query("head duplicate check", supabase.from("family_heads").select("id").ilike("email", email).limit(1));
    if (existingRows[0]) {
      await query("head update", supabase.from("family_heads").update(payload).eq("id", existingRows[0].id));
    } else {
      await query("head create", supabase.from("family_heads").insert(payload));
    }
    $("#headForm").reset();
    await loadAdminData();
    renderAdmin();
    showToast("User access saved.");
  } catch (error) {
    showToast(error.message);
  }
}

function configureProfileAccess(profileId) {
  const profile = state.adminProfiles.find((item) => item.id === profileId);
  if (!profile) return;
  $("#headForm").reset();
  $("#headName").value = profile.full_name || "";
  $("#headEmail").value = profile.email || "";
  $("#headFamilyLimit").value = 1;
  $("#headForm").scrollIntoView({ behavior: "smooth", block: "center" });
  window.setTimeout(() => $("#headFamilyLimit").focus(), 250);
}

async function addPlatformPayment(event) {
  event.preventDefault();
  const head = state.heads.find((item) => item.id === $("#paymentHead").value);
  const amount = Number($("#paymentAmount").value);
  if (!head || amount <= 0) {
    showToast("Choose a user and enter a payment amount.");
    return;
  }
  const matchingFamily = findFamilyForHead(head);
  try {
    await query(
      "platform payment create",
      supabase.from("payments").insert({
        family_head_id: head.id,
        family_id: matchingFamily?.id || null,
        recorded_by: state.session.user.id,
        amount,
        currency: $("#paymentCurrency").value,
        payment_method: $("#paymentMethod").value,
        payment_date: $("#paymentDate").value,
        reference_number: $("#paymentReference").value.trim() || null,
        notes: $("#paymentNotes").value.trim() || null
      })
    );
    $("#paymentForm").reset();
    $("#paymentDate").value = toDateValue(new Date());
    await loadAdminData();
    renderAdmin();
    showToast("Legacy payment note recorded. Subscription access changes only through an approved review request.");
  } catch (error) {
    showToast(error.message);
  }
}

async function saveAdminNote(event) {
  event.preventDefault();
  try {
    await query(
      "admin note create",
      supabase.from("admin_support_notes").insert({
        family_id: $("#adminNoteFamily").value,
        note: $("#adminNoteText").value.trim(),
        created_by: state.session.user.id
      })
    );
    $("#adminNoteForm").reset();
    await loadAdminData();
    renderAdmin();
    showToast("Support note saved.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateHeadStatus(headId, nextStatus) {
  try {
    await query("head status update", supabase.from("family_heads").update({ status: nextStatus }).eq("id", headId));
    await loadAdminData();
    renderAdmin();
    showToast(nextStatus === "active" ? "Owned Family workspaces reactivated." : "Owned Family workspaces suspended. The user's Personal workspace remains available.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateAccountStatus(userId, nextStatus) {
  try {
    await query("account status update", supabase.rpc("set_user_account_status", {
      p_user_id: userId, p_status: nextStatus
    }));
    await loadAdminData();
    renderAdmin();
    showToast(nextStatus === "active" ? "Account reactivated." : "Account suspended across all workspaces.");
  } catch (error) { showToast(friendlyMessage(error.message)); }
}

async function updateHeadMemberAccess(headId, nextValue) {
  try {
    await query("member access update", supabase.from("family_heads").update({ can_add_members: nextValue === "true" }).eq("id", headId));
    await loadAdminData();
    renderAdmin();
    showToast(nextValue === "true" ? "Family-member access unlocked." : "Family-member access locked.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateHeadFamilyLimit(headId) {
  const input = document.querySelector(`[data-family-limit-input="${headId}"]`);
  const familyLimitValue = Number(input?.value);
  if (!Number.isInteger(familyLimitValue) || familyLimitValue < 0 || familyLimitValue > 100) {
    showToast("Enter a whole-number family limit between 0 and 100.");
    return;
  }
  try {
    await query("family limit update", supabase.from("family_heads").update({ family_limit: familyLimitValue }).eq("id", headId));
    await loadAdminData();
    renderAdmin();
    showToast("Family limit updated.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateFamilyMemberAccess(familyId, nextValue) {
  const family = state.adminFamilies.find((item) => item.id === familyId);
  if (!family?.owner_email) {
    showToast("This household does not have an owner email saved.");
    return;
  }
  const allowMembers = nextValue === "true";
  const existingHead = findHeadForFamily(family);
  try {
    if (existingHead) {
      await query("household member access update", supabase.from("family_heads").update({ can_add_members: allowMembers }).eq("id", existingHead.id));
    } else if (allowMembers) {
      await query(
        "household member access create",
        supabase.from("family_heads").insert({
          full_name: `${family.name} owner`,
          email: family.owner_email.toLowerCase(),
          created_by: state.session.user.id,
          monthly_fee: 0,
          fee_currency: family.currency || "USD",
          billing_status: "unpaid",
          family_limit: 1,
          can_add_members: true,
          status: "active"
        })
      );
    }
    await loadAdminData();
    renderAdmin();
    showToast(allowMembers ? "Family-member access unlocked." : "Family-member access locked.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateFamilyStatus(familyId, nextStatus) {
  const family = state.adminFamilies.find((item) => item.id === familyId);
  const existingHead = family ? findHeadForFamily(family) : null;
  if (!existingHead) {
    showToast("Unlock member access first, then you can suspend this household.");
    return;
  }
  await updateHeadStatus(existingHead.id, nextStatus);
}

async function removeFamilyMember(memberId) {
  if (!state.family) return;
  try {
    await query(
      "family member remove",
      supabase.rpc("remove_family_member", {
        p_family_id: state.family.id,
        p_member_id: memberId
      })
    );
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    showToast("Member removed from the family. Their membership record was retained as inactive.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteSelectedFamily() {
  if (!state.family) return;
  const familyId = state.family.id;
  const proofPaths = state.paymentRecords
    .filter((record) => record.family_id === familyId && record.proof_path)
    .map((record) => record.proof_path);
  try {
    await query(
      "family delete",
      supabase.rpc("delete_family_workspace", { p_family_id: familyId })
    );
    let proofCleanupFailed = false;
    if (proofPaths.length) {
      const { error } = await supabase.storage.from(PAYMENT_PROOF_BUCKET).remove(proofPaths);
      proofCleanupFailed = Boolean(error);
    }
    window.localStorage.removeItem(selectedFamilyStorageKey());
    state.family = null;
    await loadFamily();
    await loadFamilyData();
    await loadWorkspaceSubscriptionData();
    renderFamilyApp();
    showToast(proofCleanupFailed
      ? "Family deleted from the database. Some receipt files still need admin cleanup."
      : "Family and its receipt files were permanently deleted.");
  } catch (error) {
    showToast(error.message);
  }
}

async function updateObligationStatus(itemId, nextStatus) {
  try {
    const item = state.paymentItems.find((payment) => payment.id === itemId);
    if (!item || isPlanPaused(item)) throw new Error("Payments paused by the plan limit cannot be changed. You can delete one or choose it among your five.");
    await query("payment item status update", supabase.from("payment_items").update({ status: nextStatus }).eq("id", itemId));
    await loadPaymentItems();
    state.freePaymentDraft = null;
    renderFamilyApp();
    showToast(nextStatus === "active" ? "Obligation reactivated." : "Obligation paused.");
  } catch (error) {
    showToast(error.message);
  }
}

async function deleteRow(table, id, reload, message) {
  try {
    await query(`${table} delete`, supabase.from(table).delete().eq("id", id));
    await reload();
    showToast(message);
  } catch (error) {
    showToast(error.message);
  }
}

function memberById(id) {
  return state.members.find((member) => member.id === id);
}

function paymentRecordPeople(record) {
  const recorder = state.members.find((member) => member.user_id === record.recorded_by);
  const recorderName = recorder?.name || (record.recorded_by === state.session?.user?.id
    ? state.profile?.full_name || state.session?.user?.email || "You" : "Member unavailable");
  const payerName = record.visibility === "family" || record.family_id
    ? memberById(record.paid_by_member_id)?.name || "Member not recorded" : "";
  return { payerName, recorderName };
}

function paymentRecordAttribution(record) {
  const { payerName, recorderName } = paymentRecordPeople(record);
  if (!payerName) return `Recorded by ${recorderName}`;
  return `Paid by ${payerName} · Recorded by ${recorderName}`;
}

function currentFamilyMember() {
  const userId = state.session?.user?.id;
  const email = state.session?.user?.email?.toLowerCase();
  const members = activeMembers();
  return members.find((member) => member.user_id === userId)
    || members.find((member) => email && member.email?.toLowerCase() === email)
    || (state.family?.owner_id === userId ? familyOwnerMember() : null)
    || null;
}

function familyOwnerMember() {
  if (!state.family) return null;
  const ownerEmail = state.family.owner_email?.toLowerCase();
  const members = activeMembers();
  return members.find((member) => member.user_id === state.family.owner_id)
    || members.find((member) => member.role === "Owner")
    || members.find((member) => ownerEmail && member.email?.toLowerCase() === ownerEmail)
    || null;
}

function effectiveResponsibleMember(item) {
  if (item?.responsible_member_id) return memberById(item.responsible_member_id) || null;
  if (item?.visibility === "family" && item.family_id === state.family?.id) return familyOwnerMember();
  return null;
}

function findFamilyForHead(head) {
  return state.adminFamilies.find((family) => (family.owner_email || "").toLowerCase() === head.email.toLowerCase());
}

function findHeadForFamily(family) {
  return state.heads.find((head) => head.email.toLowerCase() === (family.owner_email || "").toLowerCase());
}

function recurrenceLabel(item) {
  if (item.recurrence_type === "once") return "Once-off";
  if (item.recurrence_type === "quarterly") return "Every 3 months";
  if (item.recurrence_type === "yearly") return "Yearly";
  if (item.recurrence_type === "custom") return `Every ${item.recurrence_interval || 1} months`;
  if (item.recurrence_type === "custom_days") {
    const interval = Number(item.recurrence_interval || 1);
    return `Every ${interval} day${interval === 1 ? "" : "s"}`;
  }
  return "Monthly";
}

function paymentScheduleLabel(item) {
  if (item.recurrence_type === "custom_days") return `First due ${item.start_date}`;
  if (item.recurrence_type === "once") return `Due ${item.start_date}`;
  return `Due day ${item.due_day}`;
}

function formatOccurrenceCurrencyTotals(occurrences) {
  return formatCurrencyTotals(occurrences.map((occurrence) => ({ currency: occurrence.item.currency, amount: occurrence.amount })));
}

function formatCurrencyTotals(rows) {
  if (!rows.length) return money(0, "USD");
  const totals = rows.reduce((acc, row) => {
    const currency = row.currency || "USD";
    acc[currency] = (acc[currency] || 0n) + decimalToScaled(row.amount || 0);
    return acc;
  }, {});
  return Object.entries(totals).map(([currency, amount]) => money(scaledToDecimal(amount), currency)).join(" / ");
}

function latestBaseRate(currency, at = null) {
  const code = `${currency || "USD"}`.toUpperCase();
  if (code === "USD") return { rate: "1", provider_effective_at: at || new Date().toISOString(), provider: "identity" };
  const cutoff = at ? new Date(at).getTime() : Number.POSITIVE_INFINITY;
  return state.exchangeRates.find((row) =>
    row.quote_currency === code && new Date(row.provider_effective_at).getTime() <= cutoff
  ) || null;
}

function crossRateScaled(sourceCurrency, targetCurrency, at = null) {
  const sourceCode = `${sourceCurrency || "USD"}`.toUpperCase();
  const targetCode = `${targetCurrency || "USD"}`.toUpperCase();
  if (sourceCode === targetCode) return DECIMAL_SCALE;
  const source = latestBaseRate(sourceCode, at);
  const target = latestBaseRate(targetCode, at);
  if (!source || !target) return null;
  const sourceRate = decimalToScaled(source.rate);
  const targetRate = decimalToScaled(target.rate);
  if (sourceRate <= 0n || targetRate <= 0n) return null;
  return (targetRate * DECIMAL_SCALE) / sourceRate;
}

function convertAmountScaled(amount, sourceCurrency, targetCurrency, at = null) {
  const rate = crossRateScaled(sourceCurrency, targetCurrency, at);
  return rate == null ? null : multiplyScaled(decimalToScaled(amount), rate);
}

function formatConvertedTotal(rows, targetCurrency) {
  const total = convertedTotalScaled(rows, targetCurrency);
  if (total == null) return null;
  return money(scaledToDecimal(total), targetCurrency);
}

function convertedTotalScaled(rows, targetCurrency) {
  let total = 0n;
  for (const row of rows) {
    const converted = convertAmountScaled(row.amount, row.currency || "USD", targetCurrency, row.at || null);
    if (converted == null) return null;
    total += converted;
  }
  return total;
}

function selectedReportingCurrency() {
  return state.workspaceSettings?.reporting_currency || "USD";
}

function selectedDashboardCurrency() {
  return state.workspaceSettings?.default_payment_currency || selectedReportingCurrency();
}

function dashboardAmountSummary(rows) {
  const currency = selectedDashboardCurrency();
  const scaled = convertedTotalScaled(rows, currency);
  if (scaled != null) {
    return {
      scaled,
      currency,
      converted: rows.some((row) => `${row.currency || "USD"}`.toUpperCase() !== currency.toUpperCase()),
      text: money(scaledToDecimal(scaled), currency)
    };
  }
  return {
    scaled: null,
    currency: null,
    converted: false,
    text: formatCurrencyTotals(rows)
  };
}

function compareScaledDescending(left, right) {
  if (left == null || right == null || left === right) return 0;
  return left > right ? -1 : 1;
}

function rateStatusPresentation(status = state.exchangeRateStatus) {
  const lastSuccess = status?.last_success_at ? new Date(status.last_success_at) : null;
  const hours = Number(status?.stale_hours);
  if (!lastSuccess || Number.isNaN(lastSuccess.getTime())) {
    return { level: "missing", text: "Rates last updated: not available. Original currencies remain visible separately." };
  }
  const updated = lastSuccess.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  if (hours > 36) return { level: "danger", text: `Rates last updated: ${updated}. These rates are more than 36 hours old.` };
  if (hours > 18) return { level: "warning", text: `Rates last updated: ${updated}. The next scheduled update may be pending.` };
  return { level: "current", text: `Rates last updated: ${updated}.` };
}

function csvCell(value) {
  const text = `${value ?? ""}`.replaceAll('"', '""');
  return `"${text}"`;
}

function downloadCsv(filename, headings, rows) {
  const csv = [headings, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n");
  const link = document.createElement("a");
  link.href = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function exportReportCsv() {
  const items = paymentItemsForReportWorkspace().filter((item) =>
    state.reportCurrencyFilter === "all" || item.currency === state.reportCurrencyFilter
  );
  const records = paymentRecordsForReportWorkspace(items);
  const target = reportReportingCurrency();
  const rows = records.map((record) => {
    const item = items.find((candidate) => candidate.id === record.payment_item_id);
    const source = record.currency || item?.currency || "USD";
    const locked = lockedConversionFor("payment_record", record.id, target);
    const people = paymentRecordPeople(record);
    return [
      record.payment_date, item?.name || "Payment", record.amount, source,
      locked?.converted_amount || "", locked?.reporting_currency || "",
      locked?.exchange_rate || "", locked?.rate_effective_at || "",
      locked?.rate_source || "", people.payerName, people.recorderName,
      record.payment_method || "", record.reference_number || ""
    ];
  });
  downloadCsv(`mushavo-report-${state.reportMonth}.csv`, [
    "Payment date", "Payment", "Original amount", "Original currency", "Converted amount",
    "Reporting currency", "Exchange rate", "Rate effective at (UTC)", "Rate source", "Paid by", "Recorded by", "Method", "Reference"
  ], rows);
}

function exportAdminFinanceCsv() {
  const target = adminReportingCurrency();
  const records = [
    ...state.payments.filter((payment) => adminFinanceRecordVisible(payment, "platform_payment")).map((payment) => ({
      entity_type: "platform_payment", entity_id: payment.id, at: payment.payment_date,
      amount: payment.amount, currency: payment.currency, status: "approved", reference: payment.reference_number
    })),
    ...state.adminSubscriptionPayments.filter((payment) => adminFinanceRecordVisible(payment, "subscription_payment")).map((payment) => ({
      entity_type: "subscription_payment", entity_id: payment.id, at: payment.payment_date,
      amount: payment.amount, currency: payment.currency, status: payment.status, reference: payment.reference_number
    }))
  ];
  const rows = records.map((payment) => {
    const locked = lockedConversionFor(payment.entity_type, payment.entity_id, target);
    return [payment.entity_type, payment.entity_id, payment.status, payment.reference, payment.at, payment.amount, payment.currency,
      locked?.converted_amount || "", locked?.reporting_currency || "", locked?.exchange_rate || "",
      locked?.rate_effective_at || "", locked?.rate_source || ""];
  });
  downloadCsv(`mushavo-finance-${toDateValue(new Date())}.csv`, [
    "Record type", "Record ID", "Status", "Reference", "Payment date", "Original amount", "Original currency",
    "Converted amount", "Reporting currency", "Exchange rate", "Rate effective at (UTC)", "Rate source"
  ], rows);
}

function printCurrentView(kind) {
  document.body.dataset.printView = kind;
  window.print();
  delete document.body.dataset.printView;
}

function formatFileSize(bytes) {
  const size = Number(bytes || 0);
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function validateProofFile(file) {
  if (!PAYMENT_PROOF_TYPES.has(file.type)) {
    throw new Error("Proof must be a JPG, PNG, WebP, or PDF file.");
  }
  if (file.size > PAYMENT_PROOF_MAX_BYTES) {
    throw new Error("Proof files must be 10 MB or smaller.");
  }
}

function statusBadge(status) {
  return `<span class="mini-badge ${badgeClass(status)}">${escapeHtml(status)}</span>`;
}

function badgeClass(status) {
  return `${status}`.toLowerCase().replaceAll(" ", "-");
}

function emptyState(title, text) {
  return `<div class="empty-ledger"><strong>${escapeHtml(title)}</strong><span>${escapeHtml(text)}</span></div>`;
}

function memberInitials(name) {
  return `${name || "?"}`.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function escapeHtml(value) {
  return `${value ?? ""}`.replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" };
    return entities[char];
  });
}

document.addEventListener("click", async (event) => {
  const dashboardBrand = event.target.closest("[data-go-dashboard]");
  if (dashboardBrand) {
    if (state.isAdmin) {
      state.adminTab = "dashboard";
      setRoute("admin", "dashboard");
      await loadAdminData("dashboard");
      renderAdmin();
    } else {
      state.familyTab = "dashboard";
      setRoute("family", "dashboard");
      renderFamilyApp();
      scheduleDashboardTextFit();
    }
    closeDrawer();
  }
  if (event.target.dataset.closePaymentDialog !== undefined) $("#recordPaymentDialog").close();
  if (event.target.closest("[data-close-payment-history]")) $("#paymentHistoryDialog").close();
  if (event.target.closest("[data-open-payment-item-dialog]")) openPaymentItemDialog();
  if (event.target.closest("[data-close-payment-item-dialog]")) $("#paymentItemDialog").close();
  if (event.target.closest("[data-open-invite-dialog]")) openInviteMemberDialog();
  if (event.target.closest("[data-close-invite-dialog]")) $("#inviteMemberDialog").close();
  if (event.target.dataset.closeConfirmDialog !== undefined) $("#confirmDialog").close();
  if (event.target.closest("[data-close-notifications]")) $("#notificationDialog").close();
  if (event.target.dataset.openDrawer !== undefined) openDrawer();
  if (event.target.dataset.closeDrawer !== undefined) closeDrawer();
  if (event.target.closest("[data-open-notifications]")) openNotificationDialog();
  if (event.target.closest("[data-open-renewal-dialog]")) openRenewalDialog();
  if (event.target.closest("#purchaseFamilySubscription")) startAdditionalFamilyPurchase();
  if (event.target.closest("#purchaseFamilyPlaces")) openFamilySeatsDialog();
  if (event.target.closest("[data-close-family-seats-dialog]")) $("#familySeatsDialog").close();
  if (event.target.closest("[data-close-renewal-dialog]")) $("#renewalDialog").close();
  if (event.target.closest("[data-edit-family-name]")) openFamilyNameDialog();
  if (event.target.closest("[data-close-family-name-dialog]")) $("#familyNameDialog").close();
  if (event.target.closest("[data-close-admin-details]")) $("#adminDetailsDialog").close();

  const removeWorkspaceCurrency = event.target.closest("[data-remove-workspace-currency]");
  if (removeWorkspaceCurrency) {
    setWorkspaceCurrencySelected(removeWorkspaceCurrency.dataset.removeWorkspaceCurrency, false);
  }

  const planDefinitionEdit = event.target.closest("[data-edit-plan-definition]");
  if (planDefinitionEdit) editPlanDefinition(planDefinitionEdit.dataset.editPlanDefinition);


  const adminUserDetails = event.target.closest("[data-view-admin-user]");
  if (adminUserDetails) openAdminUserDetails(adminUserDetails.dataset.viewAdminUser, adminUserDetails.dataset.viewAdminUserEmail);

  const adminWorkspaceDetails = event.target.closest("[data-view-admin-workspace]");
  if (adminWorkspaceDetails) openAdminWorkspaceDetails(adminWorkspaceDetails.dataset.viewAdminWorkspace);

  const adminLegacyFamilyDetails = event.target.closest("[data-view-admin-legacy-family]");
  if (adminLegacyFamilyDetails) openAdminLegacyFamilyDetails(adminLegacyFamilyDetails.dataset.viewAdminLegacyFamily);

  const subscriptionPaymentDetails = event.target.closest("[data-view-subscription-payment]");
  if (subscriptionPaymentDetails) openSubscriptionPaymentDetails(subscriptionPaymentDetails.dataset.viewSubscriptionPayment);

  const selectedRenewalPlan = event.target.closest("[data-select-renewal-plan]");
  if (selectedRenewalPlan) {
    try {
      await openWorkspacePlanSelection(selectedRenewalPlan.dataset.selectRenewalPlan);
    } catch (error) {
      showToast(error.message);
    }
  }

  const subscriptionReview = event.target.closest("[data-review-subscription]");
  if (subscriptionReview) await reviewSubscriptionPayment(subscriptionReview.dataset.reviewSubscription, subscriptionReview.dataset.reviewDecision);

  const subscriptionProof = event.target.closest("[data-open-subscription-proof]");
  if (subscriptionProof) await openSubscriptionProof(subscriptionProof.dataset.openSubscriptionProof);

  const manualConversion = event.target.closest("[data-manual-conversion]");
  if (manualConversion) await saveManualConversion(
    manualConversion.dataset.conversionEntity,
    manualConversion.dataset.manualConversion
  );

  const dueMonthToggle = event.target.closest("[data-toggle-due-month]");
  if (dueMonthToggle) {
    const section = dueMonthToggle.closest(".due-month-group");
    const items = section?.querySelector(".due-month-items");
    if (section && items) {
      const expanded = dueMonthToggle.getAttribute("aria-expanded") === "true";
      if (expanded) dashboardDisclosureState.months.delete(section.dataset.month);
      else dashboardDisclosureState.months.add(section.dataset.month);
      dueMonthToggle.setAttribute("aria-expanded", `${!expanded}`);
      items.hidden = expanded;
      section.classList.toggle("expanded", !expanded);
      section.classList.toggle("collapsed", expanded);
      scheduleDashboardTextFit();
    }
  }

  const occurrenceToggle = event.target.closest("[data-toggle-occurrence-details]");
  if (occurrenceToggle) {
    const details = document.getElementById(occurrenceToggle.getAttribute("aria-controls"));
    if (details) {
      const expanded = occurrenceToggle.getAttribute("aria-expanded") === "true";
      const occurrenceKey = occurrenceToggle.closest(".occurrence-card")?.dataset.occurrenceKey;
      if (occurrenceKey) {
        if (expanded) dashboardDisclosureState.occurrences.delete(occurrenceKey);
        else dashboardDisclosureState.occurrences.add(occurrenceKey);
      }
      occurrenceToggle.setAttribute("aria-expanded", `${!expanded}`);
      details.hidden = expanded;
      occurrenceToggle.closest(".occurrence-card")?.classList.toggle("expanded", !expanded);
      scheduleDashboardTextFit();
    }
  }
  if (event.target.dataset.retryLoad !== undefined) {
    showLoading("Opening your workspace", "Checking your secure session...");
    try {
      const { session } = await query("session retry", supabase.auth.getSession());
      if (!session) {
        handleSignedOut();
        return;
      }
      const expiresSoon = session.expires_at && session.expires_at * 1000 < Date.now() + 60000;
      const freshSession = expiresSoon
        ? (await query("session refresh", supabase.auth.refreshSession())).session
        : session;
      if (!freshSession) throw new Error("Your session could not be restored. Please sign in again.");
      await openAuthenticatedSession(freshSession);
    } catch (error) {
      await handleLoadFailure(error);
    }
  }
  if (event.target.dataset.signOutError !== undefined) {
    await signOutSafely(event.target);
  }

  const configureProfileId = event.target.dataset.configureProfile;
  if (configureProfileId) configureProfileAccess(configureProfileId);

  const adminTab = event.target.dataset.adminTab;
  if (adminTab) {
    state.adminTab = adminTab;
    setRoute("admin", adminTab);
    try {
      await loadAdminData(adminTab);
      renderAdmin();
    } catch (error) {
      showToast(`This page could not load: ${friendlyMessage(error?.message)}`);
    }
    closeDrawer();
  }

  const familyTab = event.target.dataset.familyTab;
  if (familyTab) {
    state.familyTab = familyTab;
    setRoute("family", familyTab);
    if (familyTab === "support") {
      try {
        await loadUserSupportData();
      } catch (error) {
        showToast(`Support could not load: ${friendlyMessage(error.message)}`);
      }
    }
    renderFamilyApp();
    scheduleDashboardTextFit();
    closeDrawer();
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  const recordPaymentKey = event.target.dataset.recordPayment;
  if (recordPaymentKey) {
    if ($("#notificationDialog").open) $("#notificationDialog").close();
    openRecordPayment(recordPaymentKey);
  }

  const recordPaymentItem = event.target.closest("[data-record-payment-item]");
  if (recordPaymentItem) openRecordPaymentForItem(recordPaymentItem.dataset.recordPaymentItem);

  const paymentHistory = event.target.closest("[data-open-payment-history]");
  if (paymentHistory) openPaymentHistory(paymentHistory.dataset.openPaymentHistory);

  const openProofId = event.target.dataset.openProof;
  if (openProofId) await openPaymentProof(openProofId);

  const workloadToggle = event.target.closest("[data-toggle-workload]");
  if (workloadToggle) {
    const details = $(`#workload-details-${workloadToggle.dataset.toggleWorkload}`);
    if (details) {
      const expanded = workloadToggle.getAttribute("aria-expanded") === "true";
      if (expanded) dashboardDisclosureState.workloads.delete(workloadToggle.dataset.toggleWorkload);
      else dashboardDisclosureState.workloads.add(workloadToggle.dataset.toggleWorkload);
      workloadToggle.setAttribute("aria-expanded", `${!expanded}`);
      workloadToggle.textContent = expanded ? "View payments" : "Hide payments";
      details.classList.toggle("hidden", expanded);
      scheduleDashboardTextFit();
    }
  }

  const editObligationId = event.target.dataset.editObligation;
  if (editObligationId) startEditObligation(editObligationId);

  const accountId = event.target.dataset.toggleAccount;
  if (accountId && await confirmAction({
    title: event.target.dataset.nextAccountStatus === "suspended" ? "Suspend this account?" : "Reactivate this account?",
    message: "Suspension blocks the user from accessing their Personal and Family workspaces. Their data stays stored.",
    action: event.target.dataset.nextAccountStatus === "suspended" ? "Suspend" : "Reactivate"
  })) await updateAccountStatus(accountId, event.target.dataset.nextAccountStatus);

  const toggleObligationId = event.target.dataset.toggleObligation;
  if (toggleObligationId) await updateObligationStatus(toggleObligationId, event.target.dataset.nextStatus);

  const deleteObligationId = event.target.dataset.deleteObligation;
  if (deleteObligationId && await confirmAction({
    title: "Delete payment?",
    message: "This deletes the recurring payment and its saved payment records.",
    action: "Delete"
  })) {
    await deletePaymentItem(deleteObligationId);
  }

  const removeMemberId = event.target.dataset.removeMember;
  if (removeMemberId && await confirmAction({
    title: "Remove this member?",
    message: "They will lose access to this family. Their membership record will remain in the database as inactive and can be restored by inviting them again.",
    action: "Remove"
  })) {
    await removeFamilyMember(removeMemberId);
  }

  const cancelFamilyInviteId = event.target.dataset.cancelFamilyInvite;
  if (cancelFamilyInviteId && await confirmAction({
    title: "Cancel this invitation?",
    message: "The invitation will stop working and its reserved family place will become available. You can invite this person again.",
    action: "Cancel invitation"
  })) {
    await cancelFamilyInvitation(cancelFamilyInviteId);
  }

  if (event.target.dataset.deleteFamily !== undefined && state.family && await confirmAction({
    title: `Delete ${state.family.name}?`,
    message: "This permanently deletes the family and all of its family data from the database. This cannot be undone.",
    action: "Delete family"
  })) {
    await deleteSelectedFamily();
  }

  const deleteRecordId = event.target.dataset.deleteRecord;
  if (deleteRecordId && await confirmAction({
    title: "Delete payment record?",
    message: "This removes the saved payment from the selected period.",
    action: "Delete"
  })) {
    await deletePaymentRecord(deleteRecordId);
  }

  const deleteHeadId = event.target.dataset.deleteHead;
  if (deleteHeadId && await confirmAction({
    title: "Revoke user access?",
    message: "This removes the admin settings row for this user.",
    action: "Revoke"
  })) {
    await deleteRow("family_heads", deleteHeadId, async () => {
      await loadAdminData();
      renderAdmin();
    }, "User access revoked.");
  }

  const toggleHeadId = event.target.dataset.toggleHead;
  if (toggleHeadId) await updateHeadStatus(toggleHeadId, event.target.dataset.nextStatus);

  const toggleMemberAccessId = event.target.dataset.toggleMemberAccess;
  if (toggleMemberAccessId) await updateHeadMemberAccess(toggleMemberAccessId, event.target.dataset.nextMemberAccess);

  const saveFamilyLimitId = event.target.dataset.saveFamilyLimit;
  if (saveFamilyLimitId) await updateHeadFamilyLimit(saveFamilyLimitId);

  const toggleFamilyMemberAccessId = event.target.dataset.toggleFamilyMemberAccess;
  if (toggleFamilyMemberAccessId) await updateFamilyMemberAccess(toggleFamilyMemberAccessId, event.target.dataset.nextMemberAccess);

  const toggleFamilyStatusId = event.target.dataset.toggleFamilyStatus;
  if (toggleFamilyStatusId) await updateFamilyStatus(toggleFamilyStatusId, event.target.dataset.nextStatus);

  const deletePaymentId = event.target.dataset.deletePayment;
  if (deletePaymentId && await confirmAction({
    title: "Delete platform payment?",
    message: "This removes the subscription payment record from admin finance.",
    action: "Delete"
  })) {
    await deleteRow("payments", deletePaymentId, async () => {
      await loadAdminData();
      renderAdmin();
    }, "Platform payment deleted.");
  }

  const deleteAdminNoteId = event.target.dataset.deleteAdminNote;
  if (deleteAdminNoteId && await confirmAction({
    title: "Delete support note?",
    message: "This removes the note from the household support timeline.",
    action: "Delete"
  })) {
    await deleteRow("admin_support_notes", deleteAdminNoteId, async () => {
      await loadAdminData();
      renderAdmin();
    }, "Support note deleted.");
  }

  const acceptInviteId = event.target.dataset.acceptInvite;
  if (acceptInviteId) await respondToInvitation(acceptInviteId, "accepted");

  const rejectInviteId = event.target.dataset.rejectInvite;
  if (rejectInviteId) await respondToInvitation(rejectInviteId, "rejected");

  const readNotificationId = event.target.dataset.readNotification;
  if (readNotificationId) {
    await query("notification read", supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", readNotificationId));
    await loadNotifications();
    if (state.isAdmin) renderAdmin();
    else renderFamilyApp();
  }

  const openNotificationId = event.target.dataset.openNotification;
  if (openNotificationId) {
    const notification = state.notifications.find((item) => item.id === openNotificationId);
    if (notification?.url) {
      const target = new URL(notification.url, window.location.href);
      if (target.origin === window.location.origin && target.pathname === "/app.html") {
        if (!notification.read_at) {
          await query("notification open read", supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", notification.id));
        }
        window.location.assign(target.href);
      }
    }
  }
});

$("#authForm").addEventListener("submit", protectSubmission(signIn));
$("#familyForm").addEventListener("submit", protectSubmission(createFamily));
$("#memberFamilyForm").addEventListener("submit", protectSubmission(createFamilyFromMembers));
$("#familySeatsForm").addEventListener("submit", protectSubmission(submitFamilySeats));
$("#familySeatsDialog").addEventListener("close", () => {
  state.familySeatQuote = null;
  $("#familySeatsForm").reset();
  $("#familySeatsQuote").textContent = "";
});
$("#familySeatsCount").addEventListener("change", () => {
  refreshFamilySeatQuote().catch((error) => {
    $("#familySeatsQuote").textContent = friendlyMessage(error.message);
    $("#familySeatsSubmit").disabled = true;
  });
});
$("#familyNameForm").addEventListener("submit", protectSubmission(saveFamilyName));
$("#inviteForm").addEventListener("submit", protectSubmission(inviteMember));
$("#obligationForm").addEventListener("submit", protectSubmission(saveObligation));
$("#recurrenceType").addEventListener("change", updateRecurrenceControls);
[$("#dueDay"), $("#startMonth"), $("#startYear")].forEach((field) => {
  field.addEventListener("change", syncPaymentStartDate);
});
$("#recordPaymentForm").addEventListener("submit", protectSubmission(savePaymentRecord));
$("#startOwnFamilyPlan").addEventListener("click", async () => {
  try {
    $("#workspacePlansTitle").scrollIntoView({ block: "start", behavior: "smooth" });
  } catch (error) {
    showToast(error.message);
  }
});
$("#recordPaymentPeriod").addEventListener("change", (event) => {
  const occurrence = state.recordPaymentOccurrenceChoices.find((choice) => choice.key === event.target.value);
  applyRecordPaymentOccurrence(occurrence, true);
});
$("#recordPaymentDialog").addEventListener("close", () => {
  state.recordPaymentOccurrenceChoices = [];
  $("#recordPaymentPeriod").innerHTML = "";
  $("#recordPaymentPeriodField").hidden = true;
});
$("#paymentHistoryDialog").addEventListener("close", () => {
  state.paymentHistoryItemId = null;
});
$("#recordPaymentType").addEventListener("change", (event) => {
  const amountInput = $("#recordAmount");
  const outstanding = Number($("#recordOutstanding").value || 0);
  const isFullPayment = event.target.value === "full";
  amountInput.readOnly = isFullPayment;
  amountInput.value = isFullPayment ? `${Number(outstanding.toFixed(4))}` : "";
  if (!isFullPayment) amountInput.focus();
});
$("#headForm").addEventListener("submit", protectSubmission(addHead));
$("#adminInvitationForm").addEventListener("submit", protectSubmission(sendAdminUserInvitation));
$("#adminInvitePlan").addEventListener("change", refreshAdminInvitationPlanFields);
$("#adminInviteBillingPeriod").addEventListener("change", refreshAdminInvitationPlanFields);
$("#adminInviteSubscriptionCurrency").addEventListener("change", refreshAdminInvitationQuote);
$("#adminInviteEnabledCurrencies").addEventListener("change", refreshAdminInvitationDefaultCurrency);
$("#adminInvitePaymentReceived").addEventListener("change", toggleAdminInvitationPaymentFields);
$("#paymentForm").addEventListener("submit", protectSubmission(addPlatformPayment));
$("#adminNoteForm").addEventListener("submit", protectSubmission(saveAdminNote));
$("#adminSupportTicketForm").addEventListener("submit", protectSubmission(createAdminSupportTicket));
$("#supportTicketForm").addEventListener("submit", protectSubmission(createUserSupportTicket));
$("#planDefinitionForm").addEventListener("submit", protectSubmission(savePlanDefinition));
$("#cancelPlanEditButton").addEventListener("click", resetPlanDefinitionForm);
$("#planPriceForm").addEventListener("submit", protectSubmission(savePlanPrice));
$("#workspaceCurrencySettingsForm").addEventListener("submit", protectSubmission(saveWorkspaceCurrencySettings));
$("#workspaceEnabledCurrencies").addEventListener("change", refreshWorkspaceCurrencyDependentOptions);
$("#workspaceCurrencySearch").addEventListener("input", renderWorkspaceCurrencyPicker);
$("#workspaceCurrencyOptions").addEventListener("change", (event) => {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (checkbox) setWorkspaceCurrencySelected(checkbox.value, checkbox.checked);
});
[$("#workspaceDefaultCurrency"), $("#workspaceReportingCurrency")].forEach((select) => {
  select.addEventListener("change", renderWorkspaceCurrencyPicker);
});
$("#adminCurrencySettingsForm").addEventListener("submit", protectSubmission(saveAdminFinanceCurrencySettings));
$("#adminEnabledCurrencies").addEventListener("change", refreshAdminCurrencyDependentOptions);
document.querySelectorAll("#adminFinanceCurrencyFilter, #adminFinanceStatusFilter, #adminFinanceTypeFilter, #adminFinanceFromDate, #adminFinanceToDate, #adminFinanceSearch").forEach((field) => {
  field.addEventListener(field.type === "search" ? "input" : "change", () => {
    renderAdminFinanceCurrencyPanel();
    renderPlatformPayments();
    renderSubscriptionReviews();
    renderSubscriptionPaymentHistory();
  });
});
document.querySelectorAll("#adminEnquirySearch, #adminEnquiryStatus, #adminEnquiryCountry").forEach((field) => {
  field.addEventListener(field.type === "search" ? "input" : "change", renderAdminEnquiries);
});
document.querySelectorAll("#adminSupportSearch, #adminSupportStatus, #adminSupportPriority").forEach((field) => {
  field.addEventListener(field.type === "search" ? "input" : "change", renderAdminSupport);
});
$("#syncExchangeRatesButton").addEventListener("click", syncExchangeRates);
$("#exportReportCsvButton").addEventListener("click", exportReportCsv);
$("#printReportButton").addEventListener("click", () => printCurrentView("reports"));
$("#exportAdminFinanceCsvButton").addEventListener("click", exportAdminFinanceCsv);
$("#printAdminFinanceButton").addEventListener("click", () => printCurrentView("admin-finance"));
$("#renewalForm").addEventListener("submit", protectSubmission(submitSubscriptionRenewal));
$("#renewalPlan").addEventListener("change", updateRenewalQuote);
$("#renewalPeriod").addEventListener("change", updateRenewalQuote);
$("#renewalCurrency").addEventListener("change", updateRenewalQuote);
document.querySelectorAll("[data-workspace-plan-period]").forEach((button) => {
  button.addEventListener("click", () => {
    state.workspacePlanBillingPeriod = button.dataset.workspacePlanPeriod;
    renderWorkspacePlans();
  });
});
$("#workspacePlanCurrency").addEventListener("change", (event) => {
  state.workspacePlanCurrency = event.target.value;
  renderWorkspacePlans();
});
$("#renewalFamilyMemberCount").addEventListener("change", updateRenewalQuote);
$("#renewalFamilyMemberCount").addEventListener("input", (event) => {
  const count = Number(event.target.value);
  const minimum = Number(event.target.min || 1);
  const maximum = Number(event.target.max || 100);
  if (Number.isInteger(count) && count >= minimum && count <= maximum) {
    updateRenewalQuote();
  }
});
$("#cancelEditObligationButton").addEventListener("click", () => $("#paymentItemDialog").close());
$("#paymentItemDialog").addEventListener("close", resetObligationForm);
$("#paymentScope").addEventListener("change", renderPaymentScope);
$("#inviteMemberDialog").addEventListener("close", () => {
  $("#inviteEmail").value = "";
  $("#inviteRole").value = "Adult";
});
$("#enablePushNotificationsButton").addEventListener("click", enablePushNotifications);
$("#sendTestPushButton").addEventListener("click", sendTestPushNotification);
$("#disablePushNotificationsButton").addEventListener("click", disablePushNotifications);
$("#adminEnablePushNotificationsButton").addEventListener("click", enablePushNotifications);
$("#adminSendTestPushButton").addEventListener("click", sendTestPushNotification);
$("#adminDisablePushNotificationsButton").addEventListener("click", disablePushNotifications);
$("#signOutButton").addEventListener("click", (event) => signOutSafely(event.currentTarget));
$("#adminSignOutButton").addEventListener("click", (event) => signOutSafely(event.currentTarget));
$("#suspendedSignOutButton").addEventListener("click", (event) => signOutSafely(event.currentTarget));
$("#obligationCurrencySearch").addEventListener("input", (event) => {
  renderPaymentCurrencyOptions(event.target.value, $("#obligationCurrency").value);
});
$("#paymentSearch").addEventListener("input", (event) => {
  state.paymentSearch = event.target.value;
  renderObligations();
});
$("#freePaymentChoices").addEventListener("change", (event) => {
  const input = event.target.closest("[data-free-payment-id]");
  if (!input || !state.freePaymentDraft) return;
  if (input.checked) state.freePaymentDraft.add(input.dataset.freePaymentId);
  else state.freePaymentDraft.delete(input.dataset.freePaymentId);
  const limit = Number(state.personalWorkspaceEntitlement?.active_payment_limit ?? 5);
  $("#freePaymentSelectionCount").textContent = `${state.freePaymentDraft.size} of ${limit} selected`;
  $("#saveFreePaymentSelection").disabled = state.freePaymentDraft.size !== limit;
});
$("#saveFreePaymentSelection").addEventListener("click", saveFreePaymentSelection);
$("#clearPaymentSearch").addEventListener("click", () => {
  state.paymentSearch = "";
  renderObligations();
  $("#paymentSearch").focus();
});
$("#paymentSort").addEventListener("change", (event) => {
  state.paymentSort = event.target.value;
  renderObligations();
});
$("#paymentSearchToggle").addEventListener("click", (event) => {
  const panel = $("#paymentSearchPanel");
  const expanded = event.currentTarget.getAttribute("aria-expanded") === "true";
  event.currentTarget.setAttribute("aria-expanded", `${!expanded}`);
  panel.classList.toggle("mobile-collapsed", expanded);
  if (!expanded) window.setTimeout(() => $("#paymentSearch").focus(), 0);
});
$("#paymentHead").addEventListener("change", (event) => {
  const option = event.target.selectedOptions[0];
  const amount = Number(option?.dataset.amount || 0);
  if (amount > 0) $("#paymentAmount").value = amount.toFixed(2);
  if (option?.dataset.currency) $("#paymentCurrency").value = option.dataset.currency;
});
$("#monthFilter").addEventListener("change", (event) => {
  state.filterMonth = event.target.value;
  resetDashboardDisclosureState();
  renderFamilyApp();
});
$("#reportMonthFilter").addEventListener("change", (event) => {
  state.reportMonth = event.target.value;
  renderReports();
});
$("#reportCurrencyFilter").addEventListener("change", (event) => {
  state.reportCurrencyFilter = event.target.value;
  renderReports();
});
$("#reportViewMode").addEventListener("change", (event) => {
  state.reportViewMode = event.target.value;
  renderReports();
});
$("#reportReportingCurrency").addEventListener("change", (event) => {
  state.reportReportingCurrency = event.target.value;
  renderReports();
});
$("#statusFilter").addEventListener("change", (event) => {
  state.filterStatus = event.target.value;
  resetDashboardDisclosureState();
  renderFamilyApp();
});
$("#adminHouseholdSearch").addEventListener("input", renderAdminFamilies);
document.querySelectorAll("#adminWorkspaceTypeFilter, #adminWorkspaceStatusFilter, #adminWorkspacePlanFilter, #adminWorkspaceSort").forEach((field) => {
  field.addEventListener("change", renderAdminFamilies);
});
$("#adminWorkspaceReset").addEventListener("click", () => {
  $("#adminHouseholdSearch").value = "";
  $("#adminWorkspaceTypeFilter").value = "all";
  $("#adminWorkspaceStatusFilter").value = "all";
  $("#adminWorkspacePlanFilter").value = "all";
  $("#adminWorkspaceSort").value = "newest";
  renderAdminFamilies();
});
$("#adminUserSearch").addEventListener("input", renderHeads);
$("#adminUserSearchReset").addEventListener("click", () => {
  $("#adminUserSearch").value = "";
  renderHeads();
  $("#adminUserSearch").focus();
});
document.querySelectorAll("[data-family-selector]").forEach((select) => {
  select.addEventListener("change", (event) => {
    selectFamily(event.target.value).catch((error) => showToast(error.message));
  });
});

window.addEventListener("hashchange", () => {
  applyRouteFromHash();
  if (state.isAdmin) {
    loadAdminData().then(renderAdmin).catch((error) => showToast(friendlyMessage(error?.message)));
  }
  if (state.session && !state.isAdmin) renderFamilyApp();
});

async function refreshAdminAnalytics() {
  if (!state.isAdmin || state.adminTab !== "analytics") return;
  try {
    await loadAdminData("analytics");
    renderAdminAnalytics();
  } catch (error) {
    console.warn("Admin analytics unavailable", error);
  }
}

document.querySelectorAll(".analytics-filters select").forEach((filter) => {
  filter.addEventListener("change", refreshAdminAnalytics);
});
$("#analyticsReset").addEventListener("click", () => {
  $("#analyticsPeriod").value = "30";
  ["#analyticsCountry", "#analyticsPlan", "#analyticsWorkspace", "#analyticsStatus", "#analyticsBilling", "#analyticsCurrency"]
    .forEach((selector) => { $(selector).value = ""; });
  refreshAdminAnalytics();
});

window.addEventListener("beforeunload", stopRealtime);
window.addEventListener("resize", scheduleDashboardTextFit);
window.addEventListener("focus", () => {
  refreshAfterAppResume("focus");
  schedulePushNotificationRefresh(false, true);
  void recordVisibleActivity();
});
window.addEventListener("pageshow", () => {
  refreshAfterAppResume("pageshow");
  schedulePushNotificationRefresh(false, true);
  void recordVisibleActivity();
});
window.addEventListener("online", () => {
  if (!state.session) return;
  startRealtime();
  refreshAfterAppResume("online");
  schedulePushNotificationRefresh(true, true);
  void recordVisibleActivity();
});
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    if (state.session && !state.isAdmin) renderSubscriptionTimeRemaining();
    refreshAfterAppResume("visibility");
    void recordVisibleActivity();
    schedulePushNotificationRefresh(false, true);
  }
});
window.setInterval(() => {
  if (document.visibilityState === "visible") {
    if (state.session && !state.isAdmin) renderSubscriptionTimeRemaining();
    schedulePushNotificationRefresh(false, true);
    void recordVisibleActivity();
  }
}, PUSH_REFRESH_INTERVAL_MS);

init().catch(handleLoadFailure);
