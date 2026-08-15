import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Refreshes the Supabase auth session on each request and writes any rotated
 * cookies onto the response produced by the next-intl middleware.
 *
 * No-op when Supabase is not configured, so the app keeps working before the
 * project is provisioned.
 */
export async function updateSession(
  request: NextRequest,
  response: NextResponse,
): Promise<NextResponse> {
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  // IMPORTANT: touch the user immediately - do not run other logic between
  // createServerClient and getUser, or the session may not refresh correctly.
  await supabase.auth.getUser();

  return response;
}
