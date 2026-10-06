import { Link } from "@/i18n/navigation";
import { GUIDE_UPDATED, SITE_URL } from "@/app/seo";
import type { EnglishGuideContent } from "@/content/english-guides";

export function EnglishGuide({ guide }: { guide: EnglishGuideContent }) {
  const url = `${SITE_URL}/en${guide.path}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: guide.title,
        description: guide.description,
        mainEntityOfPage: url,
        inLanguage: "en",
        dateModified: GUIDE_UPDATED,
        author: { "@type": "Organization", name: "UGtax", url: SITE_URL },
        publisher: { "@type": "Organization", name: "UGtax", url: SITE_URL },
        citation: guide.sources.map((source) => source.href),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/en` },
          { "@type": "ListItem", position: 2, name: guide.title, item: url },
        ],
      },
    ],
  };
  return (
    <article className="max-w-3xl mx-auto space-y-10 py-8">
      <script type="application/ld+json" dangerouslySetInnerHTML={{
        __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
      }} />
      <header className="space-y-5">
        <nav aria-label="Breadcrumb" className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/" className="underline underline-offset-4">Home</Link>
          <span aria-hidden="true"> / </span>
          <span aria-current="page">{guide.title}</span>
        </nav>
        <p className="text-xs font-mono uppercase tracking-wider text-zinc-600 dark:text-zinc-400">UGtax guides</p>
        <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight leading-tight">{guide.title}</h1>
        <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed">{guide.intro}</p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">By UGtax · Updated <time dateTime={GUIDE_UPDATED}>7 October 2026</time></p>
      </header>
      <nav aria-label="On this page" className="rounded-lg border border-zinc-200 dark:border-zinc-800 p-5 space-y-3">
        <h2 className="font-semibold">On this page</h2>
        <ul className="space-y-2 text-sm">
          {guide.sections.map((section) => <li key={section.id}><a href={`#${section.id}`} className="underline underline-offset-4 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100">{section.title}</a></li>)}
        </ul>
      </nav>
      {guide.sections.map((section) => (
        <section key={section.id} id={section.id} className="space-y-4 scroll-mt-8">
          <h2 className="text-xl font-semibold tracking-tight">{section.title}</h2>
          {section.paragraphs.map((paragraph) => <p key={paragraph} className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{paragraph}</p>)}
          {section.items && <ul className="list-disc pl-5 space-y-2 text-zinc-600 dark:text-zinc-400 leading-relaxed">{section.items.map((item) => <li key={item}>{item}</li>)}</ul>}
        </section>
      ))}
      <section className="space-y-4 border-t border-zinc-200 dark:border-zinc-800 pt-8">
        <h2 className="text-xl font-semibold">Sources and scope</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">General information for founders of German UGs. The linked official sources govern; this guide does not determine your company&apos;s individual filing obligations. Tax rules and software requirements can change.</p>
        <ul className="space-y-2 text-sm text-zinc-600 dark:text-zinc-400">{guide.sources.map((source) => <li key={source.href}><a href={source.href} className="underline underline-offset-4">{source.label}</a></li>)}</ul>
      </section>
      <aside className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 p-6 space-y-4">
        <h2 className="text-xl font-semibold">Prepare your records with UGtax</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">Import your bank export, review the bookkeeping and download your records. Check opening balances, non-bank entries and filing requirements before submitting. Direct E-Bilanz transmission requires the self-hosted ERiC setup.</p>
        <Link href="/app" className="inline-block rounded bg-zinc-900 dark:bg-zinc-100 px-5 py-3 text-sm font-medium text-white dark:text-zinc-900">Start with your bank export</Link>
      </aside>
      <nav aria-label="Related guides" className="space-y-4">
        <h2 className="text-xl font-semibold">Related guides</h2>
        <ul className="space-y-3">{guide.related.map((link) => <li key={link.href}><Link href={link.href} className="underline underline-offset-4 text-zinc-600 dark:text-zinc-400">{link.label}</Link></li>)}</ul>
      </nav>
    </article>
  );
}
