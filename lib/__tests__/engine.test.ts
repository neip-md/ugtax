import { describe, test, expect } from "vitest";
import {
  parseCamt053,
  parseCsv,
  classifyTransactions,
  generateJournal,
  generateStatements,
  ACCOUNTS,
  type CounterpartyConfig,
  type ClassifiedTransaction,
  type CompanyConfig,
} from "../engine";

// ─── parseCamt053 ───────────────────────────────────────────────────────

describe("parseCamt053", () => {
  const sampleXml = `
    <Document>
      <BkToCstmrStmt>
        <Stmt>
          <Ntry>
            <Amt Ccy="EUR">150.00</Amt>
            <CdtDbtInd>DBIT</CdtDbtInd>
            <BookgDt><Dt>2025-03-15</Dt></BookgDt>
            <NtryDtls><TxDtls>
              <RltdPties><Cdtr><Nm>IHK Berlin</Nm></Cdtr></RltdPties>
              <RmtInf><Ustrd>IHK Beitrag 2025</Ustrd></RmtInf>
            </TxDtls></NtryDtls>
          </Ntry>
          <Ntry>
            <Amt Ccy="EUR">500.00</Amt>
            <CdtDbtInd>CRDT</CdtDbtInd>
            <BookgDt><Dt>2025-06-01</Dt></BookgDt>
            <NtryDtls><TxDtls>
              <RltdPties><Dbtr><Nm>Tochter GmbH</Nm></Dbtr></RltdPties>
              <RmtInf><Ustrd>Gewinnausschuettung</Ustrd></RmtInf>
            </TxDtls></NtryDtls>
          </Ntry>
          <Ntry>
            <Amt Ccy="EUR">25.00</Amt>
            <CdtDbtInd>DBIT</CdtDbtInd>
            <BookgDt><Dt>2024-12-01</Dt></BookgDt>
            <NtryDtls><TxDtls>
              <RmtInf><Ustrd>Kontoführung Dezember</Ustrd></RmtInf>
            </TxDtls></NtryDtls>
          </Ntry>
        </Stmt>
      </BkToCstmrStmt>
    </Document>`;

  test("parses valid camt.053 XML with multiple entries", () => {
    const txs = parseCamt053(sampleXml);
    expect(txs).toHaveLength(3);
    expect(txs[0].date).toBe("2024-12-01"); // sorted by date
    expect(txs[1].date).toBe("2025-03-15");
    expect(txs[2].date).toBe("2025-06-01");
  });

  test("extracts amount, direction, counterparty, reference", () => {
    const txs = parseCamt053(sampleXml);
    const ihk = txs.find((t) => t.reference.includes("IHK"));
    expect(ihk).toBeDefined();
    expect(ihk!.amount).toBe("150.00");
    expect(ihk!.direction).toBe("debit");
    expect(ihk!.counterparty).toBe("IHK Berlin");
  });

  test("credit entries have correct direction", () => {
    const txs = parseCamt053(sampleXml);
    const credit = txs.find((t) => t.reference.includes("Gewinn"));
    expect(credit).toBeDefined();
    expect(credit!.direction).toBe("credit");
    expect(credit!.amount).toBe("500.00");
    expect(credit!.counterparty).toBe("Tochter GmbH");
  });

  test("filters by fiscal year", () => {
    const txs = parseCamt053(sampleXml, 2025);
    expect(txs).toHaveLength(2);
    expect(txs.every((t) => t.date.startsWith("2025"))).toBe(true);
  });

  test("returns empty for wrong fiscal year", () => {
    const txs = parseCamt053(sampleXml, 2020);
    expect(txs).toHaveLength(0);
  });

  test("returns empty for empty XML", () => {
    expect(parseCamt053("")).toHaveLength(0);
    expect(parseCamt053("<Document></Document>")).toHaveLength(0);
  });

  test("skips entries without a date", () => {
    const xml = `<Ntry><Amt>100.00</Amt><CdtDbtInd>DBIT</CdtDbtInd></Ntry>`;
    expect(parseCamt053(xml)).toHaveLength(0);
  });
});

// ─── parseCsv ───────────────────────────────────────────────────────────

describe("parseCsv", () => {
  test("parses semicolon-delimited CSV with German dates and amounts", () => {
    const csv = [
      "Buchungstag;Betrag;Auftraggeber;Verwendungszweck",
      "15.03.2025;-150,00;IHK Berlin;IHK Beitrag",
      "01.06.2025;500,00;Tochter GmbH;Gewinnausschuettung",
    ].join("\n");
    const txs = parseCsv(csv);
    expect(txs).toHaveLength(2);
    expect(txs[0].date).toBe("2025-03-15");
    expect(txs[0].amount).toBe("150.00");
    expect(txs[0].direction).toBe("debit");
    expect(txs[1].direction).toBe("credit");
    expect(txs[1].amount).toBe("500.00");
  });

  test("parses comma-delimited CSV", () => {
    const csv = [
      "date,amount,name,reference",
      "2025-03-15,-50.00,Bank,Monthly fee",
    ].join("\n");
    const txs = parseCsv(csv);
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe("50.00");
    expect(txs[0].direction).toBe("debit");
  });

  test("handles German thousand separators (1.234,56)", () => {
    const csv = [
      "Buchungstag;Betrag;Auftraggeber;Verwendungszweck",
      "01.01.2025;1.234,56;Someone;Payment",
    ].join("\n");
    const txs = parseCsv(csv);
    expect(txs).toHaveLength(1);
    expect(txs[0].amount).toBe("1234.56");
  });

  test("filters by fiscal year", () => {
    const csv = [
      "Buchungstag;Betrag;Auftraggeber;Verwendungszweck",
      "15.03.2025;-100,00;A;B",
      "15.03.2024;-200,00;C;D",
    ].join("\n");
    const txs = parseCsv(csv, 2025);
    expect(txs).toHaveLength(1);
    expect(txs[0].date).toBe("2025-03-15");
  });

  test("returns empty for CSV with no data rows", () => {
    expect(parseCsv("Buchungstag;Betrag")).toHaveLength(0);
    expect(parseCsv("")).toHaveLength(0);
  });

  test("returns empty when required columns missing", () => {
    const csv = ["Name;Reference", "A;B"].join("\n");
    expect(parseCsv(csv)).toHaveLength(0);
  });
});

// ─── classifyTransactions ───────────────────────────────────────────────

describe("classifyTransactions", () => {
  test("classifies IHK transaction via rule", () => {
    const txs = [
      { date: "2025-01-15", amount: "100.00", direction: "debit" as const, counterparty: "IHK Berlin", reference: "Beitrag" },
    ];
    const { classified, unclassified } = classifyTransactions(txs);
    expect(classified).toHaveLength(1);
    expect(unclassified).toHaveLength(0);
    expect(classified[0].account).toBe("6830");
    expect(classified[0].source).toBe("rule");
  });

  test("classifies bank fees via rule", () => {
    const txs = [
      { date: "2025-01-01", amount: "5.90", direction: "debit" as const, counterparty: "Qonto", reference: "Kontoführung Januar" },
    ];
    const { classified } = classifyTransactions(txs);
    expect(classified).toHaveLength(1);
    expect(classified[0].account).toBe("6855");
    expect(classified[0].description).toBe("Bankgebühren");
  });

  test("classifies via counterparty config (Layer 1 priority)", () => {
    const txs = [
      { date: "2025-01-01", amount: "1000.00", direction: "credit" as const, counterparty: "Tochter GmbH", reference: "Dividend" },
    ];
    const counterparties: CounterpartyConfig = {
      "Tochter": { account: "4840", description: "Beteiligungserträge" },
    };
    const { classified } = classifyTransactions(txs, counterparties);
    expect(classified).toHaveLength(1);
    expect(classified[0].account).toBe("4840");
    expect(classified[0].source).toBe("config");
  });

  test("config takes priority over rules", () => {
    const txs = [
      { date: "2025-01-01", amount: "100.00", direction: "debit" as const, counterparty: "IHK Berlin", reference: "Beitrag" },
    ];
    const counterparties: CounterpartyConfig = {
      "IHK": { account: "6300", description: "Sonstiges" },
    };
    const { classified } = classifyTransactions(txs, counterparties);
    expect(classified[0].account).toBe("6300"); // config override
    expect(classified[0].source).toBe("config");
  });

  test("returns unclassified for unknown transactions", () => {
    const txs = [
      { date: "2025-01-01", amount: "42.00", direction: "debit" as const, counterparty: "Random Person", reference: "Something unknown" },
    ];
    const { classified, unclassified } = classifyTransactions(txs);
    expect(classified).toHaveLength(0);
    expect(unclassified).toHaveLength(1);
  });

  test("handles empty transaction list", () => {
    const { classified, unclassified } = classifyTransactions([]);
    expect(classified).toHaveLength(0);
    expect(unclassified).toHaveLength(0);
  });

  test("classifies legal/advisory fees", () => {
    const txs = [
      { date: "2025-01-01", amount: "500.00", direction: "debit" as const, counterparty: "Kanzlei Müller", reference: "Beratung" },
    ];
    const { classified } = classifyTransactions(txs);
    expect(classified[0].account).toBe("6827");
  });

  test("Stammkapital incoming (credit) routes to 2900", () => {
    // Holding receives a Stammkapitaleinlage from a shareholder.
    const txs = [
      { date: "2025-01-01", amount: "25000.00", direction: "credit" as const, counterparty: "Gesellschafter Schmidt", reference: "Stammkapitaleinlage" },
    ];
    const { classified } = classifyTransactions(txs);
    expect(classified).toHaveLength(1);
    expect(classified[0].account).toBe("2900");
    expect(classified[0].description).toBe("Stammkapitaleinlage");
  });

  test("Stammkapital outgoing (debit) routes to 0520 (Beteiligung at sub-co)", () => {
    // Holding pays a Stammkapitaleinlage to fund a subsidiary it owns.
    const txs = [
      { date: "2025-01-01", amount: "25000.00", direction: "debit" as const, counterparty: "TochterCo UG", reference: "Stammkapital Einzahlung" },
    ];
    const { classified } = classifyTransactions(txs);
    expect(classified).toHaveLength(1);
    expect(classified[0].account).toBe("0520");
    expect(classified[0].description).toBe("Stammkapitaleinlage");
  });
});

// ─── generateJournal ────────────────────────────────────────────────────

describe("generateJournal", () => {
  test("creates debit-to-Bank entry for credit transactions", () => {
    const classified: ClassifiedTransaction[] = [
      { date: "2025-06-01", amount: "500.00", direction: "credit", counterparty: "X", reference: "R", account: "4840", accountName: "Erträge aus Beteiligungen", description: "Dividende", source: "rule" },
    ];
    const journal = generateJournal(classified);
    expect(journal).toHaveLength(1);
    expect(journal[0].debitAccount).toBe("1810"); // Bank
    expect(journal[0].creditAccount).toBe("4840");
    expect(journal[0].amount).toBe("500.00");
  });

  test("creates expense-to-Bank entry for debit transactions", () => {
    const classified: ClassifiedTransaction[] = [
      { date: "2025-01-15", amount: "100.00", direction: "debit", counterparty: "IHK", reference: "Beitrag", account: "6830", accountName: "Sonstige Abgaben", description: "IHK-Beitrag", source: "rule" },
    ];
    const journal = generateJournal(classified);
    expect(journal).toHaveLength(1);
    expect(journal[0].debitAccount).toBe("6830");
    expect(journal[0].creditAccount).toBe("1810"); // Bank
  });

  test("sorts entries by date", () => {
    const classified: ClassifiedTransaction[] = [
      { date: "2025-06-01", amount: "500.00", direction: "credit", counterparty: "", reference: "", account: "4840", accountName: "", description: "", source: "rule" },
      { date: "2025-01-15", amount: "100.00", direction: "debit", counterparty: "", reference: "", account: "6830", accountName: "", description: "", source: "rule" },
    ];
    const journal = generateJournal(classified);
    expect(journal[0].date).toBe("2025-01-15");
    expect(journal[1].date).toBe("2025-06-01");
  });

  test("handles empty input", () => {
    expect(generateJournal([])).toHaveLength(0);
  });
});

// ─── generateStatements ─────────────────────────────────────────────────

describe("generateStatements", () => {
  const defaultConfig: CompanyConfig = {
    name: "Test UG",
    steuernummer: "27/123/45678",
    finanzamt: "Berlin Mitte",
    geschaeftsjahr: 2025,
    kleinunternehmer: true,
    stammkapital: "1000.00",
    gewinnvortrag: "0.00",
  };

  function makeJournal(entries: Array<{ debit: string; credit: string; amount: string; date?: string }>) {
    return entries.map((e) => ({
      date: e.date || "2025-01-01",
      debitAccount: e.debit,
      debitAccountName: ACCOUNTS[e.debit]?.name || "",
      creditAccount: e.credit,
      creditAccountName: ACCOUNTS[e.credit]?.name || "",
      amount: e.amount,
      description: "test",
    }));
  }

  test("produces balanced Bilanz for simple transactions", () => {
    // Bank receives 500 from revenue, pays 100 for expenses
    const journal = makeJournal([
      { debit: "1810", credit: "4830", amount: "500.00" }, // Revenue → Bank
      { debit: "6300", credit: "1810", amount: "100.00" }, // Bank → Expense
    ]);
    const result = generateStatements(journal, defaultConfig);
    expect(result.bilanz.isBalanced).toBe(true);
    expect(result.bilanz.summeAktiva).toBeCloseTo(400, 1); // 500-100 in bank
    expect(result.guv.jahresueberschuss).toBeCloseTo(400, 1); // 500 revenue - 100 expense
    expect(result.fiscalYear).toBe(2025);
    expect(result.companyName).toBe("Test UG");
  });

  test("handles Gewinnvortrag (positive) - appears in passiva", () => {
    const config = { ...defaultConfig, gewinnvortrag: "200.00" };
    const journal = makeJournal([
      { debit: "1810", credit: "4830", amount: "100.00" },
    ]);
    const result = generateStatements(journal, config);
    // Gewinnvortrag appears in passiva equity section
    expect(result.bilanz.passiva["Gewinnvortrag/Verlustvortrag"]).toBeCloseTo(200, 1);
    // Note: Bilanz won't balance because the engine doesn't track opening bank balance.
    // The opening bank balance that corresponds to the Gewinnvortrag is implicit
    // (it's part of the bank statement transactions from prior years).
    expect(result.guv.jahresueberschuss).toBeCloseTo(100, 1);
  });

  test("handles negative Gewinnvortrag (Verlustvortrag) - appears in passiva", () => {
    const config = { ...defaultConfig, gewinnvortrag: "-500.00" };
    const journal = makeJournal([
      { debit: "1810", credit: "4830", amount: "1000.00" },
    ]);
    const result = generateStatements(journal, config);
    // Verlustvortrag reduces passiva equity via account 2978
    expect(result.bilanz.passiva["Gewinnvortrag/Verlustvortrag"]).toBeCloseTo(-500, 1);
    expect(result.guv.jahresueberschuss).toBeCloseTo(1000, 1);
  });

  test("warns about Thesaurierungspflicht for UGs with profit", () => {
    const config = { ...defaultConfig, stammkapital: "1000.00" };
    const journal = makeJournal([
      { debit: "1810", credit: "4830", amount: "1000.00" },
    ]);
    const result = generateStatements(journal, config);
    expect(result.warnings.some((w) => w.includes("Thesaurierungspflicht"))).toBe(true);
    expect(result.warnings.some((w) => w.includes("25%"))).toBe(true);
  });

  test("no Thesaurierungspflicht warning for GmbH (Stammkapital >= 25000)", () => {
    const config = { ...defaultConfig, stammkapital: "25000.00" };
    const journal = makeJournal([
      { debit: "1810", credit: "4830", amount: "1000.00" },
    ]);
    const result = generateStatements(journal, config);
    expect(result.warnings.some((w) => w.includes("Thesaurierungspflicht"))).toBe(false);
  });

  test("warns about potential Überschuldung", () => {
    // Stammkapital 1000, but expenses exceed everything
    const config = { ...defaultConfig, stammkapital: "1000.00", gewinnvortrag: "0.00" };
    const journal = makeJournal([
      { debit: "6300", credit: "1810", amount: "2000.00" }, // 2000 expense, no revenue
    ]);
    const result = generateStatements(journal, config);
    expect(result.warnings.some((w) => w.includes("Überschuldung") || w.includes("Eigenkapital"))).toBe(true);
  });

  test("handles empty journal", () => {
    const result = generateStatements([], defaultConfig);
    expect(result.journalEntryCount).toBe(0);
    expect(result.bilanz.summeAktiva).toBe(0);
    expect(result.bilanz.summePassiva).toBe(0);
    expect(result.bilanz.isBalanced).toBe(true);
  });

  test("GuV separates Aufwendungen and Erträge", () => {
    const journal = makeJournal([
      { debit: "1810", credit: "4830", amount: "800.00" },
      { debit: "6855", credit: "1810", amount: "50.00" },
      { debit: "6827", credit: "1810", amount: "200.00" },
    ]);
    const result = generateStatements(journal, defaultConfig);
    expect(result.guv.summeErtraege).toBeCloseTo(800, 1);
    expect(result.guv.summeAufwendungen).toBeCloseTo(250, 1);
    expect(result.guv.jahresueberschuss).toBeCloseTo(550, 1);
  });
});
