"""Financial statements generator — Bilanz + GuV."""

from __future__ import annotations

from decimal import Decimal

from .config import Config
from .models import (
    AccountBalance,
    AccountCategory,
    Bilanz,
    BilanzPosition,
    FinancialStatements,
    GuV,
    GuvPosition,
    JournalEntry,
)
from .skr04 import BILANZ_MAPPING, GUV_MAPPING, get_account_category, get_account_name


def compute_account_balances(
    entries: list[JournalEntry],
    config: Config,
) -> dict[str, AccountBalance]:
    """Compute running balances for all accounts from journal entries."""
    balances: dict[str, AccountBalance] = {}

    def _ensure(number: str) -> AccountBalance:
        if number not in balances:
            balances[number] = AccountBalance(
                number=number,
                name=get_account_name(number),
                category=get_account_category(number),
            )
        return balances[number]

    # Opening balances from config
    if config.company.gewinnvortrag != Decimal("0.00"):
        gv = config.company.gewinnvortrag
        if gv >= 0:
            bal = _ensure("2970")
            bal.credit_total += gv
        else:
            bal = _ensure("2978")
            bal.debit_total += abs(gv)

    # Process journal entries
    for entry in entries:
        debit_bal = _ensure(entry.debit_account)
        credit_bal = _ensure(entry.credit_account)
        debit_bal.debit_total += entry.amount
        credit_bal.credit_total += entry.amount

    return balances


def compute_bilanz(
    balances: dict[str, AccountBalance],
    config: Config,
) -> Bilanz:
    """Compute Bilanz (balance sheet) from account balances."""
    bilanz = Bilanz()

    for number, bal in balances.items():
        if bal.balance == Decimal("0.00"):
            continue

        position = BILANZ_MAPPING.get(number)
        if position is None:
            continue

        pos_name = position.value
        if position in (
            BilanzPosition.FINANZANLAGEN,
            BilanzPosition.UMLAUFVERMOEGEN_BANK,
        ):
            # Aktiva
            bilanz.aktiva[pos_name] = bilanz.aktiva.get(pos_name, Decimal("0.00")) + bal.balance
        else:
            # Passiva
            bilanz.passiva[pos_name] = bilanz.passiva.get(pos_name, Decimal("0.00")) + bal.balance

    return bilanz


def compute_guv(balances: dict[str, AccountBalance]) -> GuV:
    """Compute GuV (income statement) from account balances."""
    guv = GuV()

    for number, bal in balances.items():
        if bal.balance == Decimal("0.00"):
            continue

        position = GUV_MAPPING.get(number)
        if position is None:
            continue

        pos_name = position.value
        if bal.category == AccountCategory.EXPENSE:
            guv.aufwendungen[pos_name] = guv.aufwendungen.get(pos_name, Decimal("0.00")) + bal.balance
        elif bal.category == AccountCategory.REVENUE:
            guv.ertraege[pos_name] = guv.ertraege.get(pos_name, Decimal("0.00")) + bal.balance

    return guv


def generate_statements(
    entries: list[JournalEntry],
    config: Config,
) -> FinancialStatements:
    """Generate complete financial statements from journal entries."""
    balances = compute_account_balances(entries, config)
    guv = compute_guv(balances)
    bilanz = compute_bilanz(balances, config)

    # Add Jahresüberschuss to Bilanz passiva
    je = guv.jahresueberschuss
    if je != Decimal("0.00"):
        pos_name = BilanzPosition.EIGENKAPITAL_JAHRESERGEBNIS.value
        bilanz.passiva[pos_name] = bilanz.passiva.get(pos_name, Decimal("0.00")) + je

    warnings: list[str] = []

    # §5a Abs. 3 GmbHG: Thesaurierungspflicht
    stammkapital = config.company.stammkapital
    if stammkapital < Decimal("25000.00") and je > Decimal("0.00"):
        ruecklage = je * Decimal("0.25")
        warnings.append(
            f"§5a Abs. 3 GmbHG: Thesaurierungspflicht — 25% des Jahresüberschusses "
            f"({ruecklage:.2f} €) müssen in die gesetzliche Rücklage eingestellt werden, "
            f"solange das Stammkapital unter 25.000 € liegt."
        )

    # Check Bilanz balance
    if not bilanz.is_balanced:
        diff = bilanz.summe_aktiva - bilanz.summe_passiva
        warnings.append(
            f"FEHLER: Bilanz ist nicht ausgeglichen! "
            f"Aktiva ({bilanz.summe_aktiva:.2f} €) ≠ Passiva ({bilanz.summe_passiva:.2f} €), "
            f"Differenz: {diff:.2f} €"
        )

    # Check drohende Überschuldung
    eigenkapital = sum(
        v for k, v in bilanz.passiva.items()
        if k in (
            BilanzPosition.EIGENKAPITAL_GEZEICHNET.value,
            BilanzPosition.EIGENKAPITAL_RUECKLAGE.value,
            BilanzPosition.EIGENKAPITAL_GEWINNVORTRAG.value,
            BilanzPosition.EIGENKAPITAL_JAHRESERGEBNIS.value,
        )
    )
    if eigenkapital < stammkapital:
        warnings.append(
            f"Warnung: Eigenkapital ({eigenkapital:.2f} €) ist geringer als "
            f"Stammkapital ({stammkapital:.2f} €). Prüfe auf Überschuldung (§ 19 InsO)."
        )

    return FinancialStatements(
        bilanz=bilanz,
        guv=guv,
        account_balances=balances,
        journal_entries=entries,
        fiscal_year=config.company.geschaeftsjahr,
        company_name=config.company.name,
        stammkapital=stammkapital,
        warnings=warnings,
    )
