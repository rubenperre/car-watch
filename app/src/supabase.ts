import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public by design: protected by row-level security (see supabase/migrations), not by hiding them.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const configured = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = configured
  ? createClient(url as string, anonKey as string, {
      auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
    })
  : null;
