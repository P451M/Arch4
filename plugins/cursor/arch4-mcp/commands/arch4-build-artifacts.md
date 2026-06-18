---
name: arch4-build-artifacts
description: Build this repository's Arch4 rendered artifacts and show the map.
---

# Build Arch4 Architecture Artifacts

Use the Arch4 MCP tools:

1. Call `arch4_build_artifacts`.
2. If the build succeeds, call `arch4_show_map`.
3. Display the returned architecture map widget when the host supports it.
4. If the build fails, report the diagnostics and stop.

Do not hand-edit `.arch4/architecture/build/**`; it is generated output.
