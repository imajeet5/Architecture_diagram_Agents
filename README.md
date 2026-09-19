# Architecture Diagrams

Base repository for agent-generated architecture and flow diagrams.

Every diagram is authored as **text source** (Mermaid or D2) so it can be reviewed in a PR, diffed, and regenerated. Agents follow [`AGENTS.md`](./AGENTS.md); this file is the human entry point.

## One-time setup

```sh
brew install d2                          # renders .d2 -> SVG
npm install -g @mermaid-js/mermaid-cli   # renders Mermaid -> SVG
```

GitHub renders Mermaid natively in PRs, so `mmdc` is mainly needed to keep local render output in sync; CI installs both automatically.

## How to get a diagram

Point any agent at this repo and ask, for example:

> Create an architecture diagram for our payments retry flow.

The agent will:

1. branch off `main` as `arch/payments-retry-flow`
2. add `diagrams/payments-retry-flow.md` (Mermaid) or `diagrams/payments-retry-flow.d2` (D2)
3. run `./scripts/render.sh` and commit `render/payments-retry-flow.svg`
4. open a PR into `main`

## Structure

| Path | Purpose |
|---|---|
| `AGENTS.md` | Protocol every agent follows (formats, naming, workflow) |
| `diagrams/` | One source file per diagram: `<slug>.md` (Mermaid) or `<slug>.d2` (D2) |
| `templates/` | Starting skeletons — copy, do not invent structure |
| `render/` | Generated SVG output, committed so reviewers can preview D2 diagrams |
| `scripts/render.sh` | Renders all sources into `render/` (or pass slugs for one-off renders) |
| `scripts/dashboard.sh` | Live dashboard: renders everything, serves a clickable gallery, re-renders on change |
| `scripts/preview.sh` | One-shot: renders, builds `render/index.html` gallery, opens it in Chrome |
| `.github/workflows/diagrams.yml` | CI: renders every diagram on each PR to catch syntax errors |

## Local dashboard

```sh
./scripts/dashboard.sh                   # render all + open http://127.0.0.1:4747 in Chrome
./scripts/dashboard.sh --port 5050       # custom port
./scripts/dashboard.sh --no-open         # don't launch a browser
```

- Sidebar lists every diagram (title + slug); click it, or use `j`/`k` / arrow keys to switch
- Edit a source in `diagrams/` — it re-renders automatically and the open diagram reloads
- **Light / Dark / System** toggle in the header; D2 SVGs are dual-theme (0 + 200) and follow it
- Mermaid diagrams get an on-demand dark variant in `render/.dark/` (gitignored, preview-only)
- Render errors appear inline instead of replacing the diagram
- `Ctrl-C` stops the server

Override the dark theme for committed renders with `D2_DARK_THEME=201 ./scripts/render.sh`
(set `D2_DARK_THEME=` empty to disable dark adaptation).

## One-shot preview

```sh
./scripts/preview.sh                     # render all + open a static gallery in Chrome
./scripts/preview.sh payments-platform   # render all + open a single diagram
PREVIEW_NO_OPEN=1 ./scripts/preview.sh   # build the gallery without opening a browser
```

## Review workflow

- **Mermaid** renders directly in the PR diff on GitHub.
- **D2** is rendered to `render/<slug>.svg`; open that file in the PR's *Files changed* tab to preview it.

## Protecting `main`

Enable branch protection on `main` (Settings → Branches → Require a pull request) so diagram content always arrives via PR. `main` is a template branch and should stay clean.
