---
name: arch4-mcp
description: Use Arch4 MCP tools to create, update, build, and visualize repository architecture maps.
---

# Arch4 MCP

Use Arch4 MCP tools for architecture map workflows in Cursor Agent.

Call `arch4_start_update` before creating, updating, or reviewing architecture
source. Inspect repository evidence before writing model facts.

Write only Arch4 source through `arch4_write_architecture_source`:

- `.arch4/architecture/workspace.dsl`
- `.arch4/architecture/entities/*.json`

After source edits, call `arch4_build_artifacts`, then call
`arch4_show_map` to display the rendered architecture map widget.

Never hand-edit `.arch4/architecture/build/**`; it is generated output.
