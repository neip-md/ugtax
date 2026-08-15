import { ACCOUNTS, type ProcessResults } from "./engine";

/**
 * Structured pre-filing checks.
 *
 * WHY THIS EXISTS
 *   A tax tool's only real feature is being right, and the engine previously
 *   expressed that as free-text `warnings[]` only. There was no way for the UI
 *   to say what had been verified, and no machine-readable result to assert in
 *   CI. It is also the precondition in docs/plans/2026-08-15-open-source-spine-
 *   design.md for accepting vendor rule contributions from strangers: without
 *   it, a wrong SKR04 mapping in a pull request produces a wrong Bilanz and
 *   nothing notices.
 *
 * Each check is independent and pure, so a failure never hides the others.
 */

/**
 * The minimum a row must expose to be checked.
 *
 * Deliberately structural rather than ClassifiedTransaction: the session store
 * holds TransactionItem, whose account name field is snake_case. These checks
 * only read `account` and `amount`, so widening the parameter is honest, where
 * casting at the call site would not be.
 */
export type CheckableTransaction = {
  account?: string;
  amount: string | number;
};

export type CheckStatus = "pass" | "fail" | "warn";

export type Check = {
  /** Stable id, also the i18n key suffix. */
  id: string;
  status: CheckStatus;
  /** Filled with concrete numbers when the check is not a plain pass. */
  detail?: string;
};

const EPSILON = 0.01;
const money = (n: number) => n.toFixed(2);

/** Aktiva must equal Passiva. The single most important invariant. */
function checkBilanzBalanced(results: ProcessResults): Check {
  const { summeAktiva, summePassiva } = results.bilanz;
  const delta = Math.abs(summeAktiva - summePassiva);
  return delta < EPSILON
    ? { id: "bilanzBalanced", status: "pass" }
    : {
        id: "bilanzBalanced",
        status: "fail",
        detail: `Aktiva ${money(summeAktiva)} != Passiva ${money(summePassiva)} (${money(delta)})`,
      };
}

/**
 * The GuV result must be the figure carried into the Bilanz.
 *
 * generateStatements adds jahresueberschuss into Passiva, so a mismatch means
 * the two halves were computed from different data.
 */
function checkGuvTiesToBilanz(results: ProcessResults): Check {
  const fromGuv = results.guv.jahresueberschuss;
  const inBilanz = results.bilanz.passiva["Jahresüberschuss/Jahresfehlbetrag"] ?? 0;
  // Below the rounding floor the engine omits the position entirely.
  if (Math.abs(fromGuv) < EPSILON / 2 && inBilanz === 0) {
    return { id: "guvTies", status: "pass" };
  }
  const delta = Math.abs(fromGuv - inBilanz);
  return delta < EPSILON
    ? { id: "guvTies", status: "pass" }
    : {
        id: "guvTies",
        status: "fail",
        detail: `GuV ${money(fromGuv)} != Bilanz ${money(inBilanz)} (${money(delta)})`,
      };
}

/** Every booked account must exist in the SKR04 catalogue. */
function checkAccountsKnown(classified: CheckableTransaction[]): Check {
  const unknown = [...new Set(
    classified.filter((t) => t.account && !ACCOUNTS[t.account]).map((t) => t.account),
  )];
  return unknown.length === 0
    ? { id: "accountsKnown", status: "pass" }
    : { id: "accountsKnown", status: "fail", detail: unknown.join(", ") };
}

/** Nothing may reach the statements without an account. */
function checkAllClassified(classified: CheckableTransaction[]): Check {
  const missing = classified.filter((t) => !t.account).length;
  return missing === 0
    ? { id: "allClassified", status: "pass" }
    : { id: "allClassified", status: "fail", detail: String(missing) };
}

/**
 * No transaction may be silently dropped between classification and the journal.
 *
 * Every classified transaction should produce exactly one journal entry, so a
 * shortfall means rows vanished without anyone being told.
 */
function checkNothingDropped(
  classified: CheckableTransaction[],
  results: ProcessResults,
): Check {
  const expected = classified.filter((t) => t.account).length;
  const actual = results.journalEntryCount;
  return expected === actual
    ? { id: "nothingDropped", status: "pass" }
    : {
        id: "nothingDropped",
        status: "fail",
        detail: `${actual}/${expected}`,
      };
}

/** Amounts must be finite and positive; direction carries the sign. */
function checkAmountsSane(classified: CheckableTransaction[]): Check {
  const bad = classified.filter((t) => {
    const n = Number(t.amount);
    return !Number.isFinite(n) || n <= 0;
  }).length;
  return bad === 0
    ? { id: "amountsSane", status: "pass" }
    : { id: "amountsSane", status: "fail", detail: String(bad) };
}

/**
 * Thin capital rule (§5a Abs. 3 GmbHG). A warning, not a failure: the filing is
 * valid, the founder just owes a reserve.
 */
function checkRuecklage(results: ProcessResults, stammkapital: number): Check {
  const profit = results.guv.jahresueberschuss;
  if (!(stammkapital < 25000 && profit > 0)) {
    return { id: "ruecklage", status: "pass" };
  }
  return {
    id: "ruecklage",
    status: "warn",
    detail: money(profit * 0.25),
  };
}

export function runChecks(
  classified: CheckableTransaction[],
  results: ProcessResults,
  stammkapital = 0,
): Check[] {
  return [
    checkBilanzBalanced(results),
    checkGuvTiesToBilanz(results),
    checkNothingDropped(classified, results),
    checkAllClassified(classified),
    checkAccountsKnown(classified),
    checkAmountsSane(classified),
    checkRuecklage(results, stammkapital),
  ];
}

/** True when nothing failed. Warnings do not block a filing. */
export function allChecksPassed(checks: Check[]): boolean {
  return checks.every((c) => c.status !== "fail");
}

export function failedChecks(checks: Check[]): Check[] {
  return checks.filter((c) => c.status === "fail");
}
