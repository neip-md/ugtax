"""
Tests for feldkennung_extractor.py, which was at 0% coverage.

This is the build-time script that turns ERiC's XSD schemas into the
feldkennung map, which is what lets a rejected filing say "Beiträge zur
Krankenkasse" instead of "E0102203". It needs the ERiC docs tree to run end to
end, but its two decision functions are pure and carry the rules that actually
matter, including a mapping the docstring says was verified against
Datenartversionmatrix.xml.
"""

from __future__ import annotations

import pytest

from ug_steuer.feldkennung_extractor import (
    _datenart_key_for_dir,
    build_feldkennung_map,
    extract_from_schema,
)

XSD = """<?xml version="1.0" encoding="UTF-8"?>
<xs:schema xmlns:xs="http://www.w3.org/2001/XMLSchema">
  <xs:element name="E0102203">
    <xs:annotation>
      <xs:documentation>Beitr&#228;ge zur Krankenkasse</xs:documentation>
    </xs:annotation>
  </xs:element>
  <xs:element name="E0100001">
    <xs:annotation>
      <xs:documentation>
        Einkommensteuer-
        erkl&#228;rung
      </xs:documentation>
    </xs:annotation>
  </xs:element>
</xs:schema>"""


class TestExtractFromSchema:
    def test_extracts_name_to_label(self):
        out = extract_from_schema(XSD)
        assert out["E0102203"] == "Beiträge zur Krankenkasse"

    def test_decodes_entities_and_collapses_whitespace(self):
        """Labels span lines in the source and carry XML entities."""
        out = extract_from_schema(XSD)
        assert out["E0100001"] == "Einkommensteuer- erklärung"

    def test_first_definition_wins_on_duplicates(self):
        doubled = XSD.replace("</xs:schema>", """
  <xs:element name="E0102203">
    <xs:annotation><xs:documentation>Etwas anderes</xs:documentation></xs:annotation>
  </xs:element>
</xs:schema>""")
        assert extract_from_schema(doubled)["E0102203"] == "Beiträge zur Krankenkasse"

    def test_empty_schema_yields_nothing(self):
        assert extract_from_schema("") == {}
        assert extract_from_schema("<xs:schema/>") == {}


class TestDatenartKeyForDir:
    @pytest.mark.parametrize("dir_name,expected", [
        # KSt and FEIN keep the major number: they have several variants, so
        # the API string needs it to disambiguate.
        ("KSt_30_2024", "KSt_30_2024"),
        ("FEIN_95_2025", "FEIN_95_2025"),
        # Everything else drops it.
        ("GewSt_20_2024", "GewSt_2024"),
        ("GewStZ_21_2024", "GewStZ_2024"),
        ("ESt_10_2024", "ESt_2024"),
        ("EUER_77_2024", "EUER_2024"),
        ("USt_50_2024", "USt_2024"),
    ])
    def test_documented_mapping(self, dir_name, expected):
        assert _datenart_key_for_dir(dir_name) == expected

    def test_directory_without_a_year_is_skipped(self):
        assert _datenart_key_for_dir("Erbschaftsteuer_4") is None

    def test_unrelated_directory_is_skipped(self):
        assert _datenart_key_for_dir("README") is None
        assert _datenart_key_for_dir("") is None


class TestBuildMap:
    def test_missing_root_yields_an_empty_map_rather_than_raising(self, tmp_path):
        """The script runs in a build step; a missing docs tree must not explode."""
        assert build_feldkennung_map(tmp_path / "does-not-exist") == {}

    def _tree(self, root, dir_name: str, files: dict[str, str]):
        """Build the real layout: <root>/Erklaerungssteuern/<datenart>/Schema/*.xsd"""
        schema = root / "Erklaerungssteuern" / dir_name / "Schema"
        schema.mkdir(parents=True)
        for name, text in files.items():
            (schema / name).write_text(text, encoding="utf-8")

    def test_builds_from_a_schema_tree(self, tmp_path):
        self._tree(tmp_path, "GewSt_20_2024", {"felder.xsd": XSD})
        out = build_feldkennung_map(tmp_path)
        assert "GewSt_2024" in out, out
        assert out["GewSt_2024"]["E0102203"] == "Beiträge zur Krankenkasse"

    def test_nutzdaten_wrapper_schemas_are_skipped(self, tmp_path):
        """Those re-export types and define no fields of their own."""
        other = XSD.replace("E0102203", "E9999999")
        self._tree(tmp_path, "GewSt_20_2024", {
            "felder.xsd": XSD,
            "NutzdatenHeader.xsd": other,
        })
        out = build_feldkennung_map(tmp_path)
        assert "E0102203" in out["GewSt_2024"]
        assert "E9999999" not in out["GewSt_2024"]

    def test_directory_without_a_year_is_not_collected(self, tmp_path):
        self._tree(tmp_path, "Erbschaftsteuer_4", {"felder.xsd": XSD})
        assert build_feldkennung_map(tmp_path) == {}
