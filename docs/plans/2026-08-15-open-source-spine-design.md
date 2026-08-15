# Open-source spine: rule packs, bank profiles, validation

**Date:** 2026-08-15
**Status:** design, not yet implemented
**Audience decision:** built for German founders who would actually use it, and for
developers who might contribute or fork. Explicitly not an investor showcase.

## Why

UGtax went public on 2026-08-15. The goal is to be the reference open-source
tool for filing a German holding UG, which means two people have to succeed:

1. A founder who lands on ugtax.de, drops in a bank export, and gets a correct
   Bilanz without reading documentation.
2. A developer who wants to add their bank or their vendor and can do it in one
   file without understanding the codebase.

Today neither succeeds, for one shared reason: **the tool only works well once
you have hand-written a YAML config for your own bank and your own vendors.**
That is the cold start, and it is the thing to remove.

Two concrete measurements behind that claim:

- `src/ug_steuer/classifier.py` ships **6** built-in rules. They cover
  Stammkapitaleinlage, Gesellschafterdarlehen and IHK. Everything else falls to
  the user's config, to the LLM fallback (which needs an API key), or to manual
  entry.
- `src/ug_steuer/csv_parser.py` has a single hardcoded `DEFAULT_COLUMN_MAP`
  using Sparkasse-style German headers (`Buchungstag`, `Betrag`,
  `Auftraggeber/Empfänger`, `Verwendungszweck`). A Qonto export, whose headers
  are English, misses on **every row**.

So a realistic first-time user (Qonto account, 40 transactions to Stripe, AWS,
Notion and a Steuerberater) currently gets a failed import, or an import where
almost nothing is classified.

## What we are building

Three components that share one idea: **declarative data files that carry their
own tests**, so that contributing is a one-file pull request and a wrong
contribution fails CI instead of silently producing a wrong Bilanz.

### 1. Vendor rule packs

Move the hardcoded `BUILTIN_RULES` list out of Python into versioned YAML under
`rules/`, loaded at startup into the same `PatternRule` shape the classifier
already consumes. Classification priority is unchanged:

```
user config counterparties  >  rule packs  >  unclassified (LLM / manual)
```

Schema:

```yaml
- id: stripe-payouts
  match: { pattern: "stripe", field: both }     # field: reference | counterparty | both
  accounts: { credit: "4400", debit: "6855" }
  description: Stripe payout / fees
  examples:
    - { text: "STRIPE PAYMENTS UK LTD", direction: out, expect: "6855" }
    - { text: "Stripe Payout 2025-03",  direction: in,  expect: "4400" }
```

The `examples` block is load-bearing. The test suite is parametrized over every
example in every pack, so adding a rule adds a test automatically, and a wrong
SKR04 mapping fails CI. Review becomes mechanical: does the example look like a
real bank reference, and is the account plausible for a holding UG?

Seed pack `rules/de-common.yaml`: the vendors a German holding UG actually pays.
Banking and payments (Qonto, Finom, Stripe), infrastructure (AWS, Hetzner,
Google Workspace, Vercel), statutory (IHK, Finanzamt, Amtsgericht, Notar,
Handelsregister), advisory (Steuerberater, Rechtsanwalt patterns).

`ClassifiedTransaction.source` changes from `"rule"` to
`"rule:de-common/stripe-payouts"` so the review page can show which rule fired
and offer a "this is wrong" action. That signal feeds the correction loop below.

### 2. Bank import profiles

The pleasant surprise: `parse_csv()` already takes `column_map`, `delimiter`,
`encoding` and `skip_rows`, and already sniffs delimiters, tries five encodings
and handles German decimal format. A bank profile is therefore **just a preset
for arguments that already exist**, plus detection. Very little new machinery.

```yaml
id: qonto
name: Qonto
detect:
  headers_include: ["Settlement date", "Counterparty name"]
column_map:
  date: "Settlement date"
  amount: "Amount"
  counterparty: "Counterparty name"
  reference: "Reference"
  direction: null            # infer from sign
date_formats: ["%Y-%m-%d"]
fixture: tests/fixtures/banks/qonto_sample.csv
```

`parse_csv` gains a detection step: read the header row, match against profiles,
apply the matching one, fall back to the current generic behaviour. Each profile
ships a small anonymised fixture, and the test suite asserts that the fixture
parses into the expected transaction count, dates, signs and amounts.

Target profiles: Qonto, Finom, N26 Business, Holvi, Commerzbank, Sparkasse
(the current default, made explicit rather than implicit).

### 3. Validation layer

A tax tool's only real feature is being right, and we cannot accept rule packs
from strangers without a safety net. After statement generation, assert:

- the Bilanz balances (Aktiva == Passiva)
- the GuV ties to the Jahresüberschuss carried into the Bilanz
- every booked account exists in the SKR04 catalogue
- the generated E-Bilanz XBRL validates against the taxonomy
- no transaction is silently dropped between parse and journal

Surfaced in the UI as a short "checks passed" panel listing what was verified,
and run in CI over the fixture corpus as golden-file tests.

## Data flow

```
bank export ──> profile detection ──> parse_csv / camt053 parser
                                            │
                                            ▼
                              rule packs ──> classifier ──> unclassified?
                                            │                    │
                                            │                    ▼
                                            │              LLM fallback / manual
                                            │                    │
                                            ▼                    ▼
                                        bookkeeper <── correction captured
                                            │
                                            ▼
                                 Bilanz + GuV + XBRL
                                            │
                                            ▼
                                    validation layer
                                            │
                                            ▼
                                 export / ELSTER submission
```

## The correction loop

`TODOS.md` already carries "export LLM corrections as YAML counterparty rules".
This design generalises it: when a user overrides a classification, offer to
export the correction as a **rule-pack entry**, pre-formatted with an example
block derived from the real transaction text (with amounts and account numbers
stripped). The user can paste it into a pull request.

That turns every user's manual work into a contribution, and it is why rule
packs beat a bigger hardcoded list: the tool gets better without the maintainer
doing the work.

## Error handling

- **Unknown bank format**: fall back to the generic CSV path, and tell the user
  which columns were detected so they can map manually. Never fail silently.
- **Rule conflict** (two rules match one transaction): first match wins by pack
  order, user config always overrides. Surface the conflict in `--verbose` and
  fail CI if two rules in the same pack have overlapping examples.
- **Bad rule contribution**: caught by the example tests before merge.
- **Validation failure**: block export and show which check failed with the
  offending accounts. A wrong filing is worse than no filing.

## Testing

| Layer | Test |
| --- | --- |
| Rule packs | parametrized over every `examples` entry in every pack |
| Bank profiles | each profile parses its fixture to expected transactions |
| Validation | golden-file tests over the fixture corpus |
| Regression | existing 61 pytest + 71 vitest tests stay green |

## Deliberately not building (YAGNI)

- **Direct bank API connections (Qonto, Finom).** Considered and rejected. It
  breaks the "nothing leaves your machine" property that makes a stranger
  willing to use a tax tool; it requires accounts, a backend and secret storage,
  which are anti-features for this project; and aggregating bank data under PSD2
  requires an AISP licence or a licensed aggregator. All that to save roughly
  two minutes, once a year, on an annual workflow. Bank *profiles* deliver the
  felt benefit ("it works with my bank") at a fraction of the cost. If a real
  connection is ever wanted, the only acceptable shape is self-host-only and
  opt-in, with the user supplying their own API key.
- **Accounts and payments.** The Supabase auth on `main` stays dormant.
- **Review-table pagination, Sentry.** Already deferred in `TODOS.md` behind
  usage triggers that have not fired.

## Sequencing

1. Bank profiles. Highest immediate user impact: fixes total import failure for
   non-Sparkasse users.
2. Validation layer. Must land before outside rule contributions.
3. Rule packs plus the seed pack.
4. Correction loop plus `CONTRIBUTING.md` documenting both one-file paths.

## Open question

The four `/api/*` routes are unauthenticated and the deployment is now public.
That is worth resolving before actively promoting the repository, since a public
project undermines its own credibility if its live instance is trivially abusable.
