#!/usr/bin/env bash
# Renders the social cards (opengraph-image.png + twitter-image.png) for Free and Pro.
#
#   bash scripts/og/render.sh
#
# Next.js serves app/opengraph-image.png and app/twitter-image.png automatically and appends a
# content hash to the meta tag URL, so a redeploy is all that's needed after re-rendering.
# glyph.png is the white mark from public/logo.png with the red removed (used as a CSS mask).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
FREE="$(cd "$HERE/../.." && pwd)"
PRO="$(cd "$FREE/../SwiftPiecesPro" 2>/dev/null && pwd || true)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
GLYPH="data:image/png;base64,$(base64 < "$HERE/glyph.png" | tr -d '\n')"

# render <out-dir> <title-html> <subtitle> <domain>
render() {
  cat > "$TMP/card.html" <<EOF
<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@500;600;700&display=block" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden;background:#0b0b0b;font-family:Figtree,sans-serif}
.card{position:relative;width:1200px;height:630px;background:radial-gradient(900px 600px at 85% 90%,#1a0606 0%,#0b0b0b 60%)}
h1{position:absolute;left:84px;top:96px;color:#fff;font-size:92px;font-weight:700;letter-spacing:-3px;line-height:1}
h1 em{font-style:normal;color:#ff0000}
p{position:absolute;left:86px;top:218px;width:540px;color:#8d8d8d;font-size:36px;font-weight:500;line-height:1.22;letter-spacing:-.4px}
.url{position:absolute;left:86px;top:392px;color:#5a5a5a;font-size:24px;font-weight:600;letter-spacing:-.2px}
.glyph{position:absolute;left:712px;top:156px;width:540px;height:536px;background:#ff0000;
  -webkit-mask:url($GLYPH) center/contain no-repeat;mask:url($GLYPH) center/contain no-repeat}
</style></head><body><div class="card">
<h1>$2</h1><p>$3</p><div class="url">$4</div><div class="glyph"></div>
</div></body></html>
EOF
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1200,630 --virtual-time-budget=5000 \
    --screenshot="$TMP/card.png" "file://$TMP/card.html" 2>/dev/null
  cp "$TMP/card.png" "$1/app/opengraph-image.png"
  cp "$TMP/card.png" "$1/app/twitter-image.png"
  echo "wrote $1/app/{opengraph,twitter}-image.png"
}

render "$FREE" "Swift Pieces" "Open-source SwiftUI components, built to feel native." "swiftpieces.com"
[ -n "$PRO" ] && render "$PRO" "Swift Pieces <em>Pro</em>" "Production-ready SwiftUI screens and app templates." "pro.swiftpieces.com"
rm -rf "$TMP"
