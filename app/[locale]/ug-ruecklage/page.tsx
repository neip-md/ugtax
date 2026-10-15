import { guideMetadata } from "@/app/seo";
import { Guide } from "@/components/Guide";
import { reserveGuide as guide } from "@/content/guides";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  const content = locale === "en" ? guide.en : guide.de;
  return guideMetadata(locale, content.path, content.metaTitle ?? content.title, content.description);
}

export default async function Page({ params }: Props) {
  const locale = (await params).locale === "en" ? "en" : "de";
  return <Guide guide={guide[locale]} locale={locale} />;
}
