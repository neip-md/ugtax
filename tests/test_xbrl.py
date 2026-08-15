"""Tests for XBRL E-Bilanz generator."""

import xml.etree.ElementTree as ET
from decimal import Decimal
from pathlib import Path

from ug_steuer.bookkeeper import generate_journal
from ug_steuer.classifier import classify_transactions
from ug_steuer.config import Config
from ug_steuer.parser import parse_camt053
from ug_steuer.statements import generate_statements
from ug_steuer.xbrl import generate_xbrl, validate_xbrl


def _make_xbrl(sample_camt053: Path, sample_config_path: Path, tmp_path: Path) -> Path:
    transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
    config = Config.from_yaml(sample_config_path)
    result = classify_transactions(transactions, config)
    journal = generate_journal(result.classified)
    statements = generate_statements(journal, config)

    xbrl_path = tmp_path / "ebilanz.xbrl"
    generate_xbrl(statements, config, xbrl_path)
    return xbrl_path


def test_xbrl_created(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    xbrl_path = _make_xbrl(sample_camt053, sample_config_path, tmp_path)
    assert xbrl_path.exists()
    assert xbrl_path.stat().st_size > 0


def test_xbrl_valid_xml(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    xbrl_path = _make_xbrl(sample_camt053, sample_config_path, tmp_path)
    # Should parse without error
    tree = ET.parse(xbrl_path)
    root = tree.getroot()
    assert "xbrl" in root.tag


def test_xbrl_validation_passes(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    xbrl_path = _make_xbrl(sample_camt053, sample_config_path, tmp_path)
    issues = validate_xbrl(xbrl_path)
    assert len(issues) == 0, f"Validation issues: {issues}"


def test_xbrl_has_contexts(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    xbrl_path = _make_xbrl(sample_camt053, sample_config_path, tmp_path)
    tree = ET.parse(xbrl_path)
    root = tree.getroot()
    contexts = [el for el in root if "context" in el.tag]
    assert len(contexts) >= 2  # At least instant + duration


def test_xbrl_has_monetary_facts(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    xbrl_path = _make_xbrl(sample_camt053, sample_config_path, tmp_path)
    tree = ET.parse(xbrl_path)
    root = tree.getroot()

    # Find elements with unitRef="EUR" — these are monetary facts
    monetary_facts = [el for el in root if el.get("unitRef") == "EUR"]
    assert len(monetary_facts) >= 5  # At least: bank, finanzanlagen, stammkapital, verbindlichkeiten, aufwendungen


def test_xbrl_contains_company_name(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    xbrl_path = _make_xbrl(sample_camt053, sample_config_path, tmp_path)
    content = xbrl_path.read_text()
    assert "Muster Ventures" in content


def test_xbrl_contains_tax_number(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    xbrl_path = _make_xbrl(sample_camt053, sample_config_path, tmp_path)
    content = xbrl_path.read_text()
    assert "27/123/45678" in content


def test_xbrl_contains_fiscal_year(sample_camt053: Path, sample_config_path: Path, tmp_path: Path):
    xbrl_path = _make_xbrl(sample_camt053, sample_config_path, tmp_path)
    content = xbrl_path.read_text()
    assert "2025-01-01" in content
    assert "2025-12-31" in content
