// AI Learning Circle — shared Supabase client + auth-guard helpers.
// Include supabase-config.js and the Supabase JS CDN script before this file.

const supabaseClient = (SUPABASE_URL.startsWith("PASTE_"))
  ? null
  : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function supabaseNotConfigured() {
  return supabaseClient === null;
}

// Redirects to login if there's no active session. Returns the
// session (or null, after redirecting) so callers can bail out.
async function requireMember() {
  if (supabaseNotConfigured()) return null;
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) {
    window.location.href = "login.html";
    return null;
  }
  return session;
}

// Loads the current member's own row from public.members.
async function getMemberRecord(userId) {
  const { data, error } = await supabaseClient
    .from("members")
    .select("*")
    .eq("id", userId)
    .single();
  if (error) {
    console.error("Could not load member record:", error.message);
    return null;
  }
  return data;
}

async function signOut() {
  if (supabaseNotConfigured()) return;
  await supabaseClient.auth.signOut();
  window.location.href = "login.html";
}

// Paid membership = role 'member' (or 'admin'). 'free' users get tips only.
function isPaid(member) {
  return !!member && (member.role === "member" || member.role === "admin");
}

// Membership enquiry: opens the owner's WhatsApp with a ready message.
const MEMBERSHIP_WHATSAPP_URL = "https://wa.me/919566430848?text=" +
  encodeURIComponent("I would like to subscribe for the membership for 3 months or 6 months. Kindly share me payment details");

// Content-type labels used across the Knowledge Library pages.
const RESOURCE_TYPE_LABELS = {
  use_case: "Use Cases",
  try_this_week: "Try This Week",
  prompt: "Prompt Library",
  cheat_sheet: "Cheat Sheets"
};

// Bottom action buttons for a library item. Use cases get the four
// standard buttons (greyed out when that asset hasn't been added yet);
// other types get a Download button plus an optional recording link.
// Wire clicks afterwards with wireDownloadButtons(container).
function resourceButtons(r) {
  const dl = (path, name, label) => path
    ? `<button class="chip-btn" data-path="${path}" data-name="${name || ''}">${label}</button>`
    : `<span class="chip-btn disabled">${label}</span>`;
  const rec = r.recording_url
    ? `<a class="chip-btn" href="${r.recording_url}" target="_blank" rel="noopener">▶ Session recording</a>`
    : `<span class="chip-btn disabled">▶ Session recording</span>`;
  if (r.type === "use_case") {
    return rec
      + dl(r.cheat_sheet_path, r.cheat_sheet_name, "📄 Cheat sheet · 2 min read")
      + dl(r.starter_kit_path, r.starter_kit_name, "🧰 Starter kit · across AI tools")
      + dl(r.file_path, r.file_name, "📁 Use case materials");
  }
  return (r.file_path ? dl(r.file_path, r.file_name, "⬇ Download" + (r.file_name ? " · " + r.file_name : "")) : "")
    + (r.recording_url ? rec : "");
}

function wireDownloadButtons(container) {
  container.querySelectorAll("button.chip-btn[data-path]").forEach((btn) => {
    btn.addEventListener("click", () => downloadResourceFile(btn.dataset.path, btn.dataset.name));
  });
}

// Downloads a file from the private "library-files" Storage bucket.
// Generates a short-lived signed URL (Supabase checks the member/admin
// RLS policy first) and opens it so the browser starts the download.
async function downloadResourceFile(filePath, fileName) {
  if (!filePath) return;
  // Links added by the admin (Google Drive, OneDrive, etc.) just open in a new tab.
  if (/^https?:\/\//i.test(filePath)) { window.open(filePath, "_blank", "noopener"); return; }
  if (supabaseNotConfigured()) return;
  const { data, error } = await supabaseClient
    .storage
    .from("library-files")
    .createSignedUrl(filePath, 3600, fileName ? { download: fileName } : undefined);
  if (error || !data) {
    alert("Could not generate a download link: " + (error ? error.message : "unknown error"));
    return;
  }
  window.open(data.signedUrl, "_blank");
}

// Explicit consent for "Know Your Community": attach to the
// show_in_directory checkbox so turning it ON requires an affirmative
// confirm naming exactly what becomes public. Cancelling reverts the
// checkbox. Turning it back OFF never needs confirmation.
function wireDirectoryConsent(checkboxEl) {
  checkboxEl.addEventListener('change', () => {
    if (!checkboxEl.checked) return;
    const ok = window.confirm(
      "You're about to make this public on our Know Your Community page, visible to anyone who visits the site (not just members):\n\n" +
      "• Your name, headline, location and company\n" +
      "• Your photo, if you added one\n" +
      "• Your bio and website/profile link, if you added them\n\n" +
      "Continue?"
    );
    if (!ok) checkboxEl.checked = false;
  });
}

// Adds an "Admin" tab to every ".tabs" nav on the page, only when the
// logged-in member's role is 'admin'. Safe to call on every portal
// page right after fetching the member record.
function injectAdminTab(member) {
  if (!member || member.role !== "admin") return;
  document.querySelectorAll(".tabs").forEach((tabs) => {
    if (!tabs.querySelector(".admin-tab-link")) {
      tabs.insertAdjacentHTML("beforeend", '<a class="tab-btn admin-tab-link" href="admin.html">Admin</a>');
    }
  });
}
