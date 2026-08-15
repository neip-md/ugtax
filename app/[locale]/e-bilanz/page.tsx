import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ebilanz" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function EBilanzPage() {
  const t = await getTranslations("ebilanz");

  const steps = [
    { title: t("step1Title"), body: t("step1Body") },
    { title: t("step2Title"), body: t("step2Body") },
    { title: t("step3Title"), body: t("step3Body") },
    { title: t("step4Title"), body: t("step4Body") },
  ];

  const faqs = [
    { q: t("faq1Q"), a: t("faq1A") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("faq3A") },
  ];

  return (
    <div className="max-w-3xl space-y-8 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t("h1")}</h1>

      <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">{t("intro")}</p>

      <h2 className="text-xl font-semibold">{t("h2What")}</h2>
      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{t("whatBody")}</p>

      <h2 className="text-xl font-semibold">{t("h2Taxonomy")}</h2>
      <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{t("taxonomyBody")}</p>

      <h2 className="text-xl font-semibold">{t("h2How")}</h2>
      <ol className="space-y-3 text-zinc-600 dark:text-zinc-400">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex-none w-7 h-7 rounded-full bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-xs font-medium text-zinc-600 dark:text-zinc-300">
              {i + 1}
            </span>
            <div>
              <strong className="text-zinc-800 dark:text-zinc-200">{step.title}</strong>
              <p className="text-sm mt-0.5">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <h2 className="text-xl font-semibold">{t("h2Faq")}</h2>
      <div className="space-y-4">
        {faqs.map((faq, i) => (
          <div key={i}>
            <h3 className="font-medium text-zinc-800 dark:text-zinc-200">{faq.q}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{faq.a}</p>
          </div>
        ))}
      </div>

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
