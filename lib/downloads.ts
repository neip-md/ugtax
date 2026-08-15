import type { CompanyConfig } from "./engine";
import { generateJournal, generateStatements } from "./engine";

export function journalToCsv(journal: ReturnType<typeof generateJournal>): string {
  const header = "Nr.;Datum;Soll-Konto;Soll-Bezeichnung;Haben-Konto;Haben-Bezeichnung;Betrag;Beschreibung";
  const rows = journal.map((e, i) =>
    `${i + 1};${e.date};${e.debitAccount};${e.debitAccountName};${e.creditAccount};${e.creditAccountName};${e.amount};${e.description}`,
  );
  return [header, ...rows].join("\n");
}

export function statementsToCsv(results: ReturnType<typeof generateStatements>): string {
  const lines: string[] = [];
  lines.push(`Bilanz zum 31.12.${results.fiscalYear}`);
  lines.push(`${results.companyName}`);
  lines.push("");
  lines.push("AKTIVA;EUR");
  for (const [k, v] of Object.entries(results.bilanz.aktiva)) {
    lines.push(`${k};${v.toFixed(2)}`);
  }
  lines.push(`Summe Aktiva;${results.bilanz.summeAktiva.toFixed(2)}`);
  lines.push("");
  lines.push("PASSIVA;EUR");
  for (const [k, v] of Object.entries(results.bilanz.passiva)) {
    lines.push(`${k};${v.toFixed(2)}`);
  }
  lines.push(`Summe Passiva;${results.bilanz.summePassiva.toFixed(2)}`);
  lines.push("");
  lines.push("GUV;EUR");
  for (const [k, v] of Object.entries(results.guv.ertraege)) {
    lines.push(`${k};${v.toFixed(2)}`);
  }
  for (const [k, v] of Object.entries(results.guv.aufwendungen)) {
    lines.push(`${k};-${v.toFixed(2)}`);
  }
  lines.push(`Jahresueberschuss;${results.guv.jahresueberschuss.toFixed(2)}`);
  return lines.join("\n");
}

export function generateFilingGuide(
  results: ReturnType<typeof generateStatements>,
  config: CompanyConfig,
): string {
  const year = results.fiscalYear;
  const je = results.guv.jahresueberschuss;
  const fmt = (n: number) => n.toFixed(2);
  const lines: string[] = [];

  lines.push(`# Steuerliche Abgabepflichten - ${config.name} - ${year}\n`);
  lines.push(`Steuernummer: ${config.steuernummer}`);
  lines.push(`Finanzamt: ${config.finanzamt}`);
  lines.push(`Rechtsform: UG (haftungsbeschränkt)\n`);

  if (results.warnings.length > 0) {
    lines.push("## Warnungen\n");
    for (const w of results.warnings) lines.push(`- ${w}`);
    lines.push("");
  }

  lines.push("## 1. E-Bilanz\n");
  lines.push("**Aktiva:**\n");
  for (const [k, v] of Object.entries(results.bilanz.aktiva)) {
    lines.push(`- ${k}: **${fmt(v)} €**`);
  }
  lines.push(`- **Summe Aktiva: ${fmt(results.bilanz.summeAktiva)} €**\n`);
  lines.push("**Passiva:**\n");
  for (const [k, v] of Object.entries(results.bilanz.passiva)) {
    lines.push(`- ${k}: **${fmt(v)} €**`);
  }
  lines.push(`- **Summe Passiva: ${fmt(results.bilanz.summePassiva)} €**\n`);

  lines.push("## 2. KSt 1 - ELSTER-Kennzahlen\n");
  lines.push("> **Hinweis:** Diese Werte basieren auf automatischer Klassifizierung. Prüfen Sie alle Angaben sorgfältig vor der Übermittlung an das Finanzamt.\n");
  lines.push("| ELSTER Zeile | Bezeichnung | Wert |");
  lines.push("|-------------|-------------|------|");
  lines.push(`| Zeile 11 | Gewinn/Verlust lt. Bilanz | ${fmt(je)} € |`);
  if (je > 0) {
    const kst = Math.round(je * 0.15 * 100) / 100;
    const soli = Math.round(kst * 0.055 * 100) / 100;
    lines.push(`| Zeile 24a | Körperschaftsteuer (15%) | ${fmt(kst)} € |`);
    lines.push(`| Zeile 24b | Solidaritätszuschlag (5,5% der KSt) | ${fmt(soli)} € |`);
  } else {
    lines.push("| Zeile 24a | Körperschaftsteuer | 0,00 € (Verlust) |");
    lines.push("| Zeile 24b | Solidaritätszuschlag | 0,00 € (Verlust) |");
  }
  lines.push("");

  lines.push("## 3. GewSt 1 A - ELSTER-Kennzahlen\n");
  lines.push("> **Hinweis:** Diese Werte basieren auf automatischer Klassifizierung. Prüfen Sie alle Angaben sorgfältig vor der Übermittlung an das Finanzamt.\n");
  lines.push("| ELSTER Zeile | Bezeichnung | Wert |");
  lines.push("|-------------|-------------|------|");
  lines.push(`| Zeile 33 | Gewinn aus Gewerbebetrieb | ${fmt(je)} € |`);
  lines.push(`| Zeile 103 | Hebesatz (gemeindespezifisch) | Gemeinde prüfen |`);
  if (je > 0) {
    const messbetrag = Math.round(je * 0.035 * 100) / 100;
    lines.push(`| | Steuermessbetrag (3,5%) | ${fmt(messbetrag)} € |`);
  }
  lines.push("");

  lines.push("## 4. USt-Jahreserklärung - ELSTER-Kennzahlen\n");
  if (config.kleinunternehmer) {
    lines.push("> Kleinunternehmerregelung (§ 19 UStG) angewendet.\n");
    lines.push("| ELSTER Zeile | Bezeichnung | Wert |");
    lines.push("|-------------|-------------|------|");
    lines.push("| Zeile 22 | Steuerfreie Umsätze (Kleinunternehmer) | 0,00 € |");
  } else {
    lines.push("Regelbesteuerung - Umsatzsteuer-Voranmeldung prüfen.\n");
  }
  lines.push("");

  lines.push("## 5. Fristen\n");
  lines.push(`| Erklärung | Frist |`);
  lines.push(`|-----------|-------|`);
  lines.push(`| E-Bilanz | 31.07.${year + 1} |`);
  lines.push(`| KSt 1 | 31.07.${year + 1} |`);
  lines.push(`| GewSt 1 A | 31.07.${year + 1} |`);
  lines.push(`| USt | 31.07.${year + 1} |`);
  lines.push(`| Bundesanzeiger | 31.12.${year + 1} |`);
  lines.push("");
  lines.push("---\n*Keine Steuerberatung. Alle Angaben ohne Gewähr.*");

  return lines.join("\n");
}

export function generateBundesanzeiger(
  results: ReturnType<typeof generateStatements>,
  config: CompanyConfig,
): string {
  const year = results.fiscalYear;
  const fmt = (n: number) => n.toFixed(2).replace(".", ",");
  const sitz = config.sitz?.trim() || "Berlin";
  const lines: string[] = [];

  lines.push(`${config.name}`);
  lines.push(`Sitz: ${sitz}`);
  lines.push("");
  lines.push(`Offenlegung des Jahresabschlusses zum 31.12.${year}`);
  lines.push(`gemäß §§ 325, 326 HGB`);
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("");
  lines.push("HINWEIS ZUR KLEINSTKAPITALGESELLSCHAFT (§ 267a HGB):");
  lines.push("Kleinstkapitalgesellschaften dürfen eine vereinfachte Bilanz");
  lines.push("ohne GuV und Anhang offenlegen, sofern sie an zwei aufeinander-");
  lines.push("folgenden Abschlussstichtagen mindestens zwei der drei folgenden");
  lines.push("Merkmale nicht überschreiten:");
  lines.push("  - Bilanzsumme ≤ 350.000 EUR");
  lines.push("  - Umsatzerlöse ≤ 700.000 EUR");
  lines.push("  - ≤ 10 Arbeitnehmer im Jahresdurchschnitt");
  lines.push("Bitte prüfen Sie, ob Ihre Gesellschaft die Voraussetzungen erfüllt.");
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("");
  lines.push("BILANZ");
  lines.push(`zum 31. Dezember ${year}`);
  lines.push("");

  lines.push("AKTIVA");
  lines.push("───────────────────────────────────────────────────────");
  for (const [k, v] of Object.entries(results.bilanz.aktiva)) {
    lines.push(`  ${k.padEnd(40)} ${fmt(v).padStart(12)} EUR`);
  }
  lines.push("───────────────────────────────────────────────────────");
  lines.push(`  ${"Summe Aktiva".padEnd(40)} ${fmt(results.bilanz.summeAktiva).padStart(12)} EUR`);
  lines.push("");

  lines.push("PASSIVA");
  lines.push("───────────────────────────────────────────────────────");
  for (const [k, v] of Object.entries(results.bilanz.passiva)) {
    lines.push(`  ${k.padEnd(40)} ${fmt(v).padStart(12)} EUR`);
  }
  lines.push("───────────────────────────────────────────────────────");
  lines.push(`  ${"Summe Passiva".padEnd(40)} ${fmt(results.bilanz.summePassiva).padStart(12)} EUR`);
  lines.push("");
  lines.push("═══════════════════════════════════════════════════════");
  lines.push("");
  lines.push(`${config.name}`);
  lines.push(`Geschäftsführer: gem. Handelsregister`);
  lines.push("");
  lines.push("Einzureichen über: publikations-plattform.de");
  lines.push(`Frist: 31.12.${year + 1}`);
  lines.push("");
  lines.push("---");
  lines.push("Erstellt mit UGtax.de - Keine Steuerberatung. Alle Angaben ohne Gewähr.");

  return lines.join("\n");
}
