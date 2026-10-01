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
