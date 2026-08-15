"""CSV bank statement parser with configurable column mapping.

Supports generic CSV exports from banks that don't provide camt.053.
Column mapping is configured in the YAML config file.
"""

from __future__ import annotations

import csv
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path

from .models import Direction, Transaction


# Default column mappings for common German bank CSV formats
DEFAULT_COLUMN_MAP = {
    "date": "Buchungstag",
    "amount": "Betrag",
    "counterparty": "Auftraggeber/Empfänger",
    "reference": "Verwendungszweck",
    "direction": None,  # If None, infer from amount sign
}

# Known date formats used by German banks
DATE_FORMATS = [
    "%d.%m.%Y",   # 07.01.2025 (most common in Germany)
    "%Y-%m-%d",   # 2025-01-07 (ISO)
    "%d.%m.%y",   # 07.01.25
    "%d/%m/%Y",   # 07/01/2025
    "%m/%d/%Y",   # 01/07/2025 (US format, rare but some exports use it)
]


def _parse_date(value: str) -> date:
    """Try multiple date formats."""
    value = value.strip()
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    raise ValueError(f"Cannot parse date: '{value}'. Expected formats: DD.MM.YYYY or YYYY-MM-DD")


def _parse_amount(value: str) -> tuple[Decimal, Direction]:
    """
    Parse amount string, handling German number format (comma as decimal separator).
    Returns (absolute_amount, direction).
    """
    value = value.strip()

    # Remove currency symbols and whitespace
    for char in ["€", "EUR", "\u00a0"]:
        value = value.replace(char, "")
    value = value.strip()

    # Handle German number format: 1.234,56 → 1234.56
    if "," in value and "." in value:
        # Both present: dots are thousands separators, comma is decimal
        value = value.replace(".", "").replace(",", ".")
    elif "," in value:
        # Only comma: it's the decimal separator
        value = value.replace(",", ".")

    try:
        amount = Decimal(value)
    except InvalidOperation:
        raise ValueError(f"Cannot parse amount: '{value}'")

    if amount >= 0:
        return amount, Direction.CREDIT
    else:
        return abs(amount), Direction.DEBIT


def _detect_delimiter(file_path: Path) -> str:
    """Detect CSV delimiter by reading first few lines."""
    with open(file_path, encoding="utf-8-sig") as f:
        sample = f.read(4096)

    # Try common delimiters
    for delimiter in [";", ",", "\t"]:
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=delimiter)
            return dialect.delimiter
        except csv.Error:
            continue

    # German bank CSVs almost always use semicolon
    if ";" in sample:
        return ";"
    return ","


def _detect_encoding(file_path: Path) -> str:
    """Try common encodings for German bank CSVs."""
    for encoding in ["utf-8-sig", "utf-8", "latin-1", "iso-8859-1", "cp1252"]:
        try:
            with open(file_path, encoding=encoding) as f:
                f.read(4096)
            return encoding
        except (UnicodeDecodeError, UnicodeError):
            continue
    return "utf-8"


def parse_csv(
    file_path: str | Path,
    column_map: dict[str, str | None] | None = None,
    fiscal_year: int | None = None,
    delimiter: str | None = None,
    encoding: str | None = None,
    skip_rows: int = 0,
) -> list[Transaction]:
    """
    Parse a CSV bank export into normalized transactions.

    Args:
        file_path: Path to the CSV file.
        column_map: Mapping of logical fields to CSV column headers.
            Keys: "date", "amount", "counterparty", "reference", "direction"
            Values: CSV column header names. "direction" can be None to infer from amount sign.
        fiscal_year: Filter transactions to this year. None = all.
        delimiter: CSV delimiter. Auto-detected if None.
        encoding: File encoding. Auto-detected if None.
        skip_rows: Number of header rows to skip before the actual CSV header.

    Returns:
        List of Transaction objects, sorted by date.
    """
    file_path = Path(file_path)

    # With no explicit column_map, recognise the bank from the header row.
    # Without this, DEFAULT_COLUMN_MAP's German headers were applied to every
    # file, so an export with English headers (Qonto, Finom, N26, Holvi) missed
    # on every row and produced an empty import.
    profile = None
    if column_map is None:
        from .bank_profiles import detect_profile

        profile = detect_profile(file_path)

    if profile is not None:
        col_map = {**DEFAULT_COLUMN_MAP, **profile.column_map}
        delimiter = delimiter or profile.delimiter
        encoding = encoding or profile.encoding
        skip_rows = skip_rows or profile.skip_rows
    else:
        col_map = {**DEFAULT_COLUMN_MAP, **(column_map or {})}

    if encoding is None:
        encoding = _detect_encoding(file_path)
    if delimiter is None:
        delimiter = _detect_delimiter(file_path)

    transactions: list[Transaction] = []

    with open(file_path, encoding=encoding, newline="") as f:
        # Skip rows if needed (some bank CSVs have metadata before the header)
        for _ in range(skip_rows):
            f.readline()

        reader = csv.DictReader(f, delimiter=delimiter)

        for row_num, row in enumerate(reader, start=skip_rows + 2):
            # Skip empty rows
            if not any(v.strip() for v in row.values() if v):
                continue

            try:
                # Date
                date_col = col_map["date"]
                date_val = row.get(date_col, "").strip()
                if not date_val:
                    continue  # Skip rows without a date
                tx_date = _parse_date(date_val)

                # Amount + direction
                amount_col = col_map["amount"]
                amount_val = row.get(amount_col, "").strip()
                if not amount_val:
                    continue

                amount, inferred_direction = _parse_amount(amount_val)

                # Explicit direction column (some banks have Soll/Haben)
                direction = inferred_direction
                direction_col = col_map.get("direction")
                if direction_col and direction_col in row:
                    dir_val = row[direction_col].strip().upper()
                    if dir_val in ("S", "SOLL", "DEBIT", "D"):
                        direction = Direction.DEBIT
                    elif dir_val in ("H", "HABEN", "CREDIT", "C"):
                        direction = Direction.CREDIT

                # Counterparty
                cp_col = col_map["counterparty"]
                counterparty = row.get(cp_col, "").strip() if cp_col else ""

                # Reference
                ref_col = col_map["reference"]
                reference = row.get(ref_col, "").strip() if ref_col else ""

                tx = Transaction(
                    date=tx_date,
                    amount=amount,
                    direction=direction,
                    counterparty=counterparty,
                    reference=reference,
                )

                # Filter by fiscal year
                if fiscal_year is not None and tx.date.year != fiscal_year:
                    continue

                transactions.append(tx)

            except (ValueError, KeyError) as e:
                # Log and skip problematic rows rather than failing entirely
                import sys
                print(f"Warning: Skipping row {row_num}: {e}", file=sys.stderr)
                continue

    transactions.sort(key=lambda tx: tx.date)
    return transactions
