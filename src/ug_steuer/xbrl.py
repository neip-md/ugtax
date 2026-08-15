"""XBRL E-Bilanz generator for Kleinstkapitalgesellschaft (HGB-Taxonomie 6.8).

Generates a valid XBRL instance document that can be submitted to the Finanzamt
via ERiC or validated/submitted through steuerschroeder.de or similar tools.

For a Kleinstkapitalgesellschaft (§267a HGB), only ~15-20 taxonomy positions
need to be populated. The rest of the ~4000 HGB taxonomy positions are omitted.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal
from pathlib import Path
from xml.etree.ElementTree import Element, SubElement, ElementTree, indent

from .config import Config
from .models import FinancialStatements

# HGB-Taxonomie namespaces
NS = {
    "xbrli": "http://www.xbrl.org/2003/instance",
    "link": "http://www.xbrl.org/2003/linkbase",
    "xlink": "http://www.w3.org/1999/xlink",
    "iso4217": "http://www.xbrl.org/2003/iso4217",
    "xbrldi": "http://xbrl.org/2006/xbrldi",
    "hgb": "http://www.xbrl.de/taxonomies/de-gaap-ci",
    "de-gcd": "http://www.xbrl.de/taxonomies/de-gcd",
}

# Mapping: our internal position names → HGB taxonomy element names
# These are the XBRL element names from the HGB-Taxonomie for Kleinstkapitalgesellschaft
BILANZ_AKTIVA_ELEMENTS = {
    "Finanzanlagen": "de-gaap-ci:bs.ass.fixAss.fin",
    "Guthaben bei Kreditinstituten": "de-gaap-ci:bs.ass.currAss.cashEquiv",
}

BILANZ_PASSIVA_ELEMENTS = {
    "Gezeichnetes Kapital": "de-gaap-ci:bs.eqLiab.equity.subscribed",
    "Gesetzliche Rücklage": "de-gaap-ci:bs.eqLiab.equity.reserves.legal",
    "Gewinnvortrag/Verlustvortrag": "de-gaap-ci:bs.eqLiab.equity.retainedEarnings",
    "Jahresüberschuss/Jahresfehlbetrag": "de-gaap-ci:bs.eqLiab.equity.netIncome",
    "Sonstige Verbindlichkeiten": "de-gaap-ci:bs.eqLiab.liab.other",
}

GUV_ELEMENTS = {
    "Sonstige betriebliche Aufwendungen": "de-gaap-ci:is.otherOperatingExpenses",
    "Sonstige betriebliche Erträge": "de-gaap-ci:is.otherOperatingIncome",
    "Jahresüberschuss/Jahresfehlbetrag": "de-gaap-ci:is.netIncome",
}

# Aggregate/total elements
TOTAL_ELEMENTS = {
    "summe_aktiva": "de-gaap-ci:bs.ass",
    "summe_passiva": "de-gaap-ci:bs.eqLiab",
    "summe_aufwendungen": "de-gaap-ci:is.totalExpenses",
    "summe_ertraege": "de-gaap-ci:is.totalIncome",
}

# GCD (Global Common Document) elements for report identification
GCD_ELEMENTS = {
    "report_type": "de-gcd:genInfo.report.id.reportType",
    "report_status": "de-gcd:genInfo.report.id.reportStatus",
    "company_name": "de-gcd:genInfo.company.id.name",
    "company_legal_form": "de-gcd:genInfo.company.id.legalStatus",
    "tax_number": "de-gcd:genInfo.company.id.taxNumber",
    "fiscal_year_begin": "de-gcd:genInfo.report.period.fiscalYearBegin",
    "fiscal_year_end": "de-gcd:genInfo.report.period.fiscalYearEnd",
    "accounting_standard": "de-gcd:genInfo.report.id.accountingStandard",
    "size_class": "de-gcd:genInfo.company.id.sizeClass",
}


def _format_decimal(value: Decimal) -> str:
    """Format a Decimal value for XBRL (2 decimal places, no thousands separator)."""
    return f"{value:.2f}"


def _register_namespaces() -> None:
    """Register XML namespaces to avoid ns0/ns1 prefixes in output."""
    import xml.etree.ElementTree as ET
    for prefix, uri in NS.items():
        ET.register_namespace(prefix, uri)


def generate_xbrl(
    statements: FinancialStatements,
    config: Config,
    output_path: str | Path,
) -> None:
    """
    Generate an XBRL instance document (E-Bilanz) for a Kleinstkapitalgesellschaft.

    The output is a valid XBRL 2.1 instance document that conforms to the
    HGB-Taxonomie structure. It can be submitted via ERiC or used as input
    for tools like steuerschroeder.de.
    """
    _register_namespaces()

    year = statements.fiscal_year
    company = config.company
    instance_id = f"ebilanz-{year}-{uuid.uuid4().hex[:8]}"

    # Root element — namespaces are registered via _register_namespaces()
    # so ElementTree handles xmlns declarations automatically
    root = Element(f"{{{NS['xbrli']}}}xbrl")

    # Schema references
    _add_schema_refs(root)

    # Contexts
    _add_contexts(root, year, company.steuernummer, instance_id)

    # Units
    _add_units(root)

    # GCD facts (report metadata)
    _add_gcd_facts(root, statements, config, instance_id)

    # Bilanz facts
    _add_bilanz_facts(root, statements, instance_id)

    # GuV facts
    _add_guv_facts(root, statements, instance_id)

    # Pretty print and write
    indent(root, space="  ")
    tree = ElementTree(root)
    tree.write(
        output_path,
        encoding="utf-8",
        xml_declaration=True,
    )


def _add_schema_refs(root: Element) -> None:
    """Add schemaRef linkbase references."""
    schema_ref = SubElement(root, f"{{{NS['link']}}}schemaRef")
    schema_ref.set(f"{{{NS['xlink']}}}type", "simple")
    schema_ref.set(f"{{{NS['xlink']}}}href",
                   "http://www.xbrl.de/taxonomies/de-gaap-ci-2023-06-01.xsd")


def _add_contexts(root: Element, year: int, tax_number: str, instance_id: str) -> None:
    """Add XBRL context elements."""
    # Instant context (balance sheet date)
    ctx_instant = SubElement(root, f"{{{NS['xbrli']}}}context")
    ctx_instant.set("id", f"{instance_id}-instant")

    entity = SubElement(ctx_instant, f"{{{NS['xbrli']}}}entity")
    identifier = SubElement(entity, f"{{{NS['xbrli']}}}identifier")
    identifier.set("scheme", "http://www.finanzamt.de")
    identifier.text = tax_number or "00/000/00000"

    period = SubElement(ctx_instant, f"{{{NS['xbrli']}}}period")
    instant_date = SubElement(period, f"{{{NS['xbrli']}}}instant")
    instant_date.text = f"{year}-12-31"

    # Duration context (fiscal year — for GuV)
    ctx_duration = SubElement(root, f"{{{NS['xbrli']}}}context")
    ctx_duration.set("id", f"{instance_id}-duration")

    entity2 = SubElement(ctx_duration, f"{{{NS['xbrli']}}}entity")
    identifier2 = SubElement(entity2, f"{{{NS['xbrli']}}}identifier")
    identifier2.set("scheme", "http://www.finanzamt.de")
    identifier2.text = tax_number or "00/000/00000"

    period2 = SubElement(ctx_duration, f"{{{NS['xbrli']}}}period")
    start = SubElement(period2, f"{{{NS['xbrli']}}}startDate")
    start.text = f"{year}-01-01"
    end = SubElement(period2, f"{{{NS['xbrli']}}}endDate")
    end.text = f"{year}-12-31"

    # GCD context (report identification — also duration)
    ctx_gcd = SubElement(root, f"{{{NS['xbrli']}}}context")
    ctx_gcd.set("id", f"{instance_id}-gcd")

    entity3 = SubElement(ctx_gcd, f"{{{NS['xbrli']}}}entity")
    identifier3 = SubElement(entity3, f"{{{NS['xbrli']}}}identifier")
    identifier3.set("scheme", "http://www.finanzamt.de")
    identifier3.text = tax_number or "00/000/00000"

    period3 = SubElement(ctx_gcd, f"{{{NS['xbrli']}}}period")
    start3 = SubElement(period3, f"{{{NS['xbrli']}}}startDate")
    start3.text = f"{year}-01-01"
    end3 = SubElement(period3, f"{{{NS['xbrli']}}}endDate")
    end3.text = f"{year}-12-31"


def _add_units(root: Element) -> None:
    """Add unit definitions."""
    unit_eur = SubElement(root, f"{{{NS['xbrli']}}}unit")
    unit_eur.set("id", "EUR")
    measure = SubElement(unit_eur, f"{{{NS['xbrli']}}}measure")
    measure.text = "iso4217:EUR"

    unit_pure = SubElement(root, f"{{{NS['xbrli']}}}unit")
    unit_pure.set("id", "PURE")
    measure2 = SubElement(unit_pure, f"{{{NS['xbrli']}}}measure")
    measure2.text = "xbrli:pure"


def _add_monetary_fact(
    root: Element,
    element_name: str,
    value: Decimal,
    context_ref: str,
    decimals: str = "2",
) -> None:
    """Add a monetary fact element."""
    # Split namespace prefix and local name
    if ":" in element_name:
        prefix, local = element_name.split(":", 1)
        uri = NS.get(prefix.replace("de-gaap-ci", "hgb").replace("de-gcd", "de-gcd"), "")
        # Map our simplified prefixes to actual namespace URIs
        if "de-gaap-ci" in element_name:
            uri = NS["hgb"]
        elif "de-gcd" in element_name:
            uri = NS["de-gcd"]
        fact = SubElement(root, f"{{{uri}}}{local}")
    else:
        fact = SubElement(root, element_name)

    fact.set("contextRef", context_ref)
    fact.set("unitRef", "EUR")
    fact.set("decimals", decimals)
    fact.text = _format_decimal(value)


def _add_string_fact(
    root: Element,
    element_name: str,
    value: str,
    context_ref: str,
) -> None:
    """Add a string fact element."""
    if ":" in element_name:
        if "de-gcd" in element_name:
            uri = NS["de-gcd"]
        elif "de-gaap-ci" in element_name:
            uri = NS["hgb"]
        else:
            uri = ""
        local = element_name.split(":", 1)[1]
        fact = SubElement(root, f"{{{uri}}}{local}")
    else:
        fact = SubElement(root, element_name)

    fact.set("contextRef", context_ref)
    fact.text = value


def _add_gcd_facts(
    root: Element,
    statements: FinancialStatements,
    config: Config,
    instance_id: str,
) -> None:
    """Add GCD (Global Common Document) facts for report identification."""
    ctx = f"{instance_id}-gcd"

    # Report type: E-Bilanz
    _add_string_fact(root, GCD_ELEMENTS["report_type"], "E-Bilanz", ctx)

    # Report status: final
    _add_string_fact(root, GCD_ELEMENTS["report_status"], "final", ctx)

    # Company name
    _add_string_fact(root, GCD_ELEMENTS["company_name"], config.company.name, ctx)

    # Legal form: UG (haftungsbeschränkt)
    _add_string_fact(root, GCD_ELEMENTS["company_legal_form"],
                     "UG (haftungsbeschraenkt)", ctx)

    # Tax number
    if config.company.steuernummer:
        _add_string_fact(root, GCD_ELEMENTS["tax_number"],
                         config.company.steuernummer, ctx)

    # Fiscal year period
    year = statements.fiscal_year
    _add_string_fact(root, GCD_ELEMENTS["fiscal_year_begin"], f"{year}-01-01", ctx)
    _add_string_fact(root, GCD_ELEMENTS["fiscal_year_end"], f"{year}-12-31", ctx)

    # Accounting standard: HGB
    _add_string_fact(root, GCD_ELEMENTS["accounting_standard"], "HGB", ctx)

    # Size class: Kleinstkapitalgesellschaft
    _add_string_fact(root, GCD_ELEMENTS["size_class"], "Kleinstkapitalgesellschaft", ctx)


def _add_bilanz_facts(
    root: Element,
    statements: FinancialStatements,
    instance_id: str,
) -> None:
    """Add Bilanz (balance sheet) facts — instant context."""
    ctx = f"{instance_id}-instant"
    bilanz = statements.bilanz

    # Aktiva positions
    for position_name, amount in bilanz.aktiva.items():
        element = BILANZ_AKTIVA_ELEMENTS.get(position_name)
        if element and amount != Decimal("0.00"):
            _add_monetary_fact(root, element, amount, ctx)

    # Summe Aktiva
    if bilanz.summe_aktiva != Decimal("0.00"):
        _add_monetary_fact(root, TOTAL_ELEMENTS["summe_aktiva"], bilanz.summe_aktiva, ctx)

    # Passiva positions
    for position_name, amount in bilanz.passiva.items():
        element = BILANZ_PASSIVA_ELEMENTS.get(position_name)
        if element and amount != Decimal("0.00"):
            _add_monetary_fact(root, element, amount, ctx)

    # Summe Passiva
    if bilanz.summe_passiva != Decimal("0.00"):
        _add_monetary_fact(root, TOTAL_ELEMENTS["summe_passiva"], bilanz.summe_passiva, ctx)


def _add_guv_facts(
    root: Element,
    statements: FinancialStatements,
    instance_id: str,
) -> None:
    """Add GuV (income statement) facts — duration context."""
    ctx = f"{instance_id}-duration"
    guv = statements.guv

    # Erträge
    for position_name, amount in guv.ertraege.items():
        element = GUV_ELEMENTS.get(position_name)
        if element and amount != Decimal("0.00"):
            _add_monetary_fact(root, element, amount, ctx)

    # Aufwendungen
    for position_name, amount in guv.aufwendungen.items():
        element = GUV_ELEMENTS.get(position_name)
        if element and amount != Decimal("0.00"):
            _add_monetary_fact(root, element, amount, ctx)

    # Jahresüberschuss
    je = guv.jahresueberschuss
    if je != Decimal("0.00"):
        _add_monetary_fact(root, GUV_ELEMENTS["Jahresüberschuss/Jahresfehlbetrag"], je, ctx)

    # Totals
    if guv.summe_aufwendungen != Decimal("0.00"):
        _add_monetary_fact(root, TOTAL_ELEMENTS["summe_aufwendungen"],
                           guv.summe_aufwendungen, ctx)
    if guv.summe_ertraege != Decimal("0.00"):
        _add_monetary_fact(root, TOTAL_ELEMENTS["summe_ertraege"],
                           guv.summe_ertraege, ctx)


def validate_xbrl(file_path: str | Path) -> list[str]:
    """
    Basic validation of the generated XBRL file.

    Returns a list of issues found. Empty list means the file passes basic checks.
    This does NOT validate against the full HGB taxonomy schema (that requires lxml
    with the taxonomy XSD files). It checks structural correctness only.
    """
    import xml.etree.ElementTree as ET

    issues: list[str] = []

    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
    except ET.ParseError as e:
        return [f"XML parse error: {e}"]

    # Check root element
    if "xbrl" not in root.tag:
        issues.append(f"Root element should be xbrl, got: {root.tag}")

    # Check for contexts
    contexts = [el for el in root if "context" in el.tag]
    if len(contexts) < 2:
        issues.append(f"Expected at least 2 contexts (instant + duration), found {len(contexts)}")

    # Check for units
    units = [el for el in root if "unit" in el.tag]
    if not units:
        issues.append("No unit elements found")

    # Check for schemaRef
    schema_refs = [el for el in root if "schemaRef" in el.tag]
    if not schema_refs:
        issues.append("No schemaRef found")

    # Check that monetary facts reference existing contexts and units
    for el in root:
        context_ref = el.get("contextRef")
        unit_ref = el.get("unitRef")
        if context_ref:
            ctx_ids = {ctx.get("id") for ctx in contexts}
            if context_ref not in ctx_ids:
                issues.append(f"Fact references unknown context: {context_ref}")
        if unit_ref:
            unit_ids = {u.get("id") for u in units}
            if unit_ref not in unit_ids:
                issues.append(f"Fact references unknown unit: {unit_ref}")

    return issues
