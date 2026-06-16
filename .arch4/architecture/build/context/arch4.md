# Arch4 Context

## Arch4

- Entity: arch4
- Type: softwareSystem
- Description: Cursor plugin for generating, validating, indexing, and viewing enriched C4 architecture documentation.
- Tags: Element, Software System
- Paths: README.md, docs/architecture.md, packages/**/*, scripts/**/*
- Views: Arch4SystemContext
- Owners: Arch4
- Confidence: high

Open questions:
- Internal npm packages are modeled as containers because this monorepo does not evidence separate deployable runtime services.

Notes:
```json
{
  "summary": "Cursor plugin that keeps C4 architecture documentation next to code through Structurizr DSL source, enriched metadata, rendered views, and an interactive map.",
  "decisions": [
    "Model monorepo packages as C4 containers when no stronger runtime boundary is evidenced in repository manifests or deployment files."
  ]
}
```
- Contributors: Paul Stoeckle (16)

Recent commits:
- 2026-06-16 edf64fd5 Fix Arch4 create/update workspace workflow
- 2026-06-15 ea78be18 Fix extension overview media
- 2026-06-15 862b939f Retry runtime downloads
- 2026-06-15 36ded428 Update extension architecture map copy
- 2026-06-15 180315ef Fix marketplace README media

