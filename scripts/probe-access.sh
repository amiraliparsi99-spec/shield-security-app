#!/bin/bash
# Manual check that dashboard access control behaves. Run with the dev server up:
#   bash scripts/probe-access.sh [base-url]
BASE="${1:-http://localhost:3002}"

check() {
  local role="$1" url="$2" expect="$3"
  local args=(-s -o /tmp/probe-body.html -w '%{http_code}')
  [ "$role" != "none" ] && args+=(-b "shield_guest_role=$role")
  local code
  code=$(curl "${args[@]}" "$BASE$url")

  local verdict
  if [ "$code" = "307" ]; then
    verdict="BLOCKED"
  elif grep -q NEXT_REDIRECT /tmp/probe-body.html 2>/dev/null; then
    verdict="BLOCKED"
  else
    verdict="RENDERED"
  fi

  local mark="ok  "
  [ "$verdict" != "$expect" ] && mark="FAIL"
  printf '%s guest=%-11s %-14s %-9s (expected %s)\n' "$mark" "$role" "$url" "$verdict" "$expect"
}

echo "--- correct role: should render (guest preview is on outside production) ---"
check venue     /d/venue     RENDERED
check agency    /d/agency    RENDERED
check personnel /d/personnel RENDERED

echo "--- wrong or invalid role: should be blocked ---"
check agency    /d/venue     BLOCKED
check venue     /d/agency    BLOCKED
check personnel /d/agency    BLOCKED
check superuser /d/agency    BLOCKED
check agency    /admin       BLOCKED
check none      /d/agency    BLOCKED
