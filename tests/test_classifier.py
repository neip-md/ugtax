"""Tests for transaction classifier."""

from pathlib import Path

from ug_steuer.classifier import classify_transactions
from ug_steuer.config import Config
from ug_steuer.parser import parse_camt053


def test_all_classified_with_config(sample_camt053: Path, sample_config_path: Path):
    """With proper config, all transactions should be classified."""
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    assert len(result.unclassified) == 0
    assert len(result.classified) == 9


def test_stammkapital_rule(sample_camt053: Path):
    """Stammkapitaleinlage should be classified by rule."""
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.empty()
    result = classify_transactions(transactions, config)
    stammkapital = [ct for ct in result.classified if ct.account == "2900"]
    assert len(stammkapital) == 1
    assert stammkapital[0].source == "rule"


def test_ihk_rule(sample_camt053: Path):
    """IHK should be classified by rule."""
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.empty()
    result = classify_transactions(transactions, config)
    ihk = [ct for ct in result.classified if ct.account == "6830"]
    assert len(ihk) == 1


def test_bank_fee_rule(sample_camt053: Path):
    """Bank fees should be classified by rule."""
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.empty()
    result = classify_transactions(transactions, config)
    fees = [ct for ct in result.classified if ct.account == "6855"]
    assert len(fees) == 2  # Two monthly fees


def test_legal_fees_rule(sample_camt053: Path):
    """Legal fees should be classified by rule."""
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.empty()
    result = classify_transactions(transactions, config)
    legal = [ct for ct in result.classified if ct.account == "6827"]
    assert len(legal) == 1


def test_config_overrides_rules(sample_camt053: Path, sample_config_path: Path):
    """Config counterparty mapping should take priority over rules."""
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    # Alpha GmbH is in config as 0520
    alpha = [ct for ct in result.classified if "Alpha" in ct.transaction.counterparty]
    assert len(alpha) == 1
    assert alpha[0].account == "0520"
    assert alpha[0].source == "config"


def test_unclassified_without_config(sample_camt053: Path):
    """Without config, some transactions should be unclassified."""
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.empty()
    result = classify_transactions(transactions, config)
    # Alpha GmbH and Beta Ltd won't match any rule (reference says "Investment" / "Stammkapitaleinlage Alpha GmbH")
    # Actually "Stammkapitaleinlage Alpha GmbH" WILL match the Stammkapital rule
    # Beta Ltd with "Investment Beta Ltd Series A" won't match any rule
    assert len(result.unclassified) >= 1
