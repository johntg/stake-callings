// John Harford, April 2016

import "./style.css";
import {
  getCurrentUserName,
  getRequiredPasswordType,
  hasAdminPasswordAccess,
  isLoggedInSession,
  isStakePasswordSession,
  setSessionAfterLogin,
} from "./auth/session.js";
import {
  applyThemeMode,
  getSavedThemeMode,
  setupSystemThemeChangeListener,
} from "./ui/theme-controls.js";
import {
  renderHeader as renderHeaderUi,
  syncFabVisibility as syncFabVisibilityUi,
} from "./ui/header-controls.js";
import {
  closeCreateCallingModal as closeCreateCallingModalUi,
  ensureCreateCallingUi as ensureCreateCallingUiUi,
  openCreateCallingModal as openCreateCallingModalUi,
  submitNewCalling as submitNewCallingUi,
} from "./ui/create-calling.js";
import { createCardsRenderer } from "./ui/cards-renderer.js";
import { createCallingsActions } from "./actions/callings-actions.js";
import { generateReport } from "./reports/index.js";
import {
  escapeHtml,
  getAssignmentFieldCandidates,
  isCompletedValue,
  normalizeComparableName,
  normalizeStatusOptions,
  resolveLcrRecordedField,
  resolveSettingApartByField,
  resolveSettingApartDoneField,
  resolveSustainingByField,
} from "./utils/app-utils.js";

// 1. STABLE IMPORT (Avoids the 'Failed to resolve' error)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

// 2. DATABASE SETUP
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const archiveTableName = import.meta.env.VITE_ARCHIVE_TABLE || "archive";
const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

if (import.meta.env.DEV && typeof window !== "undefined") {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });
  }

  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys.forEach((key) => caches.delete(key));
    });
  }
}

if (!import.meta.env.DEV && typeof window !== "undefined") {
  const isGitHubPages = window.location.hostname.endsWith("github.io");
  if (isGitHubPages) {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.getRegistrations().then((registrations) => {
        registrations.forEach((registration) => registration.unregister());
      });
    }

    if ("caches" in window) {
      caches.keys().then((keys) => {
        keys
          .filter(
            (key) =>
              key.includes("stake-callings") ||
              key.includes("DB-Stake-Callings"),
          )
          .forEach((key) => caches.delete(key));
      });
    }
  }
}

// 3. APP STATE
const appState = {
  callings: [],
  members: [],
  assignableNames: [],
  statusOptions: [],
  themeMode: "system",
  cardSortOrder: "newest",
  currentPage: "callings",
  currentReportType: "awaiting-shc",
  reportOutput: "",
  units: [
    "Allenton Ward",
    "Ashburton Ward",
    "Avon River Ward",
    "Cashmere Ward",
    "Hagley Ward",
    "Mona Vale Ward",
    "Rangiora Ward",
    "Riccarton Ward",
    "Stake",
  ],
  expandedGridId: null,
  expandedSustainingIds: new Set(),
  showAllCallingsForStake: false,
  activeInlineEdit: null,
};

function showFatalError(title, message) {
  if (typeof document === "undefined") {
    return;
  }

  const app = document.getElementById("app");
  if (!app) {
    return;
  }

  app.innerHTML = `
    <div class="card" style="padding: 20px; margin-top: 20px;">
      <h2 style="margin-top: 0;">${escapeHtml(title)}</h2>
      <p style="margin-bottom: 8px;">${escapeHtml(message)}</p>
    </div>
  `;
}

function canAssignMember(member) {
  if (!member || typeof member !== "object") {
    return false;
  }

  const role = String(member.role ?? "").toLowerCase();
  return role.includes("assign");
}

if (typeof window !== "undefined") {
  setupSystemThemeChangeListener(appState, () => {
    applyThemeMode("system", appState);
    renderHeader();
  });

  window.addEventListener("error", (event) => {
    const message = event?.error?.message || event?.message || "Unknown error";
    console.error("Fatal runtime error:", event?.error || event);
    showFatalError("Application error", message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason = event?.reason;
    const message =
      reason?.message ||
      (typeof reason === "string" ? reason : "Unhandled async error");
    console.error("Unhandled promise rejection:", reason);
    showFatalError("Application error", message);
  });
}

function isAssignedToCurrentUser(row) {
  const currentUser = normalizeComparableName(getCurrentUserName());
  if (!currentUser) return false;

  return getAssignmentFieldCandidates().some((field) => {
    const assignedTo = normalizeComparableName(row[field]);
    return assignedTo && assignedTo === currentUser;
  });
}

function getVisibleCallings() {
  return isStakePasswordSession() && !appState.showAllCallingsForStake
    ? appState.callings.filter((row) => isAssignedToCurrentUser(row))
    : appState.callings;
}

function getSortedVisibleCallings() {
  const rows = [...getVisibleCallings()];

  rows.sort((a, b) => {
    const aTime = new Date(a?.created_at || a?.timestamp || 0).getTime();
    const bTime = new Date(b?.created_at || b?.timestamp || 0).getTime();
    return appState.cardSortOrder === "oldest" ? aTime - bTime : bTime - aTime;
  });

  return rows;
}

function renderReportsPage() {
  const list = document.getElementById("data-list");
  const reportsPage = document.getElementById("reports-page");
  if (!reportsPage) return;

  if (list) {
    list.classList.add("hidden");
  }

  reportsPage.classList.remove("hidden");

  const reportValue = appState.reportOutput
    ? `<pre class="report-summary">${escapeHtml(appState.reportOutput)}</pre>`
    : `<p class="report-summary"></p>`;

  const actionButtons = appState.reportOutput
    ? `
      <button class="btn btn-secondary" onclick="window.copyReportToClipboard()">📋 Copy Report</button>
      <button class="btn btn-secondary" onclick="window.printReport()">🖨️ Print Report</button>
    `
    : "";

  reportsPage.innerHTML = `
    <section class="reports-header">
      <h2>Reports</h2>
      <p>SELECT REPORT THEN GENERATE</p>
    </section>

    <section class="report-actions">
    
      <select id="report-type" onchange="window.selectReportType(this.value)">
        <option value="sustain-setapart-release" ${appState.currentReportType === "sustain-setapart-release" ? "selected" : ""}>Sustain, Set Apart, and Release</option>
        <option value="awaiting-shc" ${appState.currentReportType === "awaiting-shc" ? "selected" : ""}>Calls/Releases Awaiting HC Sustaining</option>
        <option value="unassigned-assignments" ${appState.currentReportType === "unassigned-assignments" ? "selected" : ""}>Assignments Not Yet Made</option>
        <option value="assignments-by-person" ${appState.currentReportType === "assignments-by-person" ? "selected" : ""}>Assignments by Person</option>
        <option value="status-summary" ${appState.currentReportType === "status-summary" ? "selected" : ""}>Status Summary</option>
      </select>
      <button class="btn btn-primary" onclick="window.generateCurrentReport()">Generate Report</button>
    </section>

    <article class="card report-card">
      ${reportValue}
      ${actionButtons}
    </article>
  `;
}

function renderCurrentPage() {
  syncFabVisibility();

  if (appState.currentPage === "reports") {
    renderReportsPage();
    return;
  }

  renderCards();
}

async function archiveCallingRecord(id, options = {}) {
  const { confirm = true } = options;

  if (!hasAdminPasswordAccess()) {
    alert("Archiving requires signing in with the admin password.");
    renderCurrentPage();
    return false;
  }

  const item = appState.callings.find((calling) => calling.id === id);
  if (!item) {
    alert("Could not find this item to archive.");
    renderCurrentPage();
    return false;
  }

  const isDeleteMistake = item.status === "Mistake: DELETE";

  if (confirm) {
    const message = isDeleteMistake
      ? `This item is marked "Mistake: DELETE".\n\nName: ${item.name || "(no name)"}\n\nPress OK to permanently remove it from the database.\nThis cannot be undone.`
      : "Archive this item?";

    const confirmed = window.confirm(message);

    if (!confirmed) {
      renderCurrentPage();
      return false;
    }
  }

  let error;

  if (isDeleteMistake) {
    const result = await supabase.rpc("delete_calling_permanently", {
      row_id: id,
    });
    error = result.error;

    if (error) {
      console.error("Permanent delete RPC error:", error);
      alert(`Failed to permanently delete item: ${error.message}`);
      renderCurrentPage();
      return false;
    }
  } else {
    const result = await supabase.rpc("move_calling_to_archive", {
      row_id: id,
    });
    error = result.error;

    if (error) {
      console.error("Archive RPC error:", error);
      alert(`Failed to archive item: ${error.message}`);
      renderCurrentPage();
      return false;
    }
  }

  appState.callings = appState.callings.filter((calling) => calling.id !== id);

  renderCurrentPage();
  return true;
}

async function startApp() {
  const app = document.getElementById("app");

  const savedThemeMode = getSavedThemeMode();
  applyThemeMode(savedThemeMode, appState);

  if (!supabase) {
    showFatalError(
      "Missing configuration",
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for this build.",
    );
    return;
  }

  const stakePw = import.meta.env.VITE_STAKE_PW || "";
  const adminPw = import.meta.env.VITE_ADMIN_PW || "";
  if (!stakePw || !adminPw) {
    showFatalError(
      "Missing configuration",
      "VITE_STAKE_PW and VITE_ADMIN_PW must be set for this build.",
    );
    return;
  }

  const [membersResult, statusesResult] = await Promise.all([
    supabase.from("members").select("*"),
    supabase.from("status_options").select("*"),
  ]);

  const { data: members, error } = membersResult;
  const { data: statusRows, error: statusError } = statusesResult;

  if (error) {
    console.error("Error fetching members:", error);
    alert(`Database Error: ${error.message}`);
    showFatalError(
      "Could not load app data",
      `The app could not fetch members from Supabase. ${error.message}`,
    );
    return;
  }

  if (members) {
    appState.members = members;
    appState.assignableNames = [
      ...new Set(
        members
          .filter((member) => canAssignMember(member))
          .map((member) => String(member.name ?? "").trim())
          .filter(Boolean),
      ),
    ];
  }

  if (statusError) {
    console.warn("Could not load status options:", statusError.message);
  }

  appState.statusOptions = normalizeStatusOptions(statusRows);

  const isLoggedIn = isLoggedInSession();
  if (isLoggedIn) {
    await fetchCallings();
    renderHeader();
    renderCurrentPage();
  } else {
    renderLogin();
  }
}

async function fetchCallings() {
  const { data, error } = await supabase
    .from("callings")
    .select("*")
    .order("created_at", { ascending: false });
  if (!error) appState.callings = data;
}

const cardsRenderer = createCardsRenderer({
  appState,
  getSortedVisibleCallings,
  hasAdminPasswordAccess,
  resolveSustainingByField,
  resolveSettingApartByField,
  resolveSettingApartDoneField,
  resolveLcrRecordedField,
  isCompletedValue,
  escapeHtml,
});

window.login = async function (e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const selectedName = formData.get("authName");
  const enteredPassword = formData.get("authPassword");

  const STAKE_PW = import.meta.env.VITE_STAKE_PW || "";
  const ADMIN_PW = import.meta.env.VITE_ADMIN_PW || "";

  const person = appState.members.find((m) => m.name === selectedName);

  if (!person) {
    alert("Please select a name from the list first!");
    return;
  }

  const sharedPasswordType = String(person.shared_password_type ?? "")
    .toLowerCase()
    .trim();

  const requiredType = getRequiredPasswordType(sharedPasswordType);
  const correctPassword = requiredType === "admin" ? ADMIN_PW : STAKE_PW;

  console.log(
    `[Stake Callings] Logging in as: ${selectedName} | shared_password_type=${sharedPasswordType || "(none)"} | expects=${requiredType}`,
  );

  if (enteredPassword.trim() === correctPassword) {
    setSessionAfterLogin({
      userName: person.name,
      userRole: person.role,
      passwordType: requiredType,
    });
    window.location.reload();
  } else {
    alert(
      `Access Denied. For ${selectedName}, you must use the ${requiredType} password ${ADMIN_PW}::: ${enteredPassword}.`,
    );
  }
};

function renderCards() {
  cardsRenderer.renderCards();
}

const callingsActions = createCallingsActions({
  appState,
  supabase,
  hasAdminPasswordAccess,
  getAssignmentFieldCandidates,
  renderCards,
  renderCurrentPage,
  archiveCallingRecord,
});

window.toggleDetails = (id) => callingsActions.toggleDetails(id);

window.toggleSustainingUnits = (id) =>
  callingsActions.toggleSustainingUnits(id);

window.updateSustainedUnits = async (id, unitName) =>
  callingsActions.updateSustainedUnits(id, unitName);

window.updateAssignment = async (id, field, value) =>
  callingsActions.updateAssignment(id, field, value);

window.startInlineEdit = (id, field) =>
  callingsActions.startInlineEdit(id, field);

window.cancelInlineEdit = () => callingsActions.cancelInlineEdit();

window.handleInlineEditKeyup = (event, id, field) =>
  callingsActions.handleInlineEditKeyup(event, id, field);

window.commitInlineEdit = async (id, field, nextValue) =>
  callingsActions.commitInlineEdit(id, field, nextValue);

window.archiveCalling = async (id) => callingsActions.archiveCalling(id);

window.updateField = async (id, field, value) =>
  callingsActions.updateField(id, field, value);

window.toggleCallingScope = () => {
  if (!isStakePasswordSession()) {
    return;
  }

  appState.showAllCallingsForStake = !appState.showAllCallingsForStake;
  renderHeader();
  renderCurrentPage();
};

window.togglePage = () => {
  appState.currentPage =
    appState.currentPage === "callings" ? "reports" : "callings";
  renderHeader();
  renderCurrentPage();
};

window.toggleCardSortOrder = () => {
  appState.cardSortOrder =
    appState.cardSortOrder === "newest" ? "oldest" : "newest";
  renderHeader();
  renderCurrentPage();
};

window.selectReportType = (value) => {
  appState.currentReportType = value;
};

window.generateCurrentReport = () => {
  appState.reportOutput = generateReport(
    appState.currentReportType,
    getVisibleCallings(),
  );
  renderReportsPage();
};

window.copyReportToClipboard = async () => {
  if (!appState.reportOutput) {
    alert("No report to copy.");
    return;
  }

  try {
    await navigator.clipboard.writeText(appState.reportOutput);
    alert("Report copied to clipboard!");
  } catch (err) {
    console.error("Failed to copy report:", err);
    alert("Failed to copy report to clipboard. Please try again.");
  }
};

window.printReport = () => {
  if (!appState.reportOutput) {
    alert("No report to print.");
    return;
  }

  const printWindow = window.open("", "", "width=800,height=600");
  printWindow.document.write(`
    <html>
      <head>
        <title>Report</title>
        <style>
          body {
            font-family: monospace;
            padding: 20px;
            line-height: 1.5;
          }
          pre {
            white-space: pre-wrap;
            word-wrap: break-word;
          }
        </style>
      </head>
      <body>
        <pre>${escapeHtml(appState.reportOutput)}</pre>
        
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.print();
};

window.resetCacheAndReload = async () => {
  const confirmed = window.confirm(
    "Reset app cache and reload now? This will sign you out.",
  );
  if (!confirmed) return;

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(
        registrations.map((registration) => registration.unregister()),
      );
    }

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch (error) {
    console.warn("Cache reset encountered an issue:", error);
  }

  localStorage.clear();
  window.location.reload();
};

function renderLogin() {
  document.getElementById("app").innerHTML = `
    <div class="login-container">
      <div class="login-card">
        <h2>Sign In</h2>
        <form onsubmit="window.login(event)">
          <select name="authName" required>
            <option value="">Select Name...</option>
            ${appState.members.map((m) => `<option value="${m.name}">${m.name}</option>`).join("")}
          </select>
          <input id="pw-input" type="password" name="authPassword" placeholder="Password" required>
          <label>
            <input
              type="checkbox"
              onchange="document.getElementById('pw-input').type = this.checked ? 'text' : 'password'"
            >
            Show password
          </label>
          <button type="submit">Login</button>
        </form>
      </div>
    </div>
  `;

  syncFabVisibility();
}

function syncFabVisibility() {
  syncFabVisibilityUi({
    hasAdminPasswordAccess,
    isLoggedInSession,
    onResetCache: () => window.resetCacheAndReload(),
  });
}

function ensureCreateCallingUi() {
  ensureCreateCallingUiUi({
    appState,
    escapeHtml,
    syncFabVisibility,
    onOpenCreateCallingModal: () => window.openCreateCallingModal(),
    onCloseCreateCallingModal: () => window.closeCreateCallingModal(),
  });
}

window.openCreateCallingModal = () => {
  openCreateCallingModalUi({ hasAdminPasswordAccess });
};

window.closeCreateCallingModal = () => {
  closeCreateCallingModalUi({});
};

window.submitNewCalling = async (event) => {
  await submitNewCallingUi({
    event,
    hasAdminPasswordAccess,
    supabase,
    appState,
    fetchCallings,
    closeCreateCallingModal: () => window.closeCreateCallingModal(),
    renderCurrentPage,
  });
};

window.setThemeMode = (mode) => {
  applyThemeMode(mode, appState);
  renderHeader();
};

function renderHeader() {
  renderHeaderUi({
    appState,
    isStakePasswordSession,
    ensureCreateCallingUi,
  });
}

startApp().catch((error) => {
  console.error("Failed to start app:", error);
  showFatalError(
    "Failed to start app",
    error?.message || "Unexpected startup error.",
  );
});
