import "./style.css";

// 1. STABLE IMPORT (Avoids the 'Failed to resolve' error)
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";



// 2. DATABASE SETUP
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "";
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
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

// 3. APP STATE (Preserving your Role & Member logic)
const appState = {
  callings: [],
  members: [], // Loaded from your 'members' table [cite: 1]
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

function resolveFirstField(row, candidates, fallback) {
  for (const key of candidates) {
    if (Object.prototype.hasOwnProperty.call(row, key)) {
      return key;
    }
  }
  return fallback;
}

function resolveSettingApartByField(row) {
  return resolveFirstField(
    row,
    ["setting_apart_by", "sa_assign", "set_apart_by"],
    "setting_apart_by",
  );
}

function resolveSustainingByField(row) {
  return resolveFirstField(
    row,
    ["sustaining_by", "sus_assigned", "sus_assign", "sustain_by"],
    "sustaining_by",
  );
}

function resolveSettingApartDoneField(row) {
  return resolveFirstField(
    row,
    ["set_apart", "setting_apart_done", "sa_done", "set_apart_done"],
    "set_apart",
  );
}

function resolveLcrRecordedField(row) {
  return resolveFirstField(
    row,
    ["lcr_recorded", "recorded_in_lcr", "lcr_done"],
    "lcr_recorded",
  );
}

function isCompletedValue(value) {
  if (value == null) return false;
  if (typeof value === "boolean") return value;
  const text = String(value).toLowerCase().trim();
  return text !== "" && text !== "false" && text !== "0";
}

function normalizeStatusOptions(rows) {
  if (!Array.isArray(rows)) return [];

  const values = rows
    .map((row) => {
      if (!row || typeof row !== "object") return "";
      return (
        row.status ?? row.name ?? row.label ?? row.value ?? row.option ?? ""
      );
    })
    .map((value) => String(value).trim())
    .filter(Boolean);

  return [...new Set(values)];
}

function getAuthPasswordType() {
  return (localStorage.getItem("authPasswordType") || "").toLowerCase();
}

function hasAdminPasswordAccess() {
  return getAuthPasswordType() === "admin";
}

function isStakePasswordSession() {
  return getAuthPasswordType() === "stake";
}

function getAssignmentFieldCandidates() {
  return [
    "interview_by",
    "sustaining_by",
    "sus_assigned",
    "sus_assign",
    "sustain_by",
    "setting_apart_by",
    "sa_assign",
    "set_apart_by",
  ];
}

function normalizeComparableName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getSystemThemeMode() {
  if (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function"
  ) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return "light";
}

function getResolvedThemeMode(mode) {
  if (mode === "system") {
    return getSystemThemeMode();
  }

  return mode === "dark" ? "dark" : "light";
}

function applyThemeMode(mode) {
  const storedMode =
    mode === "dark" || mode === "light" || mode === "system"
      ? mode
      : "system";

  const resolvedMode = getResolvedThemeMode(storedMode);

  appState.themeMode = storedMode;

  if (typeof document !== "undefined") {
    document.body.classList.toggle("dark-mode", resolvedMode === "dark");
  }

  localStorage.setItem("themeMode", storedMode);
}

if (typeof window !== "undefined") {
  const themeMediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  const handleSystemThemeChange = () => {
    if (appState.themeMode === "system") {
      applyThemeMode("system");
      renderHeader();
    }
  };

  if (typeof themeMediaQuery.addEventListener === "function") {
    themeMediaQuery.addEventListener("change", handleSystemThemeChange);
  } else if (typeof themeMediaQuery.addListener === "function") {
    themeMediaQuery.addListener(handleSystemThemeChange);
  }

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
  const currentUser = normalizeComparableName(
    localStorage.getItem("currentUser"),
  );
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

function formatReportHeader(title, count) {
  return `${title}\n${"=".repeat(title.length)}\nItems: ${count}`;
}

function buildAwaitingShcReport(rows) {
  const awaiting = rows.filter(
    (row) =>
      isCompletedValue(row.sp_approved) &&
      !isCompletedValue(row.hc_sustained) &&
      String(row.status || "")
        .toLowerCase()
        .trim() !== "archived",
  );

  if (!awaiting.length) {
    return `${formatReportHeader("Calls/Releases Awaiting HC Sustaining", 0)}\n\nNo calls or releases are currently awaiting High Council sustaining.`;
  }

  const body = awaiting
    .map((row, index) => {
      const itemType = String(row.type || "CALL").toUpperCase();
      return `${index + 1}. [${itemType}] ${row.name || "(No name)"} — ${row.position || "(No position)"} (${row.unit || "No unit"})`;
    })
    .join("\n");

  return `${formatReportHeader("Calls/Releases Awaiting HC Sustaining", awaiting.length)}\n\n${body}`;
}

function buildAssignmentsByPersonReport(rows) {
  const grouped = new Map();

  rows.forEach((row) => {
    getAssignmentFieldCandidates().forEach((field) => {
      const person = String(row[field] || "").trim();
      if (!person) return;

      const existing = grouped.get(person) || [];
      existing.push(
        `${row.name || "(No name)"} — ${row.position || "(No position)"} [${field}]`,
      );
      grouped.set(person, existing);
    });
  });

  if (!grouped.size) {
    return `${formatReportHeader("Assignments by Person", 0)}\n\nNo assignments found.`;
  }

  const sections = [...grouped.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([person, items]) => {
      const lines = items.map((item) => `  - ${item}`).join("\n");
      return `${person}\n${lines}`;
    })
    .join("\n\n");

  return `${formatReportHeader("Assignments by Person", grouped.size)}\n\n${sections}`;
}

function buildStatusSummaryReport(rows) {
  const counts = new Map();

  rows.forEach((row) => {
    const status = String(row.status || "In Progress").trim() || "In Progress";
    counts.set(status, (counts.get(status) || 0) + 1);
  });

  const lines = [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([status, count]) => `- ${status}: ${count}`)
    .join("\n");

  return `${formatReportHeader("Status Summary", rows.length)}\n\n${lines || "No callings found."}`;
}

function buildUnassignedAssignmentsReport(rows) {
  const steps = [
    {
      label: "Interview",
      fields: ["interview_by"],
      appliesTo: () => true,
    },
    {
      label: "Sustaining",
      fields: ["sustaining_by", "sus_assigned", "sus_assign", "sustain_by"],
      appliesTo: (row) => String(row.type || "").toUpperCase() !== "RELEASE",
    },
    {
      label: "Setting Apart",
      fields: ["setting_apart_by", "sa_assign", "set_apart_by"],
      appliesTo: (row) => String(row.type || "").toUpperCase() !== "RELEASE",
    },
  ];

  const grouped = new Map();
  steps.forEach((step) => grouped.set(step.label, []));

  rows.forEach((row) => {
    steps.forEach((step) => {
      if (!step.appliesTo(row)) return;

      const hasAssignment = step.fields.some((field) =>
        String(row[field] || "").trim(),
      );

      if (!hasAssignment) {
        grouped
          .get(step.label)
          .push(
            `[${String(row.type || "CALL").toUpperCase()}] ${row.name || "(No name)"} — ${row.position || "(No position)"} (${row.unit || "No unit"})`,
          );
      }
    });
  });

  const totalMissing = [...grouped.values()].reduce(
    (sum, items) => sum + items.length,
    0,
  );

  if (!totalMissing) {
    return `${formatReportHeader("Assignments Not Yet Made", 0)}\n\nAll applicable assignments have been made.`;
  }

  const sections = steps
    .map((step) => {
      const items = grouped.get(step.label) || [];
      if (!items.length) {
        return `${step.label} (0)\n  - None`;
      }

      const lines = items.map((item) => `  - ${item}`).join("\n");
      return `${step.label} (${items.length})\n${lines}`;
    })
    .join("\n\n");

  return `${formatReportHeader("Assignments Not Yet Made", totalMissing)}\n\n${sections}`;
}

function buildSustainSetApartReleaseReport(rows) {
  // Get all units from the calling records
  const unitsSet = new Set(rows.map((r) => r.unit).filter(Boolean));
  const units = Array.from(unitsSet).sort();

  // Separate releases and callings that need sustaining/setapart
  const releases = rows.filter(
    (row) =>
      String(row.type || "").toUpperCase() === "RELEASE" &&
      String(row.status || "")
        .toLowerCase()
        .trim() !== "archived",
  );

  const toSustain = rows.filter(
    (row) =>
      String(row.type || "").toUpperCase() !== "RELEASE" &&
      String(row.status || "").trim() === "In Progress" &&
      isCompletedValue(row.interviewed) &&
      (isCompletedValue(row.sp_approved) || isCompletedValue(row.hc_sustained)),
  );

  // Build unit reports - releases first, then callings
  const reportSections = [];

  // Process Stake business first (if any Stake items exist)
  const stakeReleases = releases.filter((r) => r.unit === "Stake");
  const stakeToSustain = toSustain.filter((r) => r.unit === "Stake");

  if (stakeReleases.length > 0 || stakeToSustain.length > 0) {
    reportSections.push(
      buildUnitSection("STAKE BUSINESS", stakeReleases, stakeToSustain),
    );
  }

  // Then process each other unit
  for (const unit of units) {
    if (unit === "Stake") continue; // Already processed above

    const unitReleases = releases.filter((r) => r.unit === unit);
    const unitToSustain = toSustain.filter((r) => r.unit === unit);

    if (unitReleases.length > 0 || unitToSustain.length > 0) {
      reportSections.push(
        buildUnitSection(unit.toUpperCase(), unitReleases, unitToSustain),
      );
    }
  }

  const totalItems = releases.length + toSustain.length;
  if (reportSections.length === 0) {
    return `${formatReportHeader("Sustain, Set Apart, and Release Report", 0)}\n\nNo members require sustaining, setting apart, or release at this time.`;
  }

  return `${formatReportHeader("Sustain, Set Apart, and Release Report", totalItems)}\n\n${reportSections.join("\n\n")}`;
}

function buildUnitSection(unitTitle, releases, toSustain) {
  const lines = [];
  lines.push(`${unitTitle}`);
  lines.push("-".repeat(unitTitle.length));

  // Releases first (with vote of thanks)
  if (releases.length > 0) {
    lines.push("RELEASE - Vote of Thanks for Service:");
    releases.forEach((row, index) => {
      lines.push(
        `  ${index + 1}. ${row.name || "(No name)"} — ${row.position || "(No position)"}`,
      );
    });
    lines.push("");
  }

  // Callings to sustain and set apart
  if (toSustain.length > 0) {
    lines.push("TO BE SUSTAINED:");
    toSustain.forEach((row, index) => {
      lines.push(
        `  ${index + 1}. ${row.name || "(No name)"} — ${row.position || "(No position)"}`,
      );
    });
  }

  return lines.join("\n");
}

function generateReport(type) {
  const rows = getVisibleCallings();

  if (type === "sustain-setapart-release") {
    return buildSustainSetApartReleaseReport(rows);
  }

  if (type === "unassigned-assignments") {
    return buildUnassignedAssignmentsReport(rows);
  }

  if (type === "assignments-by-person") {
    return buildAssignmentsByPersonReport(rows);
  }

  if (type === "status-summary") {
    return buildStatusSummaryReport(rows);
  }

  return buildAwaitingShcReport(rows);
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
    : `<p class="report-summary">Choose a report type and click Generate Report.</p>`;

  const actionButtons = appState.reportOutput
    ? `
      <button class="btn btn-secondary" onclick="window.copyReportToClipboard()">📋 Copy Report</button>
      <button class="btn btn-secondary" onclick="window.printReport()">🖨️ Print Report</button>
    `
    : "";

  reportsPage.innerHTML = `
    <section class="reports-header">
      <h2>Reports</h2>
      <p>Construct summary reports from visible callings.</p>
    </section>

    <section class="report-actions">
      <label class="field-label" for="report-type">Report type</label>
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

function canUpdateAssignmentField(field) {
  const assignmentFields = new Set(getAssignmentFieldCandidates());

  if (!assignmentFields.has(field)) {
    return true;
  }

  return hasAdminPasswordAccess();
}

// 4. CORE LOGIC
async function startApp() {
  const app = document.getElementById("app");

  const savedThemeMode = localStorage.getItem("themeMode") || "system";
  applyThemeMode(savedThemeMode);

  if (!supabase) {
    showFatalError(
      "Missing configuration",
      "VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set for this build.",
    );
    return;
  }

  // Validate passwords are configured
  const stakePw = import.meta.env.VITE_STAKE_PW || "";
  const adminPw = import.meta.env.VITE_ADMIN_PW || "";
  if (!stakePw || !adminPw) {
    showFatalError(
      "Missing configuration",
      "VITE_STAKE_PW and VITE_ADMIN_PW must be set for this build.",
    );
    return;
  }

  // Fetch members and status options from database
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
    appState.assignableNames = members
      .filter((m) => m.role !== "viewer")
      .map((m) => m.name);
  }

  if (statusError) {
    console.warn("Could not load status options:", statusError.message);
  }

  appState.statusOptions = normalizeStatusOptions(statusRows);

  const isLoggedIn = localStorage.getItem("isLoggedIn");
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

// 5. LOGIN LOGIC (Restoring the Admin/Stake Password logic )
window.login = async function (e) {
  e.preventDefault();
  const formData = new FormData(e.target);
  const selectedName = formData.get("authName");
  const enteredPassword = formData.get("authPassword");

  // 1. Load master passwords from environment variables
  // They will be injected via GitHub Secrets at build time on GitHub Pages
  // or from .env locally during development
  const STAKE_PW = import.meta.env.VITE_STAKE_PW || "";
  const ADMIN_PW = import.meta.env.VITE_ADMIN_PW || "";

  // 2. Find the person in your loaded appState.members
  const person = appState.members.find((m) => m.name === selectedName);

  if (!person) {
    alert("Please select a name from the list first!");
    return;
  }

  // 3. Resolve required password type robustly.
  // Prefer explicit shared_password_type, but fall back to role when needed.
  const sharedPasswordType = String(person.shared_password_type ?? "")
    .toLowerCase()
    .trim();
  const roleType = String(person.role ?? "")
    .toLowerCase()
    .trim();

  const isAdminType =
    sharedPasswordType.includes("admin") ||
    (!sharedPasswordType && roleType.includes("admin"));

  const requiredType = isAdminType ? "admin" : "stake";
  const correctPassword = isAdminType ? ADMIN_PW : STAKE_PW;

  // DEBUG LOG - Open your console (F12) to see this!
  console.log(
    `[Stake Callings] Logging in as: ${selectedName} | role=${roleType || "(none)"} | shared_password_type=${sharedPasswordType || "(none)"} | expects=${requiredType}`,
  );

  if (enteredPassword.trim() === correctPassword) {
    localStorage.setItem("isLoggedIn", "true");
    localStorage.setItem("currentUser", person.name);
    localStorage.setItem("userRole", person.role); // Sets 'admin', 'assign', or 'viewer'
    localStorage.setItem("authPasswordType", requiredType);
    window.location.reload();
  } else {
    alert(
      `Access Denied. For ${selectedName}, you must use the ${requiredType} password.`,
    );
  }
};
// 6. UI RENDERING (White Cards / Blue Blocks)
function renderCards() {
  const list = document.getElementById("data-list");
  if (!list) return;

  const reportsPage = document.getElementById("reports-page");
  if (reportsPage) {
    reportsPage.classList.add("hidden");
  }

  list.classList.remove("hidden");

  const rowsToRender = getSortedVisibleCallings();

  if (!rowsToRender.length) {
    list.innerHTML = `
      <article class="card">
        <div style="padding: 25px; text-align: center; color: #666;">
          No assigned callings to display.
        </div>
      </article>
    `;
    return;
  }

  list.innerHTML = rowsToRender
    .map((row) => {
      const canAssign = hasAdminPasswordAccess();
      const isExpanded = appState.expandedGridId === row.id;
      const isRelease = row.type?.toUpperCase() === "RELEASE";
      const sustainingByField = resolveSustainingByField(row);
      const sustainingBy = row[sustainingByField] || "";
      const settingApartByField = resolveSettingApartByField(row);
      const settingApartDoneField = resolveSettingApartDoneField(row);
      const lcrRecordedField = resolveLcrRecordedField(row);
      const settingApartBy = row[settingApartByField] || "";
      const settingApartDone = isCompletedValue(row[settingApartDoneField]);
      const lcrRecorded = isCompletedValue(row[lcrRecordedField]);
      const currentStatus = (row.status || "In Progress").trim();
      const statusOptions = [...appState.statusOptions];
      if (currentStatus && !statusOptions.includes(currentStatus)) {
        statusOptions.unshift(currentStatus);
      }
      const visibleStatusOptions = hasAdminPasswordAccess()
        ? statusOptions
        : statusOptions.filter(
            (status) => status.toLowerCase().trim() !== "archived",
          );

      return `
      <article class="card">
        <div style="background: ${isRelease ? "var(--banner-release-bg)" : "var(--banner-call-bg)"}; 
        padding: 10px; text-align: center; font-weight: 900; color: ${isRelease ? "var(--banner-release-text)" : "var(--banner-call-text)"};">
          ${isRelease ? "RELEASE" : "CALLING"}
        </div>

        <div style="padding: 18px;">
          <h2
            class="editable-field"
            title="Click to edit name"
            onclick="window.editCardField('${row.id}', 'name')"
            style="margin: 0; font-size: 1.6rem;"
          >${escapeHtml(row.name || "")}</h2>
          <p
            class="editable-field"
            title="Click to edit