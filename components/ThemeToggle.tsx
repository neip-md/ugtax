"use client";

import { useTheme } from "@/lib/theme";

/**
 * Labels are injected rather than translated in place: this button also renders
 * in app/(legal)/layout.tsx, which sits outside NextIntlClientProvider, so
 * calling useTranslations() here would throw on the legal pages. Callers inside
 * the [locale] tree pass translated strings; the defaults cover the rest.
 */
export function ThemeToggle({
  labels,
}: {
  labels?: { light: string; dark: string; switchToLight: string; switchToDark: string };
}) {
  const { theme, toggle } = useTheme();
  const l = labels ?? {
    light: "Light",
    dark: "Dark",
    switchToLight: "Switch to light mode",
    switchToDark: "Switch to dark mode",
  };

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? l.switchToLight : l.switchToDark}
      // Was `border-zinc-700 dark:border-zinc-700 light:border-zinc-300` with
      // `text-zinc-400` and no light counterpart, giving 2.62:1 in light mode.
      // `light:` is not a registered variant here (globals.css declares only
      // `dark`), so that class never compiled at all.
      className="rounded border border-zinc-500 dark:border-zinc-600 px-2 py-1 text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
    >
      {theme === "dark" ? l.light : l.dark}
    </button>
  );
}
