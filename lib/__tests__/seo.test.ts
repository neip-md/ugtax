/**
 * Search plumbing that fails silently when it breaks: a guide that exists but
 * is linked from nowhere, a tool page that slips into the index, or a dash in
 * copy that the house-style test never sees because it lives outside messages/.
 */

import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import path from "path";
import { isNoindexPath } from "@/app/seo";
import sitemap from "@/app/sitemap";
import { GUIDE_INDEX, guidesFor } from "@/content/guide-index";
import { disclosureGuide, holdingTaxGuide, reserveGuide } from "@/content/guides";

const ROOT = path.resolve(__dirname, "../..");

describe("noindex", () => {
  it.each(["/app", "/en/app", "/review", "/en/results", "/login", "/signup", "/profile"])(
    "keeps %s out of the index",
    (p) => expect(isNoindexPath(p)).toBe(true),
  );

  it.each(["/", "/en", "/jahresabschluss", "/en/holding-ug-steuern", "/application-guide"])(
    "leaves %s indexable",
    (p) => expect(isNoindexPath(p)).toBe(false),
  );
});

describe("guide index", () => {
  it.each(GUIDE_INDEX.map((g) => g.path))("%s has a page", (p) => {
    expect(existsSync(path.join(ROOT, "app/[locale]", p, "page.tsx"))).toBe(true);
  });

  it("lists every guide in the sitemap", () => {
    const urls = sitemap().map((entry) => entry.url);
    for (const guide of GUIDE_INDEX) {
      expect(urls, guide.path).toContain(`https://ugtax.de/en${guide.path}`);
      if (guide.de) expect(urls, guide.path).toContain(`https://ugtax.de${guide.path}`);
    }
  });

  it("offers German readers only the guides that exist in German", () => {
    const german = guidesFor("de").map((g) => g.path);
    expect(german).not.toContain("/ug-tax-filing-checklist");
    expect(german).toContain("/holding-ug-steuern");
  });
});

describe("guide content", () => {
  const guides = [holdingTaxGuide, disclosureGuide, reserveGuide].flatMap((g) => [g.de, g.en]);

  it.each(guides.map((g) => [g.path, g] as const))("%s fits a search result", (_, guide) => {
    expect(guide.description.length).toBeLessThanOrEqual(160);
    expect((guide.metaTitle ?? guide.title).length).toBeLessThanOrEqual(65);
  });

  it.each(readdirSync(path.join(ROOT, "content")))("%s contains no em-dash or en-dash", (file) => {
    const text = readFileSync(path.join(ROOT, "content", file), "utf8");
    expect(text.match(/[—–]/g) ?? []).toHaveLength(0);
  });
});
