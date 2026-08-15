/**
 * XBRL E-Bilanz generator for Kleinstkapitalgesellschaft (HGB-Taxonomie).
 * Generates a valid XBRL instance document.
 */

import type { ProcessResults, CompanyConfig } from "./engine";

const BILANZ_AKTIVA_ELEMENTS: Record<string, string> = {
  "Finanzanlagen": "de-gaap-ci:bs.ass.fixAss.fin",
  "Guthaben bei Kreditinstituten": "de-gaap-ci:bs.ass.currAss.cashEquiv",
};

const BILANZ_PASSIVA_ELEMENTS: Record<string, string> = {
  "Gezeichnetes Kapital": "de-gaap-ci:bs.eqLiab.equity.subscribed",
  "Gesetzliche Rücklage": "de-gaap-ci:bs.eqLiab.equity.reserves.legal",
  "Gewinnvortrag/Verlustvortrag": "de-gaap-ci:bs.eqLiab.equity.retainedEarnings",
  "Jahresüberschuss/Jahresfehlbetrag": "de-gaap-ci:bs.eqLiab.equity.netIncome",
  "Sonstige Verbindlichkeiten": "de-gaap-ci:bs.eqLiab.liab.other",
};

const GUV_ELEMENTS: Record<string, string> = {
  "Sonstige betriebliche Aufwendungen": "de-gaap-ci:is.otherOperatingExpenses",
  "Sonstige betriebliche Erträge": "de-gaap-ci:is.otherOperatingIncome",
};

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmt(n: number): string {
  return n.toFixed(2);
}

export function generateXbrl(results: ProcessResults, config: CompanyConfig): string {
  const year = results.fiscalYear;
  const id = `ebilanz-${year}-${Date.now().toString(36)}`;
  const taxNum = config.steuernummer || "00/000/00000";

  const lines: string[] = [];
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push(`<xbrli:xbrl`);
  lines.push(`  xmlns:xbrli="http://www.xbrl.org/2003/instance"`);
  lines.push(`  xmlns:link="http://www.xbrl.org/2003/linkbase"`);
  lines.push(`  xmlns:xlink="http://www.w3.org/1999/xlink"`);
  lines.push(`  xmlns:iso4217="http://www.xbrl.org/2003/iso4217"`);
  lines.push(`  xmlns:de-gaap-ci="http://www.xbrl.de/taxonomies/de-gaap-ci"`);
  lines.push(`  xmlns:de-gcd="http://www.xbrl.de/taxonomies/de-gcd">`);

  // Schema ref
  lines.push(`  <link:schemaRef xlink:type="simple" xlink:href="http://www.xbrl.de/taxonomies/de-gaap-ci-2023-06-01.xsd"/>`);

  // Contexts
  lines.push(`  <xbrli:context id="${id}-instant">`);
  lines.push(`    <xbrli:entity><xbrli:identifier scheme="http://www.finanzamt.de">${esc(taxNum)}</xbrli:identifier></xbrli:entity>`);
  lines.push(`    <xbrli:period><xbrli:instant>${year}-12-31</xbrli:instant></xbrli:period>`);
  lines.push(`  </xbrli:context>`);

  lines.push(`  <xbrli:context id="${id}-duration">`);
  lines.push(`    <xbrli:entity><xbrli:identifier scheme="http://www.finanzamt.de">${esc(taxNum)}</xbrli:identifier></xbrli:entity>`);
  lines.push(`    <xbrli:period><xbrli:startDate>${year}-01-01</xbrli:startDate><xbrli:endDate>${year}-12-31</xbrli:endDate></xbrli:period>`);
  lines.push(`  </xbrli:context>`);

  lines.push(`  <xbrli:context id="${id}-gcd">`);
  lines.push(`    <xbrli:entity><xbrli:identifier scheme="http://www.finanzamt.de">${esc(taxNum)}</xbrli:identifier></xbrli:entity>`);
  lines.push(`    <xbrli:period><xbrli:startDate>${year}-01-01</xbrli:startDate><xbrli:endDate>${year}-12-31</xbrli:endDate></xbrli:period>`);
  lines.push(`  </xbrli:context>`);

  // Units
  lines.push(`  <xbrli:unit id="EUR"><xbrli:measure>iso4217:EUR</xbrli:measure></xbrli:unit>`);

  // GCD facts
  lines.push(`  <de-gcd:genInfo.report.id.reportType contextRef="${id}-gcd">E-Bilanz</de-gcd:genInfo.report.id.reportType>`);
  lines.push(`  <de-gcd:genInfo.report.id.reportStatus contextRef="${id}-gcd">final</de-gcd:genInfo.report.id.reportStatus>`);
  lines.push(`  <de-gcd:genInfo.company.id.name contextRef="${id}-gcd">${esc(config.name)}</de-gcd:genInfo.company.id.name>`);
  lines.push(`  <de-gcd:genInfo.company.id.legalStatus contextRef="${id}-gcd">UG (haftungsbeschraenkt)</de-gcd:genInfo.company.id.legalStatus>`);
  if (config.steuernummer) {
    lines.push(`  <de-gcd:genInfo.company.id.taxNumber contextRef="${id}-gcd">${esc(config.steuernummer)}</de-gcd:genInfo.company.id.taxNumber>`);
  }
  lines.push(`  <de-gcd:genInfo.report.period.fiscalYearBegin contextRef="${id}-gcd">${year}-01-01</de-gcd:genInfo.report.period.fiscalYearBegin>`);
  lines.push(`  <de-gcd:genInfo.report.period.fiscalYearEnd contextRef="${id}-gcd">${year}-12-31</de-gcd:genInfo.report.period.fiscalYearEnd>`);
  lines.push(`  <de-gcd:genInfo.report.id.accountingStandard contextRef="${id}-gcd">HGB</de-gcd:genInfo.report.id.accountingStandard>`);
  lines.push(`  <de-gcd:genInfo.company.id.sizeClass contextRef="${id}-gcd">Kleinstkapitalgesellschaft</de-gcd:genInfo.company.id.sizeClass>`);

  // Bilanz - Aktiva (instant context)
  for (const [pos, val] of Object.entries(results.bilanz.aktiva)) {
    const el = BILANZ_AKTIVA_ELEMENTS[pos];
    if (el && Math.abs(val) >= 0.005) {
      lines.push(`  <${el} contextRef="${id}-instant" unitRef="EUR" decimals="2">${fmt(val)}</${el}>`);
    }
  }
  lines.push(`  <de-gaap-ci:bs.ass contextRef="${id}-instant" unitRef="EUR" decimals="2">${fmt(results.bilanz.summeAktiva)}</de-gaap-ci:bs.ass>`);

  // Bilanz - Passiva (instant context)
  for (const [pos, val] of Object.entries(results.bilanz.passiva)) {
    const el = BILANZ_PASSIVA_ELEMENTS[pos];
    if (el && Math.abs(val) >= 0.005) {
      lines.push(`  <${el} contextRef="${id}-instant" unitRef="EUR" decimals="2">${fmt(val)}</${el}>`);
    }
  }
  lines.push(`  <de-gaap-ci:bs.eqLiab contextRef="${id}-instant" unitRef="EUR" decimals="2">${fmt(results.bilanz.summePassiva)}</de-gaap-ci:bs.eqLiab>`);

  // GuV (duration context)
  for (const [pos, val] of Object.entries(results.guv.ertraege)) {
    const el = GUV_ELEMENTS[pos];
    if (el && Math.abs(val) >= 0.005) {
      lines.push(`  <${el} contextRef="${id}-duration" unitRef="EUR" decimals="2">${fmt(val)}</${el}>`);
    }
  }
  for (const [pos, val] of Object.entries(results.guv.aufwendungen)) {
    const el = GUV_ELEMENTS[pos];
    if (el && Math.abs(val) >= 0.005) {
      lines.push(`  <${el} contextRef="${id}-duration" unitRef="EUR" decimals="2">${fmt(val)}</${el}>`);
    }
  }
  lines.push(`  <de-gaap-ci:is.netIncome contextRef="${id}-duration" unitRef="EUR" decimals="2">${fmt(results.guv.jahresueberschuss)}</de-gaap-ci:is.netIncome>`);

  lines.push(`</xbrli:xbrl>`);
  return lines.join("\n");
}
