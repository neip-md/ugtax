import { describe, test, expect } from "vitest";
import {
  journalToCsv,
  statementsToCsv,
  generateFilingGuide,
  generateBundesanzeiger,
} from "../downloads";
import { generateStatements, ACCOUNTS, type CompanyConfig, type JournalEntry } from "../engine";

const config: CompanyConfig = {
  name: "Test UG",
  steuernummer: "27/123/45678",
  finanzamt: "Berlin Mitte",
  geschaeftsjahr: 2025,
  kleinunternehmer: true,
  stammkapital: "1000.00",
  gewinnvortrag: "0.00",
};

function entry(debit: string, credit: string, amount: string, description = "test"): JournalEntry {
  return {
    date: "2025-01-01",
    debitAccount: debit,
    debitAccountName: ACCOUNTS[debit]?.name || "",
    creditAccount: credit,
    creditAccountName: ACCOUNTS[credit]?.name || "",
    amount,
    description,
  };
}

describe("journalToCsv", () => {
  test("emits CSV header + one row per entry", () => {
    const csv = journalToCsv([
      entry("1810", "4830", "500.00", "Dividende"),
      entry("6855", "1810", "5.00", "Kontoführung"),
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Nr.;Datum;Soll-Konto");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("1810");
    expect(lines[1]).toContain("4830");
    expect(lines[1]).toContain("Dividende");
  });

  test("handles empty journal", () => {
    const csv = journalToCsv([]);
    expect(csv.split("\n")).toHaveLength(1);
  });
});

describe("statementsToCsv", () => {
  test("contains Bilanz and GuV sections with totals", () => {
    const results = generateStatements(
      [entry("1810", "4830", "500.00"), entry("6300", "1810", "100.00")],
      config,
    );
    const csv = statementsToCsv(results);
    expect(csv).toContain("Bilanz zum 31.12.2025");
    expect(csv).toContain("AKTIVA;EUR");
    expect(csv).toContain("PASSIVA;EUR");
    expect(csv).toContain("GUV;EUR");
    expect(csv).toContain("Summe Aktiva;");
    expect(csv).toContain("Jahresueberschuss;");
  });
});

describe("generateFilingGuide", () => {
  test("includes E-Bilanz, KSt, GewSt, USt sections and filing deadlines", () => {
    const results = generateStatements(
      [entry("1810", "4830", "1000.00"), entry("6300", "1810", "200.00")],
      config,
    );
    const md = generateFilingGuide(results, config);

    expect(md).toContain("# Steuerliche Abgabepflichten");
    expect(md).toContain("Test UG");
    expect(md).toContain("## 1. E-Bilanz");
    expect(md).toContain("## 2. KSt 1");
    expect(md).toContain("## 3. GewSt 1 A");
    expect(md).toContain("## 4. USt-Jahreserklärung");
    expect(md).toContain("## 5. Fristen");
    expect(md).toContain("31.07.2026"); // year + 1
  });

  test("calculates KSt (15%) and Soli (5.5% of KSt) for positive profit", () => {
    const results = generateStatements(
      [entry("1810", "4830", "10000.00")],
      config,
    );
    const md = generateFilingGuide(results, config);

    expect(md).toContain("Körperschaftsteuer (15%)");
    expect(md).toContain("| 1500.00 €");
    expect(md).toContain("Solidaritätszuschlag");
    expect(md).toContain("| 82.50 €");
  });

  test("shows '0,00 € (Verlust)' for KSt and Soli on a loss year", () => {
    const results = generateStatements([entry("6300", "1810", "500.00")], config);
    const md = generateFilingGuide(results, config);

    expect(md).toContain("0,00 € (Verlust)");
  });

  test("Kleinunternehmer flag changes USt block", () => {
    const results = generateStatements([entry("1810", "4830", "100.00")], config);
    const kleinMd = generateFilingGuide(results, { ...config, kleinunternehmer: true });
    const regelMd = generateFilingGuide(results, { ...config, kleinunternehmer: false });

    expect(kleinMd).toContain("Kleinunternehmerregelung");
    expect(regelMd).toContain("Regelbesteuerung");
  });

  test("preserves umlauts and ampersands in company name", () => {
    const md = generateFilingGuide(
      generateStatements([entry("1810", "4830", "100.00")], config),
      { ...config, name: "Müller & Söhne Holding UG" },
    );
    expect(md).toContain("Müller & Söhne Holding UG");
  });
});

describe("generateBundesanzeiger", () => {
  test("contains required §267a/§325 HGB headers and Bilanz", () => {
    const results = generateStatements(
      [entry("1810", "4830", "500.00")],
      config,
    );
    const text = generateBundesanzeiger(results, config);

    expect(text).toContain("Test UG");
    expect(text).toContain("§ 267a HGB");
    expect(text).toContain("§§ 325, 326 HGB");
    expect(text).toContain("BILANZ");
    expect(text).toContain("AKTIVA");
    expect(text).toContain("PASSIVA");
    expect(text).toContain("31.12.2025");
  });

  test("defaults Sitz to Berlin when not set", () => {
    const results = generateStatements([entry("1810", "4830", "100.00")], config);
    const text = generateBundesanzeiger(results, config);
    expect(text).toContain("Sitz: Berlin");
  });

  test("uses config.sitz when provided (fix for hardcoded Berlin)", () => {
    const results = generateStatements([entry("1810", "4830", "100.00")], config);
    const text = generateBundesanzeiger(results, { ...config, sitz: "München" });
    expect(text).toContain("Sitz: München");
    expect(text).not.toContain("Sitz: Berlin");
  });

  test("uses German decimal comma in amounts", () => {
    const results = generateStatements(
      [entry("1810", "4830", "1234.56")],
      config,
    );
    const text = generateBundesanzeiger(results, config);
    // Bank balance after 1234.56 credit = 1234.56
    expect(text).toContain("1234,56");
  });
});
