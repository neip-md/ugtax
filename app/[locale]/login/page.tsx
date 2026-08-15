"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // Seeded from the URL during render rather than in an effect. Reading it via
  // useSearchParams is SSR-safe, so server and client agree on the first paint
  // and there is no cascading render (react-hooks/set-state-in-effect).
  const [error, setError] = useState<string | null>(() => {
    const param = searchParams.get("error");
    if (param === "confirm") return t("errorConfirm");
    if (param === "not_configured") return t("errorNotConfigured");
    return null;
  });

  if (!isSupabaseConfigured) return <NotConfigured />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(error.message);
        return;
      }
      router.push("/profile");
      router.refresh();
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("signInTitle")}</h1>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field
          label={t("email")}
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
        />
        <Field
          label={t("password")}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50"
        >
          {loading ? t("signingIn") : t("signInCta")}
        </button>
      </form>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t("noAccount")}{" "}
        <Link href="/signup" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
          {t("signUpLink")}
        </Link>
      </p>
    </div>
  );
}

export function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm text-zinc-600 dark:text-zinc-400">{label}</span>
      <input
        type={type}
        value={value}
        required
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded border border-zinc-500 dark:border-zinc-600 bg-white dark:bg-zinc-900 px-3 py-2 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500 focus:border-zinc-500"
      />
    </label>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="rounded border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-300">
      {message}
    </div>
  );
}

export function NotConfigured() {
  const t = useTranslations("auth");
  return (
    <div className="max-w-sm mx-auto space-y-3">
      <h1 className="text-2xl font-semibold tracking-tight">{t("notConfiguredTitle")}</h1>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("notConfiguredBody")}</p>
    </div>
  );
}
