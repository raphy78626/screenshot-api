#!/usr/bin/env bash
# verify-bundle.sh — verify an audit evidence ZIP bundle
# Usage: ./verify-bundle.sh <path-to-zip>
set -euo pipefail

ZIP="${1:-}"
if [[ -z "$ZIP" ]]; then
  echo "Usage: $0 <audit-evidence-bundle.zip>" >&2
  exit 1
fi

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "Extracting $ZIP ..."
unzip -q "$ZIP" -d "$TMPDIR"

MANIFEST="$TMPDIR/manifest.json"
if [[ ! -f "$MANIFEST" ]]; then
  echo "ERROR: manifest.json not found in bundle" >&2
  exit 1
fi

PASS=0
FAIL=0
SKIP=0

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  AUDIT EVIDENCE BUNDLE VERIFICATION"
echo "  Bundle: $(basename "$ZIP")"
echo "  Exported: $(python3 -c "import json,sys; d=json.load(open('$MANIFEST')); print(d.get('exportedAt','unknown'))" 2>/dev/null || echo 'unknown')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Read each page entry from manifest
PAGE_COUNT=$(python3 -c "import json,sys; d=json.load(open('$MANIFEST')); print(len(d.get('pages',[])))" 2>/dev/null || echo 0)

for i in $(seq 0 $((PAGE_COUNT - 1))); do
  ENTRY=$(python3 -c "
import json, sys
d = json.load(open('$MANIFEST'))
p = d['pages'][$i]
print(p.get('fileName',''))
print(p.get('pdfSha256',''))
print(p.get('title',''))
print(p.get('version',''))
print(p.get('capturedAt',''))
" 2>/dev/null)

  FILENAME=$(echo "$ENTRY" | sed -n '1p')
  EXPECTED=$(echo "$ENTRY" | sed -n '2p')
  TITLE=$(echo "$ENTRY" | sed -n '3p')
  VERSION=$(echo "$ENTRY" | sed -n '4p')
  CAPTURED=$(echo "$ENTRY" | sed -n '5p')

  echo ""
  echo "  Page: $TITLE (v$VERSION)"
  echo "  File: $FILENAME"
  echo "  Captured: $CAPTURED"

  PDF="$TMPDIR/$FILENAME"
  if [[ ! -f "$PDF" ]]; then
    echo "  Status: MISSING — file not found in ZIP"
    ((FAIL++))
    continue
  fi

  if [[ -z "$EXPECTED" ]]; then
    echo "  Status: SKIP — no pdfSha256 in manifest (capture error?)"
    ((SKIP++))
    continue
  fi

  ACTUAL=$(shasum -a 256 "$PDF" | awk '{print $1}')
  echo "  Expected: $EXPECTED"
  echo "  Actual:   $ACTUAL"

  if [[ "$ACTUAL" == "$EXPECTED" ]]; then
    echo "  Status: PASS ✓"
    ((PASS++))
  else
    echo "  Status: FAIL ✗ — hash mismatch (file may have been tampered with)"
    ((FAIL++))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Results: $PASS passed · $FAIL failed · $SKIP skipped"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [[ $FAIL -gt 0 ]]; then
  exit 1
fi
