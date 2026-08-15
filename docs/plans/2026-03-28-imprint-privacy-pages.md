# Imprint & Privacy Pages

## Context

ugtax.de needs legally required Impressum (DDG §5) and Datenschutzerklärung (DSGVO) pages. Currently no legal pages exist — only footer disclaimers.

## Operator

NEIP Ventures UG (haftungsbeschränkt), Retzbacher Weg 44, 13189 Berlin. HRB 270942 B Amtsgericht Charlottenburg. Geschäftsführer: Noah E. I. Petermann. Kontakt: noah@neip.vc.

## Files to create/modify

### 1. `app/imprint/page.tsx` — Impressum

Static server component. Sections:
- Angaben gemäß DDG §5 (company, address, GF)
- Registereintrag (HRB 270942 B)
- Kontakt (noah@neip.vc)
- USt-IdNr (nicht vorhanden)
- Verantwortlich für Inhalt (§18 Abs. 2 MStV)
- Haftung für Inhalte, Links, Urheberrecht
- Streitschlichtung (EU OS-Plattform, keine Teilnahme)

### 2. `app/privacy/page.tsx` — Datenschutzerklärung

Static server component. Sections:
1. Verantwortlicher
2. Allgemeines (no cookies, no analytics, no accounts)
3. Hosting / Vercel (server logs, Art. 6 Abs. 1 lit. f, EU-US DPF)
4. Bankexport-Verarbeitung (server-side, not stored, Art. 6 Abs. 1 lit. b)
5. KI-Klassifizierung / Anthropic (opt-in, user's own key, Art. 6 Abs. 1 lit. a)
6. ELSTER-Übermittlung (self-hosted ERiC, cert never stored, Art. 6 Abs. 1 lit. b)
7. Betroffenenrechte (Art. 15-21 DSGVO, Berliner Datenschutzbeauftragte)

### 3. `app/layout.tsx` — Footer links

Add "Impressum" and "Datenschutz" links to the existing last footer line.

## Design

- Same styling as rest of site: zinc palette, max-w-5xl, prose-like
- Server components (no "use client")
- German language throughout
- Subheadings with `<strong>` or `<h3>`, structured paragraphs
