# Arch4 Context

## Architecture Map Webview

- Entity: arch4.arch4Extension.extensionWebview
- Type: component
- Description: Embeds the interactive C4 map and layout controls in Cursor.
- Tags: Element, Component
- Paths: packages/cursor-extension/media/**/*, packages/cursor-extension/vite.config.ts
- Views: Arch4ExtensionComponents
- Owners: Arch4
- Confidence: high

Notes:
```json
{
  "summary": "Bundled webview shell that embeds the Arch4 viewer bundle and exchanges layout and payload messages with the extension host."
}
```
- Contributors: Paul Stoeckle (2)

Recent commits:
- 2026-06-16 edf64fd5 Fix Arch4 create/update workspace workflow
- 2026-06-14 1d74a893 Initial Arch4 release

