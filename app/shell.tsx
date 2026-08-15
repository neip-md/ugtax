import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";

/**
 * The <html>/<body> shell.
 *
 * WHY THIS IS NOT IN app/layout.tsx: the root layout sits above the [locale]
 * segment, so it cannot know which language it is rendering. Hardcoding
 * lang="de" there made every /en page declare German, which is a WCAG 3.1.1
 * (Level A) failure and made screen readers pronounce English with German
 * phonetics. The shell now takes `lang` from whichever layout renders it:
 *
 *   app/[locale]/layout.tsx  -> lang={locale}   (de or en)
 *   app/(legal)/layout.tsx   -> lang="de"       (legal pages are German-only
 *                                                by design; the proxy matcher
 *                                                excludes /imprint and /privacy
 *                                                from i18n routing)
 */

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Applies the stored theme before first paint so the page does not flash.
const THEME_SCRIPT = `(function(){try{var t=document.cookie.match(/(?:^|; )theme=([^;]*)/);var v=t?t[1]:null;if(!v)v=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light";document.documentElement.classList.add(v)}catch(e){}})()`;

export function HtmlShell({
  lang,
  children,
}: Readonly<{ lang: string; children: React.ReactNode }>) {
  return (
    <html
      lang={lang}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
