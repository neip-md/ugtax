import { Link } from "@/i18n/navigation";
import { GUIDE_UPDATED, guideStructuredData } from "@/app/seo";
import { JsonLd } from "@/components/JsonLd";
import type { GuideContent } from "@/content/guides";

const LABELS = {
  de: {
    home: "Startseite",
    kicker: "UGtax-Ratgeber",
    by: "Von UGtax · Aktualisiert",
    toc: "Auf dieser Seite",
    faq: "Häufige Fragen",
    sources: "Quellen und Umfang",
    scope:
      "Allgemeine Informationen für Gründer einer UG. Maßgeblich sind die verlinkten amtlichen Quellen; dieser Ratgeber bestimmt nicht die Pflichten Ihrer Gesellschaft im Einzelfall und ist keine Steuerberatung. Steuerliche Regeln und technische Vorgaben können sich ändern.",
    ctaTitle: "Unterlagen mit UGtax vorbereiten",
    ctaBody:
      "Bankexport importieren, Buchungen prüfen und Unterlagen herunterladen. Eröffnungswerte, Vorgänge außerhalb des Bankkontos und Abgabepflichten vor der Abgabe prüfen. Die direkte E-Bilanz-Übermittlung erfordert das Self-Hosting mit ERiC.",
    ctaButton: "Mit dem Bankexport starten",
    related: "Weitere Ratgeber",
  },
  en: {
    home: "Home",
    kicker: "UGtax guides",
    by: "By UGtax · Updated",
    toc: "On this page",
    faq: "Frequently asked questions",
    sources: "Sources and scope",
    scope:
      "General information for founders of German UGs. The linked official sources govern; this guide does not determine your company's individual filing obligations. Tax rules and software requirements can change.",
    ctaTitle: "Prepare your records with UGtax",
    ctaBody:
      "Import your bank export, review the bookkeeping and download your records. Check opening balances, non-bank entries and filing requirements before submitting. Direct E-Bilanz transmission requires the self-hosted ERiC setup.",
    ctaButton: "Start with your bank export",
    related: "Related guides",
  },
};

export function Guide({ guide, locale }: { guide: GuideContent; locale: "de" | "en" }) {
  const l = LABELS[locale];
  const updated = guide.updated ?? GUIDE_UPDATED;
  const structuredData = guideStructuredData({
    locale,
    path: guide.path,
    title: guide.title,
    description: guide.description,
    citations: guide.sources.map((source) => source.href),
    faqs: guide.faqs,
    updated,
  });
  return (
    <article className="max-w-3xl mx-auto space-y-10 py-8">
      <JsonLd data={structuredData} />
      <header className="space-y-5">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/" className="underline underline-offset-4">{l.home}</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{guide.title}</span>
        </nav>
        <p className="text-xs font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">{l.kicker}</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{guide.title}</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">{guide.intro}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {l.by}{" "}
          <time dateTime={updated}>
            {new Intl.DateTimeFormat(locale === "de" ? "de-DE" : "en-GB", { dateStyle: "long", timeZone: "UTC" }).format(new Date(updated))}
          </time>
        </p>
      </header>
      <nav aria-label={l.toc} className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
        <h2 className="font-semibold">{l.toc}</h2>
        <ul className="space-y-2 text-sm">
          {guide.sections.map((section) => <li key={section.id}><a href={`#${section.id}`} className="underline underline-offset-4 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">{section.title}</a></li>)}
          {guide.faqs && guide.faqs.length > 0 && <li><a href="#faq" className="underline underline-offset-4 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">{l.faq}</a></li>}
        </ul>
      </nav>
      {guide.sections.map((section) => (
        <section key={section.id} id={section.id} className="space-y-4 scroll-mt-8">
          <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph} className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{paragraph}</p>)}
          {section.items && <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
        </section>
      ))}
      {guide.faqs && guide.faqs.length > 0 && (
        <section id="faq" className="space-y-6 scroll-mt-8">
          <h2 className="text-xl font-semibold tracking-tight">{l.faq}</h2>
          {guide.faqs.map((faq) => (
            <div key={faq.q} className="space-y-2">
              <h3 className="font-medium text-zinc-800 dark:text-zinc-200">{faq.q}</h3>
              <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </section>
      )}
      <section className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-8">
        <h2 className="text-xl font-semibold">{l.sources}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{l.scope}</p>
        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">{guide.sources.map((source) => <li key={source.href}><a href={source.href} className="underline underline-offset-4">{source.label}</a></li>)}</ul>
      </section>
      <aside className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 space-y-4">
        <h2 className="text-xl font-semibold">{l.ctaTitle}</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">{l.ctaBody}</p>
        <Link href="/app" className="inline-block rounded bg-zinc-900 dark:bg-zinc-100 px-5 py-3 text-sm font-medium text-white dark:text-zinc-900">{l.ctaButton}</Link>
      </aside>
      <nav aria-label={l.related} className="space-y-4">
        <h2 className="text-xl font-semibold">{l.related}</h2>
        <ul className="space-y-3">{guide.related.map((link) => <li key={link.href}><Link href={link.href} className="underline underline-offset-4 text-zinc-600 dark:text-zinc-400">{link.label}</Link></li>)}</ul>
      </nav>
    </article>
  );
}
