"use client";

import { useTranslations } from "next-intl";
import type { Check } from "@/lib/validation";

/**
 * Shows what was actually verified before filing.
 *
 * The engine already emitted free-text warnings, but nothing told the user
 * which invariants had been checked and held. For a tool that produces a
 * legally binding E-Bilanz, "the Bilanz balances and nothing was dropped" is
 * worth stating explicitly rather than implying by the absence of an error.
 */
export function ChecksPanel({ checks }: { checks: Check[] }) {
  const t = useTranslations("checks");
  const failed = checks.filter((c) => c.status === "fail");
  const ok = failed.length === 0;

  return (
    <section
      aria-labelledby="checks-heading"
      className={`rounded border p-4 space-y-3 ${
        ok
          ? "border-zinc-300 dark:border-zinc-700"
          : "border-red-400 dark:border-red-700 bg-red-50 dark:bg-red-950/20"
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <h3
          id="checks-heading"
          className="text-sm font-semibold uppercase tracking-wide text-zinc-700 dark:text-zinc-300"
        >
          {t("title")}
        </h3>
        <p
          className={`text-sm font-medium ${
            ok ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-300"
          }`}
          // Announced when the result flips, without stealing focus.
          role="status"
        >
          {ok ? t("allPassed") : t("someFailed", { count: failed.length })}
        </p>
      </div>

      <ul className="space-y-1.5">
        {checks.map((check) => (
          <li key={check.id} className="flex items-start gap-2 text-sm">
            <span
              aria-hidden="true"
              className={
                check.status === "pass"
                  ? "text-green-700 dark:text-green-400"
                  : check.status === "warn"
                    ? "text-amber-700 dark:text-amber-400"
                    : "text-red-700 dark:text-red-300"
              }
            >
              {check.status === "pass" ? "✓" : check.status === "warn" ? "!" : "✗"}
            </span>
            <span className="text-zinc-700 dark:text-zinc-300">
              {/* The icon is decorative, so the state is also in the text for
                  anyone not seeing colour or glyphs. */}
              <span className="sr-only">
                {check.status === "pass"
                  ? t("statusPass")
                  : check.status === "warn"
                    ? t("statusWarn")
                    : t("statusFail")}{" "}
              </span>
              {t(check.id)}
              {check.status === "warn" && check.id === "ruecklage" && check.detail && (
                <span className="block text-xs text-amber-800 dark:text-amber-300/90">
                  {t("ruecklageWarn", { detail: check.detail })}
                </span>
              )}
              {check.status === "fail" && check.detail && (
                <span className="block font-mono text-xs text-red-700 dark:text-red-300">
                  {check.detail}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
