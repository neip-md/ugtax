"""
Tests for load_review_file.

This code path had no coverage and lost data in silence: an entry whose
counterparty carried a trailing space matched nothing, was skipped without a
warning, and the transaction never reached the journal. In a bookkeeping tool
that produces a Bilanz that is quietly short.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import yaml

from ug_steuer.classifier import load_review_file
from ug_steuer.models import Direction, Transaction


def _tx(counterparty: str = "Stripe Payments", amount: str = "42.50") -> Transaction:
    return Transaction(
        date=date(2025, 3, 14),
        amount=Decimal(amount),
        direction=Direction.DEBIT,
        counterparty=counterparty,
        reference="INV-1",
    )


def _write(tmp_path, entries):
    p = tmp_path / "review.yaml"
    p.write_text(yaml.dump({"unclassified": entries}, allow_unicode=True))
    return p


def test_exact_match_is_booked(tmp_path):
    tx = _tx()
    path = _write(tmp_path, [{
        "date": "2025-03-14", "amount": 42.50,
        "counterparty": "Stripe Payments", "account": "6855",
    }])
    result = load_review_file(path, [tx])
    assert len(result.matched) == 1
    assert result.matched[0].account == "6855"
    assert result.matched[0].source == "manual"
    assert result.unmatched == []


def test_trailing_whitespace_still_matches(tmp_path):
    """The file is hand-edited; a stray space must not silently drop the entry."""
    tx = _tx(counterparty="Stripe Payments")
    path = _write(tmp_path, [{
        "date": "2025-03-14", "amount": 42.50,
        "counterparty": "Stripe Payments  ", "account": "6855",
    }])
    result = load_review_file(path, [tx])
    assert len(result.matched) == 1
    assert result.unmatched == []


def test_amount_written_without_decimals_still_matches(tmp_path):
    tx = _tx(amount="100")
    path = _write(tmp_path, [{
        "date": "2025-03-14", "amount": 100.0,
        "counterparty": "Stripe Payments", "account": "6855",
    }])
    result = load_review_file(path, [tx])
    assert len(result.matched) == 1


def test_genuinely_unmatched_entry_is_reported_not_dropped(tmp_path):
    """The regression that motivated this module: no silent loss."""
    tx = _tx(counterparty="Stripe Payments")
    path = _write(tmp_path, [{
        "date": "2025-03-14", "amount": 42.50,
        "counterparty": "Some Other Vendor", "account": "6855",
    }])
    result = load_review_file(path, [tx])
    assert result.matched == []
    assert len(result.unmatched) == 1
    assert result.unmatched[0]["counterparty"] == "Some Other Vendor"


def test_blank_account_is_skipped_without_being_flagged(tmp_path):
    """A blank account means 'not classified yet', which is not an error."""
    tx = _tx()
    path = _write(tmp_path, [{
        "date": "2025-03-14", "amount": 42.50,
        "counterparty": "Stripe Payments", "account": "",
    }])
    result = load_review_file(path, [tx])
    assert result.matched == []
    assert result.unmatched == []


def test_empty_review_file(tmp_path):
    p = tmp_path / "empty.yaml"
    p.write_text("")
    result = load_review_file(p, [_tx()])
    assert result.matched == []
    assert result.unmatched == []
