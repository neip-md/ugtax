"""Integration test: validate a real generated XBRL against the actual ERiC binary.

Skipped by default. Run with:

    ERIC_RUN_INTEGRATION=1 ERIC_PATH=/path/to/eric/lib pytest tests/integration/

Requires:
- ERiC binary staged per eric/README.md
- Vordrucke 2025/2026 extracted
- A generated XBRL fixture (or this test generates one from the fixtures)
"""

from __future__ import annotations

import os
from pathlib import Path

import pytest

from ug_steuer.eric import (
    DatenartVersion,
    EricNotFoundError,
    EricWrapper,
    datenart_for_ebilanz,
)

INTEGRATION_ENABLED = os.environ.get("ERIC_RUN_INTEGRATION") == "1"

pytestmark = pytest.mark.skipif(
    not INTEGRATION_ENABLED,
    reason="Set ERIC_RUN_INTEGRATION=1 to run ERiC integration tests",
)


@pytest.fixture(scope="module")
def eric():
    try:
        with EricWrapper() as e:
            yield e
    except EricNotFoundError as exc:
        pytest.skip(f"ERiC binary not available: {exc}")


def test_eric_loads_and_initializes(eric):
    """Smoke test: ERiC starts up cleanly."""
    assert eric._initialized is True
    assert eric._lib is not None


def test_datenart_supported_for_ebilanz(eric):
    """The pinned E-Bilanz taxonomy must be available in the loaded plugins."""
    assert eric.datenart_supported(DatenartVersion.BILANZ_6_9), (
        "Bilanz_6.9 plugin not found — verify Vordrucke 2026 is extracted into eric/"
    )


def test_datenart_supported_rejects_garbage(eric):
    """Sanity check: a fake datenartVersion should NOT be reported as supported."""
    assert not eric.datenart_supported("Bilanz_99.99"), (
        "EricMakeElsterDatenArt accepted a fake datenartVersion — wrapper may be broken"
    )


def test_check_xml_passes_for_valid_xbrl(eric, tmp_path):
    """EricCheckXML should accept a syntactically valid (if semantically empty) XBRL.

    This test could never have passed: it called check_xml() with one argument
    while the method takes (xbrl_data, datenart_version), so it raised TypeError
    before reaching the assert, and it then compared a TransferResult against
    integers. It stayed invisible because every test in this module skips
    without the ERiC shared library installed.
    """
    minimal_xbrl = b"""<?xml version="1.0" encoding="UTF-8"?>
    <xbrli:xbrl xmlns:xbrli="http://www.xbrl.org/2003/instance"/>
    """
    result = eric.check_xml(minimal_xbrl, DatenartVersion.BILANZ_6_9)
    # ERiC may return non-zero for "valid syntax but no schema match".
    assert result.return_code in (0, 1, 5), (
        f"Unexpected EricCheckXML return code: {result.return_code}"
    )


@pytest.fixture
def sample_xbrl():
    """Generate a real XBRL from the fixture data, or load a pre-generated one.

    TODO: wire this to ug_steuer.xbrl.generate_ebilanz once we have a known-good
    fixture in tests/fixtures/. For now, points at a placeholder path.
    """
    fixture = Path(__file__).parent.parent / "fixtures" / "sample_ebilanz.xbrl"
    if not fixture.exists():
        pytest.skip(
            "tests/fixtures/sample_ebilanz.xbrl not present. "
            "Generate one with `ug-steuer process` and copy it here, or wire the "
            "xbrl.generate_ebilanz() call into this fixture."
        )
    return fixture.read_bytes()


def test_validate_real_ebilanz(eric, sample_xbrl):
    """Run ERiC validation against a real generated E-Bilanz.

    The XBRL should EITHER pass clean OR fail with parseable plausibility errors —
    never crash and never return None for issues.
    """
    result = eric.validate(sample_xbrl, datenart_version=DatenartVersion.BILANZ_6_9)
    assert result is not None
    assert isinstance(result.issues, list)

    # If validation failed, every issue must be structured (not just a raw string)
    for issue in result.issues:
        assert issue.severity in ("error", "warning", "info")
        assert isinstance(issue.message_de, str)

    # Print findings so the test output is useful when run manually
    if result.issues:
        print(f"\nValidation produced {len(result.issues)} issues:")
        for i, issue in enumerate(result.issues, 1):
            print(f"  {i}. [{issue.severity}] {issue.feldkennung} {issue.code}: {issue.message_de}")
