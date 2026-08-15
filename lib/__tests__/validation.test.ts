import { describe, it, expect } from "vitest";
import { runChecks, allChecksPassed, failedChecks, type Check } from "../validation";
import type { ClassifiedTransaction, ProcessResults } from "../engine";

function tx(over: Partial<ClassifiedTransaction> = {}): ClassifiedTransaction {
  return {
    date: "2025-03-14",
    amount: "12.50",
    direction: "debit",
    counterparty: "Bank",
    reference: "Gebühr",
    account: "6855",
    accountName: "Nebenkosten des Geldverkehrs",
    description: "Bankgebühr",
    source: "rule",
    ...over,
  } as ClassifiedTransaction;
}

function results(over: Partial<ProcessResults> = {}): ProcessResults {
  return {
    bilanz: {
      aktiva: { "Guthaben bei Kreditinstituten": 987.5 },
      passiva: { "Gezeichnetes Kapital": 1000, "Jahresüberschuss/Jahresfehlbetrag": -12.5 },
      summeAktiva: 987.5,
      summePassiva: 987.5,
      isBalanced: true,
    },
    guv: {
      aufwendungen: { "Nebenkosten des Geldverkehrs": 12.5 },
      ertraege: {},
      summeAufwendungen: 12.5,
      summeErtraege: 0,
      jahresueberschuss: -12.5,
    },
    journalEntryCount: 1,
    warnings: [],
    fiscalYear: 2025,
    companyName: "Test Holding UG",
    ...over,
  } as ProcessResults;
}

const byId = (checks: Check[], id: string) => checks.find((c) => c.id === id)!;

describe("runChecks", () => {
  it("passes a clean, balanced filing", () => {
    const checks = runChecks([tx()], results(), 1000);
    expect(allChecksPassed(checks)).toBe(true);
    expect(failedChecks(checks)).toEqual([]);
  });

  it("returns every check regardless of outcome", () => {
    const checks = runChecks([tx()], results(), 1000);
    expect(checks.map((c) => c.id).sort()).toEqual([
      "accountsKnown", "allClassified", "amountsSane",
      "bilanzBalanced", "guvTies", "nothingDropped", "ruecklage",
    ]);
  });
});

describe("bilanzBalanced", () => {
  it("fails when Aktiva and Passiva diverge, and says by how much", () => {
    const checks = runChecks([tx()], results({
      bilanz: { ...results().bilanz, summeAktiva: 1000, summePassiva: 987.5 },
    }), 1000);
    const c = byId(checks, "bilanzBalanced");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("12.50");
    expect(allChecksPassed(checks)).toBe(false);
  });

  it("tolerates sub-cent rounding", () => {
    const checks = runChecks([tx()], results({
      bilanz: { ...results().bilanz, summeAktiva: 987.5, summePassiva: 987.504 },
    }), 1000);
    expect(byId(checks, "bilanzBalanced").status).toBe("pass");
  });
});

describe("guvTies", () => {
  it("fails when the GuV result is not what the Bilanz carries", () => {
    const c = byId(runChecks([tx()], results({
      guv: { ...results().guv, jahresueberschuss: -99 },
    }), 1000), "guvTies");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("-99.00");
  });

  it("passes a zero result with the position omitted", () => {
    // Below the rounding floor the engine leaves the position out entirely.
    const c = byId(runChecks([tx()], results({
      bilanz: { ...results().bilanz, passiva: { "Gezeichnetes Kapital": 1000 } },
      guv: { ...results().guv, jahresueberschuss: 0 },
    }), 1000), "guvTies");
    expect(c.status).toBe("pass");
  });
});

describe("nothingDropped", () => {
  it("fails when fewer journal entries exist than classified transactions", () => {
    const c = byId(
      runChecks([tx(), tx(), tx()], results({ journalEntryCount: 2 }), 1000),
      "nothingDropped",
    );
    expect(c.status).toBe("fail");
    expect(c.detail).toBe("2/3");
  });

  it("ignores unclassified rows, which cannot reach the journal", () => {
    const c = byId(
      runChecks([tx(), tx({ account: "" })], results({ journalEntryCount: 1 }), 1000),
      "nothingDropped",
    );
    expect(c.status).toBe("pass");
  });
});

describe("accountsKnown", () => {
  it("fails on an account absent from SKR04 and names it", () => {
    const c = byId(runChecks([tx({ account: "9999" })], results(), 1000), "accountsKnown");
    expect(c.status).toBe("fail");
    expect(c.detail).toContain("9999");
  });

  it("reports each unknown account once", () => {
    const c = byId(
      runChecks([tx({ account: "9999" }), tx({ account: "9999" })], results(), 1000),
      "accountsKnown",
    );
    expect(c.detail).toBe("9999");
  });
});

describe("allClassified", () => {
  it("fails when a transaction has no account", () => {
    const c = byId(runChecks([tx(), tx({ account: "" })], results(), 1000), "allClassified");
    expect(c.status).toBe("fail");
    expect(c.detail).toBe("1");
  });
});

describe("amountsSane", () => {
  it.each([["0"], ["-5.00"], ["abc"], [""]])("rejects amount %s", (amount) => {
    const c = byId(runChecks([tx({ amount })], results(), 1000), "amountsSane");
    expect(c.status).toBe("fail");
  });
});

describe("ruecklage", () => {
  it("warns rather than fails when a thin-capital UG is profitable", () => {
    const checks = runChecks([tx()], results({
      guv: { ...results().guv, jahresueberschuss: 1000 },
      bilanz: {
        ...results().bilanz,
        passiva: { "Gezeichnetes Kapital": 1000, "Jahresüberschuss/Jahresfehlbetrag": 1000 },
      },
    }), 1000);
    const c = byId(checks, "ruecklage");
    expect(c.status).toBe("warn");
    expect(c.detail).toBe("250.00");
    // A warning must not block the filing.
    expect(allChecksPassed(checks)).toBe(true);
  });

  it("does not warn at or above the GmbH threshold", () => {
    const c = byId(runChecks([tx()], results({
      guv: { ...results().guv, jahresueberschuss: 1000 },
    }), 25000), "ruecklage");
    expect(c.status).toBe("pass");
  });

  it("does not warn on a loss", () => {
    expect(byId(runChecks([tx()], results(), 1000), "ruecklage").status).toBe("pass");
  });
});
