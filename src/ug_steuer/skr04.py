"""SKR04 chart of accounts — subset for micro holding UG."""

from __future__ import annotations

from .models import AccountCategory, BilanzPosition, GuvPosition


# SKR04 accounts relevant for a micro holding UG
# Format: account_number → (name, category)
ACCOUNTS: dict[str, tuple[str, AccountCategory]] = {
    # Anlagevermögen (0xxx)
    "0520": ("Anteile an verbundenen Unternehmen", AccountCategory.ASSET),
    "0535": ("Wertpapiere des Anlagevermögens", AccountCategory.ASSET),
    "0540": ("Ausleihungen an verbundene Unternehmen", AccountCategory.ASSET),
    # Umlaufvermögen (1xxx)
    "1810": ("Bank", AccountCategory.ASSET),
    "1800": ("Bank 2", AccountCategory.ASSET),
    # Eigenkapital (2xxx)
    "2900": ("Gezeichnetes Kapital", AccountCategory.EQUITY),
    "2909": ("Ausstehende Einlagen auf das gezeichnete Kapital", AccountCategory.EQUITY),
    "2960": ("Gesetzliche Rücklage", AccountCategory.EQUITY),
    "2970": ("Gewinnvortrag vor Verwendung", AccountCategory.EQUITY),
    "2978": ("Verlustvortrag vor Verwendung", AccountCategory.EQUITY),
    "2979": ("Jahresüberschuss/Jahresfehlbetrag", AccountCategory.EQUITY),
    # Verbindlichkeiten (3xxx)
    "3510": ("Verbindlichkeiten gegenüber Gesellschaftern", AccountCategory.LIABILITY),
    "3500": ("Sonstige Verbindlichkeiten", AccountCategory.LIABILITY),
    # Erträge (4xxx/5xxx)
    "4830": ("Sonstige betriebliche Erträge", AccountCategory.REVENUE),
    "4840": ("Erträge aus Beteiligungen", AccountCategory.REVENUE),
    # Aufwendungen (6xxx/7xxx)
    "6300": ("Sonstige betriebliche Aufwendungen", AccountCategory.EXPENSE),
    "6827": ("Rechts- und Beratungskosten", AccountCategory.EXPENSE),
    "6830": ("Sonstige Abgaben", AccountCategory.EXPENSE),
    "6855": ("Nebenkosten des Geldverkehrs", AccountCategory.EXPENSE),
    "6880": ("Aufwendungen aus Währungsumrechnung", AccountCategory.EXPENSE),
    "7610": ("Zinsen und ähnliche Aufwendungen", AccountCategory.EXPENSE),
}


def get_account_name(number: str) -> str:
    """Get the name for an SKR04 account number."""
    if number in ACCOUNTS:
        return ACCOUNTS[number][0]
    return f"Unbekanntes Konto {number}"


def get_account_category(number: str) -> AccountCategory:
    """Get the category for an SKR04 account number."""
    if number in ACCOUNTS:
        return ACCOUNTS[number][1]
    # Fallback by number range
    first = int(number[0])
    if first == 0:
        return AccountCategory.ASSET
    if first == 1:
        return AccountCategory.ASSET
    if first == 2:
        return AccountCategory.EQUITY
    if first == 3:
        return AccountCategory.LIABILITY
    if first in (4, 5):
        return AccountCategory.REVENUE
    return AccountCategory.EXPENSE


# Mapping: SKR04 account → Bilanz position
BILANZ_MAPPING: dict[str, BilanzPosition] = {
    "0520": BilanzPosition.FINANZANLAGEN,
    "0535": BilanzPosition.FINANZANLAGEN,
    "0540": BilanzPosition.FINANZANLAGEN,
    "1810": BilanzPosition.UMLAUFVERMOEGEN_BANK,
    "1800": BilanzPosition.UMLAUFVERMOEGEN_BANK,
    "2900": BilanzPosition.EIGENKAPITAL_GEZEICHNET,
    "2909": BilanzPosition.EIGENKAPITAL_GEZEICHNET,  # Contra-equity, shown as deduction
    "2960": BilanzPosition.EIGENKAPITAL_RUECKLAGE,
    "2970": BilanzPosition.EIGENKAPITAL_GEWINNVORTRAG,
    "2978": BilanzPosition.EIGENKAPITAL_GEWINNVORTRAG,
    "2979": BilanzPosition.EIGENKAPITAL_JAHRESERGEBNIS,
    "3510": BilanzPosition.VERBINDLICHKEITEN,
    "3500": BilanzPosition.VERBINDLICHKEITEN,
}

# Mapping: SKR04 account → GuV position
GUV_MAPPING: dict[str, GuvPosition] = {
    "4830": GuvPosition.SONSTIGE_BETRIEBLICHE_ERTRAEGE,
    "4840": GuvPosition.SONSTIGE_BETRIEBLICHE_ERTRAEGE,
    "6300": GuvPosition.SONSTIGE_BETRIEBLICHE_AUFWENDUNGEN,
    "6827": GuvPosition.SONSTIGE_BETRIEBLICHE_AUFWENDUNGEN,
    "6830": GuvPosition.SONSTIGE_BETRIEBLICHE_AUFWENDUNGEN,
    "6855": GuvPosition.SONSTIGE_BETRIEBLICHE_AUFWENDUNGEN,
    "6880": GuvPosition.SONSTIGE_BETRIEBLICHE_AUFWENDUNGEN,
    "7610": GuvPosition.SONSTIGE_BETRIEBLICHE_AUFWENDUNGEN,
}
