import type { MetadataRoute } from "next";
import { ENGLISH_GUIDE_PATHS, GUIDE_UPDATED, SITE_URL } from "./seo";

const LOCALISED = ["", "/jahresabschluss", "/vergleich", "/e-bilanz"];
const UNLOCALISED = ["/imprint", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const localised = LOCALISED.flatMap((path) => {
    const de = `${SITE_URL}${path || "/"}`;
    const en = `${SITE_URL}/en${path}`;
    return [de, en].map((url) => ({
      url,
      lastModified: GUIDE_UPDATED,
      alternates: { languages: { de, en, "x-default": de } },
    }));
  });
  const english = ENGLISH_GUIDE_PATHS.map((path) => {
    const url = `${SITE_URL}/en${path}`;
    return {
      url,
      lastModified: GUIDE_UPDATED,
      alternates: { languages: { en: url, "x-default": url } },
    };
  });
  const legal = UNLOCALISED.map((path) => ({ url: `${SITE_URL}${path}` }));
  return [...localised, ...english, ...legal];
}
