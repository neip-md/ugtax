#!/usr/bin/env bash
#
# repo-guard.sh - single source of truth for "what must never enter this repo".
#
# WHY THIS EXISTS
#   This is a public repository, and an automated tool running a broad
#   `git add -A` stages whatever is in the working tree. That is harmless when
#   the tree contains only the project and not when it contains more, so the
#   structural rule is that the checkout lives in its own directory and never
#   at $HOME. This script is the backstop for what structure cannot catch on
#   its own: private paths, secret material, and prose that belongs elsewhere.
#
# USAGE
#   scripts/repo-guard.sh --staged          scan the git index      (pre-commit)
#   scripts/repo-guard.sh --range A..B      scan a commit range     (pre-push)
#   scripts/repo-guard.sh --all             scan ALL history+refs   (CI)
#   scripts/repo-guard.sh --worktree        scan files on disk      (ad hoc)
#
# Exit 0 = clean, 1 = violations found.

set -uo pipefail

RED=$'\033[31m'; YEL=$'\033[33m'; GRN=$'\033[32m'; NC=$'\033[0m'
[ -t 2 ] || { RED=''; YEL=''; GRN=''; NC=''; }

# ---------------------------------------------------------------------------
# 1. PATHS that must never be tracked
# ---------------------------------------------------------------------------
FORBIDDEN_PATHS='(^|/)\.claude(/|\.json|$)|(^|/)\.gstack/|(^|/)\.brain/|(^|/)\.wiki/|(^|/)\.openclaw/|(^|/)\.codex/|(^|/)\.letta/|(^|/)\.mcp\.json$|(^|/)\.ssh/|(^|/)\.gnupg/|(^|/)\.aws/|(^|/)\.azure/|(^|/)\.kube/|(^|/)\.docker/|(^|/)\.npmrc$|(^|/)\.netrc$|(^|/)\.pypirc$|(^|/)\.(zshrc|bashrc|zprofile|bash_profile|profile)$|(^|/)\.?(bash|zsh|python|node_repl)_history$|(^|/)\.zsh_sessions/|(^|/)id_(rsa|ed25519|ecdsa)|\.pem$|\.p12$|\.pfx$|(^|/)\.env($|\.)|(^|/)auth\.json$|(^|/)creds?\.json$|credentials|service[-_]account|(^|/)memory/|AUDIT_20[0-9]{2}|hire_[a-z_]+\.md$|repo-guard-terms'

# Legitimate exceptions to the path rules above.
ALLOW_PATHS='\.env\.local\.example$|\.env\.example$'

# ---------------------------------------------------------------------------
# 2. SECRET material in file contents
# ---------------------------------------------------------------------------
SECRET_CONTENT='-----BEGIN [A-Z ]*PRIVATE KEY-----|A(KIA|SIA)[0-9A-Z]{16}|sk-ant-[A-Za-z0-9_-]{24,}|sk-[A-Za-z0-9]{40,}|gh[pos]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{40,}|xox[baprs]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{35}|sbp_[a-f0-9]{40}|sb_secret_[A-Za-z0-9]{20,}|eyJhbGciOi[A-Za-z0-9_-]{20,}|_authToken=|(ANTHROPIC|OPENAI|LETTA|LOOPS|STRIPE|GITHUB|SUPABASE)_(API_|SERVICE_ROLE_|SECRET_)?(KEY|TOKEN)=[^[:space:]"'"'"'$]|(access_token|refresh_token)"?[[:space:]]*[:=][[:space:]]*"[A-Za-z0-9._-]{20,}'

# ---------------------------------------------------------------------------
# 3. CONFIDENTIAL BUSINESS CONTENT
#    Ordinary prose in ordinary files, which is precisely what secret scanners
#    do not catch: this is a standalone tax tool, so commercial or HR material
#    from any unrelated venture has no reason to appear in it.
#
#    The term list is deliberately NOT stored here. A list of names specific
#    enough to detect confidential material is disclosive in its own right, so
#    publishing the detector would publish the thing it protects. It lives in a
#    private file outside every checkout; override the location with
#    $REPO_GUARD_TERMS. Absent the file this layer is simply inactive, which is
#    the expected state for anyone who is not the maintainer.
# ---------------------------------------------------------------------------
TERMS_FILE="${REPO_GUARD_TERMS:-$HOME/.config/git/repo-guard-terms.txt}"
CONFIDENTIAL_CONTENT=''
if [ -r "$TERMS_FILE" ]; then
  CONFIDENTIAL_CONTENT=$(
    grep -v '^[[:space:]]*#' "$TERMS_FILE" | sed 's/[[:space:]]*$//' | grep -v '^$' |
      paste -sd '|' -
  )
fi

# ---------------------------------------------------------------------------
# 3b. PERSONAL DATA (date of birth)
#     Matched only as LABEL + ACTUAL VALUE. The bare word "Geburtsdatum" is a
#     field label on German tax forms and appears 131 times in ELSTER's own
#     dictionary (services/submit/feldkennung_map.json); a bare date is any
#     statutory cutoff. Only the two together indicate a real person's DoB.
# ---------------------------------------------------------------------------
PERSONAL_DATA='(Geburtsdatum|geboren am|geb\.|date of birth|D\.?O\.?B\.?)[^0-9]{0,25}[0-3][0-9][./-][0-1][0-9][./-](19|20)[0-9]{2}'

# Content patterns that are false positives (documented, not guesses).
#   DE89370400440532013000 = canonical German test IBAN (Deutsche Bank Musterkonto)
#   Impressum/Datenschutz pages must publish a real address under German law (§5 TMG)
CONTENT_EXCLUDE='sb_publishable_|NEXT_PUBLIC_|YOUR-|placeholder|PLACEHOLDER|example|EXAMPLE|"integrity":|sha512-|sha256-|sk-ant-\.\.\.|\$\{|DE89370400440532013000|repo-guard'
# The guard's own machinery must contain trigger strings to work and to be
# tested, so it is exempt from the content rules. Keep this list minimal -
# every entry is a file where a real secret could hide unscanned, so these are
# the files to read closely in review.
ALLOW_CONTENT_PATHS='(imprint|privacy|impressum|datenschutz)|scripts/repo-guard\.sh$|scripts/test-repo-guard\.sh$|\.githooks/|\.github/workflows/security-scan\.yml$|SECURITY\.md$'

VIOLATIONS=0

say_fail() { printf '%s\n' "${RED}  ✗ $1${NC}" >&2; }
show()     { printf '%s\n' "$1" | head -12 | cut -c1-140 | sed 's/^/      /' >&2; }

# --- check a newline-separated list of paths --------------------------------
check_paths() {
  local paths="$1" hits
  [ -z "$paths" ] && return 0
  hits=$(printf '%s\n' "$paths" | grep -Ev '^$' | grep -Ev "$ALLOW_PATHS" | grep -E "$FORBIDDEN_PATHS" | sort -u)
  if [ -n "$hits" ]; then
    say_fail "forbidden path(s) - private/agent/credential files do not belong in this repo:"
    show "$hits"; VIOLATIONS=1
  fi
}

# --- check a blob of text (added lines, or file contents) -------------------
check_content() {
  local text="$1" label="$2" hits
  [ -z "$text" ] && return 0
  hits=$(printf '%s\n' "$text" | grep -Ev "$CONTENT_EXCLUDE" | grep -EI -e "$SECRET_CONTENT")
  if [ -n "$hits" ]; then
    say_fail "possible secret material in $label:"; show "$hits"; VIOLATIONS=1
  fi
  if [ -n "$CONFIDENTIAL_CONTENT" ]; then
    hits=$(printf '%s\n' "$text" | grep -Ev "$CONTENT_EXCLUDE" | grep -EiI -e "$CONFIDENTIAL_CONTENT")
    if [ -n "$hits" ]; then
      say_fail "confidential business content in $label (this repo is a standalone tax tool):"
      show "$hits"; VIOLATIONS=1
    fi
  fi
  hits=$(printf '%s\n' "$text" | grep -Ev "$CONTENT_EXCLUDE" | grep -EiI -e "$PERSONAL_DATA")
  if [ -n "$hits" ]; then
    say_fail "personal data in $label (a date of birth with its label):"
    show "$hits"; VIOLATIONS=1
  fi
}

# --- read a unified diff on stdin, emit added lines from non-allowlisted files
# The allowlist is per-file, so a patch must be split by file before scanning.
# Without this, --range/--commits would scan the whole patch as one blob: the
# scanner would trip on its own source and block a clean push of full history.
filter_patch() {
  awk -v allow="$ALLOW_CONTENT_PATHS" '
    /^diff --git / { f = $3; sub(/^a\//, "", f); skip = (f ~ allow); next }
    /^\+\+\+ /     { next }
    /^\+/          { if (!skip) print }
  '
}

MODE="${1:---staged}"

case "$MODE" in
  --staged)
    printf '%s\n' "${YEL}repo-guard: scanning staged changes…${NC}" >&2
    check_paths "$(git diff --cached --name-only --diff-filter=ACMR)"
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      printf '%s\n' "$f" | grep -qE "$ALLOW_CONTENT_PATHS" && continue
      check_content "$(git diff --cached -U0 -- "$f" | grep -E '^\+' | grep -Ev '^\+\+\+')" "$f"
    done <<< "$(git diff --cached --name-only --diff-filter=ACMR)"
    ;;

  --range)
    RANGE="${2:-}"
    [ -z "$RANGE" ] && { echo "usage: repo-guard.sh --range A..B" >&2; exit 2; }
    printf '%s\n' "${YEL}repo-guard: scanning $RANGE…${NC}" >&2
    check_paths "$(git diff --name-only --diff-filter=ACMR "$RANGE" 2>/dev/null)"
    check_content "$(git diff -U0 "$RANGE" 2>/dev/null | filter_patch)" "$RANGE"
    ;;

  --commits) # newline-separated commit list (used by pre-push for new branches)
    COMMITS="${2:-}"
    [ -z "$COMMITS" ] && exit 0
    printf '%s\n' "${YEL}repo-guard: scanning $(printf '%s\n' "$COMMITS" | grep -c .) commit(s)…${NC}" >&2
    check_paths "$(printf '%s\n' $COMMITS | git diff-tree --stdin -r --root --no-commit-id --name-only 2>/dev/null)"
    check_content "$(printf '%s\n' $COMMITS | git diff-tree --stdin -r -p --root --no-commit-id 2>/dev/null | filter_patch)" "outgoing commits"
    ;;

  --all) # full history, every ref, every blob - the CI gate
    printf '%s\n' "${YEL}repo-guard: scanning ALL refs and full history…${NC}" >&2
    check_paths "$(git log --all --pretty=format: --name-only --diff-filter=ACMR 2>/dev/null | sort -u)"
    while read -r obj path; do
      [ "$(git cat-file -t "$obj" 2>/dev/null)" = "blob" ] || continue
      [ -z "$path" ] && continue
      printf '%s\n' "$path" | grep -qE "$ALLOW_CONTENT_PATHS" && continue
      check_content "$(git cat-file blob "$obj" 2>/dev/null)" "$path"
    done <<< "$(git rev-list --all --objects 2>/dev/null | awk 'NF>1')"
    ;;

  --worktree)
    printf '%s\n' "${YEL}repo-guard: scanning working tree…${NC}" >&2
    check_paths "$(git ls-files)"
    while IFS= read -r f; do
      [ -z "$f" ] && continue
      printf '%s\n' "$f" | grep -qE "$ALLOW_CONTENT_PATHS" && continue
      check_content "$(cat "$f" 2>/dev/null)" "$f"
    done <<< "$(git ls-files)"
    ;;

  *) echo "usage: repo-guard.sh [--staged|--range A..B|--commits <list>|--all|--worktree]" >&2; exit 2 ;;
esac

# --- structural assertion: this repo must never be rooted at $HOME ----------
TOP=$(git rev-parse --show-toplevel 2>/dev/null)
if [ -n "$TOP" ] && [ "$TOP" = "$HOME" ]; then
  say_fail "this git repo is rooted at \$HOME ($HOME)."
  printf '%s\n' "      A broad 'git add -A' here would stage your whole home directory." >&2
  printf '%s\n' "      Move the checkout into its own directory before committing." >&2
  VIOLATIONS=1
fi

if [ "$VIOLATIONS" -ne 0 ]; then
  printf '%s\n' "" >&2
  printf '%s\n' "${RED}repo-guard: BLOCKED.${NC} See SECURITY.md for why these rules exist." >&2
  exit 1
fi
printf '%s\n' "${GRN}repo-guard: clean${NC}" >&2
exit 0
