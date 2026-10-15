import type { MetadataRoute } from "next";
import { GUIDE_INDEX } from "@/content/guide-index";
import { GUIDE_UPDATED, SITE_URL } from "./seo";

const UNLOCALISED = ["/imprint", "/privacy"];

export default function sitemap(): MetadataRoute.Sitemap {
  const bilingual = ["", ...GUIDE_INDEX.filter((g) => g.de).map((g) => g.path)];
  const localised = bilingual.flatMap((path) => {
    const de = `${SITE_URL}${path || "/"}`;
    const en = `${SITE_URL}/en${path}`;
    return [de, en].map((url) => ({
      url,
      lastModified: GUIDE_UPDATED,
      alternates: { languages: { de, en, "x-default": de } },
    }));
  });
  const english = GUIDE_INDEX.filter((g) => !g.de).map(({ path }) => {
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
