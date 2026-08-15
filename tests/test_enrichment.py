"""
Tests for enrichment.py, which was at 0% coverage.

This is what turns a raw ERiC error into something a founder can act on: a
field label instead of "E0102203", and German prose instead of a rule id. If it
silently does nothing, the user sees the raw codes and cannot tell why their
filing was rejected.
"""

from __future__ import annotations

import json

import pytest

from ug_steuer.enrichment import IssueEnricher
from ug_steuer.eric import ValidationIssue

DATENART = "Bilanz_6.9"


def _issue(**kw) -> ValidationIssue:
    kw.setdefault("severity", "error")
    return ValidationIssue(**kw)


@pytest.fixture
def maps(tmp_path):
    fk = tmp_path / "feldkennung.json"
    fk.write_text(json.dumps({
        DATENART: {
            "E0102203": "Beiträge zur Krankenkasse",
            "Jahresueberschuss": "Jahresüberschuss",
            "Stammkapital": "Gezeichnetes Kapital",
        }
    }), encoding="utf-8")
    tr = tmp_path / "translations.json"
    tr.write_text(json.dumps({
        "610001234": "Ein Pflichtfeld ist leer.",
    }), encoding="utf-8")
    return fk, tr


@pytest.fixture
def enricher(maps, tmp_path):
    fk, tr = maps
    e = IssueEnricher(
        feldkennung_map_path=fk,
        error_translations_path=tr,
        queue_path=tmp_path / "unknown.jsonl",
    )
    e.load()
    return e


class TestFieldLabels:
    def test_exact_feldkennung_gets_a_label(self, enricher):
        [out] = enricher.enrich([_issue(feldkennung="E0102203")], DATENART)
        assert out.field_label == "Beiträge zur Krankenkasse"

    def test_xpath_style_identifier_falls_back_to_the_leaf(self, enricher):
        """E-Bilanz identifiers arrive as paths; the map is keyed by leaf."""
        [out] = enricher.enrich(
            [_issue(feldkennung="bilanz/passiva/Jahresueberschuss")], DATENART
        )
        assert out.field_label == "Jahresüberschuss"

    def test_array_index_suffix_is_stripped(self, enricher):
        [out] = enricher.enrich([_issue(feldkennung="Stammkapital[1]")], DATENART)
        assert out.field_label == "Gezeichnetes Kapital"

    def test_unknown_feldkennung_is_left_blank_not_invented(self, enricher):
        [out] = enricher.enrich([_issue(feldkennung="E9999999")], DATENART)
        assert out.field_label == ""

    def test_an_existing_label_is_not_overwritten(self, enricher):
        [out] = enricher.enrich(
            [_issue(feldkennung="E0102203", field_label="Vom Aufrufer gesetzt")], DATENART
        )
        assert out.field_label == "Vom Aufrufer gesetzt"

    def test_unknown_datenart_yields_no_labels(self, enricher):
        [out] = enricher.enrich([_issue(feldkennung="E0102203")], "Bilanz_1.0")
        assert out.field_label == ""


class TestTranslations:
    def test_known_code_is_translated(self, enricher):
        [out] = enricher.enrich([_issue(code="610001234")], DATENART)
        assert out.human_message == "Ein Pflichtfeld ist leer."

    def test_unknown_error_code_is_queued_for_triage(self, enricher, tmp_path):
        enricher.enrich([_issue(code="610009999", message_de="Neuer Fehler")], DATENART)
        queued = (tmp_path / "unknown.jsonl").read_text(encoding="utf-8").strip().splitlines()
        assert len(queued) == 1
        assert json.loads(queued[0])["code"] == "610009999"

    def test_the_same_unknown_code_is_only_queued_once(self, enricher, tmp_path):
        for _ in range(3):
            enricher.enrich([_issue(code="610009999")], DATENART)
        lines = (tmp_path / "unknown.jsonl").read_text(encoding="utf-8").strip().splitlines()
        assert len(lines) == 1

    def test_unknown_warning_is_not_queued(self, enricher, tmp_path):
        """Only errors are worth triaging; Hinweise would flood the queue."""
        enricher.enrich([_issue(severity="warning", code="710000001")], DATENART)
        assert not (tmp_path / "unknown.jsonl").exists()


class TestMissingMaps:
    def test_missing_files_are_tolerated(self, tmp_path):
        """The sidecar must start even with no maps staged."""
        e = IssueEnricher(
            feldkennung_map_path=tmp_path / "nope.json",
            error_translations_path=tmp_path / "also-nope.json",
        )
        e.load()
        [out] = e.enrich([_issue(feldkennung="E0102203", code="610001234")], DATENART)
        assert out.field_label == ""
        assert out.human_message == ""

    def test_malformed_json_is_tolerated(self, tmp_path):
        bad = tmp_path / "bad.json"
        bad.write_text("{not json", encoding="utf-8")
        e = IssueEnricher(feldkennung_map_path=bad, error_translations_path=bad)
        e.load()  # must not raise
        assert e.enrich([_issue(feldkennung="X")], DATENART)[0].field_label == ""
