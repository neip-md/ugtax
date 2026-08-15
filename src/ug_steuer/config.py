"""Configuration loader for UG Steuertool."""

from __future__ import annotations

from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path

import yaml


@dataclass
class CounterpartyMapping:
    """Maps a counterparty name to an SKR04 account."""
    account: str
    description: str = ""


@dataclass
class CompanyConfig:
    """Company metadata for the UG."""
    name: str = ""
    steuernummer: str = ""
    finanzamt: str = ""
    geschaeftsjahr: int = 2025
    kleinunternehmer: bool = True
    stammkapital: Decimal = Decimal("1.00")
    gewinnvortrag: Decimal = Decimal("0.00")  # From prior year


@dataclass
class Config:
    """Full configuration."""
    company: CompanyConfig = field(default_factory=CompanyConfig)
    counterparties: dict[str, CounterpartyMapping] = field(default_factory=dict)

    @classmethod
    def from_yaml(cls, path: str | Path) -> Config:
        """Load config from a YAML file."""
        with open(path) as f:
            raw = yaml.safe_load(f) or {}

        company_raw = raw.get("company", {})
        company = CompanyConfig(
            name=company_raw.get("name", ""),
            steuernummer=company_raw.get("steuernummer", ""),
            finanzamt=company_raw.get("finanzamt", ""),
            geschaeftsjahr=company_raw.get("geschaeftsjahr", 2025),
            kleinunternehmer=company_raw.get("kleinunternehmer", True),
            stammkapital=Decimal(str(company_raw.get("stammkapital", "1.00"))),
            gewinnvortrag=Decimal(str(company_raw.get("gewinnvortrag", "0.00"))),
        )

        counterparties: dict[str, CounterpartyMapping] = {}
        for name, mapping in raw.get("counterparties", {}).items():
            if isinstance(mapping, dict):
                counterparties[name] = CounterpartyMapping(
                    account=str(mapping.get("account", "6300")),
                    description=mapping.get("description", ""),
                )
            else:
                # Simple form: counterparty: "account_number"
                counterparties[name] = CounterpartyMapping(account=str(mapping))

        return cls(company=company, counterparties=counterparties)

    @classmethod
    def empty(cls) -> Config:
        """Return a config with sensible defaults."""
        return cls()
