"""
Bank import profiles.

WHY THIS EXISTS
    csv_parser.py already sniffs the delimiter, tries five encodings and handles
    German decimal format, but it had a single hardcoded DEFAULT_COLUMN_MAP with
    Sparkasse-style German headers (Buchungstag, Betrag, Auftraggeber/Empfänger,
    Verwendungszweck). A Qonto export has English headers, so it missed on every
    row: a first-time user with a Qonto account got a failed or empty import.

    A profile is therefore not new machinery. It is a preset for arguments
    parse_csv already takes (column_map, delimiter, encoding, skip_rows), plus a
    way to recognise which preset applies from the header row.

CONTRIBUTING A BANK
    Add a YAML file to rules/banks/ with a `detect.headers_include` list and a
    `column_map`, then drop an anonymised export at the `fixture` path. The test
    suite is parametrized over every profile's fixture, so a new bank arrives
    with its own test and a wrong column mapping fails CI rather than silently
    misreading someone's statement.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from pathlib import Path
from typing import Iterable

import yaml

PROFILES_DIR = Path(__file__).resolve().parents[2] / "rules" / "banks"


@dataclass
class BankProfile:
    """One bank's export format."""

    id: str
    name: str
    #: Header names that must all be present for this profile to match.
    headers_include: list[str]
    column_map: dict[str, str | None]
    delimiter: str | None = None
    encoding: str | None = None
    skip_rows: int = 0
    date_formats: list[str] = field(default_factory=list)
    fixture: str | None = None

    def matches(self, headers: Iterable[str]) -> bool:
        """True when every required header is present (case-insensitive)."""
        present = {h.strip().lower() for h in headers if h}
        return all(h.strip().lower() in present for h in self.headers_include)

    def parse_kwargs(self) -> dict:
        """The keyword arguments to hand to parse_csv."""
        kwargs: dict = {"column_map": self.column_map, "skip_rows": self.skip_rows}
        if self.delimiter:
            kwargs["delimiter"] = self.delimiter
        if self.encoding:
            kwargs["encoding"] = self.encoding
        return kwargs


def _profile_from_dict(raw: dict) -> BankProfile:
    detect = raw.get("detect") or {}
    return BankProfile(
        id=raw["id"],
        name=raw.get("name", raw["id"]),
        headers_include=list(detect.get("headers_include") or []),
        column_map=dict(raw.get("column_map") or {}),
        delimiter=raw.get("delimiter"),
        encoding=raw.get("encoding"),
        skip_rows=int(raw.get("skip_rows") or 0),
        date_formats=list(raw.get("date_formats") or []),
        fixture=raw.get("fixture"),
    )


def load_profiles(profiles_dir: Path | None = None) -> list[BankProfile]:
    """Load every profile from disk. A malformed file is skipped, not fatal."""
    directory = Path(profiles_dir) if profiles_dir else PROFILES_DIR
    if not directory.is_dir():
        return []
    profiles: list[BankProfile] = []
    for path in sorted(directory.glob("*.yaml")):
        try:
            raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            if not raw.get("id"):
                continue
            profiles.append(_profile_from_dict(raw))
        except (yaml.YAMLError, KeyError, TypeError, ValueError):
            continue
    return profiles


def read_headers(
    file_path: str | Path,
    delimiter: str | None = None,
    encoding: str | None = None,
    skip_rows: int = 0,
) -> list[str]:
    """Read just the header row, reusing the parser's own sniffing."""
    from .csv_parser import _detect_delimiter, _detect_encoding

    path = Path(file_path)
    enc = encoding or _detect_encoding(path)
    delim = delimiter or _detect_delimiter(path)
    with open(path, encoding=enc, newline="") as f:
        for _ in range(skip_rows):
            f.readline()
        row = next(csv.reader(f, delimiter=delim), [])
    return [c.strip() for c in row]


def detect_profile(
    file_path: str | Path,
    profiles: list[BankProfile] | None = None,
) -> BankProfile | None:
    """
    Pick the profile whose required headers are all present.

    Ties are broken by specificity: the profile demanding the most headers wins,
    so a generic profile never shadows a precise one.
    """
    candidates = profiles if profiles is not None else load_profiles()
    if not candidates:
        return None
    try:
        headers = read_headers(file_path)
    except (OSError, UnicodeDecodeError, csv.Error):
        return None
    if not headers:
        return None
    matching = [p for p in candidates if p.headers_include and p.matches(headers)]
    if not matching:
        return None
    return max(matching, key=lambda p: len(p.headers_include))
