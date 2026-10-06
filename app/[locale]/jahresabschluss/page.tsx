import type { Metadata } from "next";
import { guideMetadata } from "@/app/seo";
import { getLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "jahresabschluss" });
  return guideMetadata(locale, "/jahresabschluss", t("metaTitle"), t("metaDescription"));
}

export default async function JahresabschlussPage() {
  const t = await getTranslations("jahresabschluss");
  const locale = await getLocale();

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

      <section className="space-y-3 text-sm text-zinc-600 dark:text-zinc-400">
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">{locale === "en" ? "Official sources" : "Offizielle Quellen"}</h2>
        <ul className="space-y-2">
          <li><a className="underline" href="https://www.gesetze-im-internet.de/ustg_1980/__19.html">§19 UStG</a></li>
          <li><a className="underline" href="https://www.gesetze-im-internet.de/hgb/__325.html">§325 HGB</a></li>
          <li><a className="underline" href="https://www.gesetze-im-internet.de/hgb/__267a.html">§267a HGB</a></li>
        </ul>
      </section>
      {locale === "en" && <nav aria-label="Related guides" className="space-y-3">
        <h2 className="text-xl font-semibold">Next steps</h2>
        <p><Link href="/ug-tax-filing-checklist" className="underline underline-offset-4">Use the complete UG tax filing checklist</Link></p>
        <p><Link href="/ug-with-no-revenue" className="underline underline-offset-4">Check the requirements for a UG with no revenue</Link></p>
      </nav>}
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
