"""
Tests for submit.py, which was at 0% coverage.

This module decides whether a legally binding E-Bilanz is reported to the user
as submitted, so the gates matter more than the plumbing. The regression it
pins: validate_ebilanz required `success and not errors` while submit_ebilanz
checked only `success`, so a response carrying error-severity issues was a
failure on one path and a clean submission on the other.

No ERiC library is needed: the wrapper is substituted.
"""

from __future__ import annotations

from pathlib import Path

import pytest

from ug_steuer import submit as submit_mod
from ug_steuer.eric import EricReturnCode, TransferResult, ValidationIssue


def _issue(severity: str, text: str = "x") -> ValidationIssue:
    return ValidationIssue(severity=severity, message_de=text)


class FakeEric:
    """Stands in for EricWrapper as a context manager."""

    def __init__(self, result: TransferResult):
        self._result = result

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def validate(self, *a, **k) -> TransferResult:
        return self._result

    def send(self, *a, **k) -> TransferResult:
        return self._result


@pytest.fixture
def patch_eric(monkeypatch):
    def _install(result: TransferResult):
        monkeypatch.setattr(submit_mod, "EricWrapper", lambda **kw: FakeEric(result))
    return _install


@pytest.fixture
def xbrl(tmp_path: Path) -> Path:
    p = tmp_path / "ebilanz.xbrl"
    p.write_bytes(b"<?xml version='1.0'?><xbrli:xbrl xmlns:xbrli='x'/>")
    return p


@pytest.fixture
def cert(tmp_path: Path) -> Path:
    p = tmp_path / "cert.pfx"
    p.write_bytes(b"not-a-real-certificate")
    return p


class TestValidate:
    def test_clean_result_passes(self, patch_eric, xbrl):
        patch_eric(TransferResult(return_code=EricReturnCode.ERIC_OK))
        out = submit_mod.validate_ebilanz(xbrl, filing_year=2025)
        assert out.success is True

    def test_hinweise_only_still_passes(self, patch_eric, xbrl):
        """ERIC_GLOBAL_HINWEISE means the data is sendable."""
        patch_eric(TransferResult(
            return_code=EricReturnCode.ERIC_GLOBAL_HINWEISE,
            issues=[_issue("warning")],
        ))
        assert submit_mod.validate_ebilanz(xbrl, filing_year=2025).success is True

    def test_errors_fail_even_with_a_sendable_return_code(self, patch_eric, xbrl):
        patch_eric(TransferResult(
            return_code=EricReturnCode.ERIC_GLOBAL_HINWEISE,
            issues=[_issue("error")],
        ))
        assert submit_mod.validate_ebilanz(xbrl, filing_year=2025).success is False


class TestSubmitGate:
    """The gate must match validate's, and must never overstate a filing."""

    def test_clean_send_is_a_success_with_ticket(self, patch_eric, xbrl, cert):
        patch_eric(TransferResult(
            return_code=EricReturnCode.ERIC_OK, transfer_ticket="TT-1",
        ))
        out = submit_mod.submit_ebilanz(xbrl, cert, "pw", filing_year=2025)
        assert out.success is True
        assert out.transfer_ticket == "TT-1"

    def test_accepted_but_with_errors_is_not_reported_as_success(self, patch_eric, xbrl, cert):
        """The regression. Previously this returned success=True."""
        patch_eric(TransferResult(
            return_code=EricReturnCode.ERIC_GLOBAL_HINWEISE,
            transfer_ticket="TT-2",
            issues=[_issue("error", "Feld fehlt")],
        ))
        out = submit_mod.submit_ebilanz(xbrl, cert, "pw", filing_year=2025)
        assert out.success is False
        # The ticket must still be surfaced, or the user cannot tell whether a
        # resubmission would duplicate the filing.
        assert out.transfer_ticket == "TT-2"
        assert "Doppeleinreichung" in out.message

    def test_hard_failure_is_a_failure(self, patch_eric, xbrl, cert):
        patch_eric(TransferResult(return_code=EricReturnCode.ERIC_TRANSFER_ERIC_FEHLER))
        assert submit_mod.submit_ebilanz(xbrl, cert, "pw", filing_year=2025).success is False

    def test_missing_certificate_fails_before_touching_eric(self, xbrl, tmp_path: Path):
        out = submit_mod.submit_ebilanz(xbrl, tmp_path / "nope.pfx", "pw", filing_year=2025)
        assert out.success is False
