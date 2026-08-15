import { describe, test, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseXlsx } from "../engine";

function makeXlsx(rows: (string | number | null)[][]): ArrayBuffer {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
  return buf;
}

describe("parseXlsx - bank export format", () => {
  test("parses basic bank export with German headers", () => {
    const buf = makeXlsx([
      ["Buchungstag", "Betrag", "Auftraggeber", "Verwendungszweck"],
      ["15.03.2025", "-150,00", "IHK Berlin", "IHK Beitrag 2025"],
      ["01.06.2025", "500,00", "Tochter GmbH", "Dividende"],
    ]);
    const result = parseXlsx(buf);
    expect(result.preClassified).toHaveLength(0);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].date).toBe("2025-03-15");
    expect(result.transactions[0].amount).toBe("150.00");
    expect(result.transactions[0].direction).toBe("debit");
    expect(result.transactions[1].direction).toBe("credit");
  });

  test("filters by fiscal year", () => {
    const buf = makeXlsx([
      ["Datum", "Betrag", "Name", "Zweck"],
      ["15.03.2024", "-100,00", "X", "Y"],
      ["15.03.2025", "-200,00", "X", "Y"],
    ]);
    const result = parseXlsx(buf, 2025);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].date).toBe("2025-03-15");
  });

  test("handles title rows before headers (auto-detects header row)", () => {
    const buf = makeXlsx([
      ["My Bank Report", null, null, null],
      ["Account: 1234", null, null, null],
      [null, null, null, null],
      ["Buchungstag", "Betrag", "Auftraggeber", "Verwendungszweck"],
      ["15.03.2025", "-50,00", "Test", "Test"],
    ]);
    const result = parseXlsx(buf);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0].amount).toBe("50.00");
  });

  test("returns empty when no recognizable headers", () => {
    const buf = makeXlsx([
      ["Foo", "Bar", "Baz"],
      ["a", "b", "c"],
    ]);
    const result = parseXlsx(buf);
    expect(result.transactions).toHaveLength(0);
    expect(result.preClassified).toHaveLength(0);
  });

  test("handles German thousand separators", () => {
    const buf = makeXlsx([
      ["Buchungstag", "Betrag", "Auftraggeber", "Verwendungszweck"],
      ["15.03.2025", "1.234,56", "X", "Y"],
    ]);
    const result = parseXlsx(buf);
    expect(result.transactions[0].amount).toBe("1234.56");
  });
});

describe("parseXlsx - Buchungsjournal format (pre-classified)", () => {
  test("detects journal format via Soll/Haben columns and returns preClassified", () => {
    const buf = makeXlsx([
      ["Datum", "Betrag", "SKR04 Soll", "Soll Bezeichnung", "SKR04 Haben", "Haben Bezeichnung", "Buchungstext"],
      ["15.03.2025", "150,00", "6830", "Sonstige Abgaben", "1810", "Bank", "IHK Beitrag"],
      ["01.06.2025", "500,00", "1810", "Bank", "4840", "Erträge aus Beteiligungen", "Dividende Tochter"],
    ]);
    const result = parseXlsx(buf);
    expect(result.transactions).toHaveLength(0);
    expect(result.preClassified).toHaveLength(2);

    // First entry: 6830 on Soll side → money went OUT to expenses (debit)
    expect(result.preClassified[0].account).toBe("6830");
    expect(result.preClassified[0].direction).toBe("debit");
    expect(result.preClassified[0].amount).toBe("150.00");

    // Second: 1810 on Soll side → money came IN (credit)
    expect(result.preClassified[1].account).toBe("4840");
    expect(result.preClassified[1].direction).toBe("credit");
  });

  test("preClassified entries have source 'import'", () => {
    const buf = makeXlsx([
      ["Datum", "Betrag", "SKR04 Soll", "Soll", "SKR04 Haben", "Haben", "Buchungstext"],
      ["15.03.2025", "150,00", "6830", "Sonstige Abgaben", "1810", "Bank", "IHK"],
    ]);
    const result = parseXlsx(buf);
    expect(result.preClassified[0].source).toBe("import");
  });
});
