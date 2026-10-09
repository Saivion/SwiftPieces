#!/usr/bin/env bash
# Type-checks every registry Swift file against the iOS simulator SDK so no
# invented API can ship. Metal files are compiled with the Metal compiler.
#
# Each piece is checked twice, because people copy it into both kinds of app:
#   default     Swift 6 with the default (nonisolated) isolation, as in older projects.
#   main-actor  the way an app created with Xcode 26 or later builds it: the main actor as the default
#               isolation, with Approachable Concurrency on. Helpers that run off the main actor (layout
#               keys, shape paths, animatable data, color providers) must be `nonisolated` to build here,
#               and warnings fail, since here they mark main-actor code reached from off the main actor.
set -euo pipefail
cd "$(dirname "$0")/.."

SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
SDK_VERSION=$(xcrun --sdk iphonesimulator --show-sdk-version)
TARGET="arm64-apple-ios${SDK_VERSION}-simulator"
MAIN_ACTOR=(-default-isolation MainActor -enable-upcoming-feature InferIsolatedConformances
  -enable-upcoming-feature NonisolatedNonsendingByDefault -warnings-as-errors)
fail=0

echo "Swift type-check against iOS ${SDK_VERSION} simulator SDK"
# The foundation files are checked as one: liquid sections build on motion sections (a press, a pop), and in a piece
# they always arrive together in one file. Everything in them is private, so separately neither could see the other.
cat registry/foundation/PieceMotion.swift registry/foundation/PieceLiquid.swift > /tmp/swiftpieces-foundation.swift
while IFS= read -r file; do
  for mode in default main-actor; do
    flags=()
    if [ "$mode" = main-actor ]; then flags=("${MAIN_ACTOR[@]}"); fi
    # `${flags[@]+...}` keeps an empty array from tripping `set -u` in the bash 3.2 macOS ships.
    if xcrun swiftc -typecheck -parse-as-library -target "$TARGET" -sdk "$SDK" -swift-version 6 ${flags[@]+"${flags[@]}"} "$file" 2>/tmp/swiftpieces-typecheck.log; then
      printf "  ok    %-10s %s\n" "$mode" "$file"
    else
      printf "  FAIL  %-10s %s\n" "$mode" "$file"; cat /tmp/swiftpieces-typecheck.log; fail=1
    fi
  done
done < <( { find registry/swift -name '*.swift'; echo /tmp/swiftpieces-foundation.swift; } | sort)

# UIKit runs a dynamic color's provider on whatever thread resolves the color, and SwiftUI resolves colors
# on its render thread. A provider written in main-actor code inherits the main actor unless it is
# @Sendable, and Swift then traps when it runs there (issue #40). The compiler can't see this one.
unsendable=$(grep -rnE 'UIColor *\{|dynamicProvider: *\{' registry/swift --include='*.swift' | grep -v '@Sendable' | grep -vE -- '-> *UIColor *\{' || true)
if [ -n "$unsendable" ]; then
  echo "  FAIL  UIColor providers must be @Sendable:"; echo "$unsendable"; fail=1
fi

# Liquid glass (LIQUID_GLASS.md). A piece's own code is everything before its vendored "Piece motion" or
# "Piece liquid" block; the foundation's code inside those blocks is allowed what pieces are not.
own() { awk '/^\/\/ MARK: - Piece (motion|liquid)$/ { exit } { print FILENAME ":" FNR ": " $0 }' "$1"; }
pieces=$(find registry/swift -name '*.swift' | sort)
# One font weight: semibold, for every string and SF Symbol. Haptic weights (`.impact(weight: .light)`) are not fonts.
weights=$(for f in $pieces; do own "$f"; done | grep -E 'weight: *\.(ultraLight|thin|light|regular|medium|bold|heavy|black)\b|\.(weight|fontWeight)\(\.(ultraLight|thin|light|regular|medium|bold|heavy|black)\)|\.bold\(\)|Font\.Weight\.(ultraLight|thin|light|regular|medium|bold|heavy|black)\b' | grep -vE 'impact\(|SensoryFeedback|sensoryFeedback' || true)
if [ -n "$weights" ]; then
  echo "  FAIL  font weights other than semibold (LIQUID_GLASS.md, rule 13):"; echo "$weights"; fail=1
fi
# Every piece that shows text sets semibold at its root. Read into a variable first: under pipefail, `grep -q`
# quitting early would SIGPIPE awk on a long piece and fail the pipeline whatever grep found.
for f in $pieces; do
  body=$(own "$f")
  if grep -q 'Text(' <<<"$body" && ! grep -q 'fontWeight(\.semibold)' <<<"$body"; then
    echo "  FAIL  $f shows text but never sets .fontWeight(.semibold) (LIQUID_GLASS.md, rule 13)"; fail=1
  fi
done
# Glass only through the foundation, except a piece whose subject is glass itself, marked on the line.
raw=$(for f in $pieces; do own "$f"; done | grep -E '\.glassEffect\(|GlassEffectContainer|\.(ultraThin|thin|regular|thick|ultraThick)Material\b' | grep -v 'liquid: native' || true)
if [ -n "$raw" ]; then
  echo "  FAIL  glass written outside the foundation; use .pieceLiquid and PieceLiquidGroup (LIQUID_GLASS.md, rule 1):"; echo "$raw"; fail=1
fi

while IFS= read -r file; do
  if xcrun -sdk iphonesimulator metal -c "$file" -o /tmp/swiftpieces-shader.air 2>/tmp/swiftpieces-metal.log; then
    printf "  ok    %s\n" "$file"
  else
    printf "  FAIL  %s\n" "$file"; cat /tmp/swiftpieces-metal.log; fail=1
  fi
done < <(find registry/swift -name '*.metal' | sort)

exit $fail
