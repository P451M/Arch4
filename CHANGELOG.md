# Changelog

All notable changes to Arch4 will be documented in this file.

The project follows semantic versioning for extension releases before `1.0`,
with compatibility and breaking changes called out explicitly.

## 0.1.4

Cursor MCP integration and architecture map usability release.

- Add the bundled Arch4 MCP server, MCP widget, and Cursor plugin packaging so
  Cursor can show and update architecture maps through MCP tools.
- Add Cursor commands and support-request workflow wiring for MCP-backed
  architecture map operations.
- Improve the architecture viewer tree, related-view navigation, layout
  controls, and node detail interactions used by the Cursor extension and MCP
  widget.
- Fix node label sizing, text clipping, diagram geometry, and dynamic view
  component boundaries in rendered maps.
- Expand tests for viewer behavior, Structurizr normalization, workflow
  orchestration, MCP server behavior, and Cursor extension integration.

## 0.1.3

Maintenance release for the Cursor/OpenVSX extension.

- Commit Arch4 workspace metadata and Cursor commands, rules, and skills as
  reviewed repository content.
- Refresh demo recording assets and extension marketplace documentation.
- Clarify Arch4 prompt guidance and source-only example behavior.
- Improve issue templates and release policy documentation.
- Fix the create/update workspace flow and formatting checks used by CI.

## 0.1.0

Initial public release candidate.

- Add Cursor commands for initializing, updating, opening, and removing Arch4
  workspace artifacts.
- Add repository-local C4/Structurizr architecture source under
  `.arch4/architecture/`.
- Add interactive architecture map rendering with element details,
  relationships, related views, notes, and open questions.
- Add CLI commands for validation, rendering, indexing, context generation, and
  diagnostics.
- Package platform-specific VSIX artifacts with embedded Java and Structurizr
  runtimes.
