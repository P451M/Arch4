---
name: arch4-review
description: Review whether this repository's Arch4 architecture model matches the current code.
---

# Review Arch4 Architecture Model

Use the Arch4 MCP tools:

1. Call `arch4_start_update` with `mode: "review"`.
2. Call `arch4_diagnostics`.
3. Inspect changed files, repository source, dependency manifests,
   deployment/config files, tests, docs, and existing Arch4 source.
4. Identify model drift in responsibilities, boundaries, containers,
   components, relationships, deployment topology, runtime technologies, data
   ownership, and path ownership.
5. If updates are needed, write evidenced source with
   `arch4_write_architecture_source`, build with `arch4_build_artifacts`,
   and show the map with `arch4_show_map`.
6. If no updates are needed, summarize the evidence and diagnostics.

Do not invent architecture facts. Preserve uncertainty as open questions or
low-confidence metadata.
