/**
 * Supabase client – optional. This app uses Azure only.
 * If VITE_SUPABASE_URL is not set, the client is a no-op that throws on use.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./types";

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const SUPABASE_PUBLISHABLE_KEY = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

const NOT_CONFIGURED_MSG =
  "Supabase is not configured. This app uses Azure only; data is accessed via Azure API.";

function createNoOpClient(): SupabaseClient<Database> {
  return new Proxy({} as SupabaseClient<Database>, {
    get() {
      throw new Error(NOT_CONFIGURED_MSG);
    },
  });
}

export const supabase: SupabaseClient<Database> =
  SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY
    ? createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          storage: localStorage,
          persistSession: true,
          autoRefreshToken: true,
        },
      })
    : createNoOpClient();
