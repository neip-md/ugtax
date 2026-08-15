"""Tests for filing guide generator."""

from decimal import Decimal
from pathlib import Path

from ug_steuer.bookkeeper import generate_journal
from ug_steuer.classifier import classify_transactions
from ug_steuer.config import Config
from ug_steuer.guide import generate_filing_guide
from ug_steuer.parser import parse_camt053
from ug_steuer.statements import generate_statements


def test_guide_created(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    journal = generate_journal(result.classified)
    statements = generate_statements(journal, config)

    guide_path = tmp_path / "filing_guide.md"
    generate_filing_guide(statements, config, guide_path)

    assert guide_path.exists()
    content = guide_path.read_text()
    assert "Muster Ventures UG" in content
    assert "E-Bilanz" in content
    assert "KSt" in content
    assert "GewSt" in content
    assert "Kleinunternehmer" in content
    assert "Bundesanzeiger" in content
    assert "31.07.2026" in content  # Filing deadline


def test_guide_contains_values(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    journal = generate_journal(result.classified)
    statements = generate_statements(journal, config)

    guide_path = tmp_path / "filing_guide.md"
    generate_filing_guide(statements, config, guide_path)

    content = guide_path.read_text()
    # Should contain the Jahresfehlbetrag value
    assert "-515.00" in content


def test_guide_loss_no_kst(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    """When there's a loss, guide should mention no KSt is due."""
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    journal = generate_journal(result.classified)
    statements = generate_statements(journal, config)

    guide_path = tmp_path / "filing_guide.md"
    generate_filing_guide(statements, config, guide_path)

    content = guide_path.read_text()
    assert "Verlust" in content or "keine KSt" in content
