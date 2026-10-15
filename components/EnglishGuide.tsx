import { Guide } from "@/components/Guide";
import type { EnglishGuideContent } from "@/content/english-guides";

/** The English-only guides, rendered by the shared guide layout. */
export function EnglishGuide({ guide }: { guide: EnglishGuideContent }) {
  return <Guide guide={guide} locale="en" />;
}
