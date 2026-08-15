/**
 * Tests for lib/security.ts.
 *
 * This file had zero coverage while being the only gate in front of six
 * unauthenticated API routes. Two defects it now pins:
 *   - the Origin check trusted `origin === https://${request.headers.host}`,
 *     so forging both headers at once passed (M3)
 *   - no body cap at all, so a 40 MB JSON payload was accepted and parsed (M2)
 */

import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import {
  checkOrigin,
  readJsonCapped,
  checkArrayLength,
  MAX_JSON_BYTES,
  MAX_TRANSACTIONS,
} from "../security";

function req(url: string, init?: RequestInit & { headers?: Record<string, string> }) {
  return new NextRequest(new Request(url, init as RequestInit));
}

describe("checkOrigin", () => {
  it("allows a request with no Origin (curl, CLI, self-hosted scripts)", () => {
    expect(checkOrigin(req("https://ugtax.de/api/process", { method: "POST" }))).toBeNull();
  });

  it("allows a configured origin", () => {
    const r = req("https://ugtax.de/api/process", {
      method: "POST",
      headers: { origin: "https://ugtax.de" },
    });
    expect(checkOrigin(r)).toBeNull();
  });

  it("rejects an unknown origin", () => {
    const r = req("https://ugtax.de/api/process", {
      method: "POST",
      headers: { origin: "https://evil.example.com" },
    });
    expect(checkOrigin(r)?.status).toBe(403);
  });

  it("allows any localhost port outside production", () => {
    // The allowlist only names 3000 and 4114. Removing the Host-header
    // fallback meant a dev server on any other port got a 403 on every call.
    const r = req("http://localhost:3008/api/process", {
      method: "POST",
      headers: { origin: "http://localhost:3008" },
    });
    expect(checkOrigin(r)).toBeNull();
  });

  it("does not treat a remote host as local just because it says localhost", () => {
    const r = req("https://ugtax.de/api/process", {
      method: "POST",
      headers: { origin: "https://localhost.evil.example.com" },
    });
    expect(checkOrigin(r)?.status).toBe(403);
  });

  it("no longer accepts a forged Origin backed by a forged Host", async () => {
    // The regression: the old check compared Origin against the request's own
    // Host header, so setting both to the attacker's domain satisfied it.
    const r = req("https://ugtax.de/api/process", {
      method: "POST",
      headers: { origin: "https://evil.example.com", host: "evil.example.com" },
    });
    const res = checkOrigin(r);
    expect(res?.status).toBe(403);
    expect((await res!.json()).code).toBe("origin_not_allowed");
  });
});

describe("readJsonCapped", () => {
  it("parses a normal body", async () => {
    const r = req("https://ugtax.de/api/process", {
      method: "POST",
      body: JSON.stringify({ classified: [] }),
      headers: { "content-type": "application/json" },
    });
    const out = await readJsonCapped<{ classified: unknown[] }>(r);
    expect(out.error).toBeUndefined();
    expect(out.data?.classified).toEqual([]);
  });

  it("rejects on a declared Content-Length over the cap", async () => {
    const r = req("https://ugtax.de/api/process", {
      method: "POST",
      body: "{}",
      headers: { "content-length": String(MAX_JSON_BYTES + 1) },
    });
    const out = await readJsonCapped(r);
    expect(out.error?.status).toBe(413);
  });

  it("rejects an oversized body even when Content-Length is absent", async () => {
    // A chunked request can omit the header, so the size has to be measured
    // from what actually arrives.
    const big = JSON.stringify({ pad: "x".repeat(MAX_JSON_BYTES + 100) });
    const r = req("https://ugtax.de/api/process", { method: "POST", body: big });
    r.headers.delete("content-length");
    const out = await readJsonCapped(r);
    expect(out.error?.status).toBe(413);
  });

  it("returns 400 on malformed JSON instead of throwing a 500", async () => {
    const r = req("https://ugtax.de/api/process", { method: "POST", body: "{not json" });
    const out = await readJsonCapped(r);
    expect(out.error?.status).toBe(400);
    expect((await out.error!.json()).code).toBe("invalid_json");
  });
});

describe("checkArrayLength", () => {
  it("passes a normal transaction count", () => {
    expect(checkArrayLength(new Array(50).fill(0), "classified")).toBeNull();
  });

  it("rejects an array past the cap", () => {
    const res = checkArrayLength(new Array(MAX_TRANSACTIONS + 1).fill(0), "classified");
    expect(res?.status).toBe(413);
  });

  it("ignores non-arrays", () => {
    expect(checkArrayLength(undefined, "classified")).toBeNull();
    expect(checkArrayLength({ length: 1e9 }, "classified")).toBeNull();
  });
});
