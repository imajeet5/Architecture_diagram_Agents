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
| `scripts/render.sh` | Renders all sources into `render/` |
| `scripts/preview.sh` | Renders, builds `render/index.html` gallery, opens it in Chrome |
| `.github/workflows/diagrams.yml` | CI: renders every diagram on each PR to catch syntax errors |

## Previewing diagrams locally

```sh
./scripts/preview.sh                     # render all + open gallery of every SVG in Chrome
./scripts/preview.sh payments-platform   # render all + open a single diagram
PREVIEW_NO_OPEN=1 ./scripts/preview.sh   # build the gallery without opening a browser
```

## Review workflow

- **Mermaid** renders directly in the PR diff on GitHub.
- **D2** is rendered to `render/<slug>.svg`; open that file in the PR's *Files changed* tab to preview it.

## Protecting `main`

Enable branch protection on `main` (Settings → Branches → Require a pull request) so diagram content always arrives via PR. `main` is a template branch and should stay clean.
