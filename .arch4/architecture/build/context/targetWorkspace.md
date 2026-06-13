# Arch4 Context

## Target Workspace

- Entity: targetWorkspace
- Type: softwareSystem
- Description: Repository where Arch4 is installed and whose architecture DSL, entities, and source files are modeled.
- Tags: Element, Software System
- Paths: examples/minimal-repo/**
- Views: Arch4CliComponents, Arch4Containers, Arch4ExtensionComponents, Arch4RendererComponents, Arch4SystemContext
- Confidence: medium

Open questions:
- Should target workspaces always be modeled as external systems, or only when Arch4 is installed outside this repository?

Notes:
```json
{
  "devExample": "examples/minimal-repo is the evidenced target workspace used by pnpm dev:cursor."
}
```
- Contributors: Paul Stoeckle (1)

Recent commits:
- 2026-06-14 55b9cc93 First release commit

