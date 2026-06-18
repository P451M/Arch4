---
name: arch4-seed
description: Create this repository's initial Arch4 architecture model using MCP tools.
---

# Seed Arch4 Architecture Model

Use the Arch4 MCP tools:

1. Call `arch4_start_update` with `mode: "seed"`.
2. Inspect repository source, dependency manifests, deployment/config files,
   tests, docs, and architecture notes.
3. Create the initial C4 model from evidenced facts only.
4. Include system context and relevant container/component views supported by
   evidence.
5. Write source with `arch4_write_architecture_source`.
6. Build with `arch4_build_artifacts`.
7. Show the map with `arch4_show_map`.

Do not create dynamic views during initial seeding; suggest candidates instead.
Preserve uncertainty as open questions or low-confidence metadata.
