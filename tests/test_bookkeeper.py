"""Tests for bookkeeping engine."""

from decimal import Decimal
from pathlib import Path

from ug_steuer.bookkeeper import generate_journal, validate_journal
from ug_steuer.classifier import classify_transactions
from ug_steuer.config import Config
from ug_steuer.models import Direction
from ug_steuer.parser import parse_camt053


def test_journal_entry_count(sample_camt053: Path, sample_config_path: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    journal = generate_journal(result.classified)
    assert len(journal) == 9  # One entry per transaction


def test_journal_balance(sample_camt053: Path, sample_config_path: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    journal = generate_journal(result.classified)
    assert validate_journal(journal)


def test_credit_entry_debits_bank(sample_camt053: Path, sample_config_path: Path):
    """Credit (money in) should debit Bank (1810)."""
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    journal = generate_journal(result.classified)

    # First entry is Stammkapitaleinlage (credit)
    entry = journal[0]
    assert entry.debit_account == "1810"  # Bank
    assert entry.credit_account == "2900"  # Gezeichnetes Kapital


def test_debit_entry_credits_bank(sample_camt053: Path, sample_config_path: Path):
    """Debit (money out) should credit Bank (1810)."""
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    journal = generate_journal(result.classified)

    # Find the IHK entry (debit)
    ihk = [e for e in journal if e.debit_account == "6830"][0]
    assert ihk.credit_account == "1810"  # Bank
    assert ihk.amount == Decimal("150.00")


def test_journal_sorted_by_date(sample_camt053: Path, sample_config_path: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    journal = generate_journal(result.classified)
    dates = [e.date for e in journal]
    assert dates == sorted(dates)
