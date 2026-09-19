# AGENTS.md — Architecture Diagram Base

This repository is the **base template** for creating architecture and flow diagrams.
`main` is a clean starting point; diagram work always happens on a branch and lands via PR.

Read this file fully before creating or editing anything.

## Non-negotiables

- Never commit diagram content directly to `main`.
- Text-first authoring only: **Mermaid** or **D2**. Never generate a raster image, and never draw with code (no React/JSX, no HTML canvas, no hand-placed coordinates). Both formats auto-layout.
- Every diagram has exactly one source file under `diagrams/`.
- D2 diagrams must have their rendered SVG committed under `render/` (GitHub cannot render `.d2`).
- Mermaid diagrams live in `.md` files and are rendered natively by GitHub in the PR diff.
- Run `./scripts/render.sh` before committing; it must exit 0.


## Choosing a format

| Use case | Format | Source file |
|---|---|---|
| System/cloud architecture, service maps, deployment, containers | **D2** | `diagrams/<slug>.d2` |
| Flowcharts, sequence, state machines, ER, C4, timelines | **Mermaid** | `diagrams/<slug>.md` |

Rules:

- Start from `templates/mermaid-architecture.md` or `templates/d2-architecture.d2`. Copy the skeleton; keep its structure.
- One diagram per file. Keep it under ~15 nodes. Split larger systems into several diagrams and cross-link them in the Context section.
- Auto-layout only — never position nodes manually.
- Label every edge with what flows over it (`HTTPS`, `gRPC`, `SQL`, `publish`).
- Mermaid: the `mermaid` fence must be the only fence in the file. Put a short `## Context` section above it (2–3 lines: why this diagram exists, what is out of scope) and `## Notes` below it if needed. Use `flowchart LR` unless the flow is shallow or wide.
- D2: use containers for boundaries, `direction: right` for wide systems, built-in shapes (`person`, `cloud`, `cylinder`, `queue`) when they clarify. Do not reference external icon URLs.
- Keep styling minimal (default theme); let structure carry the meaning. Do not hardcode colors — D2 renders are dual-theme (light 0 + dark 200 via `D2_DARK_THEME`) and adapt automatically.
- Preview locally without committing churn: `./scripts/dashboard.sh` serves a live dashboard; `./scripts/render.sh <slug>` re-renders a single diagram.

## Definition of done

- [ ] `./scripts/render.sh` exits 0 and `render/<slug>.svg` is committed for every D2 diagram
- [ ] Source file name matches the branch slug
- [ ] Diagram has a title and a 2–3 line Context section
- [ ] PR description: one sentence on what changed and why
