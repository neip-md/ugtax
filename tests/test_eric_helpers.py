"""
Tests for the parts of eric.py that need no ERiC shared library.

eric.py was rewritten (+713 lines) and sat at 48% coverage, where every
"covered" line was a class or def header and no method body ever executed.
These are the pure helpers: version selection and the response parsers that
decide whether a filing is reported as accepted.

The FFI surface itself still needs a fake-libericapi seam; that is tracked
separately and deliberately not faked here, because a wrong fake would be worse
than no test.
"""

from __future__ import annotations

import pytest

from ug_steuer.eric import (
    DatenartVersion,
    TransferResult,
    datenart_for_ebilanz,
    parse_ordnungsbegriff,
    parse_server_response,
    parse_telenummer,
    parse_transfer_ticket,
)


class TestDatenartSelection:
    def test_returns_a_known_bilanz_version(self):
        for year in (2023, 2024, 2025, 2026):
            got = datenart_for_ebilanz(year)
            assert got.startswith("Bilanz_"), got

    def test_newer_year_is_never_older_version(self):
        """Version must be monotonic in the filing year."""
        def as_tuple(v: str) -> tuple[int, ...]:
            return tuple(int(p) for p in v.removeprefix("Bilanz_").split("."))

        versions = [as_tuple(datenart_for_ebilanz(y)) for y in range(2020, 2031)]
        assert versions == sorted(versions), versions


class TestParseServerResponse:
    """Element names follow EricBearbeiteVorgang.xsd: FehlerRegelpruefung and Hinweis."""

    ERROR_XML = """<?xml version="1.0"?>
    <EricBearbeiteVorgang>
      <FehlerRegelpruefung>
        <Nutzdatenticket>NDT-1</Nutzdatenticket>
        <Feldidentifikator>E0101106</Feldidentifikator>
        <VordruckZeilennummer>12</VordruckZeilennummer>
        <RegelName>R_BILANZ_001</RegelName>
        <FachlicheFehlerId>610001234</FachlicheFehlerId>
        <Text>Feld darf nicht leer sein</Text>
      </FehlerRegelpruefung>
      <Hinweis>
        <FachlicheHinweisId>710000001</FachlicheHinweisId>
        <Text>Wert wurde gerundet</Text>
      </Hinweis>
    </EricBearbeiteVorgang>"""

    def test_empty_input_yields_no_issues(self):
        assert parse_server_response("") == []
        assert parse_server_response("   ") == []

    def test_malformed_xml_does_not_raise(self):
        """A garbled server response must not take down a submission report."""
        assert parse_server_response("<not-closed") == []

    def test_extracts_error_and_warning(self):
        issues = parse_server_response(self.ERROR_XML)
        assert len(issues) == 2, issues
        err = next(i for i in issues if i.severity == "error")
        warn = next(i for i in issues if i.severity == "warning")
        assert "leer" in err.message_de
        assert err.code == "610001234"
        assert err.feldkennung == "E0101106"
        assert err.vordruck_zeile == "12"
        assert "gerundet" in warn.message_de

    def test_namespaced_xml_is_handled(self):
        xml = self.ERROR_XML.replace(
            "<EricBearbeiteVorgang>",
            '<EricBearbeiteVorgang xmlns="http://www.elster.de/EricXML/1.1/EricBearbeiteVorgang">',
        )
        issues = parse_server_response(xml)
        assert len(issues) == 2, issues

    def test_regex_fallback_recovers_issues_from_unparseable_xml(self):
        """ERiC has been known to return XML the parser rejects; the fallback
        must still surface the error rather than silently reporting success."""
        broken = self.ERROR_XML.replace("</EricBearbeiteVorgang>", "")
        issues = parse_server_response(broken)
        assert any("leer" in i.message_de for i in issues), issues


class TestParseTicketFields:
    TICKET_XML = """<?xml version="1.0"?>
    <Antwort>
      <TransferTicket>ABC-123-XYZ</TransferTicket>
      <Telenummer>0815</Telenummer>
      <Ordnungsbegriff>4711</Ordnungsbegriff>
    </Antwort>"""

    def test_transfer_ticket(self):
        assert parse_transfer_ticket(self.TICKET_XML) == "ABC-123-XYZ"

    def test_telenummer(self):
        assert parse_telenummer(self.TICKET_XML) == "0815"

    def test_ordnungsbegriff(self):
        assert parse_ordnungsbegriff(self.TICKET_XML) == "4711"

    @pytest.mark.parametrize("parser", [parse_transfer_ticket, parse_telenummer, parse_ordnungsbegriff])
    def test_missing_field_returns_empty_string_not_none(self, parser):
        """Callers concatenate these into reports; None would render as 'None'."""
        assert parser("<Antwort/>") == ""


class TestTransferResult:
    def test_zero_return_code_is_success(self):
        assert TransferResult(return_code=0).success is True

    def test_non_zero_return_code_is_not_success(self):
        """This property decides whether a legally binding filing is reported
        as submitted, so it is worth pinning explicitly."""
        assert TransferResult(return_code=1).success is False
        assert TransferResult(return_code=610001234).success is False
