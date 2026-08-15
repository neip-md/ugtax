# ERiC Integration — End-to-End Plan (v2, post-pivot)

**Goal:** Users complete and file E-Bilanz, KSt, and GewSt to the Finanzamt entirely inside UGtax. No copy-paste of cryptic XML errors. No detour through ELSTER's web forms.

**Strategy:** Two-stage rollout.
- **v1 ("Validate & Download"):** UGtax generates the filing XML and runs it through ERiC's validation pipeline. User downloads pre-validated XML and uploads it to ELSTER portal themselves. No cert ever leaves the user's machine. No trust ask. Ships fast. ERiC's plausibility error translator is the moat.
- **v2 ("One-Click Submit"):** Add direct submission via sidecar. User uploads .pfx + password per submission, sidecar transmits, returns Transfer Ticket and Protokoll. Built on the same ERiC binary, same Vordrucke, same error pipeline.

USt-VA, USt-J, Lohnsteuer all out of scope. Focus: corporate filings for solo-founder holding UGs.

---

## Status quo (what already exists)

- `src/ug_steuer/eric.py` — 407-line Python ctypes wrapper. Handles `EricInitialisiere`, `EricBearbeiteVorgang`, certificate open/close, return-code mapping. Hardcoded `datenartVersion=Bilanz_6.5`.
- `src/ug_steuer/submit.py` — high-level wrapper for validate/send.
- `services/submit/main.py` — FastAPI sidecar with `/submit`, `/validate`, `/health`. Already has the validate-only path we need for v1.
- `services/submit/Dockerfile` — Python 3.13-slim, expects ERiC mounted at `/opt/eric`.
- `src/ug_steuer/xbrl.py` — 14k-line E-Bilanz XBRL generator for Kleinstkapitalgesellschaft (HGB-Taxonomie).
- `src/ug_steuer/cli.py` — `ug-steuer process` already produces a `filing_guide.md`. The pre-filled-XML download flow can plug into this.
- Frontend: Next.js 16 (`web` package) on Vercel.

## What's missing for v1

- ERiC binary itself (`eric/` is empty — Noah needs to download and stage).
- `eric.py` `datenartVersion` is hardcoded — needs parameterization for at least `Bilanz_6.5`/`6.8`/`6.9` (E-Bilanz taxonomy versions vary by year).
- `eric.py` discards the structured `Hinweise`/`Fehler` from the server response buffer. We need to parse them into `list[ValidationIssue]` so the UI can render inline errors.
- No Feldkennung → human-readable field name map. Built once at sidecar build time from the Vordrucke package.
- Frontend has no E-Bilanz upload-cert-and-submit flow because v1 doesn't need one. It DOES need a "Validate" button that posts XBRL to the sidecar's `/validate` endpoint and renders the issue list.
- No CI test that exercises ERiC validate against real generated XBRL.
- No production hosting — but v1 may not even need a sidecar in production if validation runs locally during the user's session. See Decision 4.

## What's missing for v2 (deferred)

- Cert upload UI + secure handling.
- Sidecar production deploy (Hetzner Falkenstein).
- Submission persistence (`submissions` table, Transfer Ticket, Protokoll polling).
- mTLS or shared-secret auth between Vercel and sidecar.
- Sentry, Loki, UptimeRobot, audit log.

---

## Decision 1 — ERiC release: 43 (latest stable)

ERiC 41 is the current floor (Mindestversion since April 2025). 42 is technical-only. 43 (43.4.6.0, Feb 2026) is the live November-line release receiving Jahresfortschreibung. **Use 43.4.6.0.**

Downloads needed:
- `ERiC-43.4.6.0-Linux-x86_64.jar` (production sidecar, v2)
- `ERiC-43.4.6.0-Darwin-universal.jar` (Noah's local dev)
- `Vordrucke_2025_ERiC-43.4.6.0.zip` (covers FY2024 filings due in 2025-2026)
- `Vordrucke_2026_ERiC-43.4.6.0.zip` (covers FY2025 filings)
- `Vordrucke_VZ_unabhaengig_ERiC-43.4.6.0.zip` (year-independent forms)
- `ERiC-43.4.6.0-Dokumentation.zip` (offline reference)
- `ERiC-43.4.6.0-Schemadokumentation.zip` (offline schema reference)

**Skip:** `Vordrucke_archive` (980 MB, only needed for back-filings 2015-2024). Defer until first user actually needs it.

The .jar is a zip — extract it to get `libericapi.{so,dylib}` plus plugins. Existing ctypes wrapper expects this layout (`_plugin_path = Path(_lib_path).parent`).

**Action:** Noah accepts the ERiC license on elster.de, downloads the files above, stages them in `eric/` (gitignored — license forbids redistribution). Add `eric/README.md` documenting which files go where and the version pin.

## Decision 2 — Keep Python ctypes wrapper

Already-working 400 LOC. No JNI/cgo rewrite. Confirmed.

What it needs:
1. **Parameterize `datenartVersion`** — currently `b"Bilanz_6.5"` is hardcoded in `eric.py:307`. Make it a parameter on `validate()` and `send()`. E-Bilanz taxonomy version depends on filing year (6.5 → 6.7 → 6.8 → 6.9 across recent years).
2. **Parse server response** into `list[ValidationIssue]` with `{severity: "error"|"warning", code, feldkennung, message_de}`. The XML response from `EricRueckgabepufferInhalt` contains `<Hinweis>` and `<Fehler>` elements with field references.
3. **Bind `EricCheckXML`** for offline schema validation before the full ERiC validation pass. Surfaces gross structural errors without needing the full plugin chain.
4. **Bind `EricMakeElsterDatenArt`** to verify a datenartVersion is supported by loaded plugins. Fail fast if Vordrucke aren't installed.
5. **(v2 only)** Set Testmerker via flags so test submissions don't hit production Finanzamt. Single uint flag.

Effort: ~1 day CC for items 1-4. Item 5 deferred to v2.

## Decision 3 — v1 wedge: E-Bilanz "Validate & Download"

The argument that won: existing UGtax users are E-Bilanz users. Ship the wedge that converts the existing user base, not the wedge with the prettiest schema.

**v1 user flow:**
1. User runs `ug-steuer process` (or its Next.js equivalent), gets their `bilanz_guv.xlsx` and a draft E-Bilanz XBRL.
2. UGtax frontend shows "Validate with Finanzamt rules" button.
3. Click → POST XBRL to sidecar `/validate` (no cert).
4. Sidecar runs ERiC validation, returns `list[ValidationIssue]`.
5. Frontend renders issues inline. Each issue links to the field in the user's data and explains in plain German what's wrong.
6. User fixes issues, re-validates, repeats until clean.
7. Once clean, "Download fertige E-Bilanz" button delivers the XBRL file plus a step-by-step PDF guide showing how to upload it via ELSTER portal (Mein ELSTER → "Bilanz übermitteln" → upload XML → click Senden).
8. User uploads it themselves in ELSTER portal. Done.

**Why this works:**
- Zero trust ask. The cert never leaves the user's browser; we never see it.
- Validation is the moat. ELSTER portal also validates, but it shows raw `Plausibilitätsfehler an Feldkennung 0816`. We translate.
- The "step-by-step guide" already exists in `src/ug_steuer/guide.py`. Just needs an "Upload to ELSTER portal" section.
- v1 doesn't need cert handling, doesn't need cert temp files, doesn't need a tmpfs sidecar, doesn't need submission persistence, doesn't need Protokoll polling. Half the plan disappears.

**What v1 still needs from ERiC:**
- The library itself, mounted in the sidecar.
- The Vordrucke for the user's filing year.
- `EricBearbeiteVorgang` with flag `ERIC_VALIDIERE` (already wired).
- The Hinweise/Fehler parser (Decision 2 item 2).

## Decision 4 — Where does v1 validation run?

Two options for v1:

**4a) Sidecar in production (Hetzner Falkenstein).** Same architecture as v2 but with the `/validate` endpoint only. Pro: identical to v2 deployment, no rewrite later. Con: still requires Hetzner provisioning before v1 ships, which is a few days of yak-shaving Noah doesn't need.

**4b) Validation runs in the user's browser via WASM.** Compile ERiC to WASM. No. ERiC is a closed-source signed binary; not legally redistributable, definitely not WASM-able.

**4c) Validation runs locally on Noah's machine, frontend uploads XBRL to a Vercel API route that proxies to a long-running ngrok tunnel to Noah's laptop.** No. Insane.

**4d) Validation runs in a tiny Hetzner CX22 sidecar from day one.** Same as 4a but committing to Hetzner now.

**Decision: 4d.** Hetzner CX22 in Falkenstein, €4.51/mo, Docker compose, Caddy in front. No Loki/Sentry/UptimeRobot for v1 — those are v2. Bare minimum: Caddy → FastAPI → ERiC. Health check endpoint. Manual `journalctl` if anything breaks.

This is "v2 architecture, v1 features." Avoids a rewrite when we add cert submission.

## Decision 5 — Plausibility errors → user-actionable messages (the moat)

This is the headline feature. ELSTER portal shows raw German errors with Feldkennungen. We translate.

**Pipeline:**
1. ERiC returns server response XML with `<Hinweis>` and `<Fehler>` elements.
2. Sidecar parses these into `[{severity, code, feldkennung, message_de}]`.
3. Sidecar enriches each issue with a `field_label` from a `feldkennung_map.json` built at sidecar build time by extracting field definitions from the Vordrucke package.
4. Sidecar enriches each issue with a `human_message` from a hand-curated `error_translations.json` keyed by error code. Start empty; fill in as users hit errors. The fallback is the raw ERiC message.
5. Frontend renders each issue inline next to the broken field with severity color, the human message, and a "Was bedeutet das?" expansion that shows the technical detail (Feldkennung, raw message) for advanced users.
6. Errors block the Download button. Warnings show but don't block.

**Building `error_translations.json`:**
- Bootstrap empty.
- Every time a user hits an untranslated error, log it to a "needs translation" queue.
- Noah reviews the queue weekly and writes a 1-2 sentence German explanation.
- After 6 weeks of beta, the top 50 error codes will cover 90%+ of user encounters.

**Building `feldkennung_map.json`:**
- Extract from Vordrucke at sidecar build time. The Vordrucke ZIPs contain XML field definitions with stable Feldkennungen → German labels.
- Output is a JSON file baked into the Docker image.
- Re-built whenever Vordrucke version bumps.

This is the "screenshot for the landing page" feature: input is `Plausibilitätsfehler an Feldkennung 0816`, output is "Feld 'Vorsteuer aus Rechnungen anderer Unternehmer' enthält einen negativen Wert. Vorsteuer kann nicht negativ sein."

## Decision 6 — Hosting: Hetzner Cloud, Falkenstein (DE)

Constraints: DE/EU mandatory, native C library required (rules out Vercel/Cloudflare Workers), low traffic, cost-sensitive solo founder.

**Choice:** Hetzner Cloud CX22 (€4.51/mo, 2 vCPU, 4 GB, Falkenstein DE). Docker compose. Caddy → FastAPI sidecar → ERiC binary in `/opt/eric`. ERiC mounted as a volume from the host.

Reasons over alternatives:
- **Scaleway Paris** — also EU, more expensive, no DE residency benefit.
- **Fly.io Frankfurt** — surprise pricing, cold starts hurt ERiC's 2-3s init.
- **AWS Frankfurt** — overkill, expensive, more attack surface.
- **Self-hosted** — no.

The Next.js app stays on Vercel. Vercel API route → POST to `https://eric.ugtax.de/validate` with a shared bearer token + IP allowlist. mTLS deferred to v2.

v1 has no DB on the sidecar. Stateless. Logs to stdout, captured by Docker. No backup story needed because there's nothing to back up.

## Decision 7 — Test environment (Testmerker)

Needed for v2 (real submissions). Skipped for v1 (validation doesn't need it).

For v2:
- Read `Testfaelle.pdf` from the doc package, extract test Steuernummern per Bundesland.
- Use a self-signed test certificate from the doc package, or generate one via `EricCreateTH`.
- `tests/integration/test_eric_testenv.py` runs the full v2 pipeline against test env. Skipped in CI unless `ERIC_RUN_INTEGRATION=1`.
- Production toggle requires explicit `ERIC_PRODUCTION=true` env var on sidecar AND a feature flag in frontend. Default is test env until both are set.

For v1, we still want at least one integration test that calls validate against a real generated XBRL and asserts no parsing errors. No Testmerker needed for validate-only.

## Decision 8 — Submission lifecycle, Telenummer/Protokoll (v2 only)

Deferred to v2. When we add it:

1. Persist every submission to `submissions` table: `{id, user_id, datenart, period, transfer_ticket, status, submitted_at, server_response_blob, protokoll_blob, protokoll_received_at}`.
2. Idempotency key per submission attempt — frontend generates UUID, sidecar dedupes, prevents double-submit on retry.
3. Protokoll polling — sidecar exposes `/protokoll/{transfer_ticket}` calling `EricBearbeiteVorgang` with `ERIC_HOLE_ABHOLUNGEN`. Frontend polls every 5 min for 24h, then daily for 7 days, then alerts Noah for manual investigation.
4. Render Protokoll PDF in-app, downloadable.

## Decision 9 — Monitoring (v1 minimal, v2 full)

**v1:**
- Stdout JSON logs captured by Docker. `docker compose logs -f` is the dashboard.
- Caddy access log.
- That's it. No Sentry, no Loki, no UptimeRobot. v1 traffic is 5-20 validation calls/day.

**v2:**
- Sentry (free tier) for sidecar exceptions, tagged with `datenart` + ERiC return code.
- Loki + Grafana on the same Hetzner box for structured logs.
- UptimeRobot pinging `/health` every 5 min, Telegram alert to Noah.
- Audit log of every submission, append-only JSONL on disk + mirrored to main DB.
- No PII in logs. No Steuernummer, no Name, no cert filename. Tagged user_id only.

## Decision 10 — Cert handling (v2 only)

Deferred. When v2 ships:

1. User uploads .pfx + password on submission form.
2. Sidecar writes .pfx to `tempfile` in tmpfs (`/dev/shm/eric-certs`).
3. Calls `EricGetHandleToCertificate` immediately.
4. Closes handle, unlinks file in `finally`.
5. 60-second hard timeout on the whole submit call.
6. Password lives in process memory only for the call duration. Never logged.
7. SECURITY.md documents the threat model.
8. No "remember my certificate" feature.

---

## Rollout plan

**Week 1: ERiC working locally + sidecar in production with /validate**
- Noah accepts license, downloads ERiC 43 Linux + macOS + Vordrucke 2025/2026/VZ-unabhängig + docs.
- Extract binaries into `eric/` (gitignored).
- Update `eric.py`: parameterize datenartVersion, parse server response into ValidationIssue, bind EricCheckXML and EricMakeElsterDatenArt.
- Update `submit.py` and `services/submit/main.py` to expose the parsed issues from `/validate`.
- Build `feldkennung_map.json` from Vordrucke at sidecar build time.
- Provision Hetzner CX22 Falkenstein. Install Docker. Deploy sidecar via `docker compose up -d`. Caddy in front for TLS via Let's Encrypt at `eric.ugtax.de`.
- Shared bearer token between Vercel and sidecar. IP allowlist on Caddy.
- Health check endpoint working. `pytest tests/integration/test_eric_validate.py` passes locally against real generated XBRL.

**Week 2: Frontend "Validate & Download" flow**
- Next.js page: user reviews their generated E-Bilanz, clicks "Validate".
- Frontend POST to `/validate`, renders issue list inline.
- "Download fertige E-Bilanz" button when validation is clean.
- "Wie reiche ich das bei ELSTER ein?" expansion with screenshots of the ELSTER portal upload flow.
- `error_translations.json` bootstrapped empty. Logging unknown errors to a queue.

**Week 3: Closed beta (5 friendly users)**
- Noah recruits 5 existing UGtax users this week. Already in motion in parallel with Week 1-2 (start now, do not wait).
- Each user runs their FY2024 E-Bilanz through Validate & Download.
- Noah personally watches every validation call. Translates errors that come up.
- Goal: by end of Week 3, at least 3 users have their E-Bilanz successfully filed via the ELSTER portal using UGtax's downloaded XML.

**Week 4: Public v1**
- Allowlist removed. "Validate & Download" is the headline feature.
- Landing page screenshot is the error translation comparison: ELSTER's cryptic error vs. UGtax's plain-German message.
- Pricing: free for v1.

**Month 2-3: KSt + GewSt**
- Same template: generator (already exists in some form?) + frontend Validate & Download flow + Feldkennung map for these forms + integration test.
- KSt and GewSt are mechanically similar to E-Bilanz from ERiC's perspective — different datenartVersion, different schema, same pipeline.

**Month 3-4: v2 — One-Click Submit**
- Add cert upload UI, sidecar `/submit` endpoint with secure cert handling, Testmerker for test env, submission persistence, Protokoll polling, monitoring stack (Sentry/Loki/UptimeRobot).
- Re-run closed beta with 5 users on the new flow before public launch.
- Pricing: introduce paid tier (€X/mo, see T7).

---

## NOT in scope

- USt-VA, USt annual, Lohnsteuer-Anmeldung — explicitly dropped.
- Multi-user / multi-UG per account — defer until first paying customer asks.
- "Remember my certificate" — defer indefinitely, security cost not justified.
- Steuerberater-Modus (filing on behalf of clients) — different cert flow, different liability profile.
- Back-filing for years <2024 — defer.
- Windows/macOS sidecar — Linux only in production, macOS only for Noah's local dev.
- Multi-region failover — single Hetzner box is fine for v1 and v2.
- Direct submission in v1 — that's v2.
- Sentry/Loki/UptimeRobot in v1 — that's v2.

## Failure modes registry

| Mode | When | Mitigation | Severity |
|---|---|---|---|
| ERiC sidecar down | Anytime | UGtax frontend gracefully degrades to "Download unvalidated XML, validate at ELSTER portal." User can still file. | Medium |
| Plausibility error in our XML generation | v1 + v2 | Parsed inline at field, user sees what to fix. If we generated invalid XML, that's our bug — log + alert Noah. | High |
| Untranslated error code | v1 + v2 | Fall back to raw ERiC message, queue for Noah to translate. | Low |
| ERiC binary missing on host | v1 + v2 | `/health` returns degraded, frontend shows "Validation unavailable, try again later." | Critical |
| Wrong taxonomy version for filing year | v1 + v2 | Year-aware selector in xbrl.py. Test matrix covers 2024, 2025 filing years. | High |
| User cert expired | v2 only | `ERIC_CRYPT_ZERTIFIKAT_UNGUELTIG` → "Ihr Zertifikat ist abgelaufen" with link to ELSTER portal renewal. | Medium |
| Wrong cert password | v2 only | `ERIC_CRYPT_PIN_FALSCH` → "Falsches Passwort" inline. | Low |
| Sidecar crashes mid-submission | v2 only | Idempotency key prevents double-submit. Submission record marked `unknown` until Protokoll polling resolves. | High |
| Protokoll never arrives | v2 only | After 7 days, mark `protokoll_missing`, email Noah, "Refresh Protokoll" button. | Medium |
| Test submission accidentally hits prod | v2 only | Default Testmerker = test env. Production requires `ERIC_PRODUCTION=true` env var + frontend feature flag. | Critical |

## Open taste decisions for Noah

**T1 — Sidecar↔Vercel auth: shared bearer token (recommendation) or mTLS?** Shared token + IP allowlist + Caddy rate limit is 5 min of work. mTLS is cert rotation pain. Pick token for v1+v2.

**T3 — Hosting: Hetzner Falkenstein (recommendation), Scaleway Paris, or Fly Frankfurt?** Hetzner. Cheapest, DE residency, no cold start.

**T4 — Vordrucke archive (980 MB, back-filings 2015-2024)?** Defer. Target user files current-year. Add when first user asks.

**T5 — ERiC binary versioning: pin to 43.4.6.0 (recommendation) or auto-update?** Pin. Calendar reminder for November Mindestversion bumps.

**T7 — When and how to charge?** v1 free. v2 paid. Pricing TBD — €19/mo is probably wrong (too cheap for the value, too expensive for the audience). Worth its own conversation. Probably €5-10/mo or annual €99 with E-Bilanz included.

## Premises (locked in)

1. **UGtax target user is a solo founder with a holding UG, no employees, current-year filings.** ✅ Confirmed.
2. **Wedge is E-Bilanz, not USt-VA.** ✅ Confirmed. Convert existing users.
3. **v1 ships without cert upload — pre-validated XML download only.** ✅ Confirmed.
4. **v2 adds cert upload + direct submission. P3 trust ask is acceptable.** ✅ Confirmed.
5. **DE/EU hosting on a single Hetzner box is good enough for v1 and v2.** ✅ Confirmed.
6. **Solo Noah + Claude can ship v1 in 3-4 weeks.** ✅ Confirmed.

## Things to start NOW in parallel with Week 1

1. **Recruit 5 friendly UGtax users for the Week 3 closed beta.** Reach out today. Confirm they have FY2024 E-Bilanz to file. Without warm bodies, Week 3 slips.
2. **30-min call with a German tax/IT lawyer.** Confirm liability profile of "we generate the XML, user submits via ELSTER portal." This is the lowest-liability model (we are a tool, user is the Übermittler) but worth confirming before launch.
3. **Pre-write the landing page screenshot.** Take a real ELSTER error message, write the UGtax-translated version. This is the marketing artifact that justifies the whole product.

## Kill criteria

If any of these happens, pause and reconsider:
- 3 closed-beta users hit untranslatable errors → translation moat is harder than expected.
- 0/5 closed-beta users successfully file via the downloaded XML → ELSTER portal upload flow is the blocker, not validation.
- ERiC validation accepts XML that ELSTER portal then rejects → our ERiC integration is wrong, debug before more users hit it.
- A user gets a Verspätungszuschlag because of a UGtax bug → pause, refund, fix, postmortem.
