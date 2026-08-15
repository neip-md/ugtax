"""Filing guide generator — step-by-step instructions for ELSTER and Bundesanzeiger."""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

from .config import Config
from .models import FinancialStatements


def generate_filing_guide(
    statements: FinancialStatements,
    config: Config,
    output_path: str | Path,
) -> None:
    """Generate a Markdown filing guide with exact values for each tax form."""
    year = statements.fiscal_year
    bilanz = statements.bilanz
    guv = statements.guv
    je = guv.jahresueberschuss
    company = config.company

    sections: list[str] = []

    # Header
    sections.append(f"# Steuerliche Abgabepflichten — {company.name} — Geschäftsjahr {year}\n")
    sections.append(
        f"Steuernummer: {company.steuernummer}\n"
        f"Finanzamt: {company.finanzamt}\n"
        f"Rechtsform: UG (haftungsbeschränkt)\n"
    )

    if statements.warnings:
        sections.append("## Warnungen\n")
        for w in statements.warnings:
            sections.append(f"- {w}")
        sections.append("")

    # 1. E-Bilanz
    sections.append("## 1. E-Bilanz (Elektronische Bilanz)\n")
    sections.append(
        "Die E-Bilanz wird im XBRL-Format an das Finanzamt übermittelt. "
        "Für die Übermittlung können Sie steuerschroeder.de (kostenlos) oder "
        "eine andere Übermittlungssoftware nutzen.\n"
    )
    sections.append("### Einzutragende Werte\n")
    sections.append("**Aktiva:**\n")
    for pos, amt in sorted(bilanz.aktiva.items()):
        if amt != Decimal("0.00"):
            sections.append(f"- {pos}: **{amt:,.2f} €**")
    sections.append(f"- **Summe Aktiva: {bilanz.summe_aktiva:,.2f} €**\n")

    sections.append("**Passiva:**\n")
    for pos, amt in sorted(bilanz.passiva.items()):
        if amt != Decimal("0.00"):
            sections.append(f"- {pos}: **{amt:,.2f} €**")
    sections.append(f"- **Summe Passiva: {bilanz.summe_passiva:,.2f} €**\n")

    sections.append("**GuV:**\n")
    if guv.ertraege:
        for pos, amt in sorted(guv.ertraege.items()):
            sections.append(f"- {pos}: **{amt:,.2f} €**")
    else:
        sections.append("- Erträge: **0,00 €**")
    for pos, amt in sorted(guv.aufwendungen.items()):
        sections.append(f"- {pos}: **{amt:,.2f} €**")
    sections.append(f"- **Jahresüberschuss/-fehlbetrag: {je:,.2f} €**\n")

    # 2. KSt
    sections.append("## 2. Körperschaftsteuererklärung (KSt 1)\n")
    sections.append("### ELSTER: Körperschaftsteuererklärung\n")
    sections.append(f"- **Zeile 11** (Gewinn/Verlust lt. Bilanz): **{je:,.2f} €**")
    sections.append(f"- **Zeile 33** (Einkommen): **{je:,.2f} €** (bei einfacher UG ohne Korrekturen)")

    if je > Decimal("0.00"):
        kst = (je * Decimal("0.15")).quantize(Decimal("0.01"))
        soli = (kst * Decimal("0.055")).quantize(Decimal("0.01"))
        sections.append(f"- Geschätzte KSt (15%): **{kst:,.2f} €**")
        sections.append(f"- Geschätzter Solidaritätszuschlag (5,5% der KSt): **{soli:,.2f} €**")
        sections.append(f"- **Gesamt KSt + Soli: {kst + soli:,.2f} €**")
    else:
        sections.append("- Bei Verlust: keine KSt fällig. Verlustvortrag möglich (§ 10d EStG i.V.m. § 8 Abs. 1 KStG).")
    sections.append("")

    # 3. GewSt
    sections.append("## 3. Gewerbesteuererklärung (GewSt 1 A)\n")
    sections.append("### ELSTER: Gewerbesteuererklärung\n")
    sections.append(f"- **Zeile 39** (Gewinn aus Gewerbebetrieb): **{je:,.2f} €**")
    sections.append("- Hinzurechnungen (Zeile 40ff): in der Regel keine bei reiner Holding-UG")
    sections.append("- Kürzungen (Zeile 51ff): in der Regel keine")

    if je > Decimal("0.00"):
        # GewSt: Freibetrag 24.500 € für natürliche Personen / Personengesellschaften,
        # aber NICHT für Kapitalgesellschaften (UG/GmbH)
        hebesatz = Decimal("410")  # Berlin default, varies by municipality
        messbetrag = (je * Decimal("0.035")).quantize(Decimal("0.01"))
        gewst = (messbetrag * hebesatz / Decimal("100")).quantize(Decimal("0.01"))
        sections.append(f"- Gewerbesteuermessbetrag (3,5%): **{messbetrag:,.2f} €**")
        sections.append(f"- Bei Hebesatz {hebesatz}% (Berlin): **{gewst:,.2f} €**")
        sections.append("- *Hinweis: Hebesatz variiert je nach Gemeinde. Prüfen Sie den Hebesatz Ihrer Gemeinde.*")
    else:
        sections.append("- Bei Verlust: keine GewSt fällig. Gewerbeverlust wird vorgetragen.")
    sections.append("")

    # 4. USt
    sections.append("## 4. Umsatzsteuer-Jahreserklärung\n")
    if company.kleinunternehmer:
        sections.append("### Kleinunternehmerregelung (§ 19 UStG)\n")
        sections.append(
            "Als Kleinunternehmer sind Sie von der Umsatzsteuer befreit. "
            "Die Jahreserklärung ist dennoch abzugeben.\n"
        )
        sections.append("### ELSTER: Umsatzsteuer-Jahreserklärung\n")
        sections.append("- **Zeile 22** (Kleinunternehmer): **Ja / ankreuzen**")
        sections.append("- Alle Umsatz- und Vorsteuerfelder: **0,00 €**")
        sections.append("- Keine Umsatzsteuer-Voranmeldungen nötig (sofern FA nicht anders bestimmt)")
    else:
        sections.append("### Regelbesteuerung\n")
        sections.append(
            "*Hinweis: Bei Regelbesteuerung müssen die tatsächlichen Umsätze und "
            "Vorsteuern eingetragen werden. Dieses Tool unterstützt derzeit nur "
            "die Kleinunternehmerregelung im Detail.*"
        )
    sections.append("")

    # 5. Bundesanzeiger
    sections.append("## 5. Offenlegung im Bundesanzeiger\n")
    sections.append(
        "Als Kleinstkapitalgesellschaft (§ 267a HGB) können Sie die vereinfachte "
        "Offenlegung nutzen: nur Bilanz (ohne GuV) hinterlegen.\n"
    )
    sections.append(f"- **Frist**: 12 Monate nach Geschäftsjahresende (bis 31.12.{year + 1})")
    sections.append("- **Portal**: https://www.bundesanzeiger.de")
    sections.append("- **Kosten**: ca. 2-5 € pro Hinterlegung")
    sections.append("- Hinterlegen Sie die Bilanz (Aktiva + Passiva) wie oben dargestellt.")
    sections.append("")

    # 6. Fristen
    sections.append("## 6. Abgabefristen\n")
    sections.append(f"| Erklärung | Frist |")
    sections.append(f"|-----------|-------|")
    sections.append(f"| E-Bilanz | 31.07.{year + 1} (ohne Steuerberater) |")
    sections.append(f"| KSt 1 | 31.07.{year + 1} (ohne Steuerberater) |")
    sections.append(f"| GewSt 1 A | 31.07.{year + 1} (ohne Steuerberater) |")
    sections.append(f"| USt-Jahreserklärung | 31.07.{year + 1} (ohne Steuerberater) |")
    sections.append(f"| Bundesanzeiger | 31.12.{year + 1} |")
    sections.append("")
    sections.append(
        "*Hinweis: Fristverlängerung bis Ende Februar des übernächsten Jahres möglich "
        "bei Beauftragung eines Steuerberaters. Pandemiebedingte Fristverlängerungen prüfen.*"
    )
    sections.append("")

    # Disclaimer
    sections.append("---\n")
    sections.append(
        "*Dieses Dokument wurde automatisch erstellt und stellt keine Steuerberatung dar. "
        "Alle Angaben ohne Gewähr. Prüfen Sie die Werte vor der Abgabe sorgfältig. "
        "Bei Unsicherheiten konsultieren Sie einen Steuerberater.*"
    )

    # Write file
    content = "\n".join(sections)
    Path(output_path).write_text(content, encoding="utf-8")
