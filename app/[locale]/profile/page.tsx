"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/use-user";
import { useConfigStore, defaultConfig } from "@/lib/config-store";
import type { CompanyConfig } from "@/lib/engine";
import type { FilingRow } from "@/lib/profile";
import { NotConfigured, ErrorBanner } from "../login/page";

export default function ProfilePage() {
  const t = useTranslations("auth");
  const tu = useTranslations("upload");
  const router = useRouter();
  const { user, loading } = useUser();

  const localConfig = useConfigStore((s) => s.config);
  const setLocalConfig = useConfigStore((s) => s.setConfig);

  const [form, setForm] = useState<CompanyConfig>(defaultConfig);
  const [filings, setFilings] = useState<FilingRow[]>([]);
  const [status, setStatus] = useState<"saved" | "loaded" | null>(null);
  // A failed write used to be indistinguishable from a dead button: the
  // `if (!error)` guards had no else branch and `finally` reset the UI to idle.
  const [writeError, setWriteError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);

  // Redirect anonymous visitors to the login page.
  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Load the saved company config + filings once the user is known.
  useEffect(() => {
    if (!user) return;
    const supabase = createClient();
    (async () => {
      const [{ data: profile }, { data: rows }] = await Promise.all([
        supabase.from("profiles").select("company_config").eq("id", user.id).single(),
        supabase
          .from("filings")
          .select("id, user_id, fiscal_year, company_name, results, created_at")
          // Scope to the signed-in user rather than relying on the RLS policy
          // alone to do it.
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);
      const cloud = (profile?.company_config ?? {}) as Partial<CompanyConfig>;
      // Seed from the cloud config, falling back to whatever is in this session.
      setForm({ ...defaultConfig, ...localConfig, ...cloud });
      setFilings((rows as FilingRow[]) ?? []);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  if (!isSupabaseConfigured) return <NotConfigured />;
  if (loading || !user) {
    return <p className="text-sm text-zinc-500 dark:text-zinc-400">…</p>;
  }

  function update(partial: Partial<CompanyConfig>) {
    setForm((f) => ({ ...f, ...partial }));
    setStatus(null);
    setWriteError(null);
  }

  async function saveToCloud() {
    if (!user) return;
    setSaving(true);
    setStatus(null);
    setWriteError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .upsert({ id: user.id, email: user.email, company_config: form }, { onConflict: "id" });
      if (error) setWriteError(t("saveError"));
      else setStatus("saved");
    } finally {
      setSaving(false);
    }
  }

  function loadIntoSession() {
    setLocalConfig(form);
    setStatus("loaded");
  }

  async function deleteFiling(id: string) {
    if (!user) return;
    const supabase = createClient();
    // user_id filter alongside the id: RLS already enforces ownership,
    // but the query should not rely on the policy alone.
    const { error } = await supabase
      .from("filings")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) setWriteError(t("deleteError"));
    else setFilings((prev) => prev.filter((f) => f.id !== id));
  }

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="max-w-2xl mx-auto space-y-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("profileTitle")}</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            {t("signedInAs")} <span className="font-mono">{user.email}</span>
          </p>
        </div>
        <button
          onClick={signOut}
          className="rounded border border-zinc-300 dark:border-zinc-700 px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          {t("signOut")}
        </button>
      </div>

      {/* Company data ------------------------------------------------------ */}
      <section className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
            {t("companyDataTitle")}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{t("companyDataDesc")}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Input label={tu("companyName")} value={form.name} onChange={(v) => update({ name: v })} />
          <Input
            label={tu("taxNumber")}
            value={form.steuernummer}
            onChange={(v) => update({ steuernummer: v })}
          />
          <Input
            label={tu("taxOffice")}
            value={form.finanzamt}
            onChange={(v) => update({ finanzamt: v })}
          />
          <Input
            label={tu("yearLabel")}
            type="number"
            value={String(form.geschaeftsjahr)}
            onChange={(v) => update({ geschaeftsjahr: parseInt(v) || defaultConfig.geschaeftsjahr })}
          />
          <Input
            label={tu("shareCapital")}
            value={form.stammkapital}
            onChange={(v) => update({ stammkapital: v })}
          />
          <Input
            label={tu("retainedEarnings")}
            value={form.gewinnvortrag}
            onChange={(v) => update({ gewinnvortrag: v })}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={form.kleinunternehmer}
            onChange={(e) => update({ kleinunternehmer: e.target.checked })}
          />
          {tu("smallBusiness")}
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={saveToCloud}
            disabled={saving || !ready}
            className="rounded bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50"
          >
            {saving ? t("saving") : t("saveToCloud")}
          </button>
          <button
            onClick={loadIntoSession}
            className="rounded border border-zinc-300 dark:border-zinc-700 px-4 py-2 text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            {t("loadIntoSession")}
          </button>
          {writeError && <ErrorBanner message={writeError} />}
          {status === "saved" && (
            <span className="text-sm text-green-600 dark:text-green-400">{t("saved")}</span>
          )}
          {status === "loaded" && (
            <span className="text-sm text-green-600 dark:text-green-400">{t("loaded")}</span>
          )}
        </div>
      </section>

      {/* Saved filings ----------------------------------------------------- */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wide">
          {t("savedFilingsTitle")}
        </h3>
        {filings.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("noFilings")}</p>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800 rounded border border-zinc-200 dark:border-zinc-800">
            {filings.map((f) => (
              <li key={f.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                    {f.company_name || "UG"} - {f.fiscal_year}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 font-mono">
                    {t("filingNetIncome")}:{" "}
                    {f.results?.guv?.jahresueberschuss?.toLocaleString("de-DE", {
                      minimumFractionDigits: 2,
                    })}{" "}
                    EUR · {new Date(f.created_at).toLocaleDateString("de-DE")}
                  </p>
                </div>
                <button
                  onClick={() => deleteFiling(f.id)}
                  className="text-xs text-red-600 dark:text-red-400 hover:underline"
                >
                  {t("delete")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Input({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-zinc-500 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
      />
    </label>
  );
}
