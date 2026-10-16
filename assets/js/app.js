// ============================================================
// SC Tool Hub — Core Application Logic
// Enterprise SharePoint + Power Automate Backend
// ============================================================

// ── Utility Helpers ────────────────────────────────────────────
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => r.querySelectorAll(s);

// High-security HTML character escaping for XSS prevention
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[c]));

const fmtDate = d => {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return String(d);
  }
};

const fmtSize = b => {
  const num = Number(b);
  if (isNaN(num) || num <= 0) return "—";
  return num > 1048576 
    ? (num / 1048576).toFixed(1) + " MB" 
    : Math.max(1, Math.round(num / 1024)) + " KB";
};

// Ensures relative SharePoint URLs work on GitHub Pages
const getDownloadUrl = url => {
  if (!url) return "#";
  const clean = String(url).trim();
  if (clean.startsWith("http://") || clean.startsWith("https://")) return clean;
  if (clean.startsWith("/")) {
    try {
      const origin = new URL(CFG.SHAREPOINT_SITE_URL || "https://danfoss.sharepoint.com").origin;
      return `${origin}${clean}`;
    } catch {
      return `https://danfoss.sharepoint.com${clean}`;
    }
  }
  return clean;
};

// ── Navigation Definition ──────────────────────────────────────
const NAV = [
  ["home",    "Home",            "🏠", "home.html"],
  ["macros",  "Macro Files",     "📊", "macros.html"],
  ["bots",    "Automation Bots", "🤖", "bots.html"],
  ["ticket",  "Raise a Ticket",  "🎫", "ticket.html"],
  ["updates", "New Updates",     "📣", "updates.html"],
];

// ── Theme Initialization ───────────────────────────────────────
const applyTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
  const themeBtn = $("#themeQuickToggle");
  if (themeBtn) {
    themeBtn.innerHTML = theme === "dark" ? "☀️" : "🌙";
    themeBtn.setAttribute("title", `Switch to ${theme === "dark" ? "light" : "dark"} mode`);
  }
};
applyTheme(localStorage.getItem("theme") || "light");

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
    } catch { 
      return null; 
    }
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
  async call(flowUrl, action, data = {}, timeoutMs = 30000) {
    const session = Session.get();
    const body = {
      action,
      ...data,
      ...(session ? { sessionToken: session.token, userId: session.userId } : {})
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(flowUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (!res.ok) {
        let errMessage = `Server returned HTTP ${res.status}`;
        try {
          const errJson = await res.json();
          if (errJson) {
            if (typeof errJson.error === "string") {
              errMessage = errJson.error;
            } else if (errJson.error && typeof errJson.error === "object") {
              errMessage = errJson.error.message || errJson.error.code || JSON.stringify(errJson.error);
            } else if (errJson.message) {
              errMessage = typeof errJson.message === "string" ? errJson.message : JSON.stringify(errJson.message);
            }
          }
        } catch {
          const errText = await res.text();
          if (errText) errMessage = errText.slice(0, 150);
        }
        throw new Error(errMessage);
      }

      const text = await res.text();
      return text ? JSON.parse(text) : { success: true };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new Error("Request timed out. Please check your network connection.");
      }
      console.error(`API error [${action}]:`, err);
      throw err;
    }
  },

  // Auth Operations
  async login(email, password) {
    return this.call(CFG.FLOW_AUTH_URL, "login", { email, password });
  },
  async register(email, password, fullName) {
    // Explicitly send role and isActive so Power Automate can write them to SharePoint
    return this.call(CFG.FLOW_AUTH_URL, "register", {
      email,
      password,
      fullName,
      role: "user",
      isActive: true
    });
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

  // Files Operations
  async listFiles() {
    const res = await this.call(CFG.FLOW_FILES_URL, "list");
    let raw = res.files;
    if (typeof raw === "string") {
      try { raw = JSON.parse(raw); } catch {}
    }
    if (Array.isArray(raw)) return { ...res, files: raw };
    if (raw && Array.isArray(raw.results)) return { ...res, files: raw.results };
    if (raw && raw.d && Array.isArray(raw.d.results)) return { ...res, files: raw.d.results };
    if (Array.isArray(res.value)) return { ...res, files: res.value };
    return { ...res, files: [] };
  },
  async uploadFile(file) {
    const session = Session.get();
    // Convert file to Base64 for Power Automate compatibility
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        const base64 = typeof result === "string" ? result.split(",")[1] : "";
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    return this.call(CFG.FLOW_FILES_URL, "upload", {
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type || "application/octet-stream",
      fileContent: base64Data,
      uploadedBy: session?.fullName || session?.email || "Admin"
    }, 60000); // 60s timeout for file upload
  },
  async deleteFile(fileId, fileName = "") {
    return this.call(CFG.FLOW_FILES_URL, "delete", { fileId, fileName });
  },

  // Tickets Operations
  async listTickets() {
    return this.call(CFG.FLOW_TICKETS_URL, "list");
  },
  async createTicket(ticket) {
    return this.call(CFG.FLOW_TICKETS_URL, "create", ticket);
  },
  async updateTicketStatus(ticketId, status, adminNotes) {
    return this.call(CFG.FLOW_TICKETS_URL, "updateStatus", { ticketId, status, adminNotes });
  },

  // Updates Operations
  async listUpdates() {
    return this.call(CFG.FLOW_UPDATES_URL, "list");
  },
  async createUpdate(title, body) {
    return this.call(CFG.FLOW_UPDATES_URL, "create", { title, body });
  },

  // Admin Operations
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

  // Audit Logs Operations
  async log(action, details = "") {
    try {
      const session = Session.get();
      await this.call(CFG.FLOW_LOGS_URL, "log", {
        logAction: action,
        details: String(details).slice(0, 500),
        userEmail: session?.email || "anonymous",
        pageUrl: window.location.pathname,
        timestamp: new Date().toISOString()
      }, 8000);
    } catch (e) {
      // Non-blocking background log
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
  toast.innerHTML = `
    <span class="toast-ic">${icons[type] || "ℹ️"}</span>
    <span class="toast-txt">${esc(message)}</span>
    <button class="toast-close" aria-label="Close">&times;</button>
  `;

  const closeBtn = toast.querySelector(".toast-close");
  const dismiss = () => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(80px) scale(0.95)";
    setTimeout(() => toast.remove(), 250);
  };
  closeBtn.onclick = dismiss;

  container.appendChild(toast);
  setTimeout(dismiss, duration);
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

  // Check for recent updates badge count
  let updatesBadge = "";
  try {
    const cached = JSON.parse(sessionStorage.getItem("sc_updates_count") || "0");
    if (cached > 0) updatesBadge = `<b>${cached}</b>`;
  } catch {}

  const c = $("#content");

  // Admin nav button for authorized users
  const adminNav = session.role === "admin"
    ? `<a href="admin.html" class="${page === "admin" ? "on" : ""}"><span>🛡️</span>Admin Panel</a>`
    : "";

  const currentTheme = localStorage.getItem("theme") || "light";

  document.body.innerHTML = `
    <header class="top">
      <button class="burger" aria-label="Toggle navigation menu" id="bg">☰</button>
      <a href="home.html" class="logo-link">
        <span class="logo">Danfoss</span>
      </a>
      <h1>SC Supply Chain Tool Hub</h1>
      <div class="top-actions">
        <button id="themeQuickToggle" class="icon-btn" aria-label="Toggle color theme" title="Toggle color theme">
          ${currentTheme === "dark" ? "☀️" : "🌙"}
        </button>
        <a class="bell" href="updates.html" aria-label="Updates">🔔${updatesBadge}</a>
        <div class="user" title="${esc(session.email)} (${esc(session.role || 'User')})">
          <div class="av">${esc(name[0].toUpperCase())}</div>
          <span class="nm">${esc(name)}</span>
        </div>
      </div>
    </header>
    <div class="layout">
      <div class="side-overlay" id="sov"></div>
      <aside class="side" id="sd">
        <div class="side-brand">
          <span class="side-sub">Supply Chain Central</span>
        </div>
        ${NAV.map(n => `<a href="${n[3]}" class="${n[0] === page ? "on" : ""}"><span>${n[2]}</span>${n[1]}</a>`).join("")}
        <div class="sp"></div>
        <hr>
        ${adminNav}
        <a href="settings.html" class="${page === "settings" ? "on" : ""}"><span>⚙️</span>Settings</a>
        <a href="#" id="lo" class="logout-link"><span>🚪</span>Sign out</a>
      </aside>
      <div class="main">
        <footer class="foot">
          <div class="foot-left">
            <span>🌐 Danfoss Supply Chain Tool Hub v${CFG.APP_VERSION}</span>
            <span class="foot-dot">•</span>
            <span>Connected to SharePoint Online</span>
          </div>
          <span>Engineering Tomorrow — Together for a sustainable tomorrow</span>
        </footer>
      </div>
    </div>`;

  $(".main").insertBefore(c, $(".foot"));

  // Quick theme toggle handler
  const themeToggle = $("#themeQuickToggle");
  if (themeToggle) {
    themeToggle.onclick = () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      API.log("theme_change", `Theme set to ${next}`);
    };
  }

  // Burger & mobile drawer interaction
  const sidebar = $("#sd");
  const overlay = $("#sov");
  const closeSidebar = () => { 
    sidebar.classList.remove("open"); 
    overlay.classList.remove("show"); 
    document.body.style.overflow = "";
  };
  $("#bg").onclick = () => {
    const isOpen = sidebar.classList.toggle("open");
    overlay.classList.toggle("show");
    document.body.style.overflow = isOpen ? "hidden" : "";
  };
  overlay.onclick = closeSidebar;
  $$(".side a").forEach(a => a.addEventListener("click", closeSidebar));

  // Sign out handler
  $("#lo").onclick = async e => {
    e.preventDefault();
    try {
      await API.log("logout", "User signed out");
    } catch {}
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
