"""Extract Feldkennung → human label maps from ERiC Schnittstellenbeschreibungen.

The Erklaerungssteuern XSD schemas (KSt, GewSt, ESt, FEIN, etc.) define
every form field as an `<xs:element name="EXXXXXXX">` with a German label
in `<xs:annotation><xs:documentation>`. This module walks those schemas
and produces a JSON map keyed by `(datenart, feldkennung)` so the sidecar
can enrich ValidationIssue objects with field labels before sending them
to the frontend.

E-Bilanz (Bilanz_6.X) is intentionally NOT covered here — its field
identifiers are XBRL concept QNames from the HGB-Taxonomie, which lives
in a separate set of files. Handle that in a future module.

Usage:
    # As a library
    from ug_steuer.feldkennung_extractor import build_feldkennung_map
    m = build_feldkennung_map(Path("eric/docs/.../Schnittstellenbeschreibungen"))

    # As a CLI
    python -m ug_steuer.feldkennung_extractor \\
        --schnittstellen eric/docs/ERiC-43.4.6.0/Dokumentation/Schnittstellenbeschreibungen \\
        --output services/submit/feldkennung_map.json

Output JSON shape:
    {
        "KSt_30_2024": {
            "E8000101": "Bezeichnung der Körperschaft, ...",
            "E8000501": "Ort der Geschäftsleitung nach § 10 AO",
            ...
        },
        "GewSt_2024": { ... }
    }
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path
from typing import Iterable

# The regex captures <xs:element name="EXXXXXXX" ...>
#                      <xs:annotation>
#                        <xs:documentation [optional attrs]>label</xs:documentation>
# tolerating arbitrary whitespace and optional xml: lang attrs.
_ELEMENT_DOC_RE = re.compile(
    r'<xs:element\s+name="(?P<name>E\d{7,8})"[^>]*>\s*'
    r'<xs:annotation>\s*'
    r'<xs:documentation[^>]*>(?P<doc>[^<]+)</xs:documentation>',
    re.DOTALL,
)

# Directory name patterns we recognise as Erklaerungssteuern datenarts.
# Maps directory name → datenartVersion key for the output JSON.
_DATENART_DIR_RE = re.compile(
    r"^(?P<sachbereich>[A-Za-z]+)_(?P<major>\d+)_(?P<year>\d{4})$"
)
# GewSt and KStZ use a 2-segment name (e.g. GewSt_2024 — without the major number).
_DATENART_DIR_2_RE = re.compile(
    r"^(?P<sachbereich>[A-Za-z]+)_(?P<year>\d{4})$"
)


def _read_xsd(path: Path) -> str:
    """Read an ERiC XSD, trying common encodings.

    The Erklaerungssteuern schemas are usually UTF-8 but the older Bilanz
    schemas use ISO-8859-15. Try the most likely encodings in order.
    """
    for encoding in ("utf-8", "iso-8859-15", "iso-8859-1", "cp1252"):
        try:
            return path.read_text(encoding=encoding)
        except UnicodeDecodeError:
            continue
    return path.read_bytes().decode("utf-8", errors="replace")


def extract_from_schema(xsd_text: str) -> dict[str, str]:
    """Extract feldkennung → label pairs from a single schema string."""
    out: dict[str, str] = {}
    for m in _ELEMENT_DOC_RE.finditer(xsd_text):
        name = m.group("name")
        # Decode XML entities (&#10;, &amp;, etc.) and normalise whitespace
        doc = html.unescape(m.group("doc"))
        doc = " ".join(doc.split()).strip()
        if name and doc and name not in out:
            out[name] = doc
    return out


# Sachbereiche where the API datenartVersion preserves the major number.
# Verified against Datenartversionmatrix.xml: KSt has variants 30/32/33,
# FEIN has variants 90/95, so the major must be in the API string. Every
# other Sachbereich uses just `<Sachbereich>_<year>`.
_PRESERVE_MAJOR = {"KSt", "FEIN"}


def _datenart_key_for_dir(dir_name: str) -> str | None:
    """Translate a Schnittstellenbeschreibungen directory name into the
    canonical API datenartVersion string used by EricBearbeiteVorgang.

    Examples (verified against Datenartversionmatrix.xml):
        KSt_30_2024     → KSt_30_2024     (KSt preserves major)
        FEIN_95_2025    → FEIN_95_2025    (FEIN preserves major)
        GewSt_20_2024   → GewSt_2024      (drop major)
        GewStZ_21_2024  → GewStZ_2024     (drop major)
        ESt_10_2024     → ESt_2024        (drop major)
        EUER_77_2024    → EUER_2024       (drop major)
        USt_50_2024     → USt_2024        (drop major)
        Erbschaftsteuer_4 → None          (no year, skip)
    """
    m = _DATENART_DIR_RE.match(dir_name)
    if m:
        sb = m.group("sachbereich")
        year = m.group("year")
        if sb in _PRESERVE_MAJOR:
            return dir_name
        return f"{sb}_{year}"
    if _DATENART_DIR_2_RE.match(dir_name):
        return dir_name
    return None


def _walk_schemas(schnittstellen_root: Path) -> Iterable[tuple[str, Path]]:
    """Yield (datenart_key, xsd_path) for every Erklaerungssteuern schema."""
    erkl = schnittstellen_root / "Erklaerungssteuern"
    if not erkl.is_dir():
        return
    for datenart_dir in sorted(erkl.iterdir()):
        if not datenart_dir.is_dir():
            continue
        key = _datenart_key_for_dir(datenart_dir.name)
        if not key:
            continue
        schema_dir = datenart_dir / "Schema"
        if not schema_dir.is_dir():
            continue
        for xsd in sorted(schema_dir.glob("*.xsd")):
            # Skip the Nutzdaten wrapper schemas — they re-export, no field defs.
            if "Nutzdaten" in xsd.name:
                continue
            yield key, xsd


def build_feldkennung_map(schnittstellen_root: Path) -> dict[str, dict[str, str]]:
    """Walk every Erklaerungssteuern schema and produce the merged map."""
    result: dict[str, dict[str, str]] = {}
    for datenart, xsd_path in _walk_schemas(schnittstellen_root):
        text = _read_xsd(xsd_path)
        fields = extract_from_schema(text)
        if not fields:
            continue
        bucket = result.setdefault(datenart, {})
        # Merge — first definition wins (schemas are usually consistent within
        # a datenart but multiple files may share types).
        for name, label in fields.items():
            bucket.setdefault(name, label)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--schnittstellen",
        type=Path,
        default=Path("eric/docs/ERiC-43.4.6.0/Dokumentation/Schnittstellenbeschreibungen"),
        help="Path to ERiC Schnittstellenbeschreibungen directory",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("services/submit/feldkennung_map.json"),
        help="Output JSON file path",
    )
    parser.add_argument(
        "--pretty",
        action="store_true",
        help="Pretty-print the JSON output",
    )
    args = parser.parse_args(argv)

    if not args.schnittstellen.is_dir():
        print(f"ERROR: {args.schnittstellen} is not a directory", file=sys.stderr)
        print("Did you stage ERiC docs per eric/README.md?", file=sys.stderr)
        return 2

    print(f"Walking {args.schnittstellen}...", file=sys.stderr)
    fmap = build_feldkennung_map(args.schnittstellen)

    total_fields = sum(len(b) for b in fmap.values())
    print(
        f"Extracted {total_fields} field labels across {len(fmap)} datenartVersions:",
        file=sys.stderr,
    )
    for datenart in sorted(fmap):
        print(f"  {datenart}: {len(fmap[datenart])}", file=sys.stderr)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open("w", encoding="utf-8") as f:
        if args.pretty:
            json.dump(fmap, f, ensure_ascii=False, indent=2, sort_keys=True)
        else:
            json.dump(fmap, f, ensure_ascii=False, sort_keys=True)
    print(f"Wrote {args.output}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
