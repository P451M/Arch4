---
name: update-arch4
description: Create or update this repository's Arch4 architecture model using MCP tools.
---

# Update Arch4 Architecture Model

Use the Arch4 MCP tools:

1. Call `arch4_start_update` with `mode: "auto"`.
2. Inspect repository source, dependency manifests, deployment/config files,
   tests, docs, and existing Arch4 model files.
3. Write evidenced architecture source with `arch4_write_architecture_source`.
4. Build with `arch4_build_artifacts`.
5. Show the map with `arch4_show_map`.

Do not invent architecture facts. Preserve uncertainty as open questions or
low-confidence metadata.
