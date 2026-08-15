"""Shared test fixtures."""

from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).parent / "fixtures"


@pytest.fixture
def sample_camt053() -> Path:
    return FIXTURES_DIR / "sample_camt053.xml"


@pytest.fixture
def sample_config_path() -> Path:
    return FIXTURES_DIR / "sample_config.yaml"
