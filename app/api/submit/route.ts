import { NextRequest, NextResponse } from "next/server";
import { generateJournal, generateStatements, type ClassifiedTransaction, type CompanyConfig } from "@/lib/engine";
import { generateXbrl } from "@/lib/xbrl";
import { checkOrigin } from "@/lib/security";

const SUBMISSION_SERVICE_URL = process.env.SUBMISSION_SERVICE_URL || "";

export async function HEAD() {
  if (!SUBMISSION_SERVICE_URL) {
    return new NextResponse(null, { status: 503 });
  }
  return new NextResponse(null, { status: 200 });
}

export async function POST(request: NextRequest) {
  try {
    const originError = checkOrigin(request);
    if (originError) return originError;

    const formData = await request.formData();
    const action = formData.get("action") as string || "submit";
    const classifiedRaw = formData.get("classified") as string;
    const configRaw = formData.get("config") as string;
    const certificate = formData.get("certificate") as File | null;
    const password = formData.get("password") as string || "";

    if (!SUBMISSION_SERVICE_URL) {
      return NextResponse.json({
        success: false,
        error: "Kein Submission-Service konfiguriert. Für die ELSTER-Übermittlung nutzen Sie die selbst-gehostete Version (Docker Compose) oder den CLI-Befehl `ug-steuer submit`.",
      }, { status: 503 });
    }

    // Generate XBRL from classified data
    const classified: ClassifiedTransaction[] = JSON.parse(classifiedRaw || "[]");
    const config = JSON.parse(configRaw || "{}");
    const companyConfig: CompanyConfig = config.company || config || {
      name: "", steuernummer: "", finanzamt: "",
      geschaeftsjahr: 2025, kleinunternehmer: true,
      stammkapital: "1000.00", gewinnvortrag: "0.00",
    };

    const journal = generateJournal(classified);
    const results = generateStatements(journal, companyConfig);
    const xbrlContent = generateXbrl(results, companyConfig);
    const xbrlBlob = new Blob([xbrlContent], { type: "application/xml" });

    // Build form data for the FastAPI service
    const serviceForm = new FormData();
    serviceForm.append("xbrl_file", xbrlBlob, "ebilanz.xbrl");

    if (action === "validate") {
      const res = await fetch(`${SUBMISSION_SERVICE_URL}/validate`, {
        method: "POST",
        body: serviceForm,
      });
      const data = await res.json();
      if (!res.ok) {
        return NextResponse.json({
          success: false,
          error: data.detail || data.error || `Validation fehlgeschlagen (${res.status})`,
        }, { status: res.status });
      }
      return NextResponse.json(data);
    }

    // Full submission - certificate required
    if (!certificate) {
      return NextResponse.json({
        success: false,
        error: "ELSTER-Zertifikat (.pfx) erforderlich.",
      }, { status: 400 });
    }

    const certBuffer = await certificate.arrayBuffer();
    const certBlob = new Blob([certBuffer], { type: "application/x-pkcs12" });
    serviceForm.append("certificate", certBlob, certificate.name);
    serviceForm.append("password", password);

    const res = await fetch(`${SUBMISSION_SERVICE_URL}/submit`, {
      method: "POST",
      body: serviceForm,
    });
    const data = await res.json();
    if (!res.ok) {
      return NextResponse.json({
        success: false,
        error: data.detail || data.error || `Übermittlung fehlgeschlagen (${res.status})`,
      }, { status: res.status });
    }
    return NextResponse.json(data);

  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({
      success: false,
      error: `Submission-Service nicht erreichbar: ${message}`,
    }, { status: 502 });
  }
}
