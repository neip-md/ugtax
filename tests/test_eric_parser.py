"""Unit tests for ERiC server response parsing.

These tests do NOT require the ERiC binary — they exercise the pure-Python
parser that turns ERiC's response XML into ValidationIssue objects. The
schema being parsed is documented in
eric/docs/.../API-Rueckgabe-Schemata/EricBearbeiteVorgang.xsd.
"""

from __future__ import annotations

from ug_steuer.eric import (
    DatenartVersion,
    ValidationIssue,
    datenart_for_ebilanz,
    datenart_for_gewst,
    datenart_for_kst,
    parse_ordnungsbegriff,
    parse_server_response,
    parse_telenummer,
    parse_transfer_ticket,
)


def test_parse_empty_response():
    assert parse_server_response("") == []
    assert parse_server_response("   ") == []


def test_parse_single_fehler_with_namespace():
    """The real ERiC schema uses FehlerRegelpruefung in a namespace."""
    xml = """<?xml version="1.0" encoding="UTF-8"?>
    <EricBearbeiteVorgang xmlns="http://www.elster.de/EricXML/1.1/EricBearbeiteVorgang">
      <FehlerRegelpruefung>
        <Nutzdatenticket>nd-001</Nutzdatenticket>
        <Feldidentifikator>Vorsteuer.Betrag</Feldidentifikator>
        <LfdNrVordruck>1</LfdNrVordruck>
        <VordruckZeilennummer>42</VordruckZeilennummer>
        <RegelName>VorsteuerNichtNegativ</RegelName>
        <FachlicheFehlerId>610001234</FachlicheFehlerId>
        <Text>Vorsteuer kann nicht negativ sein.</Text>
      </FehlerRegelpruefung>
    </EricBearbeiteVorgang>
    """
    issues = parse_server_response(xml)
    assert len(issues) == 1
    issue = issues[0]
    assert issue.severity == "error"
    assert issue.code == "610001234"
    assert issue.feldkennung == "Vorsteuer.Betrag"
    assert issue.lfd_nr_vordruck == "1"
    assert issue.vordruck_zeile == "42"
    assert issue.regel_name == "VorsteuerNichtNegativ"
    assert issue.nutzdatenticket == "nd-001"
    assert "Vorsteuer" in issue.message_de


def test_parse_hinweis():
    xml = """<?xml version="1.0"?>
    <EricBearbeiteVorgang xmlns="http://www.elster.de/EricXML/1.1/EricBearbeiteVorgang">
      <Hinweis>
        <Nutzdatenticket>nd-002</Nutzdatenticket>
        <Feldidentifikator>Umsatzhoehe</Feldidentifikator>
        <FachlicheHinweisId>H-100</FachlicheHinweisId>
        <Text>Ungewöhnlich hoher Umsatz.</Text>
      </Hinweis>
    </EricBearbeiteVorgang>
    """
    issues = parse_server_response(xml)
    assert len(issues) == 1
    assert issues[0].severity == "warning"
    assert issues[0].code == "H-100"
    assert issues[0].feldkennung == "Umsatzhoehe"
    assert "Ungewöhnlich" in issues[0].message_de


def test_parse_mixed_fehler_and_hinweis():
    xml = """<?xml version="1.0"?>
    <EricBearbeiteVorgang xmlns="http://www.elster.de/EricXML/1.1/EricBearbeiteVorgang">
      <FehlerRegelpruefung>
        <Nutzdatenticket>nd-1</Nutzdatenticket>
        <Feldidentifikator>F1</Feldidentifikator>
        <FachlicheFehlerId>1</FachlicheFehlerId>
        <Text>Kritisch</Text>
      </FehlerRegelpruefung>
      <Hinweis>
        <Nutzdatenticket>nd-1</Nutzdatenticket>
        <Feldidentifikator>F2</Feldidentifikator>
        <FachlicheHinweisId>2</FachlicheHinweisId>
        <Text>Warnung</Text>
      </Hinweis>
      <FehlerRegelpruefung>
        <Nutzdatenticket>nd-1</Nutzdatenticket>
        <Feldidentifikator>F3</Feldidentifikator>
        <FachlicheFehlerId>3</FachlicheFehlerId>
        <Text>Auch kritisch</Text>
      </FehlerRegelpruefung>
    </EricBearbeiteVorgang>
    """
    issues = parse_server_response(xml)
    assert len(issues) == 3
    assert [i.severity for i in issues] == ["error", "warning", "error"]
    assert [i.feldkennung for i in issues] == ["F1", "F2", "F3"]
    assert [i.code for i in issues] == ["1", "2", "3"]


def test_parse_semantischer_index_attribute():
    """SemantischerIndex carries a name attribute that identifies the context."""
    xml = """<?xml version="1.0"?>
    <EricBearbeiteVorgang xmlns="http://www.elster.de/EricXML/1.1/EricBearbeiteVorgang">
      <FehlerRegelpruefung>
        <Nutzdatenticket>nd-1</Nutzdatenticket>
        <Feldidentifikator>F</Feldidentifikator>
        <SemantischerIndex name="Person">PersonA</SemantischerIndex>
        <SemantischerIndex name="Betrieb">Betrieb1</SemantischerIndex>
        <FachlicheFehlerId>42</FachlicheFehlerId>
        <Text>Fehler im Kontext</Text>
      </FehlerRegelpruefung>
    </EricBearbeiteVorgang>
    """
    issues = parse_server_response(xml)
    assert len(issues) == 1
    assert issues[0].semantischer_index == {"Person": "PersonA", "Betrieb": "Betrieb1"}


def test_parse_namespaced_with_prefix():
    """Some ERiC outputs use a prefix instead of default namespace."""
    xml = """<?xml version="1.0"?>
    <e:EricBearbeiteVorgang xmlns:e="http://www.elster.de/EricXML/1.1/EricBearbeiteVorgang">
      <e:FehlerRegelpruefung>
        <e:Nutzdatenticket>nd</e:Nutzdatenticket>
        <e:Feldidentifikator>X</e:Feldidentifikator>
        <e:FachlicheFehlerId>99</e:FachlicheFehlerId>
        <e:Text>Prefixed</e:Text>
      </e:FehlerRegelpruefung>
    </e:EricBearbeiteVorgang>
    """
    issues = parse_server_response(xml)
    assert len(issues) == 1
    assert issues[0].code == "99"
    assert issues[0].feldkennung == "X"


def test_parse_malformed_xml_falls_back_to_regex():
    """Even unparseable XML should yield best-effort issues, not crash."""
    junk = """garbage <FehlerRegelpruefung>
        <Feldidentifikator>5555</Feldidentifikator>
        <FachlicheFehlerId>99</FachlicheFehlerId>
        <Text>Broken</Text>
    </FehlerRegelpruefung> more junk"""
    issues = parse_server_response(junk)
    assert len(issues) >= 1
    assert any(i.code == "99" for i in issues)
    assert any(i.feldkennung == "5555" for i in issues)


def test_parse_transfer_ticket():
    xml = """<EricBearbeiteVorgang xmlns="http://www.elster.de/EricXML/1.1/EricBearbeiteVorgang">
      <Transfers><Transfer><TransferTicket>eh001abcdefghijklmnopqrstuvwxy</TransferTicket></Transfer></Transfers>
    </EricBearbeiteVorgang>"""
    assert parse_transfer_ticket(xml) == "eh001abcdefghijklmnopqrstuvwxy"


def test_parse_telenummer_and_ordnungsbegriff():
    xml = """<EricBearbeiteVorgang xmlns="http://www.elster.de/EricXML/1.1/EricBearbeiteVorgang">
      <Erfolg>
        <Telenummer>ABC</Telenummer>
        <Ordnungsbegriff>OB-12345</Ordnungsbegriff>
      </Erfolg>
    </EricBearbeiteVorgang>"""
    assert parse_telenummer(xml) == "ABC"
    assert parse_ordnungsbegriff(xml) == "OB-12345"


def test_parse_transfer_ticket_missing():
    assert parse_transfer_ticket("<Result></Result>") == ""
    assert parse_transfer_ticket("") == ""


def test_datenart_for_ebilanz_picks_recent_taxonomy():
    assert datenart_for_ebilanz(2025) == DatenartVersion.BILANZ_6_9
    assert datenart_for_ebilanz(2024) == DatenartVersion.BILANZ_6_8
    assert datenart_for_ebilanz(2023) == DatenartVersion.BILANZ_6_7
    assert datenart_for_ebilanz(2026) == DatenartVersion.BILANZ_6_9  # latest


def test_datenart_for_kst_and_gewst_format_with_year():
    assert datenart_for_kst(2024) == "KSt_30_2024"
    assert datenart_for_gewst(2024) == "GewSt_2024"


def test_validation_issue_to_dict_round_trip():
    issue = ValidationIssue(
        severity="error",
        code="42",
        feldkennung="F",
        message_de="Test",
        vordruck_zeile="10",
        lfd_nr_vordruck="1",
        regel_name="MyRule",
        semantischer_index={"Person": "A"},
    )
    d = issue.to_dict()
    assert d["severity"] == "error"
    assert d["code"] == "42"
    assert d["feldkennung"] == "F"
    assert d["vordruck_zeile"] == "10"
    assert d["regel_name"] == "MyRule"
    assert d["semantischer_index"] == {"Person": "A"}
    assert d["field_label"] == ""  # not yet enriched
