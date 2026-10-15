import type { Metadata } from "next";

export const SITE_URL = "https://ugtax.de";
export const GUIDE_UPDATED = "2026-10-15";
export const ENGLISH_GUIDE_PATHS = [
  "/ug-tax-filing-checklist",
  "/ug-with-no-revenue",
];

/**
 * Tool pages: the upload form, the review and results steps, and the account
 * pages. They inherit the homepage's title and description, carry no content
 * a searcher wants, and compete with the landing page for the same queries.
 * proxy.ts sends `X-Robots-Tag: noindex, follow` for them.
 */
export const NOINDEX_PATHS = ["/app", "/review", "/results", "/login", "/signup", "/profile"];

export function isNoindexPath(pathname: string): boolean {
  const path = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return NOINDEX_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}

/** The share card for a locale; see app/[locale]/og-image/route.tsx. */
export function ogImage(locale: string) {
  return {
    url: `${SITE_URL}${locale === "de" ? "" : "/en"}/og-image`,
    width: 1200,
    height: 630,
    alt: "UGtax",
  };
}

export function guideMetadata(
  locale: string,
  path: string,
  title: string,
  description: string,
  englishOnly = false,
): Metadata {
  const canonical = `${SITE_URL}${locale === "de" ? "" : "/en"}${path}`;
  const languages = englishOnly
    ? { en: canonical, "x-default": canonical }
    : {
        de: `${SITE_URL}${path}`,
        en: `${SITE_URL}/en${path}`,
        "x-default": `${SITE_URL}${path}`,
      };
  return {
    title,
    description,
    alternates: { canonical, languages },
    openGraph: {
      title,
      description,
      url: canonical,
      type: "article",
      locale: locale === "de" ? "de_DE" : "en_US",
      siteName: "UGtax",
      modifiedTime: GUIDE_UPDATED,
      images: [ogImage(locale)],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage(locale).url] },
  };
}

/** The publisher entity, referenced by @id from every page's structured data. */
export const ORGANIZATION = {
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: "UGtax",
  url: SITE_URL,
  logo: `${SITE_URL}/favicon.svg`,
  sameAs: ["https://github.com/neip-md/ugtax"],
};

/** Article + breadcrumb (+ FAQ, when the page has one) for a guide page. */
export function guideStructuredData({
  locale,
  path,
  title,
  description,
  citations = [],
  faqs = [],
  updated = GUIDE_UPDATED,
}: {
  locale: string;
  path: string;
  title: string;
  description: string;
  citations?: string[];
  faqs?: { q: string; a: string }[];
  updated?: string;
}) {
  const home = locale === "de" ? SITE_URL : `${SITE_URL}/en`;
  const url = `${home}${path}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      ORGANIZATION,
      {
        "@type": "Article",
        "@id": `${url}#article`,
        headline: title,
        description,
        mainEntityOfPage: url,
        inLanguage: locale,
        dateModified: updated,
        author: { "@id": ORGANIZATION["@id"] },
        publisher: { "@id": ORGANIZATION["@id"] },
        ...(citations.length > 0 ? { citation: citations } : {}),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: locale === "de" ? "Startseite" : "Home", item: home },
          { "@type": "ListItem", position: 2, name: title, item: url },
        ],
      },
      ...(faqs.length > 0 ? [faqPage(faqs)] : []),
    ],
  };
}

export function faqPage(faqs: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: faqs.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
}
