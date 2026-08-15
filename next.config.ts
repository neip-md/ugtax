import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// `output: "standalone"` exists for the Docker self-hosting path
// (docker-compose + ERiC), which needs .next/standalone/server.js.
//
// It must NOT be set on Vercel. Vercel does its own file tracing and, since
// Next 16.3.1, its onBuildComplete step looks for .next/next-server.js.nft.json,
// which a standalone Turbopack build does not emit. The result is a build that
// compiles, typechecks and generates every page, then fails at the last step
// with ENOENT on that manifest. Vercel sets VERCEL=1, so scope it to self-hosting.
const nextConfig: NextConfig = {
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  // Pin tracing to this directory. Without it Turbopack infers the workspace
  // root from the nearest lockfile upward, which on a dev machine can resolve
  // to the home directory and trace unrelated files.
  outputFileTracingRoot: __dirname,

  async redirects() {
    // The legal pages live outside the [locale] segment and proxy.ts excludes
    // /imprint and /privacy from i18n routing, so /en/imprint returned 404.
    // German law requires the Impressum to be reachable from every page, and
    // the English footer links to it, so a 404 there is the worst outcome.
    // The documents stay in German (see the note rendered on the pages).
    return [
      { source: "/en/imprint", destination: "/imprint", permanent: false },
      { source: "/en/privacy", destination: "/privacy", permanent: false },
    ];
  },
};

export default withNextIntl(nextConfig);
