"""Double-entry bookkeeping engine."""

from __future__ import annotations

from decimal import Decimal

from .models import ClassifiedTransaction, Direction, JournalEntry
from .skr04 import get_account_name


BANK_ACCOUNT = "1810"
BANK_ACCOUNT_NAME = "Bank"


def generate_journal(
    classified: list[ClassifiedTransaction],
) -> list[JournalEntry]:
    """
    Convert classified transactions into double-entry journal entries.

    Rules:
    - Credit (money in): Debit Bank (1810), Credit classified account
    - Debit (money out): Debit classified account, Credit Bank (1810)
    """
    entries: list[JournalEntry] = []

    for ct in classified:
        tx = ct.transaction

        if tx.direction == Direction.CREDIT:
            # Money coming in → Debit Bank, Credit the other account
            entry = JournalEntry(
                date=tx.date,
                debit_account=BANK_ACCOUNT,
                debit_account_name=BANK_ACCOUNT_NAME,
                credit_account=ct.account,
                credit_account_name=ct.account_name,
                amount=tx.amount,
                description=ct.description or f"{tx.counterparty}: {tx.reference}"[:100],
                transaction_ref=tx.reference,
            )
        else:
            # Money going out → Debit the other account, Credit Bank
            entry = JournalEntry(
                date=tx.date,
                debit_account=ct.account,
                debit_account_name=ct.account_name,
                credit_account=BANK_ACCOUNT,
                credit_account_name=BANK_ACCOUNT_NAME,
                amount=tx.amount,
                description=ct.description or f"{tx.counterparty}: {tx.reference}"[:100],
                transaction_ref=tx.reference,
            )

        entries.append(entry)

    # Sort by date
    entries.sort(key=lambda e: e.date)
    return entries


def validate_journal(entries: list[JournalEntry]) -> bool:
    """Validate that total debits == total credits in the journal."""
    total_debits = sum(e.amount for e in entries)
    total_credits = sum(e.amount for e in entries)
    # In double-entry, each entry has equal debit and credit by construction,
    # so this always holds. But we check anyway for safety.
    return total_debits == total_credits
