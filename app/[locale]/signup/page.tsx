"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { Field, ErrorBanner, NotConfigured } from "../login/page";

export default function SignupPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  if (!isSupabaseConfigured) return <NotConfigured />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/confirm`,
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      // If confirmation is required, no session is returned yet.
      if (data.session) {
        // Use the i18n router, not window.location: a raw href drops the locale
        // prefix, so an English signup landed on the German /profile.
        router.push("/profile");
        router.refresh();
        return;
      }
      setSent(true);
    } catch {
      setError(t("errorGeneric"));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="max-w-sm mx-auto space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">{t("checkEmailTitle")}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          {t("checkEmailBody", { email })}
        </p>
        <Link href="/login" className="text-sm underline hover:text-zinc-800 dark:hover:text-zinc-200">
          {t("signInLink")}
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-sm mx-auto space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">{t("signUpTitle")}</h1>

      {error && <ErrorBanner message={error} />}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label={t("email")} type="email" value={email} onChange={setEmail} autoComplete="email" />
        <Field
          label={t("password")}
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded bg-zinc-900 dark:bg-zinc-100 px-4 py-2 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white disabled:opacity-50"
        >
          {loading ? t("creating") : t("signUpCta")}
        </button>
      </form>

      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {t("haveAccount")}{" "}
        <Link href="/login" className="underline hover:text-zinc-800 dark:hover:text-zinc-200">
          {t("signInLink")}
        </Link>
      </p>
    </div>
  );
}
