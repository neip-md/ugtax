# Security

## Reporting

Found something? Email **noah@neip.vc**. Please do not open a public issue for
anything that looks exploitable.

## Repository hygiene

This repository is public, and coding agents commit to it. An agent running a
broad `git add -A` stages whatever sits in the working tree, so the rules below
are enforced mechanically rather than by convention.

### The layers

1. **Structural.** The checkout lives in its own directory. It must never be
   rooted at `$HOME`; `scripts/repo-guard.sh` fails if it is.
2. **`.gitignore`.** Agent state, credentials, key material, and shell histories
   are ignored by name.
3. **Git hooks.** `.githooks/pre-commit` and `.githooks/pre-push` run
   `scripts/repo-guard.sh` against staged changes and outgoing commits.
   Install them once per clone:

   ```bash
   scripts/install-hooks.sh
   ```

4. **CI.** `.github/workflows/security-scan.yml` runs the same scanner over the
   **full history of every ref** on each push and pull request. Hooks are local
   and can be skipped with `--no-verify`; this job cannot, so it is the
   authoritative gate.
5. **GitHub secret scanning + push protection** are enabled on this repository.

All four scanning layers call the same script, so the rules live in exactly one
place: `scripts/repo-guard.sh`.

### What the scanner blocks

- **Private paths** — `.claude/`, `.mcp.json`, `.ssh/`, `.aws/`, `.env`, shell
  histories, key material, `memory/`, internal `AUDIT_*.md` docs.
- **Secret material** — private keys, AWS/GitHub/Anthropic/OpenAI/Slack/Supabase
  token shapes, JWTs, inline `*_KEY=` assignments.
- **Confidential business content** — this is a standalone tax tool, so
  commercial or HR material from an unrelated venture has no reason to appear
  in it. The term list is not stored in this repository: a list specific enough
  to detect confidential material would disclose it. The scanner reads it from
  a private file outside the checkout (`$REPO_GUARD_TERMS`, default
  `~/.config/git/repo-guard-terms.txt`). Without that file the layer is
  inactive, which is the expected state for an external contributor; the other
  layers are unaffected.
- **Personal data** — a date-of-birth *label together with an actual date*
  (`Geburtsdatum: 12.03.1994`, `geboren am 04.11.1988`). Matching the label alone
  or a bare date would be useless here: German tax forms label DoB fields, and
  tax law is full of statutory cutoff dates.

### Known false positives

These are allowlisted deliberately, with reasons, in `scripts/repo-guard.sh`:

| Pattern | Why it is allowed |
| --- | --- |
| `DE89370400440532013000` | The canonical German test IBAN (Deutsche Bank *Musterkonto*). Used in `tests/fixtures/sample_camt053.xml`. Not a real account. |
| Postal address in `imprint`/`privacy` pages | German law (§5 TMG) requires an operator address to be published. |
| `scripts/repo-guard.sh`, `scripts/test-repo-guard.sh`, `.githooks/*`, `SECURITY.md` | The scanner's own machinery. These files must contain the patterns they detect in order to work and to be tested. They are exempt from **content** rules only, never from path rules. |
| Generic German tax vocabulary | Terms like health-insurance contributions are ordinary deductions and appear throughout ELSTER's own field dictionary (`services/submit/feldkennung_map.json`), so the confidential-content layer matches specific names and commercial phrasing rather than generic nouns. |
| The word `Geburtsdatum` on its own | A field label, appearing 131× in the ELSTER dictionary. Likewise a bare date: the 24 dates in that file are statutory cutoffs (§ 10e EStG, "Kaufvertrag nach dem 31.12.1993"). Only label **and** value together are treated as personal data. |

That last exemption is the one soft spot in the design: a real secret pasted into
those files would not be flagged. They are short, rarely edited, and should be
read closely in review. Everything else in the repository is scanned.

### Running the scanner manually

```bash
scripts/repo-guard.sh --worktree           # files on disk
scripts/repo-guard.sh --staged             # what you are about to commit
scripts/repo-guard.sh --range origin/main..HEAD
scripts/repo-guard.sh --all                # full history, every ref
```

## Application security

The web app exposes unauthenticated `POST` endpoints (`/api/upload`,
`/api/classify-llm`, `/api/process`, `/api/download`). Uploaded bank statements
are processed in-request and are not persisted server-side. If you deploy this
yourself, put authentication or rate limiting in front of those routes before
exposing them publicly.
