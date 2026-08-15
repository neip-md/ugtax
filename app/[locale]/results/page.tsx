"use client";

import { useSessionStore } from "@/lib/session-store";
import { useConfigStore } from "@/lib/config-store";
import { Link, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { SubmitSection } from "@/components/SubmitSection";
import { ChecksPanel } from "@/components/ChecksPanel";
import { runChecks } from "@/lib/validation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/use-user";
import type { ProcessResults } from "@/lib/store-types";

export default function ResultsPage() {
  const router = useRouter();
  const t = useTranslations("results");
  const results = useSessionStore((s) => s.results);
  const classified = useSessionStore((s) => s.classified);
  const config = useConfigStore((s) => s.config);
  const updateConfig = useConfigStore((s) => s.updateConfig);
  const [gewinnvortragSaved, setGewinnvortragSaved] = useState(false);

  if (!results) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">{t("title")}</h2>
        <p className="text-zinc-500 dark:text-zinc-400">{t("noResults")}</p>
        <button onClick={() => router.push("/")} className="text-sm underline text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:text-zinc-200">
          {t("backToUpload")}
        </button>
      </div>
    );
  }

  const { bilanz, guv, warnings } = results;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {results.companyName || "UG"} - {results.fiscalYear}
        </h1>
        <p className="text-zinc-500 dark:text-zinc-400 mt-1">
          {t("entriesProcessed", { count: results.journalEntryCount })}
        </p>
      </div>

      {warnings.length > 0 && (
        <div className="rounded border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 space-y-1">
          <p className="text-sm font-medium text-amber-700 dark:text-amber-300">{t("warnings")}</p>
          {warnings.map((w, i) => (
            <p key={i} className="text-sm text-amber-800 dark:text-amber-200/80">{w}</p>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">{t("aktiva")}</h3>
          {Object.entries(bilanz.aktiva).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2">
            <Row label={t("summeAktiva")} value={bilanz.summeAktiva} bold />
          </div>
        </div>

        <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">{t("passiva")}</h3>
          {Object.entries(bilanz.passiva).map(([k, v]) => (
            <Row key={k} label={k} value={v} />
          ))}
          <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2">
            <Row label={t("summePassiva")} value={bilanz.summePassiva} bold />
          </div>
        </div>
      </div>

      {/* The balance check is the single most important status in the app and
          measured 1.78:1 on white. Darker in light mode, unchanged in dark. */}
      <div className={`text-center text-sm font-mono ${bilanz.isBalanced ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
        {bilanz.isBalanced ? t("balanced") : t("notBalanced")}
      </div>

      <ChecksPanel checks={runChecks(classified, results, parseFloat(config.stammkapital || "0"))} />

      <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">{t("guv")}</h3>
        {Object.entries(guv.ertraege).length > 0 ? (
          Object.entries(guv.ertraege).map(([k, v]) => <Row key={k} label={k} value={v} />)
        ) : (
          <p className="text-xs text-zinc-500">{t("noRevenues")}</p>
        )}
        {Object.entries(guv.aufwendungen).map(([k, v]) => (
          <Row key={k} label={k} value={v} negative />
        ))}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-2">
          <Row label={t("netIncome")} value={guv.jahresueberschuss} bold negative={guv.jahresueberschuss < 0} />
        </div>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">{t("downloads")}</h3>
        <div className="flex flex-wrap gap-3">
          <DownloadButton label={t("downloadXbrl")} type="xbrl" classified={classified} config={config} />
          <DownloadButton label={t("downloadJournal")} type="journal" classified={classified} config={config} />
          <DownloadButton label={t("downloadStatements")} type="statements" classified={classified} config={config} />
          <DownloadButton label={t("downloadGuide")} type="guide" classified={classified} config={config} />
          <DownloadButton label={t("downloadBundesanzeiger")} type="bundesanzeiger" classified={classified} config={config} />
        </div>
      </div>

      {isSupabaseConfigured && <SaveFilingSection results={results} />}

      <SubmitSection />

      {(() => {
        const currentGewinnvortrag = parseFloat(config.gewinnvortrag) || 0;
        const nextGewinnvortrag = currentGewinnvortrag + guv.jahresueberschuss;
        const nextYear = results.fiscalYear + 1;
        return (
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
            <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
              {t("gewinnvortragTitle", { year: nextYear })}
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {t("gewinnvortragPrevious")}: {currentGewinnvortrag.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR
              {guv.jahresueberschuss >= 0 ? " + " : " "}
              {t("gewinnvortragNetIncome")}: {guv.jahresueberschuss.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR
              {" = "}
              <strong className="text-zinc-800 dark:text-zinc-200">
                {nextGewinnvortrag.toLocaleString("de-DE", { minimumFractionDigits: 2 })} EUR
              </strong>
            </p>
            {gewinnvortragSaved ? (
              <p className="text-sm text-green-600 dark:text-green-400">
                {t("gewinnvortragSaved", { year: nextYear })}
              </p>
            ) : (
              <button
                onClick={() => {
                  updateConfig({ gewinnvortrag: nextGewinnvortrag.toFixed(2), geschaeftsjahr: nextYear });
                  setGewinnvortragSaved(true);
                }}
                className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                {t("gewinnvortragSave", { year: nextYear })}
              </button>
            )}
          </div>
        );
      })()}

      <button
        onClick={() => router.push("/")}
        className="rounded border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
      >
        {t("newAnalysis")}
      </button>
    </div>
  );
}

function Row({ label, value, bold, negative }: {
  label: string; value: number | string; bold?: boolean; negative?: boolean;
}) {
  const num = typeof value === "number" ? value : parseFloat(String(value));
  const formatted = isNaN(num) ? "-" : num.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (
    <div className="flex justify-between items-baseline">
      <span className={`text-sm ${bold ? "font-semibold text-zinc-800 dark:text-zinc-200" : "text-zinc-500 dark:text-zinc-400"}`}>{label}</span>
      <span className={`font-mono text-sm ${bold ? "font-semibold" : ""} ${negative ? "text-red-400" : "text-zinc-800 dark:text-zinc-200"}`}>
        {formatted} EUR
      </span>
    </div>
  );
}

function DownloadButton({ label, type, classified, config }: {
  label: string; type: string; classified: unknown[]; config: unknown;
}) {
  const [loading, setLoading] = useState(false);

  async function handleDownload() {
    setLoading(true);
    try {
      const res = await fetch(`/api/download?type=${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classified, config: { company: config } }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] || `download.${type}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      className="rounded border border-zinc-300 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-4 py-2 text-sm text-zinc-800 dark:text-zinc-200 hover:bg-zinc-700 disabled:opacity-50"
    >
      {loading ? "..." : label}
    </button>
  );
}

function SaveFilingSection({ results }: { results: ProcessResults }) {
  const t = useTranslations("auth");
  const { user, loading } = useUser();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  // Without this the insert failing looked exactly like the button doing
  // nothing: the `if (!error)` guard had no else and `finally` reset the UI.
  const [saveError, setSaveError] = useState<string | null>(null);

  if (loading) return null;

  // Signed-out visitors get a prompt to log in; the app stays fully usable.
  if (!user) {
    return (
      <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href="/login" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
          {t("signInLink")}
        </Link>{" "}
        {t("saveFilingSignedOut")}
      </div>
    );
  }

  async function handleSave() {
    if (!user) return;
    setSaveError(null);
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("filings").insert({
        user_id: user.id,
        fiscal_year: results.fiscalYear,
        company_name: results.companyName || null,
        results,
      });
      if (error) setSaveError(t("saveError"));
      else setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
      {saveError && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">{saveError}</p>
      )}
      <div className="flex items-center justify-between gap-4">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{t("saveFilingPrompt")}</p>
      {saved ? (
        <span className="text-sm text-green-600 dark:text-green-400 whitespace-nowrap">
          {t("filingSaved")}
        </span>
      ) : (
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50 whitespace-nowrap"
        >
          {saving ? t("saving") : t("saveFilingCta")}
        </button>
      )}
      </div>
    </div>
  );
}
