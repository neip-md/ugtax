"""Tests for camt.053 parser."""

from decimal import Decimal
from pathlib import Path

from ug_steuer.models import Direction
from ug_steuer.parser import parse_camt053, validate_balance


def test_parse_camt053_transaction_count(sample_camt053: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    assert len(transactions) == 9


def test_parse_camt053_balances(sample_camt053: Path):
    _, opening, closing = parse_camt053(sample_camt053, fiscal_year=2025)
    assert opening == Decimal("0.00")
    assert closing == Decimal("11485.00")


def test_parse_camt053_first_transaction(sample_camt053: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    tx = transactions[0]
    assert tx.amount == Decimal("1000.00")
    assert tx.direction == Direction.CREDIT
    assert "Max Mustermann" in tx.counterparty
    assert "Stammkapitaleinlage" in tx.reference


def test_parse_camt053_debit_transaction(sample_camt053: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    # TX 4: IHK
    ihk_tx = [tx for tx in transactions if "IHK" in tx.counterparty][0]
    assert ihk_tx.direction == Direction.DEBIT
    assert ihk_tx.amount == Decimal("150.00")


def test_validate_balance(sample_camt053: Path):
    transactions, opening, closing = parse_camt053(sample_camt053, fiscal_year=2025)
    assert validate_balance(transactions, opening, closing)


def test_fiscal_year_filter(sample_camt053: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2024)
    assert len(transactions) == 0


def test_sorted_by_date(sample_camt053: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    dates = [tx.date for tx in transactions]
    assert dates == sorted(dates)
