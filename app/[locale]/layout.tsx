import type { Metadata } from "next";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import Link from "next/link";
import { routing } from "@/i18n/routing";
import { Providers } from "../providers";
import { HtmlShell } from "../shell";
import { Header } from "./header";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  // Title, description and og:locale come from the message files rather than a
  // hardcoded root block, which previously served German metadata on every
  // English page.
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("title"),
    description: t("description"),
    openGraph: {
      title: t("title"),
      description: t("ogDescription"),
      type: "website",
      locale: t("ogLocale"),
      siteName: "UGtax",
    },
    alternates: {
      canonical: locale === "de" ? "/" : `/${locale}`,
      languages: {
        de: "/",
        en: "/en",
        // Tells a crawler which version to serve for an unmatched language.
        // Without it the locales compete for the same queries.
        "x-default": "/",
      },
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const messages = (await import(`../../messages/${locale}.json`)).default;
  // Read the theme server-side so the first client render agrees with the
  // server HTML (M12: hydration failed for every user on light mode).
  const cookieTheme = (await cookies()).get("theme")?.value;
  const initialTheme = cookieTheme === "light" || cookieTheme === "dark" ? cookieTheme : undefined;
  const t = await getTranslations({ locale, namespace: "footer" });

  return (
    <HtmlShell lang={locale}>
      <NextIntlClientProvider locale={locale} messages={messages}>
        <Providers initialTheme={initialTheme}>
        <Header />
        <main className="flex-1 px-6 py-8">
          <div className="max-w-5xl mx-auto">{children}</div>
        </main>
        {/* Contrast: the previous shades measured 2.58:1 for body text and
            1.91:1 for the legal line against the dark background, well under
            the 4.5:1 of WCAG 1.4.3. That line carries the statutory Impressum
            and Datenschutz links, so it has to be readable. */}
        <footer className="border-t border-zinc-200 dark:border-zinc-800 px-6 py-8 text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed">
          <div className="max-w-5xl mx-auto space-y-3">
            <p>
              <strong className="text-zinc-700 dark:text-zinc-300">{t("disclaimerTitle")}</strong>{" "}
              {t("disclaimerBody")}
            </p>
            <p>
              <strong className="text-zinc-700 dark:text-zinc-300">{t("elsterTitle")}</strong>{" "}
              {t("elsterBody")}
            </p>
            <p className="text-zinc-600 dark:text-zinc-400">
              {t("legalLine")}
              {" · "}
              <Link href="/imprint" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">{t("imprint")}</Link>
              {" · "}
              <Link href="/privacy" className="underline hover:text-zinc-900 dark:hover:text-zinc-100">{t("privacy")}</Link>
            </p>
          </div>
        </footer>
        </Providers>
      </NextIntlClientProvider>
    </HtmlShell>
  );
}
