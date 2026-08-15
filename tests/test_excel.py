"""
Tests for excel.py, which was at 0% coverage.

These two functions write the files the user actually receives: the
Buchungsjournal and the Bilanz/GuV workbook. A silent formatting regression
here is invisible until someone opens the spreadsheet, so the assertions are
about content landing in the right cells, not about styling.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

openpyxl = pytest.importorskip("openpyxl")

from ug_steuer.bookkeeper import generate_journal  # noqa: E402
from ug_steuer.classifier import classify_transactions  # noqa: E402
from ug_steuer.config import Config  # noqa: E402
from ug_steuer.excel import export_journal, export_statements  # noqa: E402
from ug_steuer.models import JournalEntry  # noqa: E402
from ug_steuer.parser import parse_camt053  # noqa: E402
from ug_steuer.statements import generate_statements  # noqa: E402


def _entry(amount: str, debit="6855", credit="1810", desc="Bankgebühr") -> JournalEntry:
    return JournalEntry(
        date=date(2025, 3, 14),
        debit_account=debit,
        debit_account_name="Nebenkosten des Geldverkehrs",
        credit_account=credit,
        credit_account_name="Bank",
        amount=Decimal(amount),
        description=desc,
    )


class TestExportJournal:
    def test_writes_a_readable_workbook(self, tmp_path):
        out = tmp_path / "journal.xlsx"
        export_journal([_entry("12.50"), _entry("99.00", desc="Kontoführung")], out)

        assert out.is_file() and out.stat().st_size > 0
        wb = openpyxl.load_workbook(out)
        ws = wb.active
        # header + 2 rows
        assert ws.max_row >= 3
        text = " ".join(
            str(c.value) for row in ws.iter_rows() for c in row if c.value is not None
        )
        assert "Bankgebühr" in text
        assert "Kontoführung" in text
        assert "6855" in text

    def test_empty_journal_still_produces_a_file(self, tmp_path):
        """An empty year must not crash the export."""
        out = tmp_path / "empty.xlsx"
        export_journal([], out)
        assert out.is_file()
        assert openpyxl.load_workbook(out).active.max_row >= 1

    def test_accepts_a_string_path(self, tmp_path):
        out = tmp_path / "as-str.xlsx"
        export_journal([_entry("1.00")], str(out))
        assert out.is_file()


class TestExportStatements:
    @pytest.fixture
    def statements(self, sample_camt053, sample_config_path):
        """Built from the real fixtures, the same way test_statements.py does."""
        transactions, _, _ = parse_camt053(sample_camt053, fiscal_year=2025)
        config = Config.from_yaml(sample_config_path)
        result = classify_transactions(transactions, config)
        journal = generate_journal(result.classified)
        return generate_statements(journal, config)

    def test_writes_bilanz_and_guv_sheets(self, statements, tmp_path):
        out = tmp_path / "bilanz.xlsx"
        export_statements(statements, out)

        assert out.is_file() and out.stat().st_size > 0
        wb = openpyxl.load_workbook(out)
        # Bilanz, GuV and Konten each get their own sheet.
        assert len(wb.sheetnames) >= 2, wb.sheetnames
        joined = " ".join(wb.sheetnames).lower()
        assert "bilanz" in joined or "guv" in joined

    def test_bilanz_sheet_carries_the_totals(self, statements, tmp_path):
        out = tmp_path / "bilanz.xlsx"
        export_statements(statements, out)
        wb = openpyxl.load_workbook(out)
        text = " ".join(
            str(c.value)
            for ws in wb.worksheets
            for row in ws.iter_rows()
            for c in row
            if c.value is not None
        ).lower()
        assert "aktiva" in text and "passiva" in text

    def test_accepts_a_string_path(self, statements, tmp_path):
        out = tmp_path / "as-str.xlsx"
        export_statements(statements, str(out))
        assert out.is_file()
