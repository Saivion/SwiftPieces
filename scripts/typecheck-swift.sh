#!/usr/bin/env bash
# Type-checks every registry Swift file against the iOS simulator SDK so no
# invented API can ship. Metal files are compiled with the Metal compiler.
set -euo pipefail
cd "$(dirname "$0")/.."

SDK=$(xcrun --sdk iphonesimulator --show-sdk-path)
SDK_VERSION=$(xcrun --sdk iphonesimulator --show-sdk-version)
TARGET="arm64-apple-ios${SDK_VERSION}-simulator"
fail=0

echo "Swift type-check against iOS ${SDK_VERSION} simulator SDK"
while IFS= read -r file; do
  if xcrun swiftc -typecheck -parse-as-library -target "$TARGET" -sdk "$SDK" -swift-version 6 "$file" 2>/tmp/swiftpieces-typecheck.log; then
    printf "  ok    %s\n" "$file"
  else
    printf "  FAIL  %s\n" "$file"; cat /tmp/swiftpieces-typecheck.log; fail=1
  fi
done < <(find registry/swift -name '*.swift' | sort)

while IFS= read -r file; do
  if xcrun -sdk iphonesimulator metal -c "$file" -o /tmp/swiftpieces-shader.air 2>/tmp/swiftpieces-metal.log; then
    printf "  ok    %s\n" "$file"
  else
    printf "  FAIL  %s\n" "$file"; cat /tmp/swiftpieces-metal.log; fail=1
  fi
done < <(find registry/swift -name '*.metal' | sort)

exit $fail
