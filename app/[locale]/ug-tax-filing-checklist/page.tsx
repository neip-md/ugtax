import { notFound } from "next/navigation";
import { guideMetadata } from "@/app/seo";
import { EnglishGuide } from "@/components/EnglishGuide";
import { filingChecklist as guide } from "@/content/english-guides";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props) {
  const { locale } = await params;
  if (locale !== "en") notFound();
  return guideMetadata(locale, guide.path, guide.title, guide.description, true);
}

export default async function Page({ params }: Props) {
  if ((await params).locale !== "en") notFound();
  return <EnglishGuide guide={guide} />;
}
