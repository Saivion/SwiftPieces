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
done < <(find registry/swift -name '*.swift' | sort)

# UIKit runs a dynamic color's provider on whatever thread resolves the color, and SwiftUI resolves colors
# on its render thread. A provider written in main-actor code inherits the main actor unless it is
# @Sendable, and Swift then traps when it runs there (issue #40). The compiler can't see this one.
unsendable=$(grep -rnE 'UIColor *\{|dynamicProvider: *\{' registry/swift --include='*.swift' | grep -v '@Sendable' | grep -vE -- '-> *UIColor *\{' || true)
if [ -n "$unsendable" ]; then
  echo "  FAIL  UIColor providers must be @Sendable:"; echo "$unsendable"; fail=1
fi

while IFS= read -r file; do
  if xcrun -sdk iphonesimulator metal -c "$file" -o /tmp/swiftpieces-shader.air 2>/tmp/swiftpieces-metal.log; then
    printf "  ok    %s\n" "$file"
  else
    printf "  FAIL  %s\n" "$file"; cat /tmp/swiftpieces-metal.log; fail=1
  fi
done < <(find registry/swift -name '*.metal' | sort)

exit $fail
