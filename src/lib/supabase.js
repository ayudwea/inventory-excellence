import { createClient } from "@supabase/supabase-js";

// URL dan publishable key aman dipakai di browser. Jangan pernah memakai secret/service_role key.
// Nilai env dapat menggantikan default untuk development/staging.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ktjcmnkutkcmyjcuqtwc.supabase.co";
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  "sb_publishable_ZtG8bfCvaarzSt6qaEHl2A_-vZk43uC";

export const supabase = createClient(supabaseUrl, supabaseKey);
export const supabaseConnectionConfigured = Boolean(supabaseUrl && supabaseKey);
