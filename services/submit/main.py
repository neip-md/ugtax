"""
ERiC sidecar — FastAPI wrapper around the ERiC C library.

Two endpoints in active use:
  - /validate  → no cert, runs ERiC plausibility checks, returns parsed issues.
                 This is the v1 critical path: UGtax users hit this so they can
                 download a pre-validated XBRL and submit it via the ELSTER portal
                 themselves. No certificate ever leaves the user's machine.
  - /submit    → cert required, transmits to Finanzamt. v2 only. Cert is streamed
                 to a tmpfs path, used immediately, unlinked in finally.

Deploy on a VPS with ERiC installed (not Vercel — needs the native C library).

Run locally:
    pip install fastapi uvicorn python-multipart
    ERIC_PATH=$PWD/eric/lib uvicorn services.submit.main:app --host 0.0.0.0 --port 8000

Auth:
    Set SHARED_BEARER_TOKEN in the env. All non-/health endpoints require
    Authorization: Bearer <token>. The Vercel API route holds the same token.
"""

from __future__ import annotations

import os
import secrets
import sys
import tempfile
from pathlib import Path

from fastapi import FastAPI, File, Form, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Add the project src to path for ug_steuer imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent / "src"))

from ug_steuer.eric import (  # noqa: E402
    DatenartVersion,
    EricError,
    EricNotFoundError,
    EricWrapper,
    ValidationIssue,
    datenart_for_ebilanz,
)
from ug_steuer.enrichment import IssueEnricher  # noqa: E402

# Process-wide enrichment singleton. Loaded once at startup, reused per request.
_ENRICHER = IssueEnricher(
    feldkennung_map_path=Path(os.environ.get(
        "FELDKENNUNG_MAP",
        str(Path(__file__).parent / "feldkennung_map.json"),
    )),
    error_translations_path=Path(os.environ.get(
        "ERROR_TRANSLATIONS",
        str(Path(__file__).parent / "error_translations.json"),
    )),
    queue_path=Path(os.environ.get(
        "UNKNOWN_ERROR_QUEUE",
        str(Path(__file__).parent / "unknown_errors.jsonl"),
    )),
)
_ENRICHER.load()

app = FastAPI(
    title="UGtax — ERiC Sidecar",
    description="Validate (v1) and submit (v2) German tax filings via ERiC",
    version="0.2.0",
)

# CORS — restrict in production
app.add_middleware(
    CORSMiddleware,
    # Origin list stays as tightened on main (PR #10): the sweet-gates.vercel.app
    # preview domain was deliberately removed and is not reinstated here.
    # GET is allowed because /health is a GET endpoint.
    allow_origins=os.environ.get("CORS_ORIGINS", "https://ugtax.de,https://www.ugtax.de").split(","),
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)

ERIC_PATH = os.environ.get("ERIC_PATH")
SHARED_BEARER_TOKEN = os.environ.get("SHARED_BEARER_TOKEN", "")
ALLOW_PRODUCTION_SEND = os.environ.get("ERIC_PRODUCTION", "").lower() == "true"


def _require_auth(authorization: str | None) -> None:
    """Check the Authorization header against the shared bearer token.

    Constant-time comparison. If no token is configured server-side, auth
    is disabled (dev mode) — log a warning at startup instead.
    """
    if not SHARED_BEARER_TOKEN:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    provided = authorization[len("Bearer "):]
    if not secrets.compare_digest(provided, SHARED_BEARER_TOKEN):
        raise HTTPException(status_code=401, detail="Invalid bearer token")


class IssueDTO(BaseModel):
    severity: str
    code: str = ""
    feldkennung: str = ""
    message_de: str = ""
    field_label: str = ""
    human_message: str = ""

    @classmethod
    def from_issue(cls, issue: ValidationIssue) -> "IssueDTO":
        return cls(**issue.to_dict())


class ValidateResponse(BaseModel):
    valid: bool
    return_code: int
    message: str = ""
    issues: list[IssueDTO] = []
    error_count: int = 0
    warning_count: int = 0


class SubmitResponse(BaseModel):
    success: bool
    transfer_ticket: str = ""
    message: str = ""
    issues: list[IssueDTO] = []


def _resolve_datenart(
    datenart_version: str | None,
    filing_year: int | None,
) -> str:
    """Resolve the datenartVersion. Explicit > filing_year > default."""
    if datenart_version:
        return datenart_version
    if filing_year:
        return datenart_for_ebilanz(filing_year)
    return DatenartVersion.BILANZ_6_9


@app.post("/validate", response_model=ValidateResponse)
async def validate(
    xbrl_file: UploadFile = File(..., description="XBRL/XML to validate"),
    datenart_version: str | None = Form(None, description="ERiC datenartVersion override"),
    filing_year: int | None = Form(None, description="Filing year (auto-picks taxonomy)"),
    authorization: str | None = Header(None),
) -> ValidateResponse:
    """Validate an XBRL/XML file against ERiC plausibility rules.

    No certificate. Returns the parsed Hinweise/Fehler so the frontend can
    render them inline next to the broken fields. This is the v1 critical
    path — every UGtax user hits it.
    """
    _require_auth(authorization)
    xbrl_data = await xbrl_file.read()
    datenart = _resolve_datenart(datenart_version, filing_year)

    try:
        with EricWrapper(eric_path=ERIC_PATH) as eric:
            if not eric.datenart_supported(datenart):
                raise HTTPException(
                    status_code=400,
                    detail=f"datenartVersion {datenart!r} is not supported by the loaded ERiC plugins. "
                    "Check that the matching Vordrucke package is staged.",
                )
            result = eric.validate(xbrl_data, datenart_version=datenart)

        _ENRICHER.enrich(result.issues, datenart)
        issues = [IssueDTO.from_issue(i) for i in result.issues]
        errors = [i for i in issues if i.severity == "error"]
        warnings = [i for i in issues if i.severity in ("warning", "info")]

        valid = result.return_code == 0 and not errors
        return ValidateResponse(
            valid=valid,
            return_code=result.return_code,
            message="Validation passed" if valid else "Validation failed",
            issues=issues,
            error_count=len(errors),
            warning_count=len(warnings),
        )

    except EricNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except EricError as e:
        return ValidateResponse(
            valid=False,
            return_code=e.code,
            message=str(e),
            issues=[IssueDTO(severity="error", code=str(e.code), message_de=e.message)],
            error_count=1,
        )


@app.post("/submit", response_model=SubmitResponse)
async def submit(
    xbrl_file: UploadFile = File(..., description="XBRL/XML to submit"),
    certificate: UploadFile = File(..., description="ELSTER certificate (.pfx)"),
    password: str = Form(..., description="Certificate password"),
    datenart_version: str | None = Form(None),
    filing_year: int | None = Form(None),
    authorization: str | None = Header(None),
) -> SubmitResponse:
    """Submit an XBRL/XML file to the Finanzamt. v2 only.

    The certificate is written to a tmpfs path, opened by ERiC, then
    unlinked in the finally block. Never persisted, never logged.

    Production transmission is gated by the ERIC_PRODUCTION env var. If
    that's not set, submissions go to the ERiC test environment via
    Testmerker (TODO: wire Testmerker flag).
    """
    _require_auth(authorization)

    if not ALLOW_PRODUCTION_SEND:
        # Belt-and-suspenders: refuse to send to real Finanzamt unless explicitly enabled.
        # TODO: when Testmerker is wired, route to test env here instead of refusing.
        raise HTTPException(
            status_code=503,
            detail="Production submission is disabled. Set ERIC_PRODUCTION=true on the sidecar to enable.",
        )

    xbrl_data = await xbrl_file.read()
    datenart = _resolve_datenart(datenart_version, filing_year)

    # Use tmpfs if available so the cert never touches a real disk
    tmp_dir = "/dev/shm" if Path("/dev/shm").is_dir() else None
    cert_tmp = tempfile.NamedTemporaryFile(suffix=".pfx", delete=False, dir=tmp_dir)
    try:
        cert_data = await certificate.read()
        cert_tmp.write(cert_data)
        cert_tmp.close()

        with EricWrapper(eric_path=ERIC_PATH) as eric:
            result = eric.send(
                xbrl_data,
                cert_path=cert_tmp.name,
                cert_password=password,
                datenart_version=datenart,
            )

        _ENRICHER.enrich(result.issues, datenart)
        issues = [IssueDTO.from_issue(i) for i in result.issues]

        if result.success:
            return SubmitResponse(
                success=True,
                transfer_ticket=result.transfer_ticket,
                message="Filing erfolgreich übermittelt.",
                issues=issues,
            )
        return SubmitResponse(
            success=False,
            message="Übermittlung fehlgeschlagen.",
            issues=issues,
        )

    except EricNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except EricError as e:
        return SubmitResponse(
            success=False,
            message=str(e),
            issues=[IssueDTO(severity="error", code=str(e.code), message_de=e.message)],
        )
    finally:
        try:
            os.unlink(cert_tmp.name)
        except FileNotFoundError:
            pass


@app.get("/health")
async def health():
    """Health check — also verifies ERiC is available."""
    try:
        _find = EricWrapper(eric_path=ERIC_PATH)
        return {
            "status": "ok",
            "eric": "found",
            "eric_path": _find._lib_path,
            "production_send": ALLOW_PRODUCTION_SEND,
        }
    except EricNotFoundError:
        return {
            "status": "degraded",
            "eric": "not_found",
            "message": "ERiC library not installed — see eric/README.md",
        }
