#!/usr/bin/env bash
# Point git at the tracked hooks in .githooks/ and verify the guard runs.
# Run once per clone:  scripts/install-hooks.sh
set -euo pipefail
ROOT=$(git rev-parse --show-toplevel)
cd "$ROOT"

if [ "$ROOT" = "$HOME" ]; then
  echo "REFUSING: this repo is checked out at \$HOME. Move it to its own directory first." >&2
  exit 1
fi

chmod +x .githooks/pre-commit .githooks/pre-push scripts/repo-guard.sh
git config core.hooksPath .githooks

echo "hooks installed (core.hooksPath=.githooks)"
echo "verifying guard runs…"
./scripts/repo-guard.sh --worktree
