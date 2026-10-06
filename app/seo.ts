import type { Metadata } from "next";

export const SITE_URL = "https://ugtax.de";
export const GUIDE_UPDATED = "2026-10-07";
export const ENGLISH_GUIDE_PATHS = [
  "/ug-tax-filing-checklist",
  "/ug-with-no-revenue",
];

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
    },
    twitter: { card: "summary", title, description },
  };
}
