"""Tests for CSV bank parser."""

from decimal import Decimal
from pathlib import Path

import pytest

from ug_steuer.csv_parser import parse_csv, _parse_amount, _parse_date
from ug_steuer.models import Direction

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_csv() -> Path:
    return FIXTURES_DIR / "sample_bank.csv"


def test_parse_csv_transaction_count(sample_csv: Path):
    transactions = parse_csv(sample_csv, fiscal_year=2025)
    assert len(transactions) == 9


def test_parse_csv_first_transaction(sample_csv: Path):
    transactions = parse_csv(sample_csv, fiscal_year=2025)
    tx = transactions[0]
    assert tx.amount == Decimal("1000.00")
    assert tx.direction == Direction.CREDIT
    assert "Max Mustermann" in tx.counterparty
    assert "Stammkapitaleinlage" in tx.reference


def test_parse_csv_debit_transaction(sample_csv: Path):
    transactions = parse_csv(sample_csv, fiscal_year=2025)
    ihk = [tx for tx in transactions if "IHK" in tx.counterparty][0]
    assert ihk.direction == Direction.DEBIT
    assert ihk.amount == Decimal("150.00")


def test_parse_csv_fiscal_year_filter(sample_csv: Path):
    transactions = parse_csv(sample_csv, fiscal_year=2024)
    assert len(transactions) == 0


def test_parse_csv_sorted_by_date(sample_csv: Path):
    transactions = parse_csv(sample_csv, fiscal_year=2025)
    dates = [tx.date for tx in transactions]
    assert dates == sorted(dates)


def test_parse_german_amount():
    amount, direction = _parse_amount("1.234,56")
    assert amount == Decimal("1234.56")
    assert direction == Direction.CREDIT


def test_parse_negative_amount():
    amount, direction = _parse_amount("-150,00")
    assert amount == Decimal("150.00")
    assert direction == Direction.DEBIT


def test_parse_amount_with_euro_symbol():
    amount, direction = _parse_amount("1.000,00 €")
    assert amount == Decimal("1000.00")


def test_parse_german_date():
    d = _parse_date("07.01.2025")
    assert d.year == 2025
    assert d.month == 1
    assert d.day == 7


def test_parse_iso_date():
    d = _parse_date("2025-01-07")
    assert d.year == 2025
    assert d.month == 1
    assert d.day == 7


def test_csv_matches_xml_output(sample_csv: Path, sample_camt053: Path, sample_config_path: Path):
    """CSV and XML parsers should produce the same transactions for equivalent data."""
    from ug_steuer.parser import parse_camt053

    xml_txs, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    csv_txs = parse_csv(sample_csv, fiscal_year=2025)

    assert len(csv_txs) == len(xml_txs)
    for csv_tx, xml_tx in zip(csv_txs, xml_txs):
        assert csv_tx.date == xml_tx.date
        assert csv_tx.amount == xml_tx.amount
        assert csv_tx.direction == xml_tx.direction
