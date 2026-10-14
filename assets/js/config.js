// ============================================================
// SC Tool Hub — Configuration
// SharePoint + Power Automate Backend
// ============================================================
// Replace the placeholder values below with your actual values.
// See the migration guide for how to obtain each value.

window.CFG = {

  // ── Power Automate Flow URLs ─────────────────────────────────
  // Create HTTP-triggered flows in Power Automate and paste their URLs here.
  // Each flow handles a specific set of operations.
  FLOW_AUTH_URL: "https://default097464b8069c453e9254c17ec70731.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/23/workflows/f9887b98a8f54956b393c8be28cc9e90/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=9vkTbC8UGq1UdkZa-yizZCHqjAipKQRgn5RYy65DJNk",
  FLOW_FILES_URL: "https://default097464b8069c453e9254c17ec70731.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/07/workflows/9a144b76e59b4dbb909b1e11315db124/triggers/manual/paths/invoke?api-version=1",
  FLOW_TICKETS_URL: "https://default097464b8069c453e9254c17ec70731.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/03/workflows/0ebf083121a849e282485731e60cff9b/triggers/manual/paths/invoke?api-version=1",
  FLOW_UPDATES_URL: "https://default097464b8069c453e9254c17ec70731.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/10/workflows/fda198d3cd5b4a0aa5d6ffdd0f38eec1/triggers/manual/paths/invoke?api-version=1",
  FLOW_ADMIN_URL: "https://default097464b8069c453e9254c17ec70731.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/24/workflows/b156e724efc14d409b78e453b79c678d/triggers/manual/paths/invoke?api-version=1",
  FLOW_LOGS_URL: "https://default097464b8069c453e9254c17ec70731.0d.environment.api.powerplatform.com:443/powerautomate/automations/direct/cu/21/workflows/521b0443f2304013a313de4fad4d5127/triggers/manual/paths/invoke?api-version=1",

  // ── SharePoint Info ──────────────────────────────────────────
  SHAREPOINT_SITE_URL: "https://danfoss.sharepoint.com/sites/SCAutomation",
  SHAREPOINT_FOLDER_URL: "https://danfoss.sharepoint.com/:f:/r/sites/SCAutomation/Shared%20Documents/SC-Tool-Hub/MacroUploads",

  // ── App Settings ─────────────────────────────────────────────
  ALLOWED_EMAIL_DOMAIN: "danfoss.com",   // "" = allow any domain
  POLL_SECONDS: 120,                      // Auto-refresh interval for file lists
  SESSION_HOURS: 8,                       // Auto-logout after N hours
  APP_VERSION: "2.0.0",
};
