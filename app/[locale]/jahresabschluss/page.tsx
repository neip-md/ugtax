import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "jahresabschluss" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function JahresabschlussPage() {
  const t = await getTranslations("jahresabschluss");

  const requirements = [
    t.rich("req1", { b: (c) => <strong>{c}</strong> }),
    t.rich("req2", { b: (c) => <strong>{c}</strong> }),
    t.rich("req3", { b: (c) => <strong>{c}</strong> }),
    t.rich("req4", { b: (c) => <strong>{c}</strong> }),
    t.rich("req5", { b: (c) => <strong>{c}</strong> }),
  ];

  const howSteps = [t("how1"), t("how2"), t("how3"), t("how4"), t("how5")];

  return (
    <div className="max-w-3xl space-y-8 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t("h1")}</h1>

      <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">{t("intro")}</p>

      <h2 className="text-xl font-semibold">{t("h2Required")}</h2>
      <ul className="space-y-2 text-zinc-600 dark:text-zinc-400">
        {requirements.map((node, i) => (
          <li key={i} className="flex gap-2">
            <span className="text-zinc-400">{i + 1}.</span>
            <span>{node}</span>
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-semibold">{t("h2How")}</h2>
      <ol className="space-y-2 text-zinc-600 dark:text-zinc-400 list-decimal list-inside">
        {howSteps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>

      <h2 className="text-xl font-semibold">{t("h2Who")}</h2>
      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{t("whoBody")}</p>

      <div className="pt-4">
        <Link
          href="/app"
          className="rounded bg-zinc-900 dark:bg-zinc-100 px-6 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
        >
          {t("cta")}
        </Link>
      </div>
    </div>
  );
}
