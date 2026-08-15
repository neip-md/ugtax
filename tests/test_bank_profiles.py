"""
Tests for bank import profiles.

The suite is parametrized over every profile in rules/banks/, so contributing a
bank means adding one YAML file plus one anonymised fixture, and a wrong column
mapping fails CI instead of silently misreading someone's bank statement.

The regression these exist for: csv_parser had one hardcoded German column map,
so a Qonto export (English headers) missed on every row and produced an empty
import for a first-time user.
"""

from __future__ import annotations

from decimal import Decimal
from pathlib import Path

import pytest

from ug_steuer.bank_profiles import (
    BankProfile,
    detect_profile,
    load_profiles,
    read_headers,
)
from ug_steuer.csv_parser import parse_csv

REPO_ROOT = Path(__file__).resolve().parents[1]
PROFILES = load_profiles()


def _fixture_path(profile: BankProfile) -> Path:
    assert profile.fixture, f"{profile.id} declares no fixture"
    return REPO_ROOT / profile.fixture


def _ids(profiles):
    return [p.id for p in profiles]


class TestProfileFiles:
    def test_profiles_are_discovered(self):
        assert PROFILES, "no bank profiles loaded from rules/banks/"

    @pytest.mark.parametrize("profile", PROFILES, ids=_ids(PROFILES))
    def test_profile_is_well_formed(self, profile: BankProfile):
        assert profile.id and profile.name
        assert profile.headers_include, "detection needs at least one header"
        for key in ("date", "amount", "counterparty", "reference"):
            assert key in profile.column_map, f"{profile.id} is missing {key}"

    @pytest.mark.parametrize("profile", PROFILES, ids=_ids(PROFILES))
    def test_profile_ships_a_fixture(self, profile: BankProfile):
        assert _fixture_path(profile).is_file()

    def test_profile_ids_are_unique(self):
        ids = [p.id for p in PROFILES]
        assert len(ids) == len(set(ids)), ids


class TestDetection:
    @pytest.mark.parametrize("profile", PROFILES, ids=_ids(PROFILES))
    def test_its_own_fixture_detects_as_itself(self, profile: BankProfile):
        detected = detect_profile(_fixture_path(profile))
        assert detected is not None, f"{profile.id} fixture matched no profile"
        assert detected.id == profile.id

    @pytest.mark.parametrize("profile", PROFILES, ids=_ids(PROFILES))
    def test_declared_headers_are_actually_in_the_fixture(self, profile: BankProfile):
        """Catches a profile that only matches because another one is looser."""
        headers = {h.lower() for h in read_headers(_fixture_path(profile))}
        for required in profile.headers_include:
            assert required.lower() in headers, (
                f"{profile.id} requires header {required!r}, absent from its fixture"
            )

    def test_unknown_format_returns_none(self, tmp_path):
        p = tmp_path / "mystery.csv"
        p.write_text("alpha,beta,gamma\n1,2,3\n", encoding="utf-8")
        assert detect_profile(p) is None

    def test_empty_file_returns_none(self, tmp_path):
        p = tmp_path / "empty.csv"
        p.write_text("", encoding="utf-8")
        assert detect_profile(p) is None

    def test_more_specific_profile_wins(self):
        """A profile requiring more headers beats a looser one on the same file."""
        loose = BankProfile(id="loose", name="Loose", headers_include=["Date"], column_map={})
        tight = BankProfile(
            id="tight", name="Tight",
            headers_include=["Date", "Counterparty", "Amount", "Message"],
            column_map={},
        )
        holvi = next((p for p in PROFILES if p.id == "holvi"), None)
        if holvi is None:
            pytest.skip("holvi profile not present")
        got = detect_profile(_fixture_path(holvi), profiles=[loose, tight])
        assert got is not None and got.id == "tight"


class TestParsing:
    @pytest.mark.parametrize("profile", PROFILES, ids=_ids(PROFILES))
    def test_fixture_parses_to_the_expected_transactions(self, profile: BankProfile):
        """Every fixture encodes the same two movements, so the assertions can be
        shared: +1000.00 Stammkapital in January, -12.50 bank fee in March."""
        txs = parse_csv(_fixture_path(profile), fiscal_year=2025)
        assert len(txs) == 2, f"{profile.id}: got {len(txs)} transactions"

        incoming = [t for t in txs if t.direction.value == "credit"]
        outgoing = [t for t in txs if t.direction.value == "debit"]
        assert len(incoming) == 1 and len(outgoing) == 1, (
            f"{profile.id}: signs misread ({len(incoming)} in, {len(outgoing)} out)"
        )
        assert incoming[0].amount == Decimal("1000.00"), profile.id
        assert outgoing[0].amount == Decimal("12.50"), profile.id

    @pytest.mark.parametrize("profile", PROFILES, ids=_ids(PROFILES))
    def test_dates_land_in_the_right_year_and_order(self, profile: BankProfile):
        txs = parse_csv(_fixture_path(profile), fiscal_year=2025)
        assert [t.date.year for t in txs] == [2025, 2025], profile.id
        assert txs == sorted(txs, key=lambda t: t.date), f"{profile.id}: not sorted"
        assert txs[0].date.month == 1 and txs[1].date.month == 3, profile.id

    @pytest.mark.parametrize("profile", PROFILES, ids=_ids(PROFILES))
    def test_counterparty_and_reference_are_populated(self, profile: BankProfile):
        txs = parse_csv(_fixture_path(profile), fiscal_year=2025)
        assert any(t.counterparty.strip() for t in txs), f"{profile.id}: no counterparty"
        assert any(t.reference.strip() for t in txs), f"{profile.id}: no reference"

    def test_an_explicit_column_map_still_wins(self):
        """Auto-detection must not override a caller who knows better."""
        qonto = next((p for p in PROFILES if p.id == "qonto"), None)
        if qonto is None:
            pytest.skip("qonto profile not present")
        txs = parse_csv(
            _fixture_path(qonto),
            column_map={
                "date": "Settlement date",
                "amount": "Amount",
                "counterparty": "Reference",   # deliberately swapped
                "reference": "Counterparty name",
                "direction": None,
            },
            fiscal_year=2025,
        )
        assert txs and txs[0].counterparty == "Stammkapitaleinlage"


class TestRegression:
    def test_qonto_no_longer_yields_an_empty_import(self):
        """The exact failure this feature exists for: before profiles, the German
        DEFAULT_COLUMN_MAP was applied to Qonto's English headers and every row
        was skipped for want of a date column."""
        qonto = next((p for p in PROFILES if p.id == "qonto"), None)
        if qonto is None:
            pytest.skip("qonto profile not present")
        assert len(parse_csv(_fixture_path(qonto), fiscal_year=2025)) == 2
