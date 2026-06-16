# Arch4 Context

## Structurizr CLI

- Entity: structurizrCli
- Type: softwareSystem
- Description: Validates workspace.dsl and exports workspace JSON for Arch4 rendering.
- Tags: Element, Software System
- Paths: runtime/**/*, docs/runtime-packaging.md, scripts/setup-runtime.mjs, scripts/verify-runtime-manifests.mjs
- Views: Arch4Containers, Arch4RendererComponents, Arch4SystemContext
- Owners: Structurizr
- Confidence: high

Notes:
```json
{
  "summary": "External Structurizr CLI bundled with Arch4 to validate workspace.dsl and export workspace JSON before Arch4 performs TypeScript layout and view output."
}
```
- Contributors: Paul Stoeckle (3)

Recent commits:
- 2026-06-15 862b939f Retry runtime downloads
- 2026-06-14 494349c7 Fix Windows runtime validation
- 2026-06-14 1d74a893 Initial Arch4 release

