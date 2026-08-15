"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Whether Supabase env vars are present. When false, the app runs exactly as
 * before (fully client-side, no accounts) - auth UI hides itself instead of
 * crashing. Login is an optional add-on, not a requirement.
 */
export const isSupabaseConfigured = Boolean(url && anonKey);

let browserClient: SupabaseClient | undefined;

/** Memoised browser client. Safe to call from any client component. */
export function createClient(): SupabaseClient {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
  if (!browserClient) {
    browserClient = createBrowserClient(url, anonKey);
  }
  return browserClient;
}
