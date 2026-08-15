import { NextRequest, NextResponse } from "next/server";
import { generateJournal, generateStatements, type ClassifiedTransaction, withCompanyDefaults, type CompanyConfig } from "@/lib/engine";
import { generateXbrl } from "@/lib/xbrl";
import { checkOrigin, readJsonCapped, checkArrayLength } from "@/lib/security";
import {
  journalToCsv,
  statementsToCsv,
  generateFilingGuide,
  generateBundesanzeiger,
} from "@/lib/downloads";

// Bounded so an oversized or slow request cannot pin a worker indefinitely.
export const maxDuration = 30;

/**
 * Coerce the fiscal year to plain digits before it reaches a response header.
 *
 * `config.geschaeftsjahr` is caller-supplied and was interpolated directly into
 * Content-Disposition. CRLF is not injectable through fetch's header API, but a
 * quote or semicolon still lets the caller shape the filename parameter, so the
 * value is normalised instead of trusted.
 */
function safeYear(value: unknown): string {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 4);
  return digits || "unbekannt";
}


export async function POST(request: NextRequest) {
  try {
    const originError = checkOrigin(request);
    if (originError) return originError;

    const url = new URL(request.url);
    const fileType = url.searchParams.get("type") || "guide";

    const parsed = await readJsonCapped<{
      classified?: ClassifiedTransaction[];
      config?: { company?: CompanyConfig } & Partial<CompanyConfig>;
    }>(request);
    if (parsed.error) return parsed.error;
    const body = parsed.data;

    const tooMany = checkArrayLength(body.classified, "classified");
    if (tooMany) return tooMany;

    const classified: ClassifiedTransaction[] = body.classified || [];
    const config: CompanyConfig = withCompanyDefaults(
      body.config?.company ?? body.config,
    );

    const journal = generateJournal(classified);
    const results = generateStatements(journal, config);

    if (fileType === "guide") {
      const md = generateFilingGuide(results, config);
      return new NextResponse(md, {
        headers: {
          "Content-Type": "text/markdown; charset=utf-8",
          "Content-Disposition": 'attachment; filename="filing_guide.md"',
        },
      });
    }

    if (fileType === "journal") {
      const csv = journalToCsv(journal);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="buchungsjournal.csv"',
        },
      });
    }

    if (fileType === "xbrl") {
      const xbrl = generateXbrl(results, config);
      return new NextResponse(xbrl, {
        headers: {
          "Content-Type": "application/xml; charset=utf-8",
          "Content-Disposition": `attachment; filename="ebilanz_${safeYear(config.geschaeftsjahr)}.xbrl"`,
        },
      });
    }

    if (fileType === "bundesanzeiger") {
      const text = generateBundesanzeiger(results, config);
      return new NextResponse(text, {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Content-Disposition": `attachment; filename="offenlegung_${safeYear(config.geschaeftsjahr)}.txt"`,
        },
      });
    }

    if (fileType === "statements") {
      const csv = statementsToCsv(results);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="bilanz_guv.csv"',
        },
      });
    }

    return NextResponse.json({ error: `Unknown type: ${fileType}` }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Download failed" },
      { status: 500 },
    );
  }
}
