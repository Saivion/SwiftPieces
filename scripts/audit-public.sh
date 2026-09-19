#!/usr/bin/env bash
# Public-safety audit for the Free repo (Rev 3 §3.2, §11 step 12, §12).
# Fails if anything Pro-shaped, secret-shaped, or database-shaped is present.
set -uo pipefail
cd "$(dirname "$0")/.."
fail=0
note() { printf "  %-8s %s\n" "$1" "$2"; }

echo "Public-safety audit"

# 1. No entitlement / billing / database code.
hits=$(grep -rniE "autumn|entitle|failOpen|drizzle|d1_databases|clerkMiddleware|ClerkProvider|CLERK_SECRET|license_key|keyHash" \
  --include='*.ts' --include='*.tsx' --include='*.jsonc' --include='*.json' --include='*.mjs' \
  app components lib scripts packages/brand/src packages/cli/src wrangler.jsonc next.config.ts open-next.config.ts package.json 2>/dev/null \
  | grep -viE "pro\.swiftpieces\.com|x-license-key|licenseKey|license key|readLicenseKey|writeLicenseKey|LICENSE_KEY|auth\.json|/license" )
if [ -n "$hits" ]; then note FAIL "entitlement/billing/db references:"; echo "$hits" | sed 's/^/           /'; fail=1; else note ok "no entitlement, billing or database code"; fi

# 2. No Pro categories or tiers in the registry schema/build.
if grep -qE '"blocks"|"app-ui"|"screens"|"templates"|"agent-kit"|tier:' lib/registry-schema.ts scripts/build-registry.ts; then note FAIL "Pro categories or tiers in registry schema/build"; fail=1; else note ok "registry has no Pro categories or tiers"; fi
if [ -d registry/swift/blocks ] || [ -d registry/swift/screens ] || [ -d registry/swift/templates ] || [ -d registry/swift/app-ui ]; then note FAIL "Pro source folders under registry/swift"; fail=1; else note ok "no Pro source folders"; fi

# 3. Env: only NEXT_PUBLIC_ placeholders, and no secret-looking values anywhere tracked.
if git ls-files 2>/dev/null | grep -E '(^|/)\.env($|\.)|(^|/)\.dev\.vars$' | grep -q .; then note FAIL "an env file is tracked by git"; fail=1; else note ok "no env files tracked by git"; fi
for f in .env .env.local .env.production .dev.vars; do grep -qxF "$f" .gitignore || { note FAIL "$f missing from .gitignore"; fail=1; }; done
if grep -rnE "(sk|pk)_(live|test)_[A-Za-z0-9]{12,}|am_sk_[A-Za-z0-9]{8,}|re_[A-Za-z0-9]{16,}|AKIA[0-9A-Z]{16}" --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.open-next --exclude-dir=.git . 2>/dev/null | grep -v "\.example" | grep -q .; then note FAIL "secret-looking values in tracked files"; fail=1; else note ok "no secret-looking values"; fi

# 4. No premium Swift in public/ or built assets (every free piece is MIT + Commons Clause, so we only check nothing outside registry/ ships Swift).
if grep -rl "import SwiftUI" public .open-next/assets 2>/dev/null | grep -q .; then note FAIL "Swift source under public/ or built assets"; fail=1; else note ok "no Swift source in public assets"; fi

# 5. No references into a sibling pro/ checkout.
if grep -rn "\.\./\.\./pro\|\.\./pro/" --include='*.ts' --include='*.tsx' --include='*.json' app components lib scripts packages 2>/dev/null | grep -q .; then note FAIL "imports reach into ../pro"; fail=1; else note ok "no imports into ../pro"; fi

# Source maps: built client assets must not ship .map files or point at one, so DevTools only
# ever shows minified bundles.
for dir in .next/static .open-next/assets; do
  [ -d "$dir" ] || continue
  maps=$(find "$dir" -name '*.map' 2>/dev/null | head -5)
  refs=$(grep -rlE "sourceMappingURL=" "$dir" --include='*.js' --include='*.css' 2>/dev/null | head -5)
  if [ -n "$maps$refs" ]; then note FAIL "source maps under $dir:"; printf '%s\n' $maps $refs | sed 's/^/           /'; fail=1; else note ok "no source maps under $dir"; fi
done

[ $fail -eq 0 ] && echo "Audit passed." || { echo "Audit failed."; exit 1; }
