import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "vergleich" });
  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function VergleichPage() {
  const t = await getTranslations("vergleich");

  const rows: Array<[string, string, string, string]> = [
    [t("rowCost"), t("costUgtax"), t("costSteuerberater"), t("costEbilanz")],
    [t("rowEbilanz"), t("yes"), t("yes"), t("yes")],
    [t("rowBank"), t("bankUgtax"), t("bankSteuerberater"), t("no")],
    [t("rowAi"), t("aiUgtax"), t("aiSteuerberater"), t("no")],
    [t("rowTaxes"), t("taxesUgtax"), t("taxesSteuerberater"), t("no")],
    [t("rowBundesanzeiger"), t("bundesanzeigerUgtax"), t("bundesanzeigerSteuerberater"), t("no")],
    [t("rowElster"), t("elsterUgtax"), t("elsterSteuerberater"), t("yes")],
    [t("rowOss"), t("ossUgtax"), t("no"), t("no")],
    [t("rowSuited"), t("suitedUgtax"), t("suitedSteuerberater"), t("suitedEbilanz")],
  ];

  const whenItems = [t("when1"), t("when2"), t("when3"), t("when4"), t("when5")];

  return (
    <div className="max-w-3xl space-y-8 py-8">
      <h1 className="text-3xl font-semibold tracking-tight">{t("h1")}</h1>

      <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">{t("intro")}</p>

      <div className="overflow-x-auto rounded border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400"></th>
              <th className="px-4 py-3 text-left font-medium text-zinc-900 dark:text-zinc-100">{t("colUgtax")}</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">{t("colSteuerberater")}</th>
              <th className="px-4 py-3 text-left font-medium text-zinc-500 dark:text-zinc-400">{t("colEbilanz")}</th>
            </tr>
          </thead>
          <tbody className="text-zinc-600 dark:text-zinc-400">
            {rows.map(([label, c1, c2, c3], i) => (
              <tr key={i} className={i === rows.length - 1 ? "" : "border-b border-zinc-100 dark:border-zinc-800/50"}>
                <td className="px-4 py-3 font-medium">{label}</td>
                <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{c1}</td>
                <td className="px-4 py-3">{c2}</td>
                <td className="px-4 py-3">{c3}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="text-xl font-semibold">{t("h2When")}</h2>
      <ul className="space-y-1 text-zinc-600 dark:text-zinc-400 list-disc list-inside">
        {whenItems.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>

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
