"use client";

import { usePathname, Link } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/ThemeToggle";
import { isSupabaseConfigured } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/use-user";

const STEPS = [
  { href: "/app" as const, key: "upload" as const },
  { href: "/review" as const, key: "classify" as const },
  { href: "/results" as const, key: "results" as const },
] as const;

export function Header() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("header");
  const tTheme = useTranslations("theme");
  const { user } = useUser();

  const isLanding = pathname === "/";
  const isApp = STEPS.some((s) => pathname === s.href);
  const currentIndex = STEPS.findIndex((s) => pathname === s.href);
  const nextLocale = locale === "de" ? "en" : "de";

  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              {/* Brand, not the page heading: each page renders its own h1. */}
              <span className="text-lg font-semibold tracking-tight">UGtax</span>
              <span className="text-xs text-zinc-500 font-mono">.de</span>
            </Link>
            <nav className="hidden sm:flex items-center gap-4 text-sm text-zinc-500 dark:text-zinc-400">
              {!isLanding && !isApp && (
                <>
                  <Link href="/app" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                    {t("upload")}
                  </Link>
                  <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">|</span>
                </>
              )}
              {isLanding && (
                <>
                  <Link href="/jahresabschluss" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                    {t("guideJahresabschluss")}
                  </Link>
                  <Link href="/vergleich" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                    {t("guideVergleich")}
                  </Link>
                  <span aria-hidden="true" className="text-zinc-400 dark:text-zinc-600">|</span>
                </>
              )}
              {/* A raw href="/#self-hosting" dropped the locale, throwing an
                  English reader onto the German homepage. Only the same-page
                  hash stays a plain anchor. */}
              {isLanding ? (
                <a href="#self-hosting" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                  {t("selfHosting")}
                </a>
              ) : (
                <Link href="/#self-hosting" className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors">
                  {t("selfHosting")}
                </Link>
              )}
              <a
                href="https://github.com/neip-md/ugtax"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                GitHub
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={pathname}
              locale={nextLocale}
              className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
            >
              {t("language")}
            </Link>
            {isLanding && (
              <Link
                href="/app"
                className="rounded bg-zinc-900 dark:bg-zinc-100 px-4 py-1.5 text-xs font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
              >
                {t("start")}
              </Link>
            )}
            {isSupabaseConfigured && (
              <Link
                href={user ? "/profile" : "/login"}
                className="text-xs text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors"
              >
                {user ? t("account") : t("login")}
              </Link>
            )}
            <ThemeToggle
              labels={{
                light: tTheme("light"),
                dark: tTheme("dark"),
                switchToLight: tTheme("switchToLight"),
                switchToDark: tTheme("switchToDark"),
              }}
            />
          </div>
        </div>
      </div>
      {isApp && (
        <div className="border-t border-zinc-100 dark:border-zinc-800/50 px-6 py-2">
          <div className="max-w-5xl mx-auto flex items-center gap-4">
            {STEPS.map((step, i) => {
              const isCurrent = i === currentIndex;
              const isPast = currentIndex >= 0 && i < currentIndex;
              return (
                <Link
                  key={step.href}
                  href={step.href}
                  className={`flex items-center gap-2 text-xs transition-colors ${
                    isCurrent
                      ? "text-zinc-900 dark:text-zinc-100 font-medium"
                      : isPast
                        ? "text-zinc-500 dark:text-zinc-400"
                        : "text-zinc-600 dark:text-zinc-400"
                  }`}
                >
                  <span
                    className={`flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium ${
                      isCurrent
                        ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                        : isPast
                          ? "bg-zinc-300 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                          : "bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    {i + 1}
                  </span>
                  {/* sr-only rather than hidden: display:none would strip the label
    from the accessibility tree, leaving the link named just "1". */}
                  <span className="sr-only sm:not-sr-only">{t(step.key)}</span>
                  {i < STEPS.length - 1 && (
                    <span aria-hidden="true" className="ml-2 text-zinc-500 dark:text-zinc-500">&rarr;</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
