#!/usr/bin/env bash
# dump.sh — minimal, paste-friendly code export for a fresh ChatGPT thread
# Usage: bash dump.sh [OUTPUT_FILE]
set -euo pipefail

OUT="${1:-code_dump.txt}"
: > "$OUT"

dump() {
  local f="$1"
  echo "=== File: $f ==="        >> "$OUT"
  echo "Content:"               >> "$OUT"
  cat "$f"                      >> "$OUT"
  echo -e "\n=== End of $f ===\n" >> "$OUT"
}

echo "# Gday-Gains code export ($(date +%Y-%m-%dT%H:%M:%S))" >> "$OUT"
echo >> "$OUT"

# ---- Frontend (React) ----
# Include only what the model needs to understand & modify the app
ROOT_FE=("package.json" "tsconfig.json")
for f in "${ROOT_FE[@]}"; do
  [[ -f "$f" ]] && dump "$f"
done

# Frontend src (TypeScript/TSX only; skip tests, stories, maps, assets)
if [[ -d "src" ]]; then
  while IFS= read -r -d '' f; do dump "$f"; done < <(
    find src -type f \( -name "*.ts" -o -name "*.tsx" \) \
      ! -name "*.test.*" ! -name "*.spec.*" ! -path "*/__tests__/*" \
      -print0 | sort -z
  )
fi

# ---- Backend (Node/Express) ----
if [[ -d "backend" ]]; then
  [[ -f "backend/package.json" ]]  && dump "backend/package.json"
  [[ -f "backend/tsconfig.json" ]] && dump "backend/tsconfig.json"

  while IFS= read -r -d '' f; do dump "$f"; done < <(
    find backend -type f -name "*.js" -print0 2>/dev/null | sort -z
  )
fi

# (Optional) include mockResults/dev helpers if present
[[ -f "backend/mockResults.js" ]] && dump "backend/mockResults.js"

echo "Wrote $(wc -l < "$OUT") lines to $OUT"