# UG Steuertool

CLI tool that takes a German UG's bank export and generates a ready-to-file Buchungsjournal, Bilanz, GuV, and step-by-step filing guide for E-Bilanz, KSt, GewSt, and USt.

Built for solo founders with a holding UG (haftungsbeschrankt), <50 transactions/year, no employees, Kleinunternehmer or simple VAT.

## Quickstart

Pick the surface that fits:

| You want to | Use | Time to first result |
|-------------|-----|----------------------|
| Generate Bilanz + GuV + E-Bilanz from a bank export, no install | Web at [ugtax.de](https://ugtax.de) | < 5 min |
| Same, but offline / local | `pip install -e .` then `ug-steuer process ...` | < 5 min |
| Also submit E-Bilanz to ELSTER directly | `docker compose up` (requires ERiC SDK + ELSTER cert) | ~1 day (ERiC dev registration) |

Most users want the web flow. Self-hosting only matters if you intend to submit to ELSTER programmatically — otherwise the web export + manual upload to "Mein ELSTER" works fine.

## What it does

```
Bank Export (camt.053 XML)
    |
Parse -> Classify -> Book -> Bilanz + GuV -> Filing Guide
    |
steuern_2025/
├── buchungsjournal.xlsx        # Double-entry journal
├── bilanz_guv.xlsx             # Balance sheet + income statement
└── filing_guide.md             # Step-by-step ELSTER instructions
```

## Install

Requires Python 3.11+.

```bash
pip install -e .
```

## Usage

### 1. Create your config

Copy `config/example_config.yaml` and fill in your UG's details and counterparty mappings.

### 2. Run classification (optional first pass)

```bash
ug-steuer classify \
  --bank-export qonto_2025.xml \
  --config my_ug.yaml \
  --year 2025
```

This shows how each transaction was classified. If any are unclassified, add the counterparties to your config and re-run.

### 3. Run full pipeline

```bash
ug-steuer process \
  --bank-export qonto_2025.xml \
  --config my_ug.yaml \
  --year 2025 \
  --output ./steuern_2025/
```

If unclassified transactions remain, the tool writes a `classification_review.yaml`. Fill in the account numbers and re-run with `--review`:

```bash
ug-steuer process \
  --bank-export qonto_2025.xml \
  --config my_ug.yaml \
  --year 2025 \
  --output ./steuern_2025/ \
  --review ./steuern_2025/classification_review.yaml
```

### 4. Validate only

```bash
ug-steuer validate \
  --bank-export qonto_2025.xml \
  --config my_ug.yaml \
  --year 2025
```

## Bank export format

Currently supports **camt.053 XML** (ISO 20022). Most business bank accounts export this: Qonto, N26 Business, Holvi, Kontist, Commerzbank, Deutsche Bank.

Export your bank statement for the full fiscal year and pass the XML file.

## How classification works

Two layers, in priority order:

1. **Your config** — counterparty name mappings in the YAML file
2. **Built-in rules** — pattern matching for common transaction types (Stammkapital, IHK, bank fees, legal fees, etc.)

Anything unmatched goes to a review file for manual classification. Once classified, add those counterparties to your config so they're automatic next year.

## SKR04 accounts used

| Account | Name | Typical use |
|---------|------|-------------|
| 0520 | Anteile an verbundenen Unternehmen | Beteiligungen (GmbH stakes) |
| 0535 | Wertpapiere des Anlagevermogens | Foreign investments, securities |
| 1810 | Bank | Bank account |
| 2900 | Gezeichnetes Kapital | Stammkapital |
| 2960 | Gesetzliche Rucklage | Thesaurierungsrucklage (5a GmbHG) |
| 3510 | Verbindlichkeiten ggue. Gesellschaftern | Gesellschafterdarlehen |
| 6300 | Sonstige betriebliche Aufwendungen | Catch-all expenses |
| 6827 | Rechts- und Beratungskosten | Legal / consulting |
| 6830 | Sonstige Abgaben | IHK etc. |
| 6855 | Nebenkosten des Geldverkehrs | Bank fees |

## Scope and limitations

**This tool is for:**
- Solo founder holding UGs
- <50 transactions/year
- Kleinunternehmer or simple VAT
- No employees
- SKR04

**Not for:**
- UGs with employees or payroll
- Complex revenue recognition
- Intercompany transactions across multiple entities
- Anything that actually needs a Steuerberater

The tool detects complexity it can't handle (unbalanced Bilanz, unknown accounts) and tells you.

## Direct ELSTER submission (ERiC)

Submit your E-Bilanz directly to the Finanzamt without leaving the tool.

### Setup

1. Register as a developer at https://www.elster.de/eportal/infoseite/entwickler
2. Download the ERiC SDK (C library)
3. Extract to `/opt/eric` (or any directory)
4. Get your ELSTER certificate (.pfx file) from your ELSTER account

### Usage

```bash
# Validate only (dry run, no submission)
ug-steuer submit \
  --xbrl ./output/ebilanz.xbrl \
  --eric-path /opt/eric \
  --dry-run

# Submit to Finanzamt
ug-steuer submit \
  --xbrl ./output/ebilanz.xbrl \
  --certificate ~/.elster/cert.pfx \
  --eric-path /opt/eric
```

You can set `ERIC_PATH` and `ELSTER_CERT_PASSWORD` as environment variables instead of passing them every time.

## Self-hosting (Docker Compose)

The public deployment at ugtax.de handles everything except ELSTER submission — ERiC is a native C library that can't run on serverless platforms. Self-hosting unlocks direct E-Bilanz submission to the Finanzamt from your browser.

### Prerequisites

1. Docker and Docker Compose
2. ERiC SDK — download from https://www.elster.de/eportal/infoseite/entwickler (free, requires developer registration)
3. Your ELSTER certificate (.pfx file) from your ELSTER account

### Setup

```bash
# Clone the repo
git clone https://github.com/neip-md/ugtax.git
cd ugtax

# Extract the ERiC SDK into ./eric/
# (the directory should contain lib/ with libericapi.so or libericapi.dylib)
mkdir -p eric
# ... extract ERiC here ...

# Start everything
docker compose up --build
```

Open http://localhost:4114. The web app automatically connects to the submission service.

### How it works

```
Browser (localhost:4114)
  ├── Upload bank export → classify → review → Bilanz + GuV
  ├── Download XBRL, journal, filing guide
  └── "An ELSTER senden" section
        ├── Upload .pfx certificate + enter password
        ├── Click "Validieren" (dry run) or "Einreichen"
        └── POST → Next.js /api/submit → FastAPI (localhost:8000)
              └── ERiC C library → ELSTER server
                    └── Returns Transfer-Ticket
```

Two Docker services:
- **web** — Next.js app (internal port 3000, mapped to host port 4114), identical to ugtax.de
- **submit** — FastAPI service wrapping ERiC (port 8000, accessed by the web service internally)

### Custom ERiC path

If your ERiC SDK is elsewhere:

```bash
ERIC_PATH=/path/to/eric docker compose up --build
```

### Security notes

- Your .pfx certificate is uploaded in the browser, streamed to ERiC, and never stored
- The submission service runs locally — nothing leaves your machine except the encrypted ELSTER transmission
- No data is sent to ugtax.de or any third party

**Note:** The ERiC library cannot be redistributed. It must be downloaded from elster.de by each user/operator separately.

## Legal

This tool is a bookkeeping aid (Werkzeug) per 6 Nr. 4 StBerG. It does not constitute Steuerberatung. All output should be verified before filing. Use at your own risk.

## License

MIT

## Development

```bash
pip install -e ".[dev]"
pytest
```
