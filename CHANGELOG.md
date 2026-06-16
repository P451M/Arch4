# Changelog

All notable changes to Arch4 will be documented in this file.

The project follows semantic versioning for extension releases before `1.0`,
with compatibility and breaking changes called out explicitly.

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
