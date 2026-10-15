import { ImageResponse } from "next/og";

/**
 * The share card, served at /og-image and /en/og-image.
 *
 * A route rather than the opengraph-image file convention: the convention
 * emitted /de/opengraph-image for the default locale (a redirect) and was
 * dropped on every page whose metadata sets its own openGraph block, which is
 * every guide. app/seo.ts references this URL explicitly instead.
 *
 * Generated rather than drawn, so the copy stays in step with the locale and
 * there is no binary asset to keep in sync with the site.
 */

const size = { width: 1200, height: 630 };

const COPY = {
  de: {
    title: "Holding-UG Jahresabschluss und E-Bilanz selbst erstellen",
    sub: "Bankexport hochladen · SKR04 · Bilanz, GuV, E-Bilanz",
    tags: "Kostenlos · Open Source · Claude, GPT, Gemini oder Open-Source-KI",
  },
  en: {
    title: "Annual accounts and E-Bilanz for your German holding UG",
    sub: "Upload a bank export · SKR04 · Bilanz, GuV, E-Bilanz",
    tags: "Free · Open source · Claude, GPT, Gemini or open-source AI",
  },
};

export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const copy = locale === "en" ? COPY.en : COPY.de;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#09090b",
          color: "#fafafa",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 14,
              background: "#fafafa",
              color: "#09090b",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 30,
              fontWeight: 700,
            }}
          >
            UG
          </div>
          <div style={{ fontSize: 40, fontWeight: 700 }}>UGtax</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 62, fontWeight: 700, lineHeight: 1.1, maxWidth: 1000 }}>{copy.title}</div>
          <div style={{ fontSize: 30, color: "#a1a1aa" }}>{copy.sub}</div>
        </div>
        <div style={{ fontSize: 26, color: "#a78bfa" }}>{copy.tags}</div>
      </div>
    ),
    { ...size, headers: { "Cache-Control": "public, max-age=86400, immutable" } },
  );
}
