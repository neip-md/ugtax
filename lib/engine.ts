/**
 * Core tax engine - TypeScript port of the Python ug_steuer library.
 * Handles: parsing, classification, bookkeeping, and financial statements.
 */

// ─── Types ───────────────────────────────────────────────────────────────

export type Direction = "credit" | "debit";

export type Transaction = {
  date: string; // ISO date
  amount: string; // Decimal as string for precision
  direction: Direction;
  counterparty: string;
  reference: string;
  rawCode?: string;
};

export type ClassificationSource = "rule" | "config" | "manual" | "llm" | "import";

export type ClassifiedTransaction = Transaction & {
  account: string;
  accountName: string;
  description: string;
  source: ClassificationSource;
};

export type JournalEntry = {
  date: string;
  debitAccount: string;
  debitAccountName: string;
  creditAccount: string;
  creditAccountName: string;
  amount: string;
  description: string;
};

export type CompanyConfig = {
  name: string;
  steuernummer: string;
  finanzamt: string;
  geschaeftsjahr: number;
  kleinunternehmer: boolean;
  stammkapital: string;
  gewinnvortrag: string;
  sitz?: string;
};

export const COMPANY_CONFIG_DEFAULTS: CompanyConfig = {
  name: "",
  steuernummer: "",
  finanzamt: "",
  geschaeftsjahr: 2025,
  kleinunternehmer: true,
  stammkapital: "1000.00",
  gewinnvortrag: "0.00",
};

/**
 * Fill any missing field from the defaults.
 *
 * The API routes previously did `body.config?.company || body.config || {…}`,
 * which took a caller-supplied config wholesale. A partially filled config was
 * therefore used as-is, leaving fields undefined downstream. Merging guarantees
 * a complete CompanyConfig whatever the caller sends.
 */
export function withCompanyDefaults(
  partial: Partial<CompanyConfig> | undefined | null,
): CompanyConfig {
  return { ...COMPANY_CONFIG_DEFAULTS, ...(partial ?? {}) };
}

export type Bilanz = {
  aktiva: Record<string, number>;
  passiva: Record<string, number>;
  summeAktiva: number;
  summePassiva: number;
  isBalanced: boolean;
};

export type GuV = {
  aufwendungen: Record<string, number>;
  ertraege: Record<string, number>;
  summeAufwendungen: number;
  summeErtraege: number;
  jahresueberschuss: number;
};

export type ProcessResults = {
  bilanz: Bilanz;
  guv: GuV;
  journalEntryCount: number;
  warnings: string[];
  fiscalYear: number;
  companyName: string;
};

// ─── SKR04 Accounts ──────────────────────────────────────────────────────

type AccountCategory = "asset" | "liability" | "equity" | "revenue" | "expense";

export const ACCOUNTS: Record<string, { name: string; category: AccountCategory }> = {
  "0520": { name: "Anteile an verbundenen Unternehmen", category: "asset" },
  "0535": { name: "Wertpapiere des Anlagevermögens", category: "asset" },
  "0540": { name: "Ausleihungen an verbundene Unternehmen", category: "asset" },
  "1810": { name: "Bank", category: "asset" },
  "1800": { name: "Bank 2", category: "asset" },
  "2900": { name: "Gezeichnetes Kapital", category: "equity" },
  "2909": { name: "Ausstehende Einlagen", category: "equity" },
  "2960": { name: "Gesetzliche Rücklage", category: "equity" },
  "2970": { name: "Gewinnvortrag vor Verwendung", category: "equity" },
  "2978": { name: "Verlustvortrag vor Verwendung", category: "equity" },
  "2979": { name: "Jahresüberschuss/Jahresfehlbetrag", category: "equity" },
  "3510": { name: "Verbindlichkeiten ggü. Gesellschaftern", category: "liability" },
  "3500": { name: "Sonstige Verbindlichkeiten", category: "liability" },
  "4830": { name: "Sonstige betriebliche Erträge", category: "revenue" },
  "4840": { name: "Erträge aus Beteiligungen", category: "revenue" },
  "6300": { name: "Sonstige betriebliche Aufwendungen", category: "expense" },
  "6827": { name: "Rechts- und Beratungskosten", category: "expense" },
  "6830": { name: "Sonstige Abgaben", category: "expense" },
  "6855": { name: "Nebenkosten des Geldverkehrs", category: "expense" },
  "6880": { name: "Aufwendungen aus Währungsumrechnung", category: "expense" },
  "7610": { name: "Zinsen und ähnliche Aufwendungen", category: "expense" },
};

function getAccountName(num: string): string {
  return ACCOUNTS[num]?.name ?? `Unbekanntes Konto ${num}`;
}

function getAccountCategory(num: string): AccountCategory {
  if (ACCOUNTS[num]) return ACCOUNTS[num].category;
  const first = parseInt(num[0]);
  if (first <= 1) return "asset";
  if (first === 2) return "equity";
  if (first === 3) return "liability";
  if (first <= 5) return "revenue";
  return "expense";
}

// Bilanz mapping
const BILANZ_MAP: Record<string, { position: string; side: "aktiva" | "passiva" }> = {
  "0520": { position: "Finanzanlagen", side: "aktiva" },
  "0535": { position: "Finanzanlagen", side: "aktiva" },
  "0540": { position: "Finanzanlagen", side: "aktiva" },
  "1810": { position: "Guthaben bei Kreditinstituten", side: "aktiva" },
  "1800": { position: "Guthaben bei Kreditinstituten", side: "aktiva" },
  "2900": { position: "Gezeichnetes Kapital", side: "passiva" },
  "2909": { position: "Gezeichnetes Kapital", side: "passiva" },
  "2960": { position: "Gesetzliche Rücklage", side: "passiva" },
  "2970": { position: "Gewinnvortrag/Verlustvortrag", side: "passiva" },
  "2978": { position: "Gewinnvortrag/Verlustvortrag", side: "passiva" },
  "2979": { position: "Jahresüberschuss/Jahresfehlbetrag", side: "passiva" },
  "3510": { position: "Sonstige Verbindlichkeiten", side: "passiva" },
  "3500": { position: "Sonstige Verbindlichkeiten", side: "passiva" },
};

// ─── Parser ──────────────────────────────────────────────────────────────

export function parseCamt053(xmlText: string, fiscalYear?: number): Transaction[] {
  // Use regex-based parsing for the key elements (avoids heavy XML lib)
  const transactions: Transaction[] = [];

  // Extract all Ntry blocks
  const ntryRegex = /<Ntry>([\s\S]*?)<\/Ntry>/g;
  let match;

  while ((match = ntryRegex.exec(xmlText)) !== null) {
    const block = match[1];

    const amt = extractTag(block, "Amt") || "0.00";
    const cdi = extractTag(block, "CdtDbtInd") || "DBIT";
    const dateStr = extractTag(block, "Dt", block.indexOf("BookgDt")) || extractTag(block, "Dt") || "";
    const counterparty = cdi === "CRDT"
      ? extractTag(block, "Nm", block.indexOf("Dbtr"))
      : extractTag(block, "Nm", block.indexOf("Cdtr"));
    const reference = extractTag(block, "Ustrd") || extractTag(block, "AddtlNtryInf") || "";
    const rawCode = extractTag(block, "Cd", block.indexOf("Prtry")) || "";

    if (!dateStr) continue;

    const tx: Transaction = {
      date: dateStr,
      amount: amt,
      direction: cdi === "CRDT" ? "credit" : "debit",
      counterparty: counterparty || "",
      reference,
      rawCode,
    };

    if (fiscalYear && !tx.date.startsWith(String(fiscalYear))) continue;
    transactions.push(tx);
  }

  return transactions.sort((a, b) => a.date.localeCompare(b.date));
}

function extractTag(xml: string, tag: string, startFrom = 0): string | null {
  const searchFrom = Math.max(0, startFrom);
  const openTag = `<${tag}`;
  const idx = xml.indexOf(openTag, searchFrom);
  if (idx === -1) return null;
  const closeStart = xml.indexOf(">", idx);
  if (closeStart === -1) return null;
  const closeTag = `</${tag}>`;
  const endIdx = xml.indexOf(closeTag, closeStart);
  if (endIdx === -1) return null;
  return xml.substring(closeStart + 1, endIdx).trim();
}

export function parseCsv(csvText: string, fiscalYear?: number): Transaction[] {
  const lines = csvText.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const delimiter = lines[0].includes(";") ? ";" : ",";
  const headers = lines[0].split(delimiter).map((h) => h.trim());

  const dateCol = headers.findIndex((h) => /buchungstag|datum|date/i.test(h));
  const amtCol = headers.findIndex((h) => /betrag|amount/i.test(h));
  const cpCol = headers.findIndex((h) => /auftraggeber|empf|counterparty|name/i.test(h));
  const refCol = headers.findIndex((h) => /verwendungszweck|reference|zweck/i.test(h));

  if (dateCol === -1 || amtCol === -1) return [];

  const transactions: Transaction[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(delimiter).map((c) => c.trim());
    if (cols.length <= Math.max(dateCol, amtCol)) continue;

    const rawDate = cols[dateCol];
    const rawAmt = cols[amtCol];
    if (!rawDate || !rawAmt) continue;

    // Parse German date (DD.MM.YYYY) or ISO
    let isoDate = rawDate;
    const dmyMatch = rawDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (dmyMatch) {
      isoDate = `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
    }

    if (fiscalYear && !isoDate.startsWith(String(fiscalYear))) continue;

    // Parse German amount (1.234,56 or -150,00)
    let amtStr = rawAmt.replace(/[€\s]/g, "");
    if (amtStr.includes(",") && amtStr.includes(".")) {
      amtStr = amtStr.replace(/\./g, "").replace(",", ".");
    } else if (amtStr.includes(",")) {
      amtStr = amtStr.replace(",", ".");
    }

    const amtNum = parseFloat(amtStr);
    const direction: Direction = amtNum >= 0 ? "credit" : "debit";

    transactions.push({
      date: isoDate,
      amount: Math.abs(amtNum).toFixed(2),
      direction,
      counterparty: cpCol >= 0 ? (cols[cpCol] || "") : "",
      reference: refCol >= 0 ? (cols[refCol] || "") : "",
    });
  }

  return transactions.sort((a, b) => a.date.localeCompare(b.date));
}

export type XlsxParseResult = {
  transactions: Transaction[];
  preClassified: ClassifiedTransaction[];
};

export function parseXlsx(buffer: ArrayBuffer, fiscalYear?: number): XlsxParseResult {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require("xlsx");
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Get all rows as arrays to handle files with title rows before headers
  const allRows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: null,
  });

  if (allRows.length < 2) return { transactions: [], preClassified: [] };

  // Find the header row - look for a row that contains date/amount-like headers
  let headerIdx = -1;
  for (let i = 0; i < Math.min(10, allRows.length); i++) {
    const row = allRows[i].map((c) => String(c || "").toLowerCase());
    const hasDate = row.some((c) => /datum|date|buchungstag|valuta/.test(c));
    const hasAmt = row.some((c) => /betrag|amount|summe/.test(c));
    const hasSoll = row.some((c) => /soll/.test(c));
    if (hasDate && (hasAmt || hasSoll)) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) return { transactions: [], preClassified: [] };

  const headers = allRows[headerIdx].map((c) => String(c || "").trim());

  // Detect if this is a Buchungsjournal (pre-classified double-entry journal)
  const sollKontoCol = headers.findIndex((h) => /skr04.*soll|soll.*konto/i.test(h));
  const habenKontoCol = headers.findIndex((h) => /skr04.*haben|haben.*konto/i.test(h));

  if (sollKontoCol >= 0 && habenKontoCol >= 0) {
    return parseJournalXlsx(allRows, headers, headerIdx, sollKontoCol, habenKontoCol, fiscalYear);
  }

  // Standard bank export format
  return { transactions: parseBankExportXlsx(allRows, headers, headerIdx, fiscalYear), preClassified: [] };
}

function parseJournalXlsx(
  allRows: (string | number | null)[][],
  headers: string[],
  headerIdx: number,
  sollKontoCol: number,
  habenKontoCol: number,
  fiscalYear?: number,
): XlsxParseResult {
  const dateCol = headers.findIndex((h) => /datum|date|buchungstag/i.test(h));
  const amtCol = headers.findIndex((h) => /betrag|amount/i.test(h));
  const sollNameCol = headers.findIndex((h, i) => i !== sollKontoCol && /soll/i.test(h) && !/skr04/i.test(h));
  const habenNameCol = headers.findIndex((h, i) => i !== habenKontoCol && /haben/i.test(h) && !/skr04/i.test(h));
  const textCol = headers.findIndex((h) => /buchungstext|text|beschreibung|verwendung/i.test(h));

  if (dateCol < 0 || amtCol < 0) return { transactions: [], preClassified: [] };

  const preClassified: ClassifiedTransaction[] = [];

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.every((c) => c === null || c === "")) continue;

    const rawDate = String(row[dateCol] || "").trim();
    const rawAmt = String(row[amtCol] || "").trim();
    if (!rawDate || !rawAmt) continue;

    const isoDate = parseGermanDate(rawDate);
    if (fiscalYear && !isoDate.startsWith(String(fiscalYear))) continue;

    const amount = parseGermanAmount(rawAmt);
    if (isNaN(amount) || amount === 0) continue;

    const sollKonto = String(row[sollKontoCol] || "").trim();
    const habenKonto = String(row[habenKontoCol] || "").trim();
    const description = textCol >= 0 ? String(row[textCol] || "").trim() : "";

    // Determine direction: if Bank (1810) is on the Soll side, money came in (credit)
    const isBankDebit = sollKonto === "1810" || sollKonto === "1800";
    const direction: Direction = isBankDebit ? "credit" : "debit";
    const account = isBankDebit ? habenKonto : sollKonto;
    const accountName = isBankDebit
      ? (habenNameCol >= 0 ? String(row[habenNameCol] || "").trim() : getAccountName(account))
      : (sollNameCol >= 0 ? String(row[sollNameCol] || "").trim() : getAccountName(account));

    preClassified.push({
      date: isoDate,
      amount: Math.abs(amount).toFixed(2),
      direction,
      counterparty: description.split("-")[0]?.split("-")[0]?.trim() || "",
      reference: description,
      account,
      accountName: accountName || getAccountName(account),
      description,
      source: "import",
    });
  }

  return { transactions: [], preClassified };
}

function parseBankExportXlsx(
  allRows: (string | number | null)[][],
  headers: string[],
  headerIdx: number,
  fiscalYear?: number,
): Transaction[] {
  const dateCol = headers.findIndex((h) => /buchungstag|datum|date|valuta/i.test(h));
  const amtCol = headers.findIndex((h) => /betrag|amount|summe/i.test(h));
  const cpCol = headers.findIndex((h) => /auftraggeber|empf|counterparty|name|partner/i.test(h));
  const refCol = headers.findIndex((h) => /verwendungszweck|reference|zweck|beschreibung/i.test(h));

  if (dateCol < 0 || amtCol < 0) return [];

  const transactions: Transaction[] = [];

  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!row || row.every((c) => c === null || c === "")) continue;

    const rawDate = String(row[dateCol] || "").trim();
    const rawAmt = String(row[amtCol] || "").trim();
    if (!rawDate || !rawAmt) continue;

    const isoDate = parseGermanDate(rawDate);
    if (fiscalYear && !isoDate.startsWith(String(fiscalYear))) continue;

    const amount = parseGermanAmount(rawAmt);
    if (isNaN(amount)) continue;
    const direction: Direction = amount >= 0 ? "credit" : "debit";

    transactions.push({
      date: isoDate,
      amount: Math.abs(amount).toFixed(2),
      direction,
      counterparty: cpCol >= 0 ? String(row[cpCol] || "").trim() : "",
      reference: refCol >= 0 ? String(row[refCol] || "").trim() : "",
    });
  }

  return transactions.sort((a, b) => a.date.localeCompare(b.date));
}

function parseGermanDate(raw: string): string {
  const dmyMatch = raw.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (dmyMatch) return `${dmyMatch[3]}-${dmyMatch[2]}-${dmyMatch[1]}`;
  if (/^\d{5}$/.test(raw)) {
    const d = new Date((parseInt(raw) - 25569) * 86400 * 1000);
    return d.toISOString().split("T")[0];
  }
  return raw; // Assume ISO
}

function parseGermanAmount(raw: string): number {
  let s = raw.replace(/[€\s]/g, "");
  if (s.includes(",") && s.includes(".")) {
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (s.includes(",")) {
    s = s.replace(",", ".");
  }
  return parseFloat(s);
}

// ─── Classifier ──────────────────────────────────────────────────────────

// PatternRule routes a transaction to a SKR04 account based on its direction.
// onCredit fires when money comes IN (the matched counterparty paid us);
// onDebit fires when money goes OUT. Most rules use the same account both ways
// because the booking semantics don't depend on direction (IHK is always 6830).
// Stammkapital is the exception: incoming books to 2900 (capital received from
// shareholder), outgoing books to 0520 (this holding investing into a sub-co).
// Don't collapse this distinction - generateJournal still pairs the chosen
// account with Bank 1810, so the routing decides which side of that pair is
// the non-bank account.
type PatternRule = {
  pattern: RegExp;
  onCredit: string;
  onDebit: string;
  description: string;
};

const RULES: PatternRule[] = [
  { pattern: /stammkapital/i, onCredit: "2900", onDebit: "0520", description: "Stammkapitaleinlage" },
  { pattern: /gesellschafterdarlehen|darlehen.*gesellschafter/i, onCredit: "3510", onDebit: "3510", description: "Gesellschafterdarlehen" },
  { pattern: /\bIHK\b|Industrie.*Handelskammer/i, onCredit: "6830", onDebit: "6830", description: "IHK-Beitrag" },
  { pattern: /Kontoführung|Bankgebühr|Kartengebühr|Monatliche Gebühr|Account fee|Monthly fee|Card fee|subscription fee|plan fee/i, onCredit: "6855", onDebit: "6855", description: "Bankgebühren" },
  { pattern: /Rechtsanw|Notar|Kanzlei|Gleiss\s*Lutz|Hengeler|Freshfields|CMS\s+Hasche|Linklaters|Steuerberater|Wirtschaftsprüfer|legal|lawyer|attorney|notary/i, onCredit: "6827", onDebit: "6827", description: "Rechts- und Beratungskosten" },
  { pattern: /Wechselkurs|FX|Exchange|Währung|currency/i, onCredit: "6880", onDebit: "6880", description: "Währungsumrechnung" },
];

export type CounterpartyConfig = Record<string, { account: string; description: string }>;

export function classifyTransactions(
  transactions: Transaction[],
  counterparties: CounterpartyConfig = {},
): { classified: ClassifiedTransaction[]; unclassified: Transaction[] } {
  const classified: ClassifiedTransaction[] = [];
  const unclassified: Transaction[] = [];

  for (const tx of transactions) {
    const result = classifySingle(tx, counterparties);
    if (result) classified.push(result);
    else unclassified.push(tx);
  }

  return { classified, unclassified };
}

function classifySingle(tx: Transaction, counterparties: CounterpartyConfig): ClassifiedTransaction | null {
  // Layer 1: user config
  for (const [name, mapping] of Object.entries(counterparties)) {
    if (tx.counterparty.toLowerCase().includes(name.toLowerCase())) {
      return {
        ...tx,
        account: mapping.account,
        accountName: getAccountName(mapping.account),
        description: mapping.description,
        source: "config",
      };
    }
  }

  // Layer 2: rules
  const text = `${tx.reference} ${tx.counterparty}`;
  for (const rule of RULES) {
    if (rule.pattern.test(text)) {
      const account = tx.direction === "credit" ? rule.onCredit : rule.onDebit;
      return {
        ...tx,
        account,
        accountName: getAccountName(account),
        description: rule.description,
        source: "rule",
      };
    }
  }

  return null;
}

// ─── Bookkeeper ──────────────────────────────────────────────────────────

export function generateJournal(classified: ClassifiedTransaction[]): JournalEntry[] {
  return classified
    .map((ct) => {
      if (ct.direction === "credit") {
        return {
          date: ct.date,
          debitAccount: "1810",
          debitAccountName: "Bank",
          creditAccount: ct.account,
          creditAccountName: ct.accountName,
          amount: ct.amount,
          description: ct.description || `${ct.counterparty}: ${ct.reference}`.slice(0, 100),
        };
      } else {
        return {
          date: ct.date,
          debitAccount: ct.account,
          debitAccountName: ct.accountName,
          creditAccount: "1810",
          creditAccountName: "Bank",
          amount: ct.amount,
          description: ct.description || `${ct.counterparty}: ${ct.reference}`.slice(0, 100),
        };
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Statements ──────────────────────────────────────────────────────────

export function generateStatements(
  journal: JournalEntry[],
  config: CompanyConfig,
): ProcessResults {
  // Compute account balances
  const balances: Record<string, { debit: number; credit: number }> = {};

  function ensure(acct: string) {
    if (!balances[acct]) balances[acct] = { debit: 0, credit: 0 };
  }

  // Opening: Gewinnvortrag
  const gv = parseFloat(config.gewinnvortrag || "0");
  if (gv > 0) {
    ensure("2970");
    balances["2970"].credit += gv;
  } else if (gv < 0) {
    ensure("2978");
    balances["2978"].debit += Math.abs(gv);
  }

  for (const entry of journal) {
    ensure(entry.debitAccount);
    ensure(entry.creditAccount);
    const amt = parseFloat(entry.amount);
    balances[entry.debitAccount].debit += amt;
    balances[entry.creditAccount].credit += amt;
  }

  // Compute net balances
  function netBalance(acct: string): number {
    const b = balances[acct];
    if (!b) return 0;
    const cat = getAccountCategory(acct);
    if (cat === "asset" || cat === "expense") return b.debit - b.credit;
    return b.credit - b.debit;
  }

  // Build Bilanz
  const aktiva: Record<string, number> = {};
  const passiva: Record<string, number> = {};

  for (const acct of Object.keys(balances)) {
    const bal = netBalance(acct);
    if (Math.abs(bal) < 0.005) continue;
    const mapping = BILANZ_MAP[acct];
    if (!mapping) continue;
    if (mapping.side === "aktiva") {
      aktiva[mapping.position] = (aktiva[mapping.position] || 0) + bal;
    } else {
      passiva[mapping.position] = (passiva[mapping.position] || 0) + bal;
    }
  }

  // Build GuV
  const aufwendungen: Record<string, number> = {};
  const ertraege: Record<string, number> = {};
  const GUV_EXPENSE_ACCTS = ["6300", "6827", "6830", "6855", "6880", "7610"];
  const GUV_REVENUE_ACCTS = ["4830", "4840"];

  for (const acct of GUV_EXPENSE_ACCTS) {
    const bal = netBalance(acct);
    if (Math.abs(bal) >= 0.005) {
      aufwendungen["Sonstige betriebliche Aufwendungen"] =
        (aufwendungen["Sonstige betriebliche Aufwendungen"] || 0) + bal;
    }
  }
  for (const acct of GUV_REVENUE_ACCTS) {
    const bal = netBalance(acct);
    if (Math.abs(bal) >= 0.005) {
      ertraege["Sonstige betriebliche Erträge"] =
        (ertraege["Sonstige betriebliche Erträge"] || 0) + bal;
    }
  }

  const summeAufwendungen = Object.values(aufwendungen).reduce((a, b) => a + b, 0);
  const summeErtraege = Object.values(ertraege).reduce((a, b) => a + b, 0);
  const jahresueberschuss = summeErtraege - summeAufwendungen;

  // Add Jahresüberschuss to Passiva
  if (Math.abs(jahresueberschuss) >= 0.005) {
    passiva["Jahresüberschuss/Jahresfehlbetrag"] =
      (passiva["Jahresüberschuss/Jahresfehlbetrag"] || 0) + jahresueberschuss;
  }

  const summeAktiva = Object.values(aktiva).reduce((a, b) => a + b, 0);
  const summePassiva = Object.values(passiva).reduce((a, b) => a + b, 0);

  // Round
  const r = (n: number) => Math.round(n * 100) / 100;

  const warnings: string[] = [];
  const stammkapital = parseFloat(config.stammkapital || "0");

  if (stammkapital < 25000 && jahresueberschuss > 0) {
    const ruecklage = r(jahresueberschuss * 0.25);
    warnings.push(
      `§5a Abs. 3 GmbHG: Thesaurierungspflicht - 25% des Jahresüberschusses (${ruecklage.toFixed(2)} €) müssen in die gesetzliche Rücklage eingestellt werden.`
    );
  }

  if (Math.abs(r(summeAktiva) - r(summePassiva)) > 0.01) {
    warnings.push(
      `FEHLER: Bilanz ist nicht ausgeglichen! Aktiva (${r(summeAktiva).toFixed(2)} €) ≠ Passiva (${r(summePassiva).toFixed(2)} €)`
    );
  }

  const eigenkapital = (passiva["Gezeichnetes Kapital"] || 0) +
    (passiva["Gesetzliche Rücklage"] || 0) +
    (passiva["Gewinnvortrag/Verlustvortrag"] || 0) +
    (passiva["Jahresüberschuss/Jahresfehlbetrag"] || 0);

  if (eigenkapital < stammkapital) {
    warnings.push(
      `Warnung: Eigenkapital (${r(eigenkapital).toFixed(2)} €) ist geringer als Stammkapital (${stammkapital.toFixed(2)} €). Prüfe auf Überschuldung (§ 19 InsO).`
    );
  }

  return {
    bilanz: {
      aktiva: Object.fromEntries(Object.entries(aktiva).map(([k, v]) => [k, r(v)])),
      passiva: Object.fromEntries(Object.entries(passiva).map(([k, v]) => [k, r(v)])),
      summeAktiva: r(summeAktiva),
      summePassiva: r(summePassiva),
      isBalanced: Math.abs(r(summeAktiva) - r(summePassiva)) < 0.01,
    },
    guv: {
      aufwendungen: Object.fromEntries(Object.entries(aufwendungen).map(([k, v]) => [k, r(v)])),
      ertraege: Object.fromEntries(Object.entries(ertraege).map(([k, v]) => [k, r(v)])),
      summeAufwendungen: r(summeAufwendungen),
      summeErtraege: r(summeErtraege),
      jahresueberschuss: r(jahresueberschuss),
    },
    journalEntryCount: journal.length,
    warnings,
    fiscalYear: config.geschaeftsjahr,
    companyName: config.name,
  };
}
