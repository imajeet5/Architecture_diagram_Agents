#!/usr/bin/env bash
# Renders diagram sources into render/.
#   ./scripts/render.sh                  # render everything
#   ./scripts/render.sh slug [slug...]   # render only the given diagrams
#   ./scripts/render.sh --dark [slug...] # dark mermaid twins into render/.dark/
set -euo pipefail

cd "$(dirname "$0")/.."
mkdir -p render

dark=0
if [ "${1-}" = "--dark" ]; then
  dark=1
  shift
fi

# D2 SVGs embed both palettes and follow the viewer's prefers-color-scheme.
# Override with e.g. D2_DARK_THEME=201 (or empty to disable) before invoking.
export D2_DARK_THEME="${D2_DARK_THEME-200}"

only="$*"
matches() {
  [ -z "$only" ] && return 0
  case " $only " in *" $1 "*) return 0 ;; esac
  return 1
}

rendered=0
missing=""

render_d2() {
  for src in diagrams/*.d2; do
    [ -e "$src" ] || continue
    slug="$(basename "${src%.d2}")"
    matches "$slug" || continue
    out="render/$slug.svg"
    echo "d2      $src -> $out"
    d2 "$src" "$out"
    rendered=$((rendered + 1))
  done
}

render_mermaid() {
  # $1 = output dir, $2 = mermaid theme (optional, "" for the default light theme)
  outdir="$1"
  theme="${2-}"
  mkdir -p "$outdir"

  for src in diagrams/*.md; do
    [ -e "$src" ] || continue
    slug="$(basename "${src%.md}")"
    matches "$slug" || continue
    out="$outdir/$slug.svg"
    tmp="$(mktemp -d)"

    # mermaid-cli numbers outputs for markdown input (out-1.svg), so render
    # into a scratch dir and move the single result to its final name.
    if [ -n "$theme" ]; then
      # Bake the dashboard's dark background so the SVG also reads well when
      # opened directly in a browser tab.
      mmdc -i "$src" -o "$tmp/out.svg" -t "$theme" -b '#0d1117' --quiet
    else
      mmdc -i "$src" -o "$tmp/out.svg" --quiet
    fi

    set -- "$tmp"/out*.svg
    if [ ! -e "$1" ] || [ "$#" -ne 1 ]; then
      echo "error: $src must contain exactly one mermaid diagram" >&2
      exit 1
    fi

    echo "mermaid $src -> $out"
    mv "$1" "$out"
    rm -rf "$tmp"
    rendered=$((rendered + 1))
  done
}

if [ "$dark" -eq 1 ]; then
  # Mermaid needs a separately rendered dark variant; D2 is already dual-theme.
  if command -v mmdc >/dev/null 2>&1; then
    render_mermaid render/.dark dark
  else
    missing="$missing mmdc"
  fi
else
  if command -v d2 >/dev/null 2>&1; then
    render_d2
  else
    missing="$missing d2"
  fi

  if command -v mmdc >/dev/null 2>&1; then
    render_mermaid render
  else
    missing="$missing mmdc"
  fi
fi

if [ -n "$missing" ]; then
  echo "warn: missing tools:$missing — those diagrams were skipped" >&2
  echo "      install with: brew install d2 && npm i -g @mermaid-js/mermaid-cli" >&2
fi

if [ "$rendered" -eq 0 ] && [ -z "$missing" ]; then
  echo "nothing to render (diagrams/ is empty)"
fi
