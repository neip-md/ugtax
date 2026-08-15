import { NextRequest, NextResponse } from "next/server";

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_ZIP_UNCOMPRESSED_BYTES = 20 * 1024 * 1024;

/**
 * Cap for JSON request bodies.
 *
 * These endpoints are unauthenticated and unthrottled, and `output: standalone`
 * means a self-hosted deploy has no platform body limit in front of it. Before
 * this cap a 40 MB JSON body was accepted and fully parsed in about a second.
 * A holding UG has well under 50 transactions a year, so 2 MB is generous.
 */
export const MAX_JSON_BYTES = 2 * 1024 * 1024;

/** Upper bound on array lengths inside a request body. */
export const MAX_TRANSACTIONS = 10_000;

function allowedOrigins(): string[] {
  const env = process.env.ALLOWED_ORIGINS;
  if (env) return env.split(",").map((s) => s.trim()).filter(Boolean);
  const canonical = [
    "https://ugtax.de",
    "https://www.ugtax.de",
    "http://localhost:3000",
    "http://localhost:4114",
  ];
  // On Vercel, allow the deployment's own URL. This comes from the platform,
  // not from the request, which is the important difference: the previous
  // implementation trusted `origin === https://${request.headers.host}`, so a
  // caller could satisfy the check by forging both headers at once.
  if (process.env.VERCEL_URL) canonical.push(`https://${process.env.VERCEL_URL}`);
  return canonical;
}

/**
 * Any localhost origin, on any port, outside production.
 *
 * The allowlist hardcodes ports 3000 and 4114. That was masked before by the
 * Host-header fallback, which had to go because it validated one
 * client-controlled header with another. Without this, a contributor running
 * the dev server on any other port gets a 403 on every API call, which looks
 * like the app being broken. Production keeps the strict allowlist.
 */
function isLocalDevOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  try {
    const { hostname, protocol } = new URL(origin);
    return protocol === "http:" && (hostname === "localhost" || hostname === "127.0.0.1");
  } catch {
    return false;
  }
}

export function checkOrigin(request: NextRequest): NextResponse | null {
  const origin = request.headers.get("origin");
  // A missing Origin stays allowed: browsers always send it on POST, so this
  // path is non-browser callers (curl, the CLI, self-hosted scripts) which these
  // endpoints are meant to support. Nothing behind this gate carries ambient
  // authority, so it is a hygiene control, not access control.
  if (!origin) return null;
  if (allowedOrigins().includes(origin)) return null;
  if (isLocalDevOrigin(origin)) return null;
  return NextResponse.json(
    { code: "origin_not_allowed", error: "Origin not allowed" },
    { status: 403 },
  );
}

function tooLarge(maxBytes: number): NextResponse {
  return NextResponse.json(
    {
      code: "body_too_large",
      error: `Request body exceeds ${Math.floor(maxBytes / 1024 / 1024)} MB`,
    },
    { status: 413 },
  );
}

/**
 * Read and parse a JSON body with a hard size cap.
 *
 * Checks Content-Length first, then measures what actually arrived, since a
 * chunked request can omit the header. Returns 400 on malformed JSON rather
 * than letting the route throw a 500 that echoes the V8 parser message back.
 */
export async function readJsonCapped<T = unknown>(
  request: NextRequest,
  maxBytes: number = MAX_JSON_BYTES,
): Promise<{ data: T; error?: undefined } | { data?: undefined; error: NextResponse }> {
  const declared = request.headers.get("content-length");
  if (declared) {
    const n = Number(declared);
    if (Number.isFinite(n) && n > maxBytes) return { error: tooLarge(maxBytes) };
  }

  const text = await request.text();
  if (text.length > maxBytes) return { error: tooLarge(maxBytes) };

  try {
    return { data: JSON.parse(text) as T };
  } catch {
    return {
      error: NextResponse.json(
        { code: "invalid_json", error: "Request body is not valid JSON" },
        { status: 400 },
      ),
    };
  }
}

/** Reject arrays long enough to be a resource-exhaustion attempt. */
export function checkArrayLength(
  value: unknown,
  field: string,
  max: number = MAX_TRANSACTIONS,
): NextResponse | null {
  if (Array.isArray(value) && value.length > max) {
    return NextResponse.json(
      { code: "too_many_items", error: `${field} exceeds ${max} items` },
      { status: 413 },
    );
  }
  return null;
}
