import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function LandingPage() {
  const t = await getTranslations("landing");

  const steps = [
    { step: "1", title: t("step1Title"), desc: t("step1Desc") },
    { step: "2", title: t("step2Title"), desc: t("step2Desc") },
    { step: "3", title: t("step3Title"), desc: t("step3Desc") },
    { step: "4", title: t("step4Title"), desc: t("step4Desc") },
  ];

  const featureKeys = [
    "feature1", "feature2", "feature3", "feature4", "feature5", "feature6",
    "feature7", "feature8", "feature9", "feature10", "feature11", "feature12",
  ] as const;
  const features = featureKeys.map((key) => t(key));

  return (
    <div className="min-h-[80vh] flex flex-col">
      {/* Hero */}
      <section className="flex-1 flex flex-col justify-center py-20">
        <div className="max-w-2xl">
          <p className="text-sm font-mono text-zinc-500 dark:text-zinc-500 mb-4 tracking-wide">
            {t("tagline")}
          </p>
          <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1] text-zinc-900 dark:text-zinc-100">
            {t("heroTitle")}
          </h1>
          <p className="mt-6 text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-xl">
            {t("heroDesc")}
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Link
              href="/app"
              className="rounded bg-zinc-900 dark:bg-zinc-100 px-6 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
            >
              {t("cta")}
            </Link>
            <a
              href="https://github.com/neip-md/ugtax"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded border border-zinc-300 dark:border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="py-16 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-8">
          {t("problemTitle")}
        </h2>
        <div className="grid sm:grid-cols-3 gap-8">
          <div>
            <p className="text-3xl font-mono font-semibold text-zinc-900 dark:text-zinc-100">{t("problem1Value")}</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("problem1Desc")}</p>
          </div>
          <div>
            <p className="text-3xl font-mono font-semibold text-zinc-900 dark:text-zinc-100">{t("problem2Value")}</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("problem2Desc")}</p>
          </div>
          <div>
            <p className="text-3xl font-mono font-semibold text-zinc-900 dark:text-zinc-100">{t("problem3Value")}</p>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{t("problem3Desc")}</p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-16 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-8">
          {t("howTitle")}
        </h2>
        <div className="grid sm:grid-cols-4 gap-6">
          {steps.map((item) => (
            <div key={item.step} className="space-y-2">
              <div className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-400">
                {item.step}
              </div>
              <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{item.title}</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI classification */}
      <section className="py-20 border-t border-zinc-200 dark:border-zinc-800">
        <div className="relative overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-gradient-to-br from-zinc-50 via-white to-zinc-100 dark:from-zinc-900 dark:via-zinc-900 dark:to-zinc-800 p-8 sm:p-12">
          <div className="absolute -top-24 -right-24 w-64 h-64 rounded-full bg-violet-500/10 dark:bg-violet-500/5 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-blue-500/10 dark:bg-blue-500/5 blur-3xl" />

          <div className="relative space-y-8">
            <div className="space-y-3">
              <p className="text-xs font-mono font-medium tracking-widest uppercase text-violet-600 dark:text-violet-400">
                {t("aiLabel")}
              </p>
              <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
                {t("aiTitle")}<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-blue-600 dark:from-violet-400 dark:to-blue-400">
                  {t("aiTitleHighlight")}
                </span>
              </h2>
              <p className="text-zinc-600 dark:text-zinc-400 max-w-xl leading-relaxed">
                {t("aiDesc")}
              </p>
            </div>

            {/* Mock UI preview */}
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-700/50 bg-white dark:bg-zinc-950 shadow-lg overflow-hidden max-w-2xl">
              <div className="px-4 py-2.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex items-center gap-2">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-300 dark:bg-zinc-700" />
                </div>
                <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-600 ml-2">{t("aiMockTitle")}</span>
              </div>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-zinc-100 dark:border-zinc-800 text-left text-[10px] text-zinc-400 dark:text-zinc-600">
                    <th className="px-4 py-2 font-medium">{t("aiMockBooking")}</th>
                    <th className="px-4 py-2 font-medium">{t("aiMockAmount")}</th>
                    <th className="px-4 py-2 font-medium">{t("aiMockSuggestion")}</th>
                    <th className="px-4 py-2 font-medium">{t("aiMockConfidence")}</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">IHK Beitrag 2025</td>
                    <td className="px-4 py-2.5 text-red-500">-150,00</td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">6830 &mdash; Sonstige Abgaben</td>
                    <td className="px-4 py-2.5"><span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{t("aiMockHigh")}</span></td>
                  </tr>
                  <tr className="border-b border-zinc-50 dark:border-zinc-800/50">
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">Notar Dr. M&uuml;ller</td>
                    <td className="px-4 py-2.5 text-red-500">-892,50</td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">6827 &mdash; Rechts- und Beratungskosten</td>
                    <td className="px-4 py-2.5"><span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">{t("aiMockHigh")}</span></td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2.5 text-zinc-700 dark:text-zinc-300">STRIPE TRANSFER</td>
                    <td className="px-4 py-2.5 text-green-500">+2.340,00</td>
                    <td className="px-4 py-2.5 text-zinc-600 dark:text-zinc-400">4400 &mdash; Erl&ouml;se</td>
                    <td className="px-4 py-2.5"><span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400">{t("aiMockMedium")}</span></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid sm:grid-cols-3 gap-4 max-w-2xl">
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-violet-600 dark:text-violet-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("aiFeature1Title")}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t("aiFeature1Desc")}</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("aiFeature2Title")}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t("aiFeature2Desc")}</p>
                </div>
              </div>
              <div className="flex gap-3 items-start">
                <div className="mt-0.5 w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{t("aiFeature3Title")}</p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{t("aiFeature3Desc")}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* For whom */}
      <section className="py-16 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-8">
          {t("forWhomTitle")}
        </h2>
        <div className="grid sm:grid-cols-2 gap-6">
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-5 space-y-2">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("forWhom1Title")}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("forWhom1Desc")}</p>
          </div>
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-5 space-y-2">
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("forWhom2Title")}</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{t("forWhom2Desc")}</p>
          </div>
        </div>
      </section>

      {/* What you get */}
      <section className="py-16 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-8">
          {t("whatYouGetTitle")}
        </h2>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          {features.map((item) => (
            <div key={item} className="flex items-start gap-2 text-zinc-600 dark:text-zinc-400">
              <span className="text-green-500 mt-0.5 flex-shrink-0">&#10003;</span>
              {item}
            </div>
          ))}
        </div>
      </section>

      {/* Self-hosting / ELSTER */}
      <section id="self-hosting" className="py-16 border-t border-zinc-200 dark:border-zinc-800 scroll-mt-24">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-3">
          {t("selfHostTitle")}
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-6 max-w-2xl">
          {t("selfHostDesc")}
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-8">
          {t("selfHostPrereq")}{" "}
          <a href="https://www.docker.com/products/docker-desktop/" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">
            {t("selfHostPrereqLink")}
          </a>{" "}
          {t("selfHostPrereqSuffix")}
        </p>
        <div className="grid sm:grid-cols-3 gap-6 mb-8">
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-5 space-y-2">
            <div className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-400">1</div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("selfHostStep1Title")}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {t("selfHostStep1Desc")}{" "}
              <a href="https://www.elster.de/eportal/infoseite/entwickler" target="_blank" rel="noopener noreferrer" className="underline hover:text-zinc-700 dark:hover:text-zinc-300">
                {t("selfHostStep1Link")}
              </a>
              {t("selfHostStep1Suffix")}
            </p>
          </div>
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-5 space-y-2">
            <div className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-400">2</div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("selfHostStep2Title")}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">
                git clone https://github.com/neip-md/ugtax
              </code>
              <br />
              <code className="font-mono bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-[11px]">
                docker compose up --build
              </code>
            </p>
          </div>
          <div className="rounded border border-zinc-200 dark:border-zinc-800 p-5 space-y-2">
            <div className="w-8 h-8 rounded-full border border-zinc-300 dark:border-zinc-700 flex items-center justify-center text-xs font-mono font-semibold text-zinc-600 dark:text-zinc-400">3</div>
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{t("selfHostStep3Title")}</h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("selfHostStep3Desc")}</p>
          </div>
        </div>
        <a
          href="https://github.com/neip-md/ugtax#self-hosting-docker-compose"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded border border-zinc-300 dark:border-zinc-700 px-5 py-2.5 text-sm font-medium text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          {t("selfHostGuide")} &rarr;
        </a>
      </section>

      {/* Ratgeber */}
      <section className="py-16 border-t border-zinc-200 dark:border-zinc-800">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 mb-8">
          {t("guidesTitle")}
        </h2>
        <div className="grid sm:grid-cols-3 gap-4">
          <Link
            href="/jahresabschluss"
            className="rounded border border-zinc-200 dark:border-zinc-800 p-5 space-y-1.5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
              {t("guide1Title")} &rarr;
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("guide1Desc")}</p>
          </Link>
          <Link
            href="/vergleich"
            className="rounded border border-zinc-200 dark:border-zinc-800 p-5 space-y-1.5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
              {t("guide2Title")} &rarr;
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("guide2Desc")}</p>
          </Link>
          <Link
            href="/e-bilanz"
            className="rounded border border-zinc-200 dark:border-zinc-800 p-5 space-y-1.5 hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors group"
          >
            <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-900 dark:group-hover:text-zinc-100">
              {t("guide3Title")} &rarr;
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{t("guide3Desc")}</p>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 border-t border-zinc-200 dark:border-zinc-800 text-center">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("ctaTitle")}
        </h2>
        <p className="mt-3 text-zinc-500 dark:text-zinc-400">
          {t("ctaDesc")}
        </p>
        <div className="mt-8">
          <Link
            href="/app"
            className="rounded bg-zinc-900 dark:bg-zinc-100 px-8 py-3 text-sm font-medium text-white dark:text-zinc-900 hover:bg-zinc-800 dark:hover:bg-white transition-colors"
          >
            {t("cta")}
          </Link>
        </div>
      </section>
    </div>
  );
}
