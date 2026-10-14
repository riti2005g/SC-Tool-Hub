// ============================================================
// SC Tool Hub — Core Application Logic
// SharePoint + Power Automate Backend
// ============================================================

// ── Utility Helpers ────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => r.querySelectorAll(s);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fmtDate = d => new Date(d).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const fmtSize = b => b > 1048576 ? (b / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(b / 1024)) + " KB";

// ── Navigation Definition ──────────────────────────────────────
const NAV = [
  ["home",    "Home",            "🏠", "home.html"],
  ["macros",  "Macro Files",     "📄", "macros.html"],
  ["bots",    "Automation Bots", "🤖", "bots.html"],
  ["ticket",  "Raise a Ticket",  "🎫", "ticket.html"],
  ["updates", "New Updates",     "📣", "updates.html"],
];

// ── Theme Initialization ───────────────────────────────────────
document.documentElement.dataset.theme = localStorage.getItem("theme") || "light";

// ── Session Management ─────────────────────────────────────────
const Session = {
  save(data) {
    const session = {
      ...data,
      expiresAt: Date.now() + (CFG.SESSION_HOURS * 3600000)
    };
    localStorage.setItem("sc_session", JSON.stringify(session));
  },
  get() {
    try {
      const s = JSON.parse(localStorage.getItem("sc_session"));
      if (!s || Date.now() > s.expiresAt) {
        this.clear();
        return null;
      }
      return s;
    } catch { return null; }
  },
  clear() {
    localStorage.removeItem("sc_session");
  },
  isAdmin() {
    const s = this.get();
    return s?.role === "admin";
  }
};

// ── API Client (calls Power Automate flows) ────────────────────
const API = {
  async call(flowUrl, action, data = {}) {
    const session = Session.get();
    const body = {
      action,
      ...data,
      ...(session ? { sessionToken: session.token, userId: session.userId } : {})
    };
    try {
      const res = await fetch(flowUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err) {
      console.error(`API error [${action}]:`, err);
      throw err;
    }
  },

  // Auth
  async login(email, password) {
    return this.call(CFG.FLOW_AUTH_URL, "login", { email, password });
  },
  async register(email, password, fullName) {
    return this.call(CFG.FLOW_AUTH_URL, "register", { email, password, fullName });
  },
  async resetPassword(email) {
    return this.call(CFG.FLOW_AUTH_URL, "resetPassword", { email });
  },
  async changePassword(newPassword) {
    return this.call(CFG.FLOW_AUTH_URL, "changePassword", { newPassword });
  },
  async updateProfile(fullName, department) {
    return this.call(CFG.FLOW_AUTH_URL, "updateProfile", { fullName, department });
  },

  // Files
  async listFiles() {
    return this.call(CFG.FLOW_FILES_URL, "list");
  },
  async uploadFile(file) {
    // For file uploads, use FormData
    const session = Session.get();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("action", "upload");
    formData.append("userId", session?.userId || "");
    formData.append("sessionToken", session?.token || "");

    const res = await fetch(CFG.FLOW_FILES_URL, {
      method: "POST",
      body: formData
    });
    if (!res.ok) throw new Error("Upload failed");
    return res.json();
  },
  async deleteFile(fileId) {
    return this.call(CFG.FLOW_FILES_URL, "delete", { fileId });
  },

  // Tickets
  async listTickets() {
    return this.call(CFG.FLOW_TICKETS_URL, "list");
  },
  async createTicket(ticket) {
    return this.call(CFG.FLOW_TICKETS_URL, "create", ticket);
  },
  async updateTicketStatus(ticketId, status, adminNotes) {
    return this.call(CFG.FLOW_TICKETS_URL, "updateStatus", { ticketId, status, adminNotes });
  },

  // Updates
  async listUpdates() {
    return this.call(CFG.FLOW_UPDATES_URL, "list");
  },
  async createUpdate(title, body) {
    return this.call(CFG.FLOW_UPDATES_URL, "create", { title, body });
  },

  // Admin
  async listUsers() {
    return this.call(CFG.FLOW_ADMIN_URL, "listUsers");
  },
  async updateUser(userId, changes) {
    return this.call(CFG.FLOW_ADMIN_URL, "updateUser", { targetUserId: userId, ...changes });
  },
  async getStats() {
    return this.call(CFG.FLOW_ADMIN_URL, "getStats");
  },
  async listAllTickets() {
    return this.call(CFG.FLOW_ADMIN_URL, "listAllTickets");
  },

  // Logs
  async log(action, details = "") {
    try {
      await this.call(CFG.FLOW_LOGS_URL, "log", {
        logAction: action,
        details,
        pageUrl: window.location.pathname,
        timestamp: new Date().toISOString()
      });
    } catch (e) {
      // Logging should never block the UI
      console.warn("Log failed:", e);
    }
  },
  async getLogs(filters = {}) {
    return this.call(CFG.FLOW_LOGS_URL, "list", filters);
  }
};

// ── Toast Notifications ────────────────────────────────────────
function showToast(message, type = "info", duration = 4000) {
  let container = $(".toast-container");
  if (!container) {
    container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  const icons = { success: "✅", error: "❌", info: "ℹ️" };
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ""}</span><span>${esc(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(80px)";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Shell Initialization (Layout Builder) ──────────────────────
async function initShell() {
  const session = Session.get();
  if (!session) {
    location.replace("login.html");
    return null;
  }

  const page = document.body.dataset.page;
  const name = session.fullName || session.email.split("@")[0];

  // Check for recent updates count (local fallback)
  let updatesBadge = "";
  try {
    const cached = JSON.parse(sessionStorage.getItem("sc_updates_count") || "0");
    if (cached > 0) updatesBadge = `<b>${cached}</b>`;
  } catch {}

  const c = $("#content");

  // Build the admin nav item if user is admin
  const adminNav = session.role === "admin"
    ? `<a href="admin.html" class="${page === "admin" ? "on" : ""}"><span>🛡️</span>Admin Panel</a>`
    : "";

  document.body.innerHTML = `
    <header class="top">
      <button class="burger" aria-label="Menu" id="bg">☰</button>
      <span class="logo">Danfoss</span>
      <h1>SC Supply Chain Tool Hub</h1>
      <a class="bell" href="updates.html" aria-label="Updates">🔔${updatesBadge}</a>
      <div class="user">
        <div class="av">${esc(name[0].toUpperCase())}</div>
        <span class="nm">${esc(name)}</span>
      </div>
    </header>
    <div class="layout">
      <div class="side-overlay" id="sov"></div>
      <nav class="side" id="sd">
        ${NAV.map(n => `<a href="${n[3]}" class="${n[0] === page ? "on" : ""}"><span>${n[2]}</span>${n[1]}</a>`).join("")}
        <div class="sp"></div>
        <hr>
        ${adminNav}
        <a href="settings.html" class="${page === "settings" ? "on" : ""}"><span>⚙️</span>Settings</a>
        <a href="#" id="lo"><span>🚪</span>Sign out</a>
      </nav>
      <div class="main">
        <footer class="foot">
          <span>🌐 Danfoss | SC Supply Chain Tool Hub v${CFG.APP_VERSION}</span>
          <span>Together for a sustainable tomorrow</span>
        </footer>
      </div>
    </div>`;

  $(".main").insertBefore(c, $(".foot"));

  // Burger / sidebar toggle
  const sidebar = $("#sd");
  const overlay = $("#sov");
  const closeSidebar = () => { sidebar.classList.remove("open"); overlay.classList.remove("show"); };
  $("#bg").onclick = () => {
    sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
  };
  overlay.onclick = closeSidebar;
  // Close sidebar on navigation
  $$(".side a").forEach(a => a.addEventListener("click", closeSidebar));

  // Sign out
  $("#lo").onclick = async e => {
    e.preventDefault();
    API.log("logout");
    Session.clear();
    sessionStorage.clear();
    location.replace("login.html");
  };

  return {
    user: { id: session.userId, email: session.email },
    profile: { full_name: session.fullName, department: session.department },
    name,
    isAdmin: session.role === "admin"
  };
}
