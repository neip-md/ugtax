"""camt.053 (ISO 20022) bank statement parser."""

from __future__ import annotations

import xml.etree.ElementTree as ET
from datetime import date
from decimal import Decimal
from pathlib import Path

from .models import Direction, Transaction

# ISO 20022 namespace
NS = {"camt": "urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"}
# Some banks use v08 or no namespace — we try multiple
NS_VARIANTS = [
    {"camt": "urn:iso:std:iso:20022:tech:xsd:camt.053.001.02"},
    {"camt": "urn:iso:std:iso:20022:tech:xsd:camt.053.001.08"},
    {},  # No namespace fallback
]


def _find_with_ns(root: ET.Element, path: str, ns: dict[str, str]) -> ET.Element | None:
    """Find element, trying with namespace prefix and without."""
    result = root.find(path, ns)
    if result is not None:
        return result
    # Try without namespace prefix (strip 'camt:' from path)
    bare_path = path.replace("camt:", "")
    return root.find(bare_path)


def _findall_with_ns(root: ET.Element, path: str, ns: dict[str, str]) -> list[ET.Element]:
    """Find all elements, trying with namespace prefix and without."""
    results = root.findall(path, ns)
    if results:
        return results
    bare_path = path.replace("camt:", "")
    return root.findall(bare_path)


def _text(element: ET.Element | None) -> str:
    """Safely get text content of an element."""
    if element is None:
        return ""
    return (element.text or "").strip()


def _detect_namespace(root: ET.Element) -> dict[str, str]:
    """Detect which namespace variant the document uses."""
    for ns in NS_VARIANTS:
        if _findall_with_ns(root, ".//camt:Stmt", ns) or _findall_with_ns(root, ".//Stmt", ns):
            return ns
    # Last resort: try to extract namespace from root tag
    tag = root.tag
    if "{" in tag:
        uri = tag.split("{")[1].split("}")[0]
        return {"camt": uri}
    return {}


def _parse_balance(bal_elem: ET.Element, ns: dict[str, str]) -> tuple[str, Decimal]:
    """Parse a Bal element, returning (type_code, amount)."""
    tp = _text(_find_with_ns(bal_elem, "camt:Tp/camt:CdOrPrtry/camt:Cd", ns))
    amt_elem = _find_with_ns(bal_elem, "camt:Amt", ns)
    amt = Decimal(_text(amt_elem)) if amt_elem is not None else Decimal("0.00")
    cdi = _text(_find_with_ns(bal_elem, "camt:CdtDbtInd", ns))
    if cdi == "DBIT":
        amt = -amt
    return tp, amt


def _parse_entry(ntry: ET.Element, ns: dict[str, str]) -> Transaction:
    """Parse a single Ntry element into a Transaction."""
    # Date
    booking_date_str = _text(_find_with_ns(ntry, "camt:BookgDt/camt:Dt", ns))
    if not booking_date_str:
        booking_date_str = _text(_find_with_ns(ntry, "camt:ValDt/camt:Dt", ns))
    tx_date = date.fromisoformat(booking_date_str) if booking_date_str else date.today()

    # Amount
    amt_elem = _find_with_ns(ntry, "camt:Amt", ns)
    amount = Decimal(_text(amt_elem)) if amt_elem is not None else Decimal("0.00")

    # Direction
    cdi = _text(_find_with_ns(ntry, "camt:CdtDbtInd", ns))
    direction = Direction.CREDIT if cdi == "CRDT" else Direction.DEBIT

    # Transaction details — may be nested under NtryDtls/TxDtls
    tx_dtls = _find_with_ns(ntry, "camt:NtryDtls/camt:TxDtls", ns)

    # Counterparty
    counterparty = ""
    if tx_dtls is not None:
        if direction == Direction.CREDIT:
            # Money coming in — look at debtor (who sent it)
            counterparty = _text(_find_with_ns(tx_dtls, "camt:RltdPties/camt:Dbtr/camt:Nm", ns))
        else:
            # Money going out — look at creditor (who received it)
            counterparty = _text(_find_with_ns(tx_dtls, "camt:RltdPties/camt:Cdtr/camt:Nm", ns))

    # Reference / remittance info
    reference = ""
    if tx_dtls is not None:
        # Unstructured remittance info (most common)
        reference = _text(_find_with_ns(tx_dtls, "camt:RmtInf/camt:Ustrd", ns))
        if not reference:
            # Structured reference
            reference = _text(_find_with_ns(tx_dtls, "camt:RmtInf/camt:Strd/camt:CdtrRefInf/camt:Ref", ns))
    if not reference:
        # Fallback: additional entry info
        reference = _text(_find_with_ns(ntry, "camt:AddtlNtryInf", ns))

    # Raw bank transaction code
    raw_code = _text(_find_with_ns(ntry, "camt:BkTxCd/camt:Prtry/camt:Cd", ns))
    if not raw_code:
        raw_code = _text(_find_with_ns(ntry, "camt:BkTxCd/camt:Domn/camt:Cd", ns))

    return Transaction(
        date=tx_date,
        amount=amount,
        direction=direction,
        counterparty=counterparty,
        reference=reference,
        raw_code=raw_code,
    )


def parse_camt053(
    file_path: str | Path,
    fiscal_year: int | None = None,
) -> tuple[list[Transaction], Decimal, Decimal]:
    """
    Parse a camt.053 XML file.

    Returns:
        (transactions, opening_balance, closing_balance)
    """
    tree = ET.parse(file_path)
    root = tree.getroot()
    ns = _detect_namespace(root)

    # Find statement(s)
    stmts = _findall_with_ns(root, ".//camt:Stmt", ns)
    if not stmts:
        raise ValueError(f"No Stmt elements found in {file_path}. Is this a valid camt.053 file?")

    all_transactions: list[Transaction] = []
    opening_balance = Decimal("0.00")
    closing_balance = Decimal("0.00")

    for stmt in stmts:
        # Parse balances
        for bal in _findall_with_ns(stmt, "camt:Bal", ns):
            tp, amt = _parse_balance(bal, ns)
            if tp == "OPBD":
                opening_balance = amt
            elif tp == "CLBD":
                closing_balance = amt

        # Parse entries
        for ntry in _findall_with_ns(stmt, "camt:Ntry", ns):
            tx = _parse_entry(ntry, ns)
            all_transactions.append(tx)

    # Filter by fiscal year if specified
    if fiscal_year is not None:
        all_transactions = [
            tx for tx in all_transactions
            if tx.date.year == fiscal_year
        ]

    # Sort by date
    all_transactions.sort(key=lambda tx: tx.date)

    return all_transactions, opening_balance, closing_balance


def validate_balance(
    transactions: list[Transaction],
    opening_balance: Decimal,
    closing_balance: Decimal,
) -> bool:
    """
    Validate that opening_balance + sum(transactions) == closing_balance.
    Returns True if valid.
    """
    computed = opening_balance + sum(tx.signed_amount for tx in transactions)
    return computed == closing_balance
