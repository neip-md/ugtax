import type { MetadataRoute } from "next";

const BASE = "https://ugtax.de";

// Locale-prefixed routes. German is the default locale and is served without a
// prefix (localePrefix: "as-needed" in i18n/routing.ts).
const LOCALISED = ["", "/app", "/jahresabschluss", "/vergleich", "/e-bilanz"];

// Legal pages sit outside the [locale] segment and are German only.
const UNLOCALISED = ["/imprint", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  const localised = LOCALISED.map((path) => ({
    url: `${BASE}${path || "/"}`,
    lastModified: now,
    alternates: {
      languages: {
        de: `${BASE}${path || "/"}`,
        en: `${BASE}/en${path}`,
        "x-default": `${BASE}${path || "/"}`,
      },
    },
  }));

  const english = LOCALISED.map((path) => ({
    url: `${BASE}/en${path}`,
    lastModified: now,
  }));

  const legal = UNLOCALISED.map((path) => ({
    url: `${BASE}${path}`,
    lastModified: now,
  }));

  return [...localised, ...english, ...legal];
}
