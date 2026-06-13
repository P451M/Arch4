# Arch4 Architecture

Arch4 is split into deterministic architecture infrastructure and editor
integration:

- `@arch4/core` defines source layout, public contracts, and JSON helpers.
- `@arch4/renderer-structurizr` turns Structurizr export data into `DiagramSpec`.
- `@arch4/viewer` renders diagram-only architecture maps.
- `@arch4/cli` initializes, validates, renders, and indexes architecture workspaces.
- `packages/cursor-extension` hosts the Cursor commands, tree view, and webview.

Arch4 owns the repository-local architecture artifact layout and enriches it
with code and git evidence.
