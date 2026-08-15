import { cookies } from "next/headers";
import { Providers } from "../providers";
import { HtmlShell } from "../shell";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";

// Legal pages are German-only by design: proxy.ts excludes /imprint and
// /privacy from i18n routing, so they are never locale-prefixed. The shell is
// therefore rendered with a fixed lang="de".
export default async function LegalLayout({ children }: { children: React.ReactNode }) {
  const cookieTheme = (await cookies()).get("theme")?.value;
  const initialTheme = cookieTheme === "light" || cookieTheme === "dark" ? cookieTheme : undefined;
  return (
    <HtmlShell lang="de">
      <Providers initialTheme={initialTheme}>
        <header className="border-b border-zinc-200 dark:border-zinc-800 px-6 py-4">
          <div className="max-w-5xl mx-auto flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              {/* Brand, not the page heading: each page renders its own h1. */}
              <span className="text-lg font-semibold tracking-tight">UGtax</span>
              <span className="text-xs text-zinc-500 font-mono">.de</span>
            </Link>
            <ThemeToggle />
          </div>
        </header>
        <main className="flex-1 px-6 py-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* These documents are binding under German law and are published in
                German only. English visitors are redirected here from
                /en/imprint and /en/privacy (see next.config.ts), so tell them
                why the page switched language and give them a way back. */}
            <p
              lang="en"
              className="rounded border border-zinc-300 dark:border-zinc-700 px-4 py-3 text-xs text-zinc-600 dark:text-zinc-400"
            >
              These legal documents are published in German, the binding language
              for a German company.{" "}
              <Link href="/en" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">
                Back to the English site
              </Link>
              .
            </p>
            {children}
          </div>
        </main>
        <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-4 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="max-w-5xl mx-auto">
            <Link href="/imprint" className="underline hover:text-zinc-700 dark:hover:text-zinc-200">Impressum</Link>
            {" · "}
            <Link href="/privacy" className="underline hover:text-zinc-700 dark:hover:text-zinc-200">Datenschutz</Link>
            {" · "}
            <Link href="/" className="underline hover:text-zinc-700 dark:hover:text-zinc-200">Startseite</Link>
          </div>
        </footer>
      </Providers>
    </HtmlShell>
  );
}
