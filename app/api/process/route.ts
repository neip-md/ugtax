import { NextRequest, NextResponse } from "next/server";
import { generateJournal, generateStatements, type ClassifiedTransaction, withCompanyDefaults, type CompanyConfig } from "@/lib/engine";
import { checkOrigin, readJsonCapped, checkArrayLength } from "@/lib/security";

// Bounded so an oversized or slow request cannot pin a worker indefinitely.
export const maxDuration = 30;

type ProcessBody = {
  classified?: ClassifiedTransaction[];
  config?: { company?: CompanyConfig } & Partial<CompanyConfig>;
};

export async function POST(request: NextRequest) {
  try {
    const originError = checkOrigin(request);
    if (originError) return originError;

    const parsed = await readJsonCapped<ProcessBody>(request);
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

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Processing failed" },
      { status: 500 },
    );
  }
}
