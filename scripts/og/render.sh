#!/usr/bin/env bash
# Renders the social card (opengraph-image.png) for Free and Pro.
#
#   bash scripts/og/render.sh
#
# Next.js serves app/opengraph-image.png automatically and appends a content hash to the meta tag
# URL, so a redeploy is all that's needed after re-rendering. There is deliberately no
# twitter-image.png: X falls back to og:image, so one file keeps the two cards from drifting.
# glyph.png is the white mark from public/logo.png with the red removed (used as a CSS mask).
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
FREE="$(cd "$HERE/../.." && pwd)"
PRO="$(cd "$FREE/../SwiftPiecesPro" 2>/dev/null && pwd || true)"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
GLYPH="data:image/png;base64,$(base64 < "$HERE/glyph.png" | tr -d '\n')"
LOGO="data:image/png;base64,$(base64 < "$FREE/public/logo.png" | tr -d '\n')"

# render <out-dir> <brand-html> <headline-html> <footer-html> <domain>
# Same shape as the site hero: lockup, the headline with its red word, then the way in.
render() {
  cat > "$TMP/card.html" <<EOF
<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@500;600;700;800&display=block" rel="stylesheet">
<style>
*{margin:0;box-sizing:border-box}
html,body{width:1200px;height:630px;overflow:hidden;background:#080808;font-family:Figtree,sans-serif;-webkit-font-smoothing:antialiased}
.card{position:relative;width:1200px;height:630px;overflow:hidden;
  background:radial-gradient(640px 540px at 90% 80%,rgba(255,0,0,.18),transparent 70%),#080808}
.grid{position:absolute;inset:0;background-image:radial-gradient(rgba(255,255,255,.11) 1.2px,transparent 1.5px);background-size:28px 28px;
  -webkit-mask:linear-gradient(90deg,transparent 35%,#000 80%)}
.frame{position:absolute;inset:28px;border:1px solid rgba(255,255,255,.07);border-radius:28px}
.brand{position:absolute;left:84px;top:80px;display:flex;align-items:center;gap:16px;color:#fff;font-size:28px;font-weight:700;letter-spacing:-.5px}
.brand img{width:48px;height:48px;border-radius:12px}
.brand em,h1 em{font-style:normal;color:#ff0000}
.url{position:absolute;right:84px;top:92px;color:#6a6a6a;font-size:22px;font-weight:600;letter-spacing:-.2px}
h1{position:absolute;left:80px;top:196px;width:640px;color:#fff;font-size:84px;font-weight:800;letter-spacing:-3.4px;line-height:.98}
.foot{position:absolute;left:84px;bottom:80px;display:flex;align-items:center;gap:24px}
.cmd{display:flex;align-items:center;gap:14px;height:58px;padding:0 24px;border:1px solid rgba(255,255,255,.13);border-radius:14px;background:#111;
  font-family:ui-monospace,"SF Mono",Menlo,monospace;font-size:21px;color:#f2f2f2}
.cmd span{color:#5c5c5c}
.tags{color:#8a8a8a;font-size:22px;font-weight:600;letter-spacing:-.2px}
.glyph{position:absolute;left:762px;top:196px;width:360px;height:360px;background:#ff0000;
  -webkit-mask:url($GLYPH) center/contain no-repeat;mask:url($GLYPH) center/contain no-repeat;filter:drop-shadow(0 0 48px rgba(255,0,0,.35))}
</style></head><body><div class="card">
<div class="grid"></div><div class="frame"></div>
<div class="brand"><img src="$LOGO"><span>$2</span></div><div class="url">$5</div>
<h1>$3</h1><div class="foot">$4</div><div class="glyph"></div>
</div></body></html>
EOF
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --window-size=1200,630 --virtual-time-budget=5000 \
    --screenshot="$TMP/card.png" "file://$TMP/card.html" 2>/dev/null
  cp "$TMP/card.png" "$1/app/opengraph-image.png"
  echo "wrote $1/app/opengraph-image.png"
}

render "$FREE" "Swift Pieces" "Native SwiftUI that feels <em>alive.</em>" "" "swiftpieces.com"
[ -n "$PRO" ] && render "$PRO" "Swift Pieces <em>Pro</em>" "The pieces<br>to build the<br>whole <em>app.</em>" \
  '<div class="tags">Screens · App Templates · Build Kit</div>' "pro.swiftpieces.com"
rm -rf "$TMP"
