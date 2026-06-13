# Seed Arch4 Architecture Model

Create this repository's initial Arch4 architecture model.

Use both the C4 skill and the Arch4 skill. Follow this workflow:

1. Read `.arch4/architecture/workspace.dsl` and any entity metadata under `.arch4/architecture/entities/`.
2. Determine the DSL identifier mode. If `!identifiers hierarchical` is present, draft an identifier inventory before writing many relationships, views, or metadata files.
3. Inspect repository source files, dependency manifests, deployment/config files, tests, docs, and existing architecture notes needed to understand the actual architecture.
4. Create or refresh the initial C4 model in `.arch4/architecture/workspace.dsl` using only evidenced facts:
   - include a system context view; if actors or external dependencies are unknown, include at least the target software system and record open questions
   - include all relevant container views supported by evidence
   - include only component views that have meaningful evidenced relationships; skip or justify relationship-free component candidates
   - include deployment views only when deployment/runtime evidence exists
   - use relationship labels that read as `<source> <label> <target>`, including needed prepositions
   - treat package-as-container modeling as an explicit convention when runtime boundaries are not evidenced
5. Use staged validation before metadata generation for large DSL edits.
6. Create or update `.arch4/architecture/entities/*.json` metadata from validated identifiers for modeled entities, including paths, owners when known, confidence, open questions, and notes that follow the Arch4 skill's entity notes guidance.
7. Do not create dynamic views during initial seeding. Instead, identify suitable dynamic view candidates.
8. Do not edit files under `.arch4/architecture/build/**`; they are derived output.
9. If an Arch4 CLI is available, run `arch4 validate`, `arch4 render`, and `arch4 index` after source edits and report the result.

Return a concise summary of model changes, evidence used, open questions, and suggested dynamic views. Ask which suggested dynamic views should be created next.
