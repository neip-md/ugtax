"""CLI entry point for UG Steuertool."""

from __future__ import annotations

from pathlib import Path

import typer

from . import __version__

app = typer.Typer(
    name="ug-steuer",
    help="German UG (haftungsbeschränkt) tax filing tool — bank export to Bilanz, GuV, and filing guide.",
    no_args_is_help=True,
)


def _version_callback(value: bool) -> None:
    if value:
        typer.echo(f"ug-steuer {__version__}")
        raise typer.Exit()


@app.callback()
def main(
    version: bool = typer.Option(
        False, "--version", "-V", callback=_version_callback, is_eager=True,
        help="Show version and exit.",
    ),
) -> None:
    pass


def _parse_bank_export(
    bank_export: Path,
    year: int,
    config_file: Path | None = None,
):
    """Parse bank export, auto-detecting format (camt.053 XML or CSV)."""
    from decimal import Decimal

    suffix = bank_export.suffix.lower()

    if suffix in (".xml",):
        from .parser import parse_camt053, validate_balance
        transactions, opening, closing = parse_camt053(bank_export, fiscal_year=year)
        typer.echo(f"  Format: camt.053 XML")
        typer.echo(f"  {len(transactions)} transactions found for {year}")
        typer.echo(f"  Opening balance: {opening:,.2f} €")
        typer.echo(f"  Closing balance: {closing:,.2f} €")
        if not validate_balance(transactions, opening, closing):
            typer.echo("  WARNING: Balance validation failed.", err=True)
        return transactions

    elif suffix in (".csv", ".tsv"):
        from .csv_parser import parse_csv

        # Load column mapping from config if available
        column_map = None
        skip_rows = 0
        if config_file:
            import yaml
            with open(config_file) as f:
                raw = yaml.safe_load(f) or {}
            csv_config = raw.get("csv", {})
            if csv_config:
                column_map = {
                    k: v for k, v in csv_config.get("columns", {}).items() if v
                }
                skip_rows = csv_config.get("skip_rows", 0)

        delimiter = "\t" if suffix == ".tsv" else None
        transactions = parse_csv(
            bank_export,
            column_map=column_map,
            fiscal_year=year,
            delimiter=delimiter,
            skip_rows=skip_rows,
        )
        typer.echo(f"  Format: CSV")
        typer.echo(f"  {len(transactions)} transactions found for {year}")
        return transactions

    else:
        typer.echo(f"Unsupported file format: {suffix}. Use .xml (camt.053) or .csv.", err=True)
        raise typer.Exit(1)


@app.command()
def process(
    bank_export: Path = typer.Option(..., "--bank-export", "-b", help="Path to bank export (camt.053 XML or CSV)."),
    config_file: Path = typer.Option(..., "--config", "-c", help="Path to YAML config file."),
    year: int = typer.Option(..., "--year", "-y", help="Fiscal year to process."),
    output: Path = typer.Option("./output", "--output", "-o", help="Output directory."),
    review_file: Path | None = typer.Option(None, "--review", "-r", help="Path to filled-in classification review file."),
    xbrl: bool = typer.Option(False, "--xbrl", help="Generate XBRL E-Bilanz file."),
) -> None:
    """Full pipeline: parse → classify → book → statements → guide → export."""
    from .bookkeeper import generate_journal
    from .classifier import (
        classify_transactions,
        load_review_file,
        write_review_file,
    )
    from .config import Config
    from .excel import export_journal, export_statements
    from .guide import generate_filing_guide
    from .statements import generate_statements

    # Load config
    config = Config.from_yaml(config_file)
    config.company.geschaeftsjahr = year

    # Parse bank export
    typer.echo(f"Parsing {bank_export}...")
    transactions = _parse_bank_export(bank_export, year, config_file)

    # Classify
    typer.echo("Classifying transactions...")
    result = classify_transactions(transactions, config)
    typer.echo(f"  {len(result.classified)} classified, {len(result.unclassified)} unclassified")

    # Handle review file for previously unclassified transactions
    if review_file and review_file.exists():
        typer.echo(f"Loading review file {review_file}...")
        review = load_review_file(review_file, transactions)
        manual = review.matched
        result.classified.extend(manual)
        manual_refs = {(ct.transaction.date, ct.transaction.amount, ct.transaction.counterparty) for ct in manual}
        result.unclassified = [
            tx for tx in result.unclassified
            if (tx.date, tx.amount, tx.counterparty) not in manual_refs
        ]
        typer.echo(f"  {len(manual)} transactions loaded from review file")
        # Entries carrying an account that matched nothing used to vanish in
        # silence, so a transaction the user had classified never reached the
        # journal and the Bilanz came out short with no warning anywhere.
        if review.unmatched:
            plural = "y" if len(review.unmatched) == 1 else "ies"
            typer.secho(
                f"  WARNING: {len(review.unmatched)} review entr{plural} matched no "
                "transaction and will NOT be booked:",
                fg=typer.colors.RED,
                err=True,
            )
            for entry in review.unmatched:
                typer.secho(
                    f"    {entry.get('date')}  {entry.get('amount')}  "
                    f"{entry.get('counterparty')!r}",
                    fg=typer.colors.RED,
                    err=True,
                )
            typer.secho(
                "  Date, amount and counterparty must match the bank export exactly.",
                fg=typer.colors.RED,
                err=True,
            )

    # Write review file if there are unclassified transactions
    output.mkdir(parents=True, exist_ok=True)
    if result.unclassified:
        review_path = output / "classification_review.yaml"
        write_review_file(result.unclassified, review_path)
        typer.echo(f"\n  {len(result.unclassified)} transactions could not be classified.")
        typer.echo(f"  Review file written to: {review_path}")
        typer.echo(f"  Fill in the 'account' field for each transaction, then re-run with --review {review_path}")
        raise typer.Exit(1)

    # Generate journal
    typer.echo("Generating Buchungsjournal...")
    journal = generate_journal(result.classified)
    typer.echo(f"  {len(journal)} journal entries")

    # Generate statements
    typer.echo("Computing Bilanz + GuV...")
    statements = generate_statements(journal, config)

    if statements.warnings:
        typer.echo("\nWarnungen:")
        for w in statements.warnings:
            typer.echo(f"  - {w}")

    bilanz = statements.bilanz
    guv = statements.guv
    typer.echo(f"\n  Aktiva:  {bilanz.summe_aktiva:>12,.2f} €")
    typer.echo(f"  Passiva: {bilanz.summe_passiva:>12,.2f} €")
    typer.echo(f"  Bilanz ausgeglichen: {'Ja' if bilanz.is_balanced else 'NEIN'}")
    typer.echo(f"  Jahresüberschuss/-fehlbetrag: {guv.jahresueberschuss:,.2f} €")

    # Export
    journal_path = output / "buchungsjournal.xlsx"
    export_journal(journal, journal_path)
    typer.echo(f"\n  Buchungsjournal: {journal_path}")

    statements_path = output / "bilanz_guv.xlsx"
    export_statements(statements, statements_path)
    typer.echo(f"  Bilanz + GuV:    {statements_path}")

    guide_path = output / "filing_guide.md"
    generate_filing_guide(statements, config, guide_path)
    typer.echo(f"  Filing Guide:    {guide_path}")

    # XBRL E-Bilanz
    if xbrl:
        from .xbrl import generate_xbrl, validate_xbrl
        xbrl_path = output / "ebilanz.xbrl"
        typer.echo("Generating E-Bilanz (XBRL)...")
        generate_xbrl(statements, config, xbrl_path)
        issues = validate_xbrl(xbrl_path)
        if issues:
            typer.echo("  XBRL validation warnings:")
            for issue in issues:
                typer.echo(f"    - {issue}")
        else:
            typer.echo(f"  E-Bilanz:        {xbrl_path}")

    typer.echo("\nDone.")


@app.command()
def classify(
    bank_export: Path = typer.Option(..., "--bank-export", "-b", help="Path to bank export (camt.053 XML or CSV)."),
    config_file: Path = typer.Option(..., "--config", "-c", help="Path to YAML config file."),
    year: int = typer.Option(..., "--year", "-y", help="Fiscal year to process."),
    output: Path = typer.Option("./output", "--output", "-o", help="Output directory."),
) -> None:
    """Parse and classify only — output classification review for user inspection."""
    from .classifier import classify_transactions, write_review_file
    from .config import Config

    config = Config.from_yaml(config_file)

    typer.echo(f"Parsing {bank_export}...")
    transactions = _parse_bank_export(bank_export, year, config_file)

    result = classify_transactions(transactions, config)
    typer.echo(f"{len(result.classified)} classified, {len(result.unclassified)} unclassified")

    output.mkdir(parents=True, exist_ok=True)

    typer.echo("\nClassified transactions:")
    for ct in result.classified:
        tx = ct.transaction
        typer.echo(f"  {tx.date}  {tx.amount:>10,.2f} €  {tx.direction.value:6s}  [{ct.account}] {ct.account_name}  ({ct.source})")

    if result.unclassified:
        review_path = output / "classification_review.yaml"
        write_review_file(result.unclassified, review_path)
        typer.echo(f"\nUnclassified transactions written to: {review_path}")
    else:
        typer.echo("\nAll transactions classified.")


@app.command()
def validate(
    bank_export: Path = typer.Option(..., "--bank-export", "-b", help="Path to bank export (camt.053 XML or CSV)."),
    config_file: Path = typer.Option(..., "--config", "-c", help="Path to YAML config file."),
    year: int = typer.Option(..., "--year", "-y", help="Fiscal year."),
) -> None:
    """Validate config and bank export without processing."""
    from .config import Config

    # Validate config
    try:
        config = Config.from_yaml(config_file)
        typer.echo(f"Config OK: {config.company.name}")
        typer.echo(f"  {len(config.counterparties)} counterparty mappings")
    except Exception as e:
        typer.echo(f"Config ERROR: {e}", err=True)
        raise typer.Exit(1)

    # Validate bank export
    try:
        typer.echo(f"Parsing {bank_export}...")
        transactions = _parse_bank_export(bank_export, year, config_file)
        typer.echo("  Bank export: OK")
    except Exception as e:
        typer.echo(f"Bank export ERROR: {e}", err=True)
        raise typer.Exit(1)

    typer.echo("\nAll validations passed.")


@app.command()
def submit(
    xbrl_file: Path = typer.Option(..., "--xbrl", "-x", help="Path to E-Bilanz XBRL file."),
    certificate: Path = typer.Option(None, "--certificate", "--cert", help="Path to ELSTER certificate (.pfx file)."),
    password: str = typer.Option(None, "--password", "-p", help="Certificate password. Can also use ELSTER_CERT_PASSWORD env var."),
    eric_path: str = typer.Option(None, "--eric-path", help="Path to ERiC library directory. Can also use ERIC_PATH env var."),
    dry_run: bool = typer.Option(False, "--dry-run", help="Validate only — do not send to Finanzamt."),
) -> None:
    """Submit E-Bilanz to the Finanzamt via ERiC."""
    import os
    from .submit import validate_ebilanz, submit_ebilanz

    if not xbrl_file.exists():
        typer.echo(f"XBRL file not found: {xbrl_file}", err=True)
        raise typer.Exit(1)

    if dry_run:
        typer.echo(f"Validating {xbrl_file} (dry run)...")
        result = validate_ebilanz(xbrl_file, eric_path=eric_path)
    else:
        # Certificate required for actual submission
        if not certificate:
            typer.echo("Certificate required for submission. Use --certificate or --dry-run.", err=True)
            raise typer.Exit(1)

        if not certificate.exists():
            typer.echo(f"Certificate file not found: {certificate}", err=True)
            raise typer.Exit(1)

        cert_password = password or os.environ.get("ELSTER_CERT_PASSWORD", "")
        if not cert_password:
            import getpass
            cert_password = getpass.getpass("ELSTER certificate password: ")

        typer.echo(f"Submitting {xbrl_file} to Finanzamt...")
        result = submit_ebilanz(xbrl_file, certificate, cert_password, eric_path=eric_path)

    # Output result
    if result.success:
        typer.echo(f"\n  {result.message}")
        if result.transfer_ticket:
            typer.echo(f"  Transfer-Ticket: {result.transfer_ticket}")
            typer.echo("  Bewahren Sie das Transfer-Ticket als Nachweis auf.")
    else:
        typer.echo(f"\n  FEHLER: {result.message}", err=True)

    if result.warnings:
        typer.echo("\n  Warnungen:")
        for w in result.warnings:
            typer.echo(f"    - {w}")

    if result.server_response:
        typer.echo(f"\n  Server-Antwort gespeichert.")

    if not result.success:
        raise typer.Exit(1)

    typer.echo("\nDone.")
