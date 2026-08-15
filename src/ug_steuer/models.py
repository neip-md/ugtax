"""Core data models for UG Steuertool."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from decimal import Decimal
from enum import Enum


class Direction(Enum):
    CREDIT = "credit"  # Money in
    DEBIT = "debit"    # Money out


class AccountCategory(Enum):
    ASSET = "asset"
    LIABILITY = "liability"
    EQUITY = "equity"
    REVENUE = "revenue"
    EXPENSE = "expense"


class BilanzPosition(Enum):
    # Aktiva
    FINANZANLAGEN = "Finanzanlagen"
    UMLAUFVERMOEGEN_BANK = "Guthaben bei Kreditinstituten"
    # Passiva
    EIGENKAPITAL_GEZEICHNET = "Gezeichnetes Kapital"
    EIGENKAPITAL_RUECKLAGE = "Gesetzliche Rücklage"
    EIGENKAPITAL_GEWINNVORTRAG = "Gewinnvortrag/Verlustvortrag"
    EIGENKAPITAL_JAHRESERGEBNIS = "Jahresüberschuss/Jahresfehlbetrag"
    VERBINDLICHKEITEN = "Sonstige Verbindlichkeiten"


class GuvPosition(Enum):
    SONSTIGE_BETRIEBLICHE_AUFWENDUNGEN = "Sonstige betriebliche Aufwendungen"
    SONSTIGE_BETRIEBLICHE_ERTRAEGE = "Sonstige betriebliche Erträge"
    JAHRESUEBERSCHUSS = "Jahresüberschuss/Jahresfehlbetrag"


@dataclass
class Transaction:
    """A single normalized bank transaction."""
    date: date
    amount: Decimal
    direction: Direction
    counterparty: str
    reference: str
    raw_code: str = ""
    bank_account: str = "1810"

    @property
    def signed_amount(self) -> Decimal:
        """Positive for credits (money in), negative for debits (money out)."""
        if self.direction == Direction.CREDIT:
            return self.amount
        return -self.amount


@dataclass
class ClassifiedTransaction:
    """A transaction with its SKR04 account classification."""
    transaction: Transaction
    account: str          # SKR04 account number, e.g. "0520"
    account_name: str     # Human-readable name
    description: str = "" # Optional booking description
    source: str = ""      # How it was classified: "rule", "config", "manual"


@dataclass
class JournalEntry:
    """A double-entry bookkeeping journal entry."""
    date: date
    debit_account: str       # SKR04 account number
    debit_account_name: str
    credit_account: str      # SKR04 account number
    credit_account_name: str
    amount: Decimal
    description: str
    transaction_ref: str = ""  # Original transaction reference for traceability


@dataclass
class AccountBalance:
    """Running balance for a single SKR04 account."""
    number: str
    name: str
    category: AccountCategory
    debit_total: Decimal = Decimal("0.00")
    credit_total: Decimal = Decimal("0.00")

    @property
    def balance(self) -> Decimal:
        """Net balance. Assets/expenses are debit-normal, liabilities/equity/revenue are credit-normal."""
        if self.category in (AccountCategory.ASSET, AccountCategory.EXPENSE):
            return self.debit_total - self.credit_total
        return self.credit_total - self.debit_total


@dataclass
class Bilanz:
    """Balance sheet (Kleinstkapitalgesellschaft §267a HGB)."""
    aktiva: dict[str, Decimal] = field(default_factory=dict)   # BilanzPosition name → amount
    passiva: dict[str, Decimal] = field(default_factory=dict)  # BilanzPosition name → amount

    @property
    def summe_aktiva(self) -> Decimal:
        return sum(self.aktiva.values(), Decimal("0.00"))

    @property
    def summe_passiva(self) -> Decimal:
        return sum(self.passiva.values(), Decimal("0.00"))

    @property
    def is_balanced(self) -> bool:
        return self.summe_aktiva == self.summe_passiva


@dataclass
class GuV:
    """Income statement (Gewinn- und Verlustrechnung)."""
    aufwendungen: dict[str, Decimal] = field(default_factory=dict)  # Position name → amount
    ertraege: dict[str, Decimal] = field(default_factory=dict)

    @property
    def summe_aufwendungen(self) -> Decimal:
        return sum(self.aufwendungen.values(), Decimal("0.00"))

    @property
    def summe_ertraege(self) -> Decimal:
        return sum(self.ertraege.values(), Decimal("0.00"))

    @property
    def jahresueberschuss(self) -> Decimal:
        return self.summe_ertraege - self.summe_aufwendungen


@dataclass
class FinancialStatements:
    """Complete financial statements for a fiscal year."""
    bilanz: Bilanz
    guv: GuV
    account_balances: dict[str, AccountBalance]  # account number → balance
    journal_entries: list[JournalEntry]
    fiscal_year: int
    company_name: str
    stammkapital: Decimal = Decimal("0.00")
    warnings: list[str] = field(default_factory=list)
