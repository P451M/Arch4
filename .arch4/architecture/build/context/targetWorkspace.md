# Arch4 Context

## Target Repository

- Entity: targetWorkspace
- Type: softwareSystem
- Description: Repository workspace where Arch4 stores architecture source and derived artifacts under .arch4/.
- Tags: Element, Software System
- Paths: .arch4/**/*
- Views: Arch4CliComponents, Arch4Containers, Arch4ExtensionComponents, Arch4RendererComponents, Arch4SystemContext
- Confidence: high

Open questions:
- Should repository-local .arch4/ state be modeled as an external system, a container, or a data store when Arch4 models its own host repository?

Notes:
```json
{
  "summary": "Repository workspace where Arch4 stores architecture source, entity metadata, and derived build artifacts."
}
```

