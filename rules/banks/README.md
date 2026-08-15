# Bank import profiles

Each YAML file here teaches UGtax how to read one bank's CSV export.

## Why

`csv_parser.py` already sniffs the delimiter, tries five encodings and handles
German decimal format. What it could not do was know that a Qonto export calls
the date column `Settlement date` rather than `Buchungstag`. With one hardcoded
German column map, any export with English headers missed on **every row**, so a
first-time user with a Qonto, Finom, N26 or Holvi account got an empty import.

A profile is not new machinery. It is a preset for arguments `parse_csv()`
already accepts, plus a way to recognise which preset applies.

## Adding your bank

Two files, no code.

**1. `rules/banks/<yourbank>.yaml`**

```yaml
id: yourbank
name: Your Bank
detect:
  # Every one of these must appear in the header row for this profile to match.
  # Pick the ones that identify the bank, not the ones every CSV has.
  headers_include: ["Settlement date", "Counterparty name", "Amount"]
column_map:
  date: "Settlement date"
  amount: Amount
  counterparty: "Counterparty name"
  reference: Reference
  direction: null          # null = infer from the sign of the amount
delimiter: ","             # optional, sniffed when omitted
encoding: utf-8            # optional, sniffed when omitted
skip_rows: 0               # rows of metadata before the header
date_formats: ["%Y-%m-%d"]
fixture: tests/fixtures/banks/yourbank_sample.csv
```

**2. `tests/fixtures/banks/<yourbank>_sample.csv`**

An anonymised two-row export. Use fictional names and round amounts. Every
fixture encodes the same two movements so the assertions can be shared:

| when | direction | amount | what |
| --- | --- | --- | --- |
| 2025-01-07 | in | 1000.00 | Stammkapitaleinlage |
| 2025-03-14 | out | 12.50 | a bank fee |

**Never commit a real bank statement.** The repo-guard hooks will reject
recognisable personal data, but the responsibility is yours.

## What the tests check

`tests/test_bank_profiles.py` is parametrized over every profile, so your bank
arrives with its own tests automatically. They assert that:

- the profile is well formed and ships a fixture
- the fixture detects as *your* profile, not someone else's
- every header you require actually appears in your fixture (this catches a
  profile that only "works" because a looser one matched first)
- the fixture parses to exactly two transactions with the right signs, amounts,
  dates and ordering
- counterparty and reference are populated

A wrong column mapping therefore fails CI rather than silently misreading
somebody's bank statement, which is the whole point.

## Detection and precedence

Detection reads only the header row. When several profiles match, the one
requiring the most headers wins, so a broad profile never shadows a precise one.
An explicit `column_map` passed to `parse_csv()` always beats auto-detection.

If no profile matches, the parser falls back to its previous behaviour: the
German default column map plus delimiter and encoding sniffing.
