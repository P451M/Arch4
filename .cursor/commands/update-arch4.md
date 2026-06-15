<!-- arch4-owned: true -->
# Update Arch4 Architecture Model

Update this repository's Arch4 architecture model.

Use both the C4 skill and the Arch4 skill. Follow this workflow:

1. Read `.arch4/architecture/workspace.dsl` and any entity metadata under `.arch4/architecture/entities/`.
2. Determine the DSL identifier mode. If `!identifiers hierarchical` is present, draft an identifier inventory before writing many relationships, views, or metadata files.
3. Inspect repository source files, dependency manifests, deployment/config files, and tests needed to understand the actual architecture.
4. Identify architecture-relevant changes: responsibilities, boundaries, containers, components, relationships, deployment topology, runtime technologies, data ownership, and path ownership.
5. Maintain the existing model from the changed facts. Do not reseed from scratch unless `.arch4/architecture/workspace.dsl` is still empty or minimal.
6. Preserve existing qualified identifiers unless a rename is explicitly justified.
7. Update only Arch4 architecture source files when facts changed:
   - `.arch4/architecture/workspace.dsl`
   - `.arch4/architecture/entities/*.json`
8. Update relevant entity notes when mapped responsibilities, boundaries, dependencies, data ownership, runtime technology, runtime behavior, ownership, or paths changed.
9. Use staged validation before metadata generation for large DSL edits.
10. Do not invent architecture facts. If evidence is insufficient, add an open question or leave the model unchanged and explain the uncertainty.
11. Do not edit files under `.arch4/architecture/build/**`; they are derived output.
12. If an Arch4 CLI is available, run `arch4 validate`, `arch4 render`, and `arch4 index` after source edits and report the result.
13. Inspect rendered view JSON and report node, edge, and boundary counts for each view.
14. Run `git status --short` and call out unexpected changes outside `.arch4/architecture/workspace.dsl` and `.arch4/architecture/entities/*.json`.

Return a concise summary of model changes, evidence used, and any open questions.