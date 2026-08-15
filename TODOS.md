# TODOS

## Local / self-hosted LLM endpoints (Ollama, LM Studio, OpenRouter)
**What:** Let the user point the classification fallback at an OpenAI-compatible endpoint of their choosing, instead of only the three hosted providers.
**Why:** A self-hoster running Ollama can classify without sending bank data to anyone. This is the remaining piece of the multi-provider work shipped on 2026-08-16.
**Cons:** A caller-supplied base URL means the server fetches an arbitrary host, which on ugtax.de is server-side request forgery: an attacker could reach cloud metadata endpoints or anything else inside the deployment's network. That is why it was left out of the first pass.
**Context:** `lib/llm-providers.ts` already speaks the OpenAI chat-completions shape, so the request code is done; the missing part is the guard. Likely shape: accept a base URL only when an env var opts the deployment in (off by default, so ugtax.de is unaffected and self-hosters get it with one setting), and still reject private and link-local addresses.
**Added:** 2026-08-16

## Export LLM corrections as YAML counterparty rules
**What:** When a user overrides an LLM suggestion on the review page, offer to export that correction as a YAML counterparty rule so it auto-classifies next year.
**Why:** Without this, the LLM makes the same mistakes every year. Corrections are lost between sessions. This closes the feedback loop and reduces LLM dependence over time.
**Pros:** Each year's manual work improves next year's auto-classification; eventually the user needs fewer LLM calls.
**Cons:** Requires tracking which items were LLM-classified vs manually overridden, and generating valid YAML config entries.
**Context:** The review page already tracks `source` ("rule", "config", "manual", "llm"). Items where source changed from "llm" to "manual" are corrections. These could be exported as counterparty mappings for `config/example_config.yaml`.
**Depends on:** LLM fallback feature landing first.
**Added:** 2026-03-28

## Review table pagination
**What:** Add pagination or virtual scrolling to the transaction review table.
**Why:** Large bank exports could produce unwieldy tables.
**Trigger:** Defer until a user reports >50 transactions as a pain point. Target audience (holding UGs) typically has <50 txns/year.
**Added:** 2026-03-29 (CEO review)

## Sentry error tracking
**What:** Add Sentry for client-side and API route error monitoring.
**Why:** Need real error visibility beyond Vercel Analytics page views.
**Trigger:** Add when Vercel Analytics shows real usage (>50 sessions/week).
**Added:** 2026-03-29 (CEO review)

## Bank-specific import guides
**What:** Add help text/guides for exporting from specific banks (Qonto, N26, Holvi, Commerzbank).
**Why:** Users struggle to find the right export format in their banking app.
**Added:** 2026-03-29 (CEO review)

## Sample data demo mode
**What:** Pre-loaded sample bank export so users can try UGtax without their own data.
**Why:** Reduces friction for first-time visitors evaluating the tool.
**Added:** 2026-03-29 (CEO review)

## DATEV export for Steuerberater review
**What:** Export classified transactions in DATEV-compatible format so a Steuerberater can review/import.
**Why:** Some users want professional review of UGtax output before filing.
**Added:** 2026-03-29 (CEO review)

## ELSTER submit confirmation dialog
**What:** Add a confirmation dialog before ELSTER submission with a summary of what will be sent.
**Why:** Submitting to the Finanzamt is irreversible — users should see a final review.
**Added:** 2026-03-29 (CEO review)

## Mobile UX optimization
**What:** Responsive design improvements for the upload, review, and results pages on mobile.
**Why:** Some users may access on mobile, but current UI is desktop-first.
**Added:** 2026-03-29 (CEO review)

## USt ELSTER XML generation
**What:** Generate Umsatzsteuererklärung XML for ERiC submission.
**Why:** Only relevant for non-Kleinunternehmer holding UGs, which are rare. Most holding UGs use §19 UStG.
**Trigger:** Defer until a user specifically requests this.
**Added:** 2026-03-29 (CEO review)
