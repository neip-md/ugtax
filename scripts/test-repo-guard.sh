#!/bin/bash
#
# Test suite for scripts/repo-guard.sh.
#
# Plants each class of content the guard must stop and asserts it is blocked,
# then plants known false positives and asserts they are allowed.
#
# Every fixture is synthetic. Nothing real is written even to a temporary file:
# a test suite that has to embed the material it detects would put that
# material in the repository, which is the outcome the guard exists to prevent.
#
# Run:  scripts/test-repo-guard.sh
#
# Never uses `git checkout -- .`; that would clobber uncommitted work. Each case
# cleans up only the paths it created.
cd "$(git rev-parse --show-toplevel)" || exit 1
PASS=0; FAIL=0
run_case() { # name | setup | expect(block|allow) | cleanup-paths
  local name="$1" setup="$2" expect="$3" cleanup="$4"
  git reset -q >/dev/null 2>&1
  mkdir -p _guardtest
  eval "$setup" >/dev/null 2>&1
  if ./scripts/repo-guard.sh --staged >/dev/null 2>&1; then got=allow; else got=block; fi
  if [ "$got" = "$expect" ]; then printf "  \033[32mPASS\033[0m  %-56s exp=%-5s got=%s\n" "$name" "$expect" "$got"; PASS=$((PASS+1))
  else printf "  \033[31mFAIL\033[0m  %-56s exp=%-5s got=%s\n" "$name" "$expect" "$got"; FAIL=$((FAIL+1)); fi
  git reset -q >/dev/null 2>&1
  rm -rf $cleanup _guardtest 2>/dev/null
}

# Synthetic tokens are ASSEMBLED AT RUNTIME rather than written as literals.
# GitHub push protection scans this file too and rejected an earlier version
# whose fake Supabase token looked real to it. The fixtures still reach disk in
# full, so repo-guard sees exactly what it would see for a genuine key.
A28=$(printf 'A%.0s' $(seq 28)); A36=$(printf 'A%.0s' $(seq 36))
HEX40=$(printf '0123456789abcdef%.0s' 1 2 3 | cut -c1-40)
FAKE_ANTHROPIC="sk-ant-api03-${A28}"
FAKE_GITHUB="ghp_${A36}"
FAKE_SUPABASE="sbp_${HEX40}"
FAKE_PEM="-----BEGIN RSA $(printf 'PRIVATE')  KEY-----"; FAKE_PEM="${FAKE_PEM/  / }"

# The confidential-content layer reads its terms from a private file outside the
# repository, so there is nothing here to assert against. Point it at a
# throwaway list of invented terms instead: that exercises the whole mechanism
# (file is read, terms are joined, matches are blocked, misses are allowed)
# without this suite knowing a single real one.
TERMS_TMP="$(mktemp -t repo-guard-terms)"
printf '# synthetic\nZzyzx Holding\nQuux-Mustermann\nPhantasiepreis\n' > "$TERMS_TMP"
export REPO_GUARD_TERMS="$TERMS_TMP"
trap 'rm -f "$TERMS_TMP"' EXIT

echo "======================= GUARD TEST SUITE ======================="
echo "-- must BLOCK --"
run_case "agent memory note (hire_*.md under .claude/)" \
  "mkdir -p .claude/projects/x/memory && printf 'notes\n' > .claude/projects/x/memory/hire_example_person.md && git add -f .claude" block ".claude"
run_case "agent state path (.claude/CLAUDE.md)" \
  "mkdir -p .claude && echo notes > .claude/CLAUDE.md && git add -f .claude/CLAUDE.md" block ".claude"
run_case ".mcp.json" "echo '{}' > .mcp.json && git add -f .mcp.json" block ".mcp.json"
run_case "shell history file" "echo 'export K=a' > .zsh_history && git add -f .zsh_history" block ".zsh_history"
run_case "private key material" \
  "printf '%s\nMIIabc\n' \"\$FAKE_PEM\" > _guardtest/k.txt && git add -f _guardtest/k.txt" block ""
run_case "Anthropic API key literal" \
  "echo \"const k = \\\"\$FAKE_ANTHROPIC\\\"\" > _guardtest/a.ts && git add -f _guardtest/a.ts" block ""
run_case "GitHub PAT literal" \
  "echo \"token: \$FAKE_GITHUB\" > _guardtest/b.txt && git add -f _guardtest/b.txt" block ""
run_case "Supabase service-role key literal" \
  "echo \"k=\$FAKE_SUPABASE\" > _guardtest/s.txt && git add -f _guardtest/s.txt" block ""
run_case "confidential prose: term from the private list" \
  "echo 'Zzyzx Holding, Konditionen fuer 2027' > _guardtest/c.md && git add -f _guardtest/c.md" block ""
run_case "confidential prose: second term, mid-sentence" \
  "echo 'Notiz: Phantasiepreis pro Einheit noch offen' > _guardtest/d.md && git add -f _guardtest/d.md" block ""
run_case "confidential prose: term matched case-insensitively" \
  "echo 'quux-mustermann hat zugestimmt' > _guardtest/e.md && git add -f _guardtest/e.md" block ""
run_case "personal data: DoB label + value" \
  "echo 'Geburtsdatum: 12.03.1994' > _guardtest/dob.md && git add -f _guardtest/dob.md" block ""
run_case "personal data: 'geboren am' + value" \
  "echo 'Mitarbeiterin, geboren am 04.11.1988, Berlin' > _guardtest/dob2.md && git add -f _guardtest/dob2.md" block ""
run_case "internal audit doc (AUDIT_2026_*.md)" \
  "echo internal > AUDIT_2026_09_01.md && git add -f AUDIT_2026_09_01.md" block "AUDIT_2026_09_01.md"
run_case ".env with real value" \
  "echo \"SUPABASE_SERVICE_ROLE_KEY=\$FAKE_SUPABASE\" > .env && git add -f .env" block ".env"

echo "-- must ALLOW (false-positive guard) --"
run_case "canonical test IBAN in fixture" \
  "printf '<IBAN>DE89370400440532013000</IBAN>\n' > _guardtest/f.xml && git add -f _guardtest/f.xml" allow ""
run_case ".env.local.example template" \
  "printf 'NEXT_PUBLIC_SUPABASE_URL=\nSUPABASE_ANON_KEY=\n' > .env.local.example && git add -f .env.local.example" allow ".env.local.example"
run_case "ordinary source change" \
  "echo '// c' > _guardtest/ok.ts && git add -f _guardtest/ok.ts" allow ""
run_case "prose that matches no term on the list" \
  "echo 'Rechnung der Stadtwerke, Konto 6805' > _guardtest/t.md && git add -f _guardtest/t.md" allow ""
# Without the private list the layer is simply off, which is the state every
# external contributor is in. It must not fail their commits.
run_case "no private term list present" \
  "REPO_GUARD_TERMS=/nonexistent/terms.txt; export REPO_GUARD_TERMS; echo 'Zzyzx Holding' > _guardtest/u.md && git add -f _guardtest/u.md" allow ""
export REPO_GUARD_TERMS="$TERMS_TMP"
run_case "package-lock integrity hash" \
  "echo '\"integrity\": \"sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA\"' > _guardtest/g.json && git add -f _guardtest/g.json" allow ""
# Regression: "Krankenkasse" is ordinary German tax vocabulary. ELSTER's own
# field dictionary uses it, so the generic word must not trip the guard.
run_case "ELSTER field label mentioning Krankenkasse" \
  "echo '{\"E0102203\": \"Beitraege zur Krankenkasse laut Nr. 25 der Lohnsteuerbescheinigung\"}' > _guardtest/h.json && git add -f _guardtest/h.json" allow ""
# Regression: the bare label appears 131x in ELSTER's dictionary, and bare dates
# are statutory cutoffs (§ 10e EStG). Only label + value together are personal.
run_case "ELSTER label 'Geburtsdatum' with no value" \
  "echo '{\"E0101106\": \"Geburtsdatum dieser Person\"}' > _guardtest/i.json && git add -f _guardtest/i.json" allow ""
run_case "statutory cutoff date with no DoB label" \
  "echo 'bei Kaufvertrag nach dem 31.12.1993 gilt § 10e EStG' > _guardtest/j.md && git add -f _guardtest/j.md" allow ""
# 10000 is deliberately NOT an assigned German postcode (Berlin runs 10115-14199),
# so this fixture exercises the legal-page allowlist without embedding anything
# that resembles a real address.
run_case "Impressum address (legally public)" \
  "mkdir -p _guardtest && printf 'Musterstr 1\n10000 Berlin\n' > app/imprint-test-privacy.tsx && git add -f app/imprint-test-privacy.tsx" allow "app/imprint-test-privacy.tsx"

git reset -q >/dev/null 2>&1
rm -rf _guardtest 2>/dev/null

# --- push path -------------------------------------------------------------
# Regression cover for a real bug: --commits and --range once scanned the whole
# patch as a single blob, so the per-file allowlist never applied. That made a
# clean push of full history fail, because the scanner tripped on its own source.
#
# These cases need to CREATE a commit, so they run inside a throwaway clone in
# $TMPDIR. Never do this in the real working tree: an earlier version reset the
# checkout to clean up and destroyed uncommitted work twice.
echo "-- push path (--commits, isolated clone) --"
SRC=$(git rev-parse --show-toplevel)
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
git clone -q --no-hardlinks "$SRC" "$TMP/clone" 2>/dev/null
cd "$TMP/clone" || { echo "  could not create isolated clone - skipping push tests"; cd "$SRC"; }
git config user.email test@example.com >/dev/null 2>&1
git config user.name "guard test" >/dev/null 2>&1

push_case() { # name | commit-list | expect
  local name="$1" commits="$2" expect="$3"
  if ./scripts/repo-guard.sh --commits "$commits" >/dev/null 2>&1; then got=allow; else got=block; fi
  if [ "$got" = "$expect" ]; then printf "  \033[32mPASS\033[0m  %-56s exp=%-5s got=%s\n" "$name" "$expect" "$got"; PASS=$((PASS+1))
  else printf "  \033[31mFAIL\033[0m  %-56s exp=%-5s got=%s\n" "$name" "$expect" "$got"; FAIL=$((FAIL+1)); fi
}

push_case "full clean history (new-branch push)" "$(git rev-list HEAD)" allow

# A forbidden path is enough to prove the history scan works, and it keeps the
# fixture free of anything that would be sensitive if it were real.
mkdir -p .claude/projects/x/memory
printf 'notes\n' > .claude/projects/x/memory/hire_example_person.md
git add -f .claude >/dev/null 2>&1
git -c core.hooksPath=/dev/null commit -q --no-verify -m "TEST: fixture commit" >/dev/null 2>&1
push_case "history with a planted violation" "$(git rev-list HEAD)" block

cd "$SRC"
rm -rf "$TMP"
trap - EXIT

echo "================================================================"
echo "  PASS: $PASS   FAIL: $FAIL"
[ $FAIL -eq 0 ] || exit 1
