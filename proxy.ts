import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { updateSession } from "./lib/supabase/middleware";

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // Run locale routing first, then let Supabase refresh the session and write
  // any rotated auth cookies onto the same response.
  const response = intlMiddleware(request);
  return updateSession(request, response);
}

export const config = {
  matcher: [
    // Match all pathnames except api, auth (email-confirm route), _next,
    // static files, and legal pages.
    "/((?!api|auth|_next|.*\\..*|privacy|imprint).*)",
  ],
};
