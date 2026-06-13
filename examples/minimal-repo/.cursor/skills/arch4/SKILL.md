---
name: arch4
description: Maintain Arch4 workspaces, source files, entity metadata, derived outputs, and CLI workflow.
---

# Arch4 Architecture Maintenance

Use this skill when editing or reviewing Arch4 files for the current repository.
Use the C4 skill for C4 modeling terminology and diagram semantics.

## Source Locations

- Architecture DSL: `.arch4/architecture/workspace.dsl`
- Entity metadata: `.arch4/architecture/entities/*.json`
- Derived output: `.arch4/architecture/build/**`

## Entity Metadata Schema

Each entity metadata file is stored at
`.arch4/architecture/entities/{entityId}.json`:

```json
{
  "schemaVersion": 1,
  "entityId": "bookingApi",
  "owners": ["Platform"],
  "paths": ["src/booking-api/**/*"],
  "confidence": "high",
  "openQuestions": [],
  "notes": {}
}
```

Use `paths` for repository file globs. Do not use `pathGlobs`.

## Entity Notes

Use `notes` for durable, evidence-backed architecture context that is not
already obvious from the DSL, paths, owners, or relationships.

- Prefer `notes.summary` as the first field when notes are present. Keep it to
  1-3 concise sentences about the entity's durable architecture role, not an
  implementation walkthrough.
- Use structured keys when evidenced and useful: `summary`,
  `responsibilities`, `boundaries`, `dataOwnership`, `contracts`,
  `technologyNotes`, `dependencyNotes`, `operationalConcerns`, `decisions`,
  `risks`, and `evidence`.
- Use `technologyNotes` and `dependencyNotes` for explanatory context, not as
  duplicates of DSL technology labels or modeled relationships. Good notes
  explain rationale, runtime constraints, dependency criticality, sync/async
  behavior, failure behavior, ownership boundaries, or coupling that affects
  future changes.
- Do not invent notes from guesses or names alone. Keep notes backed by code,
  manifests, deploy files, tests, docs, git history, existing Arch4 files, or
  explicit user input.
- Put uncertain facts in `openQuestions`, not `notes`.
- Avoid duplicating the DSL description or restating first-class Arch4 facts
  unless the note adds important context.
- Omit empty note fields and keep `notes: {}` when there is nothing durable to
  add.
- Update relevant entity notes when responsibilities, boundaries,
  dependencies, data ownership, runtime technology, runtime behavior,
  ownership, or paths change.

## Structurizr Identifier Discipline

- Check whether `.arch4/architecture/workspace.dsl` contains
  `!identifiers hierarchical` before editing identifiers, relationships,
  views, or metadata.
- With hierarchical identifiers, references outside an element's declaring scope
  must use fully qualified identifiers. For example, use
  `developer -> arch4.arch4Extension`, not
  `developer -> arch4Extension`.
- Nested component metadata must also use fully qualified identifiers. For
  example, use `arch4.arch4Renderer.rendererExport` as the metadata filename
  and `entityId`, not `rendererExport`.
- Use the same fully qualified identifiers in relationships, view subjects,
  include statements, metadata filenames, and `entityId` values.
- Before creating or renaming many elements, build an identifier inventory from
  the DSL tree and use that inventory for relationships, views, and metadata.
- Do not batch-create metadata from local nested names when hierarchical
  identifiers are enabled.

## Workflow

1. Read the current Arch4 source files and relevant repository files.
2. Decide whether the change affects architecture responsibilities, boundaries,
   dependencies, deployment topology, data ownership, runtime technology,
   ownership metadata, or path coverage.
3. If it does, update `.arch4/architecture/workspace.dsl` and the relevant
   `.arch4/architecture/entities/*.json` metadata files.
4. Keep `.arch4/architecture/build/**` disposable and derived; do not edit it
   as source.
5. When a CLI is available, validate/render/index the model after source edits.
6. Before committing or completing architecture-impacting work, review changed
   files against mapped entities and confirm relevant
   `.arch4/architecture/entities/*.json` notes are still accurate.

## Large Architecture Edit Workflow

For large DSL changes, use staged validation before metadata generation:

1. Model elements and boundaries.
2. Validate the DSL.
3. Add relationships and views.
4. Validate and render the DSL.
5. Create or update entity metadata from rendered or validated identifiers.
6. Index and inspect orphaned metadata warnings.

## CLI Commands

- `arch4 validate`: validate the Structurizr workspace and write diagnostics.
- `arch4 render`: render DSL views into `.arch4/architecture/build/views/`.
- `arch4 index`: build `.arch4/architecture/build/architecture-index.json`
  and `.arch4/architecture/build/context/*.md`.
- `arch4 context --changed-files <paths...>`: retrieve compact architecture
  context for changed files.

## Evidence Rules

- Do not invent architecture facts.
- Use code, manifests, deploy files, git history, existing Arch4 model files, or
  explicit user input as evidence.
- When evidence is weak, preserve the uncertainty as diagnostics, open
  questions, notes, or low-confidence metadata.
- Do not add concepts that are not supported by source evidence in the current
  repository.
