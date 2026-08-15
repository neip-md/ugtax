/**
 * Tests for the API routes that had none.
 *
 * Only /api/classify-llm was covered, while download's six-way type dispatch,
 * process, and skr04 emit the actual tax filings. These call the route handlers
 * directly with a real NextRequest, so the body caps, dispatch and headers are
 * exercised end to end without a server.
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as processPost } from "../process/route";
import { POST as downloadPost } from "../download/route";
import { GET as skr04Get } from "../skr04/route";
import { MAX_JSON_BYTES } from "@/lib/security";

const CONFIG = {
  name: "Test Holding UG",
  steuernummer: "27/123/45678",
  finanzamt: "Berlin Mitte",
  geschaeftsjahr: 2025,
  kleinunternehmer: true,
  stammkapital: "1000.00",
  gewinnvortrag: "0.00",
};

const CLASSIFIED = [
  {
    date: "2025-01-02",
    amount: "1000.00",
    direction: "credit",
    counterparty: "Gesellschafter",
    reference: "Stammkapital",
    account: "2900",
    accountName: "Gezeichnetes Kapital",
    description: "Stammkapitaleinlage",
    source: "rule",
  },
  {
    date: "2025-03-14",
    amount: "12.50",
    direction: "debit",
    counterparty: "Bank",
    reference: "Kontoführung",
    account: "6855",
    accountName: "Nebenkosten des Geldverkehrs",
    description: "Bankgebühr",
    source: "rule",
  },
];

function post(url: string, body: unknown) {
  return new NextRequest(
    new Request(url, {
      method: "POST",
      body: typeof body === "string" ? body : JSON.stringify(body),
      headers: { "content-type": "application/json" },
    }),
  );
}

describe("POST /api/process", () => {
  it("returns a balanced Bilanz for a valid payload", async () => {
    const res = await processPost(
      post("https://ugtax.de/api/process", { classified: CLASSIFIED, config: { company: CONFIG } }),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.bilanz).toBeDefined();
    expect(body.bilanz.isBalanced).toBe(true);
    expect(body.guv).toBeDefined();
  });

  it("fills defaults when the config is partial", async () => {
    // The routes used to take a caller-supplied config wholesale, leaving
    // fields undefined downstream.
    const res = await processPost(
      post("https://ugtax.de/api/process", { classified: CLASSIFIED, config: { name: "Nur Name" } }),
    );
    expect(res.status).toBe(200);
    expect((await res.json()).bilanz).toBeDefined();
  });

  it("handles an empty transaction list", async () => {
    const res = await processPost(post("https://ugtax.de/api/process", { classified: [] }));
    expect(res.status).toBe(200);
  });

  it("rejects an oversized body with 413", async () => {
    const res = await processPost(
      post("https://ugtax.de/api/process", { pad: "x".repeat(MAX_JSON_BYTES + 100) }),
    );
    expect(res.status).toBe(413);
  });

  it("returns 400 on malformed JSON, not 500", async () => {
    const res = await processPost(post("https://ugtax.de/api/process", "{nope"));
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe("invalid_json");
  });
});

describe("POST /api/download", () => {
  const body = { classified: CLASSIFIED, config: { company: CONFIG } };

  it.each([
    ["guide", "text/markdown", ".md"],
    ["journal", "text/csv", ".csv"],
    ["xbrl", "application/xml", ".xbrl"],
    ["bundesanzeiger", "text/plain", ".txt"],
  ])("serves the %s file with the right headers", async (type, contentType, ext) => {
    const res = await downloadPost(post(`https://ugtax.de/api/download?type=${type}`, body));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain(contentType);
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(ext);
    expect((await res.text()).length).toBeGreaterThan(0);
  });

  it("sanitises the fiscal year in the filename", async () => {
    // geschaeftsjahr is caller-controlled and was interpolated into the header.
    const res = await downloadPost(
      post("https://ugtax.de/api/download?type=xbrl", {
        classified: CLASSIFIED,
        config: { company: { ...CONFIG, geschaeftsjahr: '2025"; rm -rf /' } },
      }),
    );
    const disposition = res.headers.get("content-disposition") ?? "";
    expect(disposition).toBe('attachment; filename="ebilanz_2025.xbrl"');
  });

  it("rejects an oversized body with 413", async () => {
    const res = await downloadPost(
      post("https://ugtax.de/api/download?type=guide", { pad: "x".repeat(MAX_JSON_BYTES + 100) }),
    );
    expect(res.status).toBe(413);
  });
});

describe("GET /api/skr04", () => {
  it("returns the account catalogue", async () => {
    const res = await skr04Get();
    expect(res.status).toBe(200);
    const accounts = await res.json();
    expect(Array.isArray(accounts)).toBe(true);
    expect(accounts.length).toBeGreaterThan(0);
    expect(accounts[0]).toHaveProperty("number");
    expect(accounts[0]).toHaveProperty("name");
  });
});
