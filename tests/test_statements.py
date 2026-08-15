"""Tests for financial statements generator."""

from decimal import Decimal
from pathlib import Path

from ug_steuer.bookkeeper import generate_journal
from ug_steuer.classifier import classify_transactions
from ug_steuer.config import Config
from ug_steuer.models import BilanzPosition
from ug_steuer.parser import parse_camt053
from ug_steuer.statements import generate_statements


def _make_statements(sample_camt053: Path, sample_config_path: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    journal = generate_journal(result.classified)
    return generate_statements(journal, config)


def test_bilanz_balanced(sample_camt053: Path, sample_config_path: Path):
    statements = _make_statements(sample_camt053, sample_config_path)
    assert statements.bilanz.is_balanced, (
        f"Aktiva={statements.bilanz.summe_aktiva}, Passiva={statements.bilanz.summe_passiva}"
    )


def test_bank_balance(sample_camt053: Path, sample_config_path: Path):
    """Bank account should reflect all ins and outs."""
    statements = _make_statements(sample_camt053, sample_config_path)
    bank = statements.account_balances.get("1810")
    assert bank is not None
    # Opening 0 + 1000 + 15000 - 3000 - 150 - 15 - 250 - 15 - 1000 - 85 = 11485
    assert bank.balance == Decimal("11485.00")


def test_stammkapital(sample_camt053: Path, sample_config_path: Path):
    statements = _make_statements(sample_camt053, sample_config_path)
    ek = statements.account_balances.get("2900")
    assert ek is not None
    assert ek.balance == Decimal("1000.00")


def test_gesellschafterdarlehen(sample_camt053: Path, sample_config_path: Path):
    statements = _make_statements(sample_camt053, sample_config_path)
    darlehen = statements.account_balances.get("3510")
    assert darlehen is not None
    assert darlehen.balance == Decimal("15000.00")


def test_jahresueberschuss_is_loss(sample_camt053: Path, sample_config_path: Path):
    """A holding UG with only expenses should have a loss."""
    statements = _make_statements(sample_camt053, sample_config_path)
    je = statements.guv.jahresueberschuss
    # Expenses: 150 (IHK) + 15 + 15 (bank fees) + 250 (legal) + 85 (FX) = 515
    # Revenue: 0
    assert je == Decimal("-515.00")


def test_thesaurierung_warning_not_triggered_on_loss(sample_camt053: Path, sample_config_path: Path):
    """Thesaurierungspflicht only triggers on profit."""
    statements = _make_statements(sample_camt053, sample_config_path)
    thes_warnings = [w for w in statements.warnings if "Thesaurierung" in w]
    assert len(thes_warnings) == 0


def test_finanzanlagen(sample_camt053: Path, sample_config_path: Path):
    """Beteiligungen + Wertpapiere should show up as Finanzanlagen."""
    statements = _make_statements(sample_camt053, sample_config_path)
    bilanz = statements.bilanz
    finanzanlagen = bilanz.aktiva.get(BilanzPosition.FINANZANLAGEN.value, Decimal("0.00"))
    # Alpha GmbH 3000 + Beta Ltd 1000 = 4000
    assert finanzanlagen == Decimal("4000.00")
