import { NextRequest, NextResponse } from "next/server";
import { parseCamt053, parseCsv, parseXlsx, classifyTransactions, type CounterpartyConfig, type Transaction, type ClassifiedTransaction } from "@/lib/engine";
import { MAX_UPLOAD_BYTES, MAX_ZIP_UNCOMPRESSED_BYTES, checkOrigin } from "@/lib/security";
import yaml from "js-yaml";
import JSZip from "jszip";

const BANK_EXTENSIONS = [".xml", ".csv", ".tsv", ".xlsx", ".xls"];

class ZipBombError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZipBombError";
  }
}

async function extractFromZip(
  zipBuffer: ArrayBuffer,
  year: number,
): Promise<{ transactions: Transaction[]; preClassified: ClassifiedTransaction[]; fileName: string }> {
  const zip = await JSZip.loadAsync(zipBuffer);
  const candidates: { name: string; ext: string }[] = [];
  let totalUncompressed = 0;

  let entriesSeen = 0;
  let sizesRead = 0;

  zip.forEach((relativePath, entry) => {
    if (entry.dir) return;
    const lower = relativePath.toLowerCase();
    // Skip macOS metadata and hidden files
    if (lower.includes("__macosx") || lower.startsWith(".")) return;
    entriesSeen++;
    // uncompressedSize lives on a JSZip internal (_data), which is the only
    // place the declared size is exposed before decompressing. Track whether we
    // actually managed to read it: the previous `?? 0` meant a JSZip rename
    // would silently make every entry weigh nothing, the cap below would never
    // fire, and the test suite would stay green while the guard was dead.
    const size = (entry as unknown as { _data?: { uncompressedSize?: number } })
      ._data?.uncompressedSize;
    if (typeof size === "number" && Number.isFinite(size)) {
      sizesRead++;
      totalUncompressed += size;
    }
    for (const ext of BANK_EXTENSIONS) {
      if (lower.endsWith(ext)) {
        candidates.push({ name: relativePath, ext });
        break;
      }
    }
  });

  // Fail closed. If there were entries but not one declared size could be read,
  // the guard cannot do its job and we must not proceed to decompress.
  if (entriesSeen > 0 && sizesRead === 0) {
    throw new ZipBombError(
      "ZIP-Groesse konnte nicht geprueft werden (JSZip-Interna geaendert?). " +
        "Aus Sicherheitsgruenden abgelehnt.",
    );
  }

  if (totalUncompressed > MAX_ZIP_UNCOMPRESSED_BYTES) {
    throw new ZipBombError(
      `ZIP zu groß nach Entpacken: ${(totalUncompressed / 1024 / 1024).toFixed(1)} MB (max ${MAX_ZIP_UNCOMPRESSED_BYTES / 1024 / 1024} MB).`,
    );
  }

  if (candidates.length === 0) {
    throw new Error(
      "Keine Bankexport-Datei im ZIP gefunden. Erwartet: .xml, .csv, .xlsx"
    );
  }

  // Prefer XML > XLSX > CSV
  const priority = [".xml", ".xlsx", ".xls", ".csv", ".tsv"];
  candidates.sort((a, b) => priority.indexOf(a.ext) - priority.indexOf(b.ext));
  const chosen = candidates[0];
  const entry = zip.file(chosen.name)!;

  if (chosen.ext === ".xlsx" || chosen.ext === ".xls") {
    const buffer = await entry.async("arraybuffer");
    const result = parseXlsx(buffer, year);
    return { ...result, fileName: chosen.name };
  } else if (chosen.ext === ".xml") {
    const text = await entry.async("string");
    return { transactions: parseCamt053(text, year), preClassified: [], fileName: chosen.name };
  } else {
    const text = await entry.async("string");
    return { transactions: parseCsv(text, year), preClassified: [], fileName: chosen.name };
  }
}

export async function POST(request: NextRequest) {
  try {
    const originError = checkOrigin(request);
    if (originError) return originError;

    const formData = await request.formData();
    const bankFile = formData.get("bank_file") as File | null;
    const year = parseInt(formData.get("year") as string) || 2025;
    const configYaml = formData.get("config_yaml") as string | null;

    if (!bankFile) {
      return NextResponse.json({ error: "bank_file is required" }, { status: 400 });
    }

    if (bankFile.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        {
          code: "file_too_large",
          error: `Datei zu groß: ${(bankFile.size / 1024 / 1024).toFixed(1)} MB (max ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).`,
        },
        { status: 413 },
      );
    }

    const fileName = bankFile.name.toLowerCase();
    let transactions: Transaction[] = [];
    let preClassified: ClassifiedTransaction[] = [];

    if (fileName.endsWith(".zip")) {
      const buffer = await bankFile.arrayBuffer();
      const result = await extractFromZip(buffer, year);
      transactions = result.transactions;
      preClassified = result.preClassified;
    } else if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
      const buffer = await bankFile.arrayBuffer();
      const result = parseXlsx(buffer, year);
      transactions = result.transactions;
      preClassified = result.preClassified;
    } else if (fileName.endsWith(".xml")) {
      const text = await bankFile.text();
      transactions = parseCamt053(text, year);
    } else {
      const text = await bankFile.text();
      transactions = parseCsv(text, year);
    }

    // Check for empty result after parsing
    if (transactions.length === 0 && preClassified.length === 0) {
      return NextResponse.json(
        { error: `Keine Transaktionen für das Geschäftsjahr ${year} gefunden. Prüfen Sie das Jahr und das Dateiformat.` },
        { status: 400 },
      );
    }

    // If we got pre-classified data (e.g. from a Buchungsjournal XLSX), return it directly
    if (preClassified.length > 0) {
      return NextResponse.json({
        transactionCount: preClassified.length,
        classified: preClassified,
        unclassified: [],
        year,
        importType: "journal",
      });
    }

    // Parse config for counterparty mappings
    const counterparties: CounterpartyConfig = {};
    if (configYaml) {
      try {
        const parsed = yaml.load(configYaml) as Record<string, unknown>;
        const cp = (parsed?.counterparties || {}) as Record<string, { account: string; description?: string }>;
        for (const [name, mapping] of Object.entries(cp)) {
          if (typeof mapping === "object" && mapping.account) {
            counterparties[name] = {
              account: String(mapping.account),
              description: mapping.description || "",
            };
          }
        }
      } catch {
        // Config parse error - continue with no counterparties
      }
    }

    const result = classifyTransactions(transactions, counterparties);

    return NextResponse.json({
      transactionCount: transactions.length,
      classified: result.classified,
      unclassified: result.unclassified,
      year,
      importType: "bank_export",
    });
  } catch (err) {
    if (err instanceof ZipBombError) {
      return NextResponse.json(
        { code: "zip_too_large", error: err.message },
        { status: 413 },
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 },
    );
  }
}
