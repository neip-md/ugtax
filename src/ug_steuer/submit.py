"""High-level submission logic for German tax filings via ERiC.

Thin wrapper around EricWrapper that loads XBRL/XML from disk, picks the
right datenartVersion for the filing year, and returns a SubmissionResult
that contains both the legacy fields (transfer_ticket, warnings) and the
new structured `issues` list parsed from ERiC's server response.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from .eric import (
    DatenartVersion,
    EricError,
    EricNotFoundError,
    EricWrapper,
    ValidationIssue,
    datenart_for_ebilanz,
)


@dataclass
class SubmissionResult:
    """Result of a validate or submit attempt."""
    success: bool
    transfer_ticket: str = ""
    message: str = ""
    server_response: str = ""
    issues: list[ValidationIssue] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def hinweise(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity in ("warning", "info")]


def validate_ebilanz(
    xbrl_path: str | Path,
    eric_path: str | None = None,
    filing_year: int | None = None,
    datenart_version: str | None = None,
) -> SubmissionResult:
    """Validate an E-Bilanz XBRL file using ERiC (no submission).

    Pass either `filing_year` (preferred — picks the right taxonomy version
    automatically) or `datenart_version` (explicit override). If neither is
    given, defaults to the latest E-Bilanz taxonomy.
    """
    xbrl_path = Path(xbrl_path)
    if not xbrl_path.exists():
        return SubmissionResult(
            success=False,
            message=f"XBRL file not found: {xbrl_path}",
        )

    xbrl_data = xbrl_path.read_text(encoding="utf-8")
    datenart = datenart_version or (
        datenart_for_ebilanz(filing_year) if filing_year else DatenartVersion.BILANZ_6_9
    )

    try:
        with EricWrapper(eric_path=eric_path) as eric:
            result = eric.validate(xbrl_data, datenart_version=datenart)

            return SubmissionResult(
                success=result.success and not result.errors,
                message="Validation passed" if result.success and not result.errors else "Validation failed",
                server_response=result.server_response,
                issues=result.issues,
                warnings=result.warnings,
            )
    except EricNotFoundError as e:
        return SubmissionResult(success=False, message=str(e))
    except EricError as e:
        return SubmissionResult(success=False, message=str(e), warnings=[e.message])


def submit_ebilanz(
    xbrl_path: str | Path,
    cert_path: str | Path,
    cert_password: str,
    eric_path: str | None = None,
    filing_year: int | None = None,
    datenart_version: str | None = None,
) -> SubmissionResult:
    """Submit an E-Bilanz XBRL file to the Finanzamt via ERiC.

    Validates the XBRL first (ERiC always does this server-side); if
    validation fails the submission is rejected and the parsed issues
    are returned.
    """
    xbrl_path = Path(xbrl_path)
    cert_path = Path(cert_path)

    if not xbrl_path.exists():
        return SubmissionResult(
            success=False,
            message=f"XBRL file not found: {xbrl_path}",
        )

    if not cert_path.exists():
        return SubmissionResult(
            success=False,
            message=f"Certificate file not found: {cert_path}",
        )

    xbrl_data = xbrl_path.read_text(encoding="utf-8")
    datenart = datenart_version or (
        datenart_for_ebilanz(filing_year) if filing_year else DatenartVersion.BILANZ_6_9
    )

    try:
        with EricWrapper(eric_path=eric_path) as eric:
            result = eric.send(
                xbrl_data,
                cert_path=str(cert_path),
                cert_password=cert_password,
                datenart_version=datenart,
            )

            # Same gate as validate_ebilanz. The two used to diverge: validate
            # required `result.success and not result.errors` while submit
            # checked only `result.success`, so a response carrying
            # error-severity issues was reported as a clean, legally binding
            # submission by one path and as a failure by the other.
            if result.success and not result.errors:
                return SubmissionResult(
                    success=True,
                    transfer_ticket=result.transfer_ticket,
                    message=f"E-Bilanz erfolgreich übermittelt. Transfer-Ticket: {result.transfer_ticket}",
                    server_response=result.server_response,
                    issues=result.issues,
                    warnings=result.warnings,
                )
            elif result.success and result.errors:
                # ERiC accepted the transmission but reported errors. Do not
                # call that a success, and do not hide the transfer ticket:
                # without it the user cannot tell whether a resubmission would
                # be a duplicate filing.
                return SubmissionResult(
                    success=False,
                    transfer_ticket=result.transfer_ticket,
                    message=(
                        "Übermittlung wurde angenommen, ERiC meldet jedoch "
                        f"{len(result.errors)} Fehler. Transfer-Ticket: "
                        f"{result.transfer_ticket or '(keins)'}. "
                        "Fehler prüfen, bevor erneut übermittelt wird, um eine "
                        "Doppeleinreichung zu vermeiden."
                    ),
                    server_response=result.server_response,
                    issues=result.issues,
                    warnings=result.warnings,
                )
            else:
                return SubmissionResult(
                    success=False,
                    message="Übermittlung fehlgeschlagen",
                    server_response=result.server_response,
                    issues=result.issues,
                    warnings=result.warnings,
                )

    except EricNotFoundError as e:
        return SubmissionResult(success=False, message=str(e))
    except EricError as e:
        return SubmissionResult(success=False, message=str(e), warnings=[e.message])
