// AI Learning Circle — Supabase connection config.
//
// Fill these in once you've created your Supabase project:
//   Supabase dashboard → Project Settings → API
//   - "Project URL" goes in SUPABASE_URL
//   - "anon public" key goes in SUPABASE_ANON_KEY
//
// This key is meant to be public (it ships in every visitor's
// browser) — it only lets someone do what your Row Level Security
// policies (see supabase/schema.sql) allow. Never put the
// "service_role" key here or in any file in this repository.

const SUPABASE_URL = "https://fcrljnbuvfrhrpwavkji.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lAvzAkI-r3v2sJa80zjy8Q_SHjCNELO";

// The onboarding survey shown on first login. Reuses the existing
// AI Pulse Google Form by default — replace with a dedicated
// onboarding survey URL if you'd rather use a different one.
const ONBOARDING_SURVEY_URL = "https://docs.google.com/forms/d/e/1FAIpQLScehQKlY-b5gAFt98ep4FeJ-jywcjLtImcIGGkeVLXI5iNROA/viewform?embedded=true";
