import { describe, test, expect } from "vitest";
import { generateXbrl } from "../xbrl";
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

function entry(debit: string, credit: string, amount: string, date = "2025-01-01"): JournalEntry {
  return {
    date,
    debitAccount: debit,
    debitAccountName: ACCOUNTS[debit]?.name || "",
    creditAccount: credit,
    creditAccountName: ACCOUNTS[credit]?.name || "",
    amount,
    description: "test",
  };
}

describe("generateXbrl", () => {
  test("produces a valid XBRL document with required namespaces", () => {
    const results = generateStatements(
      [entry("1810", "4830", "500.00"), entry("6300", "1810", "100.00")],
      config,
    );
    const xbrl = generateXbrl(results, config);

    expect(xbrl).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xbrl).toContain("xmlns:xbrli=");
    expect(xbrl).toContain("xmlns:de-gaap-ci=");
    expect(xbrl).toContain("xmlns:de-gcd=");
    expect(xbrl).toContain("<xbrli:unit id=\"EUR\">");
    expect(xbrl).toContain("iso4217:EUR");
  });

  test("includes company name and tax number in context", () => {
    const results = generateStatements([entry("1810", "4830", "500.00")], config);
    const xbrl = generateXbrl(results, config);

    expect(xbrl).toContain("Test UG");
    expect(xbrl).toContain("27/123/45678");
    expect(xbrl).toContain("UG (haftungsbeschraenkt)");
    expect(xbrl).toContain("Kleinstkapitalgesellschaft");
  });

  test("escapes XML-sensitive characters in company name", () => {
    const evilConfig = { ...config, name: "M&M Holding <UG> \"GmbH\"" };
    const results = generateStatements([entry("1810", "4830", "500.00")], evilConfig);
    const xbrl = generateXbrl(results, evilConfig);

    expect(xbrl).toContain("M&amp;M Holding &lt;UG&gt; &quot;GmbH&quot;");
    expect(xbrl).not.toContain("M&M Holding <UG>");
  });

  test("emits Bilanz balance equation: Aktiva = Passiva", () => {
    const results = generateStatements(
      [entry("1810", "4830", "1000.00"), entry("6300", "1810", "300.00")],
      config,
    );
    const xbrl = generateXbrl(results, config);

    const aktivaMatch = xbrl.match(/<de-gaap-ci:bs\.ass [^>]*>([\d.]+)</);
    const passivaMatch = xbrl.match(/<de-gaap-ci:bs\.eqLiab [^>]*>([\d.]+)</);
    expect(aktivaMatch).toBeTruthy();
    expect(passivaMatch).toBeTruthy();
    expect(parseFloat(aktivaMatch![1])).toBeCloseTo(parseFloat(passivaMatch![1]), 2);
  });

  test("handles zero-revenue year (empty Erträge)", () => {
    // Only expenses, no income - Jahresfehlbetrag scenario.
    const results = generateStatements(
      [entry("6855", "1810", "100.00")],
      config,
    );
    const xbrl = generateXbrl(results, config);

    expect(xbrl).toContain("is.netIncome");
    expect(xbrl).toContain("-100.00");
  });

  test("uses fiscal year as the period instant date", () => {
    const yearConfig = { ...config, geschaeftsjahr: 2024 };
    const results = generateStatements(
      [entry("1810", "4830", "500.00", "2024-06-01")],
      yearConfig,
    );
    const xbrl = generateXbrl(results, yearConfig);

    expect(xbrl).toContain("2024-12-31");
    expect(xbrl).toContain("2024-01-01");
  });
});
