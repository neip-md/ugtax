"""Transaction classifier — rule-based + YAML config."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from pathlib import Path

import yaml

from .config import Config
from .models import ClassifiedTransaction, Direction, Transaction
from .skr04 import ACCOUNTS, get_account_name


@dataclass
class ClassificationResult:
    """Result of classifying a list of transactions."""
    classified: list[ClassifiedTransaction]
    unclassified: list[Transaction]


# Pattern rules: (regex_pattern, field_to_match, account_for_credit, account_for_debit, description)
# field_to_match: "reference", "counterparty", or "both"
@dataclass
class PatternRule:
    pattern: re.Pattern[str]
    match_field: str  # "reference", "counterparty", "both"
    account_credit: str  # Account when money comes IN
    account_debit: str   # Account when money goes OUT
    description: str = ""


# Built-in rules for common holding UG transactions
BUILTIN_RULES: list[PatternRule] = [
    # Stammkapitaleinlage
    PatternRule(
        pattern=re.compile(r"stammkapital", re.IGNORECASE),
        match_field="both",
        account_credit="2900",  # Gezeichnetes Kapital (credit side when money comes in)
        account_debit="0520",   # Beteiligung (debit side when paying out for a stake)
        description="Stammkapitaleinlage",
    ),
    # Gesellschafterdarlehen
    PatternRule(
        pattern=re.compile(r"gesellschafterdarlehen|darlehen.*gesellschafter", re.IGNORECASE),
        match_field="both",
        account_credit="3510",  # Verbindlichkeiten ggü. Gesellschaftern
        account_debit="3510",
        description="Gesellschafterdarlehen",
    ),
    # IHK
    PatternRule(
        pattern=re.compile(r"\bIHK\b|Industrie.*Handelskammer", re.IGNORECASE),
        match_field="both",
        account_credit="6830",
        account_debit="6830",
        description="IHK-Beitrag",
    ),
    # Bank fees (common patterns)
    PatternRule(
        pattern=re.compile(
            r"Kontoführung|Bankgebühr|Kartengebühr|Monatliche Gebühr|"
            r"Account fee|Monthly fee|Card fee|subscription fee|plan fee",
            re.IGNORECASE,
        ),
        match_field="both",
        account_credit="6855",
        account_debit="6855",
        description="Bankgebühren",
    ),
    # Legal / consulting fees
    PatternRule(
        pattern=re.compile(
            r"Rechtsanw|Notar|Kanzlei|Gleiss\s*Lutz|Hengeler|Freshfields|"
            r"CMS\s+Hasche|Linklaters|Steuerberater|Wirtschaftsprüfer|"
            r"legal|lawyer|attorney|notary",
            re.IGNORECASE,
        ),
        match_field="both",
        account_credit="6827",
        account_debit="6827",
        description="Rechts- und Beratungskosten",
    ),
    # FX fees / currency conversion
    PatternRule(
        pattern=re.compile(r"Wechselkurs|FX|Exchange|Währung|currency", re.IGNORECASE),
        match_field="both",
        account_credit="6880",
        account_debit="6880",
        description="Währungsumrechnung",
    ),
]


def _match_rule(tx: Transaction, rule: PatternRule) -> bool:
    """Check if a transaction matches a pattern rule."""
    if rule.match_field == "reference":
        return bool(rule.pattern.search(tx.reference))
    if rule.match_field == "counterparty":
        return bool(rule.pattern.search(tx.counterparty))
    # "both"
    return bool(rule.pattern.search(tx.reference) or rule.pattern.search(tx.counterparty))


def classify_transactions(
    transactions: list[Transaction],
    config: Config,
) -> ClassificationResult:
    """
    Classify transactions using two layers:
    1. User config counterparty mappings (highest priority)
    2. Built-in pattern rules

    Returns classified and unclassified lists.
    """
    classified: list[ClassifiedTransaction] = []
    unclassified: list[Transaction] = []

    for tx in transactions:
        result = _classify_single(tx, config)
        if result is not None:
            classified.append(result)
        else:
            unclassified.append(tx)

    return ClassificationResult(classified=classified, unclassified=unclassified)


def _classify_single(tx: Transaction, config: Config) -> ClassifiedTransaction | None:
    """Try to classify a single transaction. Returns None if unclassified."""
    # Layer 1: User config — exact counterparty match
    for name, mapping in config.counterparties.items():
        if name.lower() in tx.counterparty.lower():
            return ClassifiedTransaction(
                transaction=tx,
                account=mapping.account,
                account_name=get_account_name(mapping.account),
                description=mapping.description,
                source="config",
            )

    # Layer 2: Built-in pattern rules
    for rule in BUILTIN_RULES:
        if _match_rule(tx, rule):
            account = rule.account_credit if tx.direction == Direction.CREDIT else rule.account_debit
            return ClassifiedTransaction(
                transaction=tx,
                account=account,
                account_name=get_account_name(account),
                description=rule.description,
                source="rule",
            )

    return None


def write_review_file(
    unclassified: list[Transaction],
    output_path: str | Path,
) -> None:
    """Write unclassified transactions to a YAML file for user review."""
    entries = []
    for tx in unclassified:
        entries.append({
            "date": tx.date.isoformat(),
            "amount": float(tx.amount),
            "direction": tx.direction.value,
            "counterparty": tx.counterparty,
            "reference": tx.reference,
            "account": "",       # User fills this in
            "description": "",   # User fills this in
        })

    output = {
        "_instructions": (
            "Fill in the 'account' field for each transaction with the SKR04 account number. "
            "Common accounts: 0520 (Beteiligungen), 0535 (Wertpapiere), 6300 (Sonstige Aufwendungen), "
            "6827 (Rechtsberatung), 6830 (Abgaben), 6855 (Bankgebühren). "
            "Then add the counterparties to your config YAML so they're auto-classified next time."
        ),
        "unclassified": entries,
    }

    with open(output_path, "w") as f:
        yaml.dump(output, f, default_flow_style=False, allow_unicode=True, sort_keys=False)


@dataclass
class ReviewLoadResult:
    """Outcome of loading a hand-edited review file."""

    matched: list[ClassifiedTransaction]
    #: Entries that carried an account but matched no transaction. These are the
    #: dangerous ones: previously they were skipped in silence, so a transaction
    #: the user had classified never reached the journal and the Bilanz came out
    #: short with no warning anywhere.
    unmatched: list[dict]


def _amounts_equal(a, b) -> bool:
    """Compare monetary values without float-equality surprises."""
    if b is None:
        return False
    try:
        return abs(Decimal(str(a)) - Decimal(str(b))) < Decimal("0.005")
    except (InvalidOperation, ValueError, TypeError):
        return False


def load_review_file(
    review_path: str | Path,
    transactions: list[Transaction],
) -> ReviewLoadResult:
    """
    Load a filled-in review file and classify the previously unclassified
    transactions.

    Matching is deliberately forgiving about whitespace: the file is edited by
    hand, and a trailing space in a counterparty name used to make the entry
    match nothing at all.
    """
    with open(review_path) as f:
        raw = yaml.safe_load(f) or {}

    review_entries = raw.get("unclassified", [])
    matched: list[ClassifiedTransaction] = []
    unmatched: list[dict] = []

    for entry in review_entries:
        account = str(entry.get("account", "")).strip()
        if not account:
            # Left blank on purpose: the user has not classified this one yet.
            continue

        entry_counterparty = str(entry.get("counterparty", "") or "").strip()
        hit = None
        for tx in transactions:
            if (
                tx.date.isoformat() == entry.get("date")
                and _amounts_equal(tx.amount, entry.get("amount"))
                and (tx.counterparty or "").strip() == entry_counterparty
            ):
                hit = tx
                break

        if hit is None:
            unmatched.append(entry)
            continue

        matched.append(ClassifiedTransaction(
            transaction=hit,
            account=account,
            account_name=get_account_name(account),
            description=entry.get("description", ""),
            source="manual",
        ))

    return ReviewLoadResult(matched=matched, unmatched=unmatched)
