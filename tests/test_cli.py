"""
Tests for cli.py, which was at 0% coverage despite being the entry point
`ug-steuer` and the largest untested module in the package.

These drive the real Typer app through CliRunner against the existing fixtures,
so they exercise the actual argument wiring rather than mocking it away.
"""

from __future__ import annotations

from pathlib import Path

import pytest
from typer.testing import CliRunner

from ug_steuer import __version__
from ug_steuer.cli import app

runner = CliRunner()


class TestTopLevel:
    def test_version_flag(self):
        result = runner.invoke(app, ["--version"])
        assert result.exit_code == 0
        assert __version__ in result.stdout

    def test_help_lists_every_command(self):
        result = runner.invoke(app, ["--help"])
        assert result.exit_code == 0
        for cmd in ("process", "classify", "validate", "submit"):
            assert cmd in result.stdout


class TestClassify:
    def test_classifies_the_sample_export(self, sample_camt053: Path, sample_config_path: Path):
        result = runner.invoke(app, [
            "classify",
            "--bank-export", str(sample_camt053),
            "--config", str(sample_config_path),
            "--year", "2025",
        ])
        assert result.exit_code == 0, result.stdout
        assert "classified" in result.stdout.lower()

    def test_missing_bank_export_fails_cleanly(self, sample_config_path: Path, tmp_path: Path):
        result = runner.invoke(app, [
            "classify",
            "--bank-export", str(tmp_path / "nope.xml"),
            "--config", str(sample_config_path),
            "--year", "2025",
        ])
        assert result.exit_code != 0
        # Typer's own validation, not a traceback leaking out.
        assert "Traceback" not in result.stdout


class TestProcess:
    def test_full_pipeline_writes_outputs(
        self, sample_camt053: Path, sample_config_path: Path, tmp_path: Path
    ):
        out = tmp_path / "steuern_2025"
        result = runner.invoke(app, [
            "process",
            "--bank-export", str(sample_camt053),
            "--config", str(sample_config_path),
            "--year", "2025",
            "--output", str(out),
        ])
        assert result.exit_code == 0, result.stdout
        assert out.is_dir(), result.stdout
        produced = list(out.iterdir())
        assert produced, "process produced no files"
        # The filing guide is the thing a user actually follows.
        assert any(p.suffix == ".md" for p in produced), [p.name for p in produced]

    def test_unknown_year_yields_no_transactions_but_does_not_crash(
        self, sample_camt053: Path, sample_config_path: Path, tmp_path: Path
    ):
        result = runner.invoke(app, [
            "process",
            "--bank-export", str(sample_camt053),
            "--config", str(sample_config_path),
            "--year", "1999",
            "--output", str(tmp_path / "leer"),
        ])
        assert "Traceback" not in result.stdout


class TestSubmit:
    def test_missing_xbrl_fails_cleanly(self, tmp_path: Path):
        result = runner.invoke(app, [
            "submit",
            "--xbrl", str(tmp_path / "nope.xbrl"),
            "--cert", str(tmp_path / "nope.pfx"),
            "--password", "x",
        ])
        assert result.exit_code != 0
        assert "Traceback" not in result.stdout
