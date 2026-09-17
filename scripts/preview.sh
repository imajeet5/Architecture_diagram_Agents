#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

./scripts/render.sh

target="${1:-}"

write_gallery() {
  {
    cat <<'HTML'
<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Diagram preview</title>
<style>
  :root { color-scheme: light; }
  body { margin: 0; padding: 2rem 1.5rem 4rem; background: #f6f7f9;
         font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #24292f; }
  h1 { font-size: 18px; margin: 0 0 1.5rem; }
  h1 span { color: #6e7781; font-weight: normal; }
  figure { margin: 0 0 2rem; padding: 1rem; background: #fff; border: 1px solid #d0d7de;
           border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,.04); }
  figcaption { margin-bottom: .75rem; font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
               font-size: 12px; color: #57606a; }
  img { display: block; width: 100%; height: auto; }
  main { max-width: 1400px; margin: 0 auto; }
</style>
</head>
<body>
<main>
<h1>Diagram preview <span id="count"></span></h1>
HTML
    for f in render/*.svg; do
      [ -e "$f" ] || continue
      name="$(basename "$f")"
      printf '<figure><figcaption>%s</figcaption><img src="%s" alt="%s"></figure>\n' "$name" "$name" "$name"
    done
    cat <<'HTML'
<script>document.getElementById('count').textContent = '(' + document.querySelectorAll('figure').length + ' diagrams)';</script>
</main>
</body>
</html>
HTML
  } > render/index.html
}

if [ -n "$target" ]; then
  slug="${target#render/}"
  slug="${slug%.svg}"
  url="render/$slug.svg"
  if [ ! -f "$url" ]; then
    echo "error: no rendered diagram at $url (expected diagrams/$slug.md or .d2)" >&2
    exit 1
  fi
else
  write_gallery
  url="render/index.html"
fi

if [ -n "${PREVIEW_NO_OPEN:-}" ]; then
  echo "PREVIEW_NO_OPEN set: not opening $url"
  exit 0
fi

if [ "$(uname)" = "Darwin" ] && open -Ra "Google Chrome" 2>/dev/null; then
  open -a "Google Chrome" "$url"
elif [ -n "${BROWSER:-}" ]; then
  "$BROWSER" "$url" &
elif command -v open >/dev/null 2>&1; then
  open "$url"
elif command -v xdg-open >/dev/null 2>&1; then
  xdg-open "$url"
else
  echo "open $url manually"
fi
