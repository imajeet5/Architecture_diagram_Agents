#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p render

rendered=0
missing=""

render_d2() {
  for src in diagrams/*.d2; do
    [ -e "$src" ] || continue
    out="render/$(basename "${src%.d2}").svg"
    echo "d2      $src -> $out"
    d2 "$src" "$out"
    rendered=$((rendered + 1))
  done
}

render_mermaid() {
  for src in diagrams/*.md; do
    [ -e "$src" ] || continue
    slug="$(basename "${src%.md}")"
    out="render/$slug.svg"
    echo "mermaid $src -> $out"
    rm -f render/"$slug"-*.svg
    mmdc -i "$src" -o "$out" --quiet
    if [ ! -f "$out" ]; then
      first="$(ls render/"$slug"-*.svg 2>/dev/null | head -n 1 || true)"
      [ -n "$first" ] && mv "$first" "$out"
    fi
    rendered=$((rendered + 1))
  done
}

if command -v d2 >/dev/null 2>&1; then
  render_d2
else
  missing="$missing d2"
fi

if command -v mmdc >/dev/null 2>&1; then
  render_mermaid
else
  missing="$missing mmdc"
fi

if [ -n "$missing" ]; then
  echo "warn: missing tools:$missing — those diagrams were skipped" >&2
  echo "      install with: brew install d2 && npm i -g @mermaid-js/mermaid-cli" >&2
fi

if [ "$rendered" -eq 0 ] && [ -z "$missing" ]; then
  echo "nothing to render (diagrams/ is empty)"
fi
