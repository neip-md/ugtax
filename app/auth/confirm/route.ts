import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Email-confirmation callback. Supabase links here from the signup email.
 *
 * Handles both flows:
 *  - token_hash + type  (recommended custom email template, verifyOtp)
 *  - code               (default PKCE link, exchangeCodeForSession)
 *
 * On success the session cookies are written onto the redirect response and
 * the user lands on their profile.
 */
/**
 * Only same-origin relative paths are allowed as a redirect target.
 *
 * `next` arrives from the query string and was previously passed straight to
 * `new URL(next, origin)`, which resolves an absolute URL to itself. Three
 * shapes escaped the origin: "https://evil…", "//evil…" (protocol-relative)
 * and "/\/evil…" (backslash, which some parsers normalise to "//"). Because
 * the Supabase session cookies are written onto this very response, the cookies
 * landed on ugtax.de and the browser was then sent off-site.
 */
function safeNext(raw: string | null): string {
  if (!raw) return "/profile";
  return /^\/(?![/\\])/.test(raw) ? raw : "/profile";
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  const redirect = (path: string) => NextResponse.redirect(new URL(path, origin));

  if (!url || !anonKey) return redirect("/login?error=not_configured");

  const response = redirect(next);
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

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return response;
  } else if (tokenHash && type) {
    // Drop any session already on this browser before consuming the token, so a
    // confirmation link cannot attach a victim's confirmed account to a session
    // an attacker planted first.
    await supabase.auth.signOut();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return response;
  }

  return redirect("/login?error=confirm");
}
