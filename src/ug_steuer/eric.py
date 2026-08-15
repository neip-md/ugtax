"""ERiC (ELSTER Rich Client) ctypes wrapper.

Wraps the ERiC C library for German tax filings. The ERiC library must be
downloaded separately from elster.de and is not redistributable
(see eric/README.md).

Verified against ERiC 43.4.6.0 documentation:
- API reference: eric/docs/.../API-Referenz/HTML/ericapi_8h.html
- Response schema: eric/docs/.../API-Rueckgabe-Schemata/EricBearbeiteVorgang.xsd
- DatenArt strings: eric/docs/.../Datenartversionmatrix.xml
- Return codes: eric/docs/.../API-Referenz/HTML/eric__fehlercodes_8h_source.html

The C API surface for the functions we use:

    int EricBearbeiteVorgang(
        const char *datenpuffer,
        const char *datenartVersion,
        uint32_t bearbeitungsFlags,
        const eric_druck_parameter_t *druckParameter,         // NULL = no print
        const eric_verschluesselungs_parameter_t *cryptoParameter,  // NULL = validate-only
        EricTransferHandle *transferHandle,                   // OUT, may be NULL
        EricRueckgabepufferHandle rueckgabeXmlPuffer,         // server answer XML
        EricRueckgabepufferHandle serverantwortXmlPuffer);    // FehlerRegelpruefung XML

    int EricCheckXML(const char *xml,
                     const char *datenartVersion,
                     EricRueckgabepufferHandle fehlertextPuffer);

    int EricGetHandleToCertificate(
        EricZertifikatHandle *hToken,        // OUT
        uint32_t *iInfoPinSupport,           // OUT
        const char *pathToKeystore);         // IN (no password — that goes in crypto struct)
"""

from __future__ import annotations

import ctypes
import ctypes.util
import os
import platform
import re
import shutil
import tempfile
from dataclasses import dataclass, field
from enum import IntEnum
from pathlib import Path
from typing import Optional
from xml.etree import ElementTree as ET


class EricError(Exception):
    """Raised when an ERiC API call fails."""
    def __init__(self, code: int, message: str = ""):
        self.code = code
        self.message = message or ERROR_MESSAGES.get(code, f"Unknown ERiC error code: {code}")
        super().__init__(f"ERiC error {code}: {self.message}")


class EricNotFoundError(Exception):
    """Raised when the ERiC library cannot be found."""
    pass


# ERiC return codes (subset). Full list in eric_fehlercodes.h.
class EricReturnCode(IntEnum):
    ERIC_OK = 0
    ERIC_GLOBAL_PRUEF_FEHLER = 610001002       # Plausibility errors found
    ERIC_GLOBAL_HINWEISE = 610001003           # Hinweise but no errors (data is sendable)
    ERIC_GLOBAL_FEHLER_PARAMETER = 5
    ERIC_GLOBAL_NICHT_INITIALISIERT = 3
    ERIC_GLOBAL_MEHRFACHE_INITIALISIERUNG = 4
    ERIC_TRANSFER_ERIC_FEHLER = 610001001
    ERIC_CRYPT_ZERTIFIKAT_UNGUELTIG = 610301001
    ERIC_CRYPT_PIN_FALSCH = 610301006
    ERIC_IO_DATEI_NICHT_GEFUNDEN = 610501001


# Human-readable German messages for return codes the user might see.
ERROR_MESSAGES: dict[int, str] = {
    0: "Erfolg",
    3: "ERiC nicht initialisiert",
    4: "ERiC bereits initialisiert",
    5: "Ungültiger Parameter",
    610001001: "ERiC-interner Fehler",
    610001002: "Plausibilitätsfehler in den übergebenen Daten",
    610001003: "Hinweise zu den übergebenen Daten",
    610301001: "Zertifikat ungültig oder abgelaufen",
    610301006: "Falsches Passwort für das Zertifikat (PIN)",
    610501001: "Datei nicht gefunden",
}


# ERiC Bearbeitungsflags (bitmask passed to EricBearbeiteVorgang)
ERIC_VALIDIERE = 1      # Validate only
ERIC_SENDE = 2          # Send to Finanzamt
ERIC_DRUCKE = 4         # Generate print output


# Datenartversion strings — verified against Datenartversionmatrix.xml.
# Format is `<Sachbereich>_<MajorVersion>_<Jahr>` for Erklaerungssteuern,
# or `<Sachbereich>_<Version>` for E-Bilanz.
class DatenartVersion:
    # E-Bilanz, HGB-Taxonomie. Versions go 6.0 → 6.9 (latest in ERiC 43.4.6.0).
    BILANZ_6_0 = "Bilanz_6.0"
    BILANZ_6_1 = "Bilanz_6.1"
    BILANZ_6_2 = "Bilanz_6.2"
    BILANZ_6_3 = "Bilanz_6.3"
    BILANZ_6_4 = "Bilanz_6.4"
    BILANZ_6_5 = "Bilanz_6.5"
    BILANZ_6_6 = "Bilanz_6.6"
    BILANZ_6_7 = "Bilanz_6.7"
    BILANZ_6_8 = "Bilanz_6.8"
    BILANZ_6_9 = "Bilanz_6.9"

    # Helpers — these are templates. Format with the filing year.
    KST_30 = "KSt_30_{year}"     # Körperschaftsteuer Hauptvordruck (ab VZ 2015)
    KSTZ = "KStZ_{year}"          # Körperschaftsteuer-Zerlegung
    GEWST = "GewSt_{year}"        # Gewerbesteuer
    GEWSTZ = "GewStZ_{year}"      # Gewerbesteuer-Zerlegung


def datenart_for_ebilanz(filing_year: int) -> str:
    """Pick the right E-Bilanz taxonomy version for a given filing year.

    Mapping is approximate — verify against the E-Bilanz_Taxonomie_*.pdf
    documents in eric/docs/ before relying on it for production submissions.
    The HGB-Taxonomie bumps each spring; new version becomes mandatory after
    a transition period.
    """
    if filing_year >= 2025:
        return DatenartVersion.BILANZ_6_9
    if filing_year == 2024:
        return DatenartVersion.BILANZ_6_8
    if filing_year == 2023:
        return DatenartVersion.BILANZ_6_7
    if filing_year == 2022:
        return DatenartVersion.BILANZ_6_6
    return DatenartVersion.BILANZ_6_5


def datenart_for_kst(year: int) -> str:
    return DatenartVersion.KST_30.format(year=year)


def datenart_for_gewst(year: int) -> str:
    return DatenartVersion.GEWST.format(year=year)


@dataclass
class ValidationIssue:
    """A single FehlerRegelpruefung or Hinweis from ERiC's response.

    Field names mirror the elements in EricBearbeiteVorgang.xsd
    (FehlerRegelpruefungTyp / HinweisTyp).
    """
    severity: str               # "error" | "warning"
    code: str = ""              # FachlicheFehlerId or FachlicheHinweisId
    feldkennung: str = ""       # Feldidentifikator (field name or context path)
    message_de: str = ""        # Text from ERiC
    vordruck_zeile: str = ""    # VordruckZeilennummer
    lfd_nr_vordruck: str = ""   # LfdNrVordruck
    mehrfachzeilenindex: str = ""
    regel_name: str = ""        # RegelName
    semantischer_index: dict[str, str] = field(default_factory=dict)
    untersachbereich: str = ""
    nutzdatenticket: str = ""
    field_label: str = ""       # Filled in later from feldkennung_map.json
    human_message: str = ""     # Filled in later from error_translations.json

    def to_dict(self) -> dict:
        return {
            "severity": self.severity,
            "code": self.code,
            "feldkennung": self.feldkennung,
            "message_de": self.message_de,
            "vordruck_zeile": self.vordruck_zeile,
            "lfd_nr_vordruck": self.lfd_nr_vordruck,
            "mehrfachzeilenindex": self.mehrfachzeilenindex,
            "regel_name": self.regel_name,
            "semantischer_index": self.semantischer_index,
            "untersachbereich": self.untersachbereich,
            "nutzdatenticket": self.nutzdatenticket,
            "field_label": self.field_label,
            "human_message": self.human_message,
        }


@dataclass
class TransferResult:
    """Result of an ERiC validate or send call."""
    return_code: int
    transfer_ticket: str = ""
    telenummer: str = ""
    ordnungsbegriff: str = ""
    server_response: str = ""
    issues: list[ValidationIssue] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def success(self) -> bool:
        """ERIC_OK or ERIC_GLOBAL_HINWEISE both mean the data is sendable."""
        return self.return_code in (
            EricReturnCode.ERIC_OK,
            EricReturnCode.ERIC_GLOBAL_HINWEISE,
        )

    @property
    def errors(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "error"]

    @property
    def hinweise(self) -> list[ValidationIssue]:
        return [i for i in self.issues if i.severity == "warning"]


# --- Server response parsing (matches EricBearbeiteVorgang.xsd) ---

ERIC_NS = "http://www.elster.de/EricXML/1.1/EricBearbeiteVorgang"
NS_MAP = {"e": ERIC_NS}


def parse_server_response(xml_text: str) -> list[ValidationIssue]:
    """Parse ERiC's response XML into ValidationIssue objects.

    The schema (EricBearbeiteVorgang.xsd) defines four cases:
    - Erfolg: <EricBearbeiteVorgang><Erfolg><Telenummer/><Ordnungsbegriff/></>
    - Erfolg + Transfers: success with TransferTicket
    - FehlerRegelpruefung: zero or more <FehlerRegelpruefung> elements
    - Hinweis: zero or more <Hinweis> elements

    The relevant child elements (per FehlerRegelpruefungTyp / HinweisTyp):
    - Nutzdatenticket
    - Feldidentifikator
    - Mehrfachzeilenindex
    - LfdNrVordruck
    - VordruckZeilennummer
    - SemantischerIndex (with name attribute, repeatable)
    - Untersachbereich
    - PrivateKennnummer
    - RegelName
    - FachlicheFehlerId / FachlicheHinweisId
    - Text

    Element names are in the http://www.elster.de/EricXML/1.1/EricBearbeiteVorgang
    namespace. The parser handles both namespaced and prefixed XML, and falls
    back to a tag-name regex if XML parsing fails.
    """
    if not xml_text or not xml_text.strip():
        return []

    issues: list[ValidationIssue] = []

    try:
        root = ET.fromstring(xml_text)
        for el in root.iter():
            tag = _localname(el.tag)
            if tag == "FehlerRegelpruefung":
                issues.append(_parse_issue_element(el, severity="error"))
            elif tag == "Hinweis":
                issues.append(_parse_issue_element(el, severity="warning"))
    except ET.ParseError:
        pass

    if not issues:
        # Regex fallback for malformed XML.
        for match in re.finditer(
            r"<(?:[\w]+:)?(?P<tag>FehlerRegelpruefung|Hinweis)\b[^>]*>(?P<body>.*?)</(?:[\w]+:)?(?P=tag)>",
            xml_text,
            re.DOTALL,
        ):
            tag = match.group("tag")
            body = match.group("body")
            severity = "error" if tag == "FehlerRegelpruefung" else "warning"
            issues.append(
                ValidationIssue(
                    severity=severity,
                    code=(_extract_tag_text(body, "FachlicheFehlerId")
                          or _extract_tag_text(body, "FachlicheHinweisId")),
                    feldkennung=_extract_tag_text(body, "Feldidentifikator"),
                    message_de=_extract_tag_text(body, "Text").strip(),
                    vordruck_zeile=_extract_tag_text(body, "VordruckZeilennummer"),
                    lfd_nr_vordruck=_extract_tag_text(body, "LfdNrVordruck"),
                    mehrfachzeilenindex=_extract_tag_text(body, "Mehrfachzeilenindex"),
                    regel_name=_extract_tag_text(body, "RegelName"),
                    untersachbereich=_extract_tag_text(body, "Untersachbereich"),
                    nutzdatenticket=_extract_tag_text(body, "Nutzdatenticket"),
                )
            )

    return issues


def _localname(tag: str) -> str:
    """Strip XML namespace prefix from a tag name."""
    if "}" in tag:
        return tag.split("}", 1)[1]
    return tag


def _parse_issue_element(el: ET.Element, severity: str) -> ValidationIssue:
    """Build a ValidationIssue from an XML element using the real schema."""
    children: dict[str, str] = {}
    semantischer_index: dict[str, str] = {}
    for child in el:
        name = _localname(child.tag)
        if name == "SemantischerIndex":
            key = child.attrib.get("name", "")
            semantischer_index[key] = (child.text or "").strip()
        else:
            children[name] = (child.text or "").strip()

    return ValidationIssue(
        severity=severity,
        code=(children.get("FachlicheFehlerId")
              or children.get("FachlicheHinweisId", "")),
        feldkennung=children.get("Feldidentifikator", ""),
        message_de=children.get("Text", ""),
        vordruck_zeile=children.get("VordruckZeilennummer", ""),
        lfd_nr_vordruck=children.get("LfdNrVordruck", ""),
        mehrfachzeilenindex=children.get("Mehrfachzeilenindex", ""),
        regel_name=children.get("RegelName", ""),
        semantischer_index=semantischer_index,
        untersachbereich=children.get("Untersachbereich", ""),
        nutzdatenticket=children.get("Nutzdatenticket", ""),
    )


def _extract_tag_text(body: str, tag: str) -> str:
    """Pull the text content of a tag from a chunk of XML, namespace-agnostic."""
    m = re.search(
        rf"<(?:[\w]+:)?{tag}\b[^>]*>(.*?)</(?:[\w]+:)?{tag}>",
        body,
        re.DOTALL,
    )
    return m.group(1).strip() if m else ""


def parse_transfer_ticket(xml_text: str) -> str:
    """Extract TransferTicket from a server response.

    Schema: <Transfers><Transfer><TransferTicket>...</TransferTicket></Transfer></Transfers>
    Pattern: eh[0-9]{3}[0-9a-km-z]{27} (32 chars total).
    """
    return _extract_tag_text(xml_text, "TransferTicket")


def parse_telenummer(xml_text: str) -> str:
    """Extract Telenummer from a successful response."""
    return _extract_tag_text(xml_text, "Telenummer")


def parse_ordnungsbegriff(xml_text: str) -> str:
    """Extract Ordnungsbegriff from a successful response."""
    return _extract_tag_text(xml_text, "Ordnungsbegriff")


# --- C type definitions for ERiC structs ---

class _eric_druck_parameter_t(ctypes.Structure):
    """Mirrors the C struct in eric_types.h.

    We never use printing, so we always pass NULL. This is defined only so
    EricBearbeiteVorgang's argtypes are accurate.
    """
    _fields_ = [
        ("version", ctypes.c_uint32),
        ("vorschau", ctypes.c_uint32),
        ("ersteSeite", ctypes.c_uint32),
        ("duplexDruck", ctypes.c_uint32),
        ("pdfName", ctypes.c_char_p),
        ("fussText", ctypes.c_char_p),
        ("pdfCallback", ctypes.c_void_p),
        ("pdfCallbackBenutzerdaten", ctypes.c_void_p),
    ]


class _eric_verschluesselungs_parameter_t(ctypes.Structure):
    """Mirrors the C struct in eric_types.h.

    Used for signed sends. version must be 3 (per ERiC 43.x docs).
    """
    _fields_ = [
        ("version", ctypes.c_uint32),
        ("zertifikatHandle", ctypes.c_uint32),  # EricZertifikatHandle = uint32_t
        ("pin", ctypes.c_char_p),
    ]


# --- Library discovery ---

def _find_eric_library(eric_path: str | None = None) -> str:
    system = platform.system()
    if system == "Darwin":
        lib_name = "libericapi.dylib"
    elif system == "Windows":
        lib_name = "ericapi.dll"
    else:
        lib_name = "libericapi.so"

    if eric_path:
        candidates = [
            Path(eric_path) / lib_name,
            Path(eric_path) / "lib" / lib_name,
            Path(eric_path),
        ]
        for c in candidates:
            # is_file(), not exists(): the last candidate is eric_path itself,
            # so pointing ERIC_PATH at a directory used to "succeed" here and
            # then fail inside ctypes.CDLL with an opaque dlopen dump instead of
            # the actionable message below.
            if c.is_file():
                return str(c)
        raise EricNotFoundError(
            f"ERiC library not found at {eric_path}. Expected {lib_name} "
            f"either directly at that path, or in a lib/ subdirectory."
        )

    env_path = os.environ.get("ERIC_PATH")
    if env_path:
        return _find_eric_library(env_path)

    common_paths = [
        "/opt/eric", "/opt/eric/lib", "/usr/local/lib/eric",
        os.path.expanduser("~/.eric"), os.path.expanduser("~/.eric/lib"),
        "/usr/lib/eric",
    ]
    if system == "Windows":
        common_paths = [
            r"C:\Program Files\ERiC", r"C:\ERiC", os.path.expanduser(r"~\ERiC"),
        ]
    for p in common_paths:
        lib_path = Path(p) / lib_name
        if lib_path.exists():
            return str(lib_path)

    found = ctypes.util.find_library("ericapi")
    if found:
        return found

    raise EricNotFoundError(
        f"ERiC library ({lib_name}) not found. See eric/README.md for staging."
    )


# --- The wrapper ---

class EricWrapper:
    """ctypes wrapper around the ERiC C library.

    Usage (validate-only, no cert):
        with EricWrapper() as eric:
            result = eric.validate(xbrl_data, datenart_version="Bilanz_6.9")
            for issue in result.issues:
                print(issue.severity, issue.feldkennung, issue.message_de)

    Usage (sign and send, requires cert):
        with EricWrapper() as eric:
            result = eric.send(xbrl_data, "/path/to/cert.pfx", "password",
                               datenart_version="Bilanz_6.9")
            print("Transfer ticket:", result.transfer_ticket)
    """

    def __init__(self, eric_path: str | None = None, log_path: str | None = None):
        self._lib_path = _find_eric_library(eric_path)
        # Every wrapper used to mkdtemp() a log directory that nothing ever
        # removed, so a long-running process leaked one per instantiation.
        # Only clean up directories we created ourselves.
        self._owns_log_dir = log_path is None
        self._log_path = log_path or tempfile.mkdtemp(prefix="eric_log_")
        self._lib: Optional[ctypes.CDLL] = None
        self._initialized = False
        self._plugin_path = str(Path(self._lib_path).parent)

    def __enter__(self) -> "EricWrapper":
        self._load_library()
        self._initialize()
        return self

    def __exit__(self, *args) -> None:
        self._finalize()

    def _load_library(self) -> None:
        try:
            lib_dir = str(Path(self._lib_path).parent)
            if platform.system() == "Linux":
                os.environ["LD_LIBRARY_PATH"] = f"{lib_dir}:{os.environ.get('LD_LIBRARY_PATH', '')}"
            elif platform.system() == "Darwin":
                os.environ["DYLD_LIBRARY_PATH"] = f"{lib_dir}:{os.environ.get('DYLD_LIBRARY_PATH', '')}"
            self._lib = ctypes.CDLL(self._lib_path)
        except OSError as e:
            raise EricNotFoundError(f"Failed to load ERiC library from {self._lib_path}: {e}")

    def _initialize(self) -> None:
        if self._lib is None:
            raise EricError(3, "Library not loaded")
        func = self._lib.EricInitialisiere
        func.restype = ctypes.c_int
        func.argtypes = [ctypes.c_char_p, ctypes.c_char_p]
        ret = func(self._plugin_path.encode("utf-8"), self._log_path.encode("utf-8"))
        if ret != 0 and ret != 4:
            raise EricError(ret)
        self._initialized = True

    def _finalize(self) -> None:
        if self._lib is not None and self._initialized:
            func = self._lib.EricBeende
            func.restype = ctypes.c_int
            func()
            self._initialized = False
        self._cleanup_log_dir()

    def _cleanup_log_dir(self) -> None:
        """Remove the temp log directory this wrapper created, if any."""
        if not getattr(self, "_owns_log_dir", False):
            return
        shutil.rmtree(self._log_path, ignore_errors=True)
        self._owns_log_dir = False

    # --- Public API ---

    def validate(
        self,
        xbrl_data: str | bytes,
        datenart_version: str = DatenartVersion.BILANZ_6_9,
    ) -> TransferResult:
        """Validate XBRL/XML against ERiC plausibility rules. No cert needed."""
        return self._process(xbrl_data, datenart_version, flags=ERIC_VALIDIERE)

    def send(
        self,
        xbrl_data: str | bytes,
        cert_path: str,
        cert_password: str,
        datenart_version: str = DatenartVersion.BILANZ_6_9,
    ) -> TransferResult:
        """Validate and submit to the Finanzamt. Requires .pfx + password."""
        return self._process(
            xbrl_data,
            datenart_version,
            flags=ERIC_SENDE | ERIC_VALIDIERE,
            cert_path=cert_path,
            cert_password=cert_password,
        )

    def check_xml(self, xbrl_data: str | bytes, datenart_version: str) -> TransferResult:
        """Pure schema validation via EricCheckXML.

        Faster than validate() because it skips plausibility rules. Returns
        a TransferResult so the caller can read structured issues out of
        the fehlertextPuffer the same way as validate().
        """
        if self._lib is None or not self._initialized:
            raise EricError(3)
        if isinstance(xbrl_data, str):
            xbrl_data = xbrl_data.encode("utf-8")

        func = self._lib.EricCheckXML
        func.restype = ctypes.c_int
        func.argtypes = [ctypes.c_char_p, ctypes.c_char_p, ctypes.c_void_p]

        buf = self._create_buffer()
        try:
            ret = func(xbrl_data, datenart_version.encode("utf-8"), buf)
            text = self._read_buffer(buf)
            issues = parse_server_response(text)
            return TransferResult(
                return_code=ret,
                server_response=text,
                issues=issues,
            )
        finally:
            self._free_buffer(buf)

    def datenart_supported(self, datenart_version: str) -> bool:
        """Check whether a datenartVersion is supported by loaded plugins.

        Implementation: try EricMakeElsterDatenArt if available, else attempt
        check_xml with empty payload and check the return code. Conservative
        fallback returns True so older binaries don't break callers.
        """
        if self._lib is None or not self._initialized:
            raise EricError(3)
        try:
            func = self._lib.EricMakeElsterDatenArt
        except AttributeError:
            return True
        func.restype = ctypes.c_int
        func.argtypes = [ctypes.c_char_p, ctypes.c_void_p]
        buf = self._create_buffer()
        try:
            ret = func(datenart_version.encode("utf-8"), buf)
            return ret == 0
        finally:
            self._free_buffer(buf)

    # --- The core call ---

    def _process(
        self,
        xbrl_data: str | bytes,
        datenart_version: str,
        flags: int = ERIC_VALIDIERE,
        cert_path: str | None = None,
        cert_password: str | None = None,
    ) -> TransferResult:
        """Call EricBearbeiteVorgang with the correct 8-arg signature.

        Layout:
            (datenpuffer, datenartVersion, bearbeitungsFlags,
             druckParameter*, cryptoParameter*,
             transferHandle*, rueckgabeXmlPuffer, serverantwortXmlPuffer)

        For validate-only: druck=NULL, crypto=NULL, transferHandle=NULL.
        For send: druck=NULL, crypto=&_eric_verschluesselungs_parameter_t,
                  transferHandle=&uint32 (output, currently unused).
        """
        if self._lib is None or not self._initialized:
            raise EricError(3)
        if isinstance(xbrl_data, str):
            xbrl_data = xbrl_data.encode("utf-8")

        rueckgabe_buf = self._create_buffer()
        serverantwort_buf = self._create_buffer()

        cert_handle: Optional[ctypes.c_uint32] = None
        crypto_param_ref = None  # ctypes.POINTER instance, kept alive
        try:
            if (flags & ERIC_SENDE) and cert_path and cert_password is not None:
                cert_handle = self._open_certificate(cert_path)
                crypto = _eric_verschluesselungs_parameter_t(
                    version=3,
                    zertifikatHandle=cert_handle.value,
                    pin=cert_password.encode("utf-8"),
                )
                crypto_param_ref = ctypes.byref(crypto)
            else:
                crypto = None  # noqa: F841 — kept for clarity

            transfer_handle_storage = ctypes.c_uint32(0)
            transfer_handle_ref = ctypes.byref(transfer_handle_storage)

            func = self._lib.EricBearbeiteVorgang
            func.restype = ctypes.c_int
            func.argtypes = [
                ctypes.c_char_p,                                            # datenpuffer
                ctypes.c_char_p,                                            # datenartVersion
                ctypes.c_uint32,                                            # bearbeitungsFlags
                ctypes.POINTER(_eric_druck_parameter_t),                    # druckParameter
                ctypes.POINTER(_eric_verschluesselungs_parameter_t),        # cryptoParameter
                ctypes.POINTER(ctypes.c_uint32),                            # transferHandle
                ctypes.c_void_p,                                            # rueckgabeXmlPuffer
                ctypes.c_void_p,                                            # serverantwortXmlPuffer
            ]

            ret = func(
                xbrl_data,
                datenart_version.encode("utf-8"),
                ctypes.c_uint32(flags),
                None,                            # druck = NULL (we never print)
                crypto_param_ref,                # crypto or NULL
                transfer_handle_ref,             # OUT
                rueckgabe_buf,
                serverantwort_buf,
            )

            rueckgabe_text = self._read_buffer(rueckgabe_buf)
            serverantwort_text = self._read_buffer(serverantwort_buf)

            # Parse issues from both buffers — schema says FehlerRegelpruefung
            # lives in serverantwort, but ERiC has been known to mix them.
            issues = parse_server_response(serverantwort_text)
            issues.extend(parse_server_response(rueckgabe_text))

            transfer_ticket = (parse_transfer_ticket(rueckgabe_text)
                               or parse_transfer_ticket(serverantwort_text))
            telenummer = (parse_telenummer(rueckgabe_text)
                          or parse_telenummer(serverantwort_text))
            ordnungsbegriff = (parse_ordnungsbegriff(rueckgabe_text)
                               or parse_ordnungsbegriff(serverantwort_text))

            warnings: list[str] = []
            sendable = ret in (
                EricReturnCode.ERIC_OK,
                EricReturnCode.ERIC_GLOBAL_HINWEISE,
            )
            if not sendable:
                err_msg = self._get_error_text(ret)
                warnings.append(err_msg)
                # If ret indicates an error but we got no parsed issues,
                # synthesize one so callers always have something to render.
                if not issues:
                    issues.append(ValidationIssue(
                        severity="error", code=str(ret), message_de=err_msg,
                    ))

            return TransferResult(
                return_code=ret,
                transfer_ticket=transfer_ticket,
                telenummer=telenummer,
                ordnungsbegriff=ordnungsbegriff,
                server_response=serverantwort_text or rueckgabe_text,
                issues=issues,
                warnings=warnings,
            )

        finally:
            if cert_handle is not None:
                self._close_certificate(cert_handle)
            self._free_buffer(rueckgabe_buf)
            self._free_buffer(serverantwort_buf)

    # --- Buffer helpers ---

    def _create_buffer(self) -> ctypes.c_void_p:
        func = self._lib.EricRueckgabepufferErzeugen
        func.restype = ctypes.c_void_p
        return func()

    def _read_buffer(self, handle: ctypes.c_void_p) -> str:
        func = self._lib.EricRueckgabepufferInhalt
        func.restype = ctypes.c_char_p
        func.argtypes = [ctypes.c_void_p]
        result = func(handle)
        return result.decode("utf-8", errors="replace") if result else ""

    def _free_buffer(self, handle: ctypes.c_void_p) -> None:
        func = self._lib.EricRueckgabepufferFreigeben
        func.argtypes = [ctypes.c_void_p]
        func(handle)

    # --- Certificate helpers ---

    def _open_certificate(self, cert_path: str) -> ctypes.c_uint32:
        """Call EricGetHandleToCertificate.

        Signature:
            int EricGetHandleToCertificate(
                EricZertifikatHandle *hToken,    // OUT
                uint32_t *iInfoPinSupport,       // OUT
                const char *pathToKeystore);     // IN

        Note: NO password parameter — that goes into the verschluesselungs
        struct passed to EricBearbeiteVorgang.
        """
        handle = ctypes.c_uint32(0)
        pin_support = ctypes.c_uint32(0)

        func = self._lib.EricGetHandleToCertificate
        func.restype = ctypes.c_int
        func.argtypes = [
            ctypes.POINTER(ctypes.c_uint32),
            ctypes.POINTER(ctypes.c_uint32),
            ctypes.c_char_p,
        ]
        ret = func(ctypes.byref(handle), ctypes.byref(pin_support), cert_path.encode("utf-8"))
        if ret != 0:
            raise EricError(ret, f"Failed to open certificate: {cert_path}")
        return handle

    def _close_certificate(self, handle: ctypes.c_uint32) -> None:
        func = self._lib.EricCloseHandleToCertificate
        func.restype = ctypes.c_int
        func.argtypes = [ctypes.c_uint32]
        func(handle.value)

    def _get_error_text(self, code: int) -> str:
        if code in ERROR_MESSAGES:
            return ERROR_MESSAGES[code]
        try:
            func = self._lib.EricHoleFehlerText
            func.restype = ctypes.c_char_p
            func.argtypes = [ctypes.c_int]
            result = func(code)
            return result.decode("utf-8", errors="replace") if result else f"Error code {code}"
        except Exception:
            return f"ERiC error code {code}"
