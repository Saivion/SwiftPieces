#!/usr/bin/env bash
# Fails if the final bundled Worker exceeds the compressed limit (spec §4a: gate at ~8 MB).
set -euo pipefail
cd "$(dirname "$0")/.."
LIMIT_BYTES=$(( ${BUNDLE_LIMIT_MB:-8} * 1024 * 1024 ))
OUT=$(mktemp -d)
npx wrangler deploy --dry-run --outdir "$OUT" >/dev/null
SIZE=$(gzip -c "$OUT/worker.js" | wc -c | tr -d ' ')
printf "Worker bundle: %.2f MB compressed (limit %s MB)\n" "$(echo "$SIZE / 1048576" | bc -l)" "${BUNDLE_LIMIT_MB:-8}"
if [ "$SIZE" -gt "$LIMIT_BYTES" ]; then
  echo "::error::Worker bundle exceeds limit"; exit 1
fi
