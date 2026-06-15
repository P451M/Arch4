<p align="center">
  <img src="packages/cursor-extension/media/icon.svg" width="96" height="96" alt="Arch4 C4 icon">
</p>

<h1 align="center">Arch4</h1>

<p align="center">
  <strong>A Cursor plugin for generating and viewing enriched C4 documentation.</strong>
</p>

<p align="center">
  <a href="https://www.cursor.com">
    <img alt="Cursor plugin" src="https://img.shields.io/badge/Cursor-plugin-111827?style=for-the-badge&logo=cursor&logoColor=white">
  </a>
  <img alt="C4 documentation" src="https://img.shields.io/badge/C4-documentation-2563eb?style=for-the-badge">
  <img alt="Structurizr" src="https://img.shields.io/badge/Structurizr-renderer-0891b2?style=for-the-badge">
</p>

<p align="center">
  <img src="packages/cursor-extension/media/marketplace/arch4-demo.gif" alt="Looping Arch4 demo in Cursor showing workspace initialization, architecture model update, and interactive C4 map exploration">
</p>

Arch4 is a Cursor plugin that keeps C4 architecture documentation next to the
code, generates repository-aware architecture artifacts, and opens enriched
interactive C4/Structurizr maps directly inside Cursor.

It is designed for teams and AI-assisted development workflows that need an
accurate architectural view before changing a system: ownership, source paths,
relationships, confidence, notes, open questions, and generated context stay
connected to the repository.

## What Arch4 Does

- Installs as a Cursor plugin and adds Arch4 commands, views, rules, and skills.
- Initializes a repository-local C4 documentation workspace under
  `.arch4/architecture/`.
- Generates and validates Structurizr DSL models from repository context.
- Renders enriched C4 architecture views in an interactive Cursor webview.
- Indexes architecture entities with ownership, repository paths, confidence,
  notes, and open questions.
- Builds contextual markdown for architecture-aware development workflows.

## Quick Start

Install Arch4 from Cursor's Extensions pane after the plugin is published to
OpenVSX. Search for `Arch4`, install the extension for your platform, then run:

1. `Arch4: Initialize Workspace`
2. `Arch4: Update Architecture Model`
3. `Arch4: Open Architecture Map`

Manual VSIX install for local builds:

```sh
cursor --install-extension artifacts/arch4-0.1.0-<platform>.vsix
```

Supported packaged platforms are `darwin-arm64`, `darwin-x64`, `linux-x64`,
and `win32-x64`.

## Example Workspace

The [minimal repository example](examples/minimal-repo/README.md) contains a
reviewed mock travel-booking architecture with context, container, component,
deployment, and dynamic views. It is the quickest way to inspect the rendered
map and validate extension behavior during development.

## Commands

Cursor commands:

- `Arch4: Initialize Workspace`
- `Arch4: Update Architecture Model`
- `Arch4: Build Architecture Artifacts`
- `Arch4: Open Architecture Map`
- `Arch4: Remove Workspace Artifacts`

CLI commands:

```sh
arch4 init
arch4 validate
arch4 render
arch4 index
arch4 context --changed-files <paths...>
arch4 doctor
```

`arch4 validate` validates the model and writes diagnostics only. `arch4 render`
atomically replaces generated view JSON after a successful render.

## Workspace Files

- `.arch4/architecture/workspace.dsl` is the architecture source of truth.
- `.arch4/architecture/entities/*.json` stores entity owners, repository paths,
  confidence, open questions, and notes.
- `.arch4/architecture/build/**` is generated output. This repository commits
  reviewed build output so fresh checkouts can inspect maps without first
  rendering them; other repositories can choose to ignore it.
- `.cursor/commands/*`, `.cursor/rules/arch4.mdc`, and `.cursor/skills/*` are
  installed with Arch4 ownership markers. Arch4 refuses to overwrite unmarked
  user-owned Cursor files.
- `.arch4` is Arch4-owned workspace state. `Arch4: Remove Workspace Artifacts`
  removes it only after explicit confirmation.
- Arch4 does not create backup copies before updating or removing Arch4-owned
  files. Use Git or local filesystem history for recovery.

## Runtime Behavior

Published VSIX packages embed the matching Java and Structurizr CLI runtime for
the target platform. Arch4 owns diagram layout in TypeScript, so rendering does
not require Graphviz or a system `dot` executable. The installed extension uses
only its embedded runtime. If the runtime is missing or corrupted, Arch4 reports
an actionable diagnostic instead of falling back to tools on the user's machine.

Development builds can use `pnpm setup:runtime` to download the pinned runtime
into `runtime/bundles/<platform>/`.

## Documentation

- [Architecture overview](docs/architecture.md)
- [Runtime packaging](docs/runtime-packaging.md)
- [OpenVSX release process](docs/openvsx-release.md)
- [Release policy](docs/release-policy.md)
- [Viewer styling notes](docs/viewer-styling.md)
- [Support](SUPPORT.md)
- [Security](SECURITY.md)
- [Contributing](CONTRIBUTING.md)

## Development

Core development loop:

```sh
pnpm install
pnpm setup:runtime
pnpm build
pnpm check
pnpm lint
pnpm format:check
pnpm test
pnpm smoke
```

Run the extension from source in an isolated Cursor development profile:

```sh
pnpm dev:cursor
```

`pnpm dev:cursor` opens Cursor with `packages/cursor-extension` loaded as an
extension development path and `examples/minimal-repo` as the target workspace.
It uses an isolated Cursor dev profile under `artifacts/dev-cursor/` so an
installed Arch4 extension cannot register duplicate commands or views. Before
launching, it refreshes that dev profile from your normal Cursor settings,
keybindings, snippets, profiles, and non-Arch4 extensions so themes and related
editor preferences still load. It also regenerates the ignored example diagram
build outputs before launching.

For custom Cursor installs, set `CURSOR_BIN=/path/to/cursor`; for nonstandard
profile locations, set `CURSOR_USER_DATA_DIR` or `CURSOR_EXTENSIONS_DIR`.

Build, package, and reinstall the local VSIX into your normal Cursor
installation:

```sh
pnpm reinstall:cursor
```

`pnpm reinstall:cursor` runs `pnpm build`, packages the extension for the
current platform, uninstalls the existing Arch4 extension from Cursor, installs
the new VSIX with `--force`, verifies the installed webview bundle, and reopens
this workspace. The reinstall worker runs in the background and writes progress
to the temp-directory log path printed by the command.

Package local artifacts:

```sh
pnpm package:extension -- --platform darwin-arm64
pnpm package:cli
```

Additional release and runtime checks:

```sh
pnpm verify:runtime
pnpm release:dry-run
```

`pnpm verify:runtime` validates runtime manifests. `pnpm release:dry-run` builds
the monorepo and packages all platform VSIX artifacts expected by the release
workflow.

`pnpm package:extension:all` requires runtime bundles for every supported
platform. The OpenVSX release workflow builds and validates those bundles in a
platform matrix; local all-platform packaging is only expected to work after the
target bundles already exist on disk.

NPM publication is intentionally out of scope. Workspace packages are marked
private to prevent accidental npm releases.

## Repository Layout

- `@arch4/core`: shared contracts, layout helpers, and validation.
- `@arch4/renderer-structurizr`: Structurizr export normalization and diagram specs.
- `@arch4/viewer`: React diagram viewer.
- `@arch4/cli`: terminal CLI.
- `arch4-cursor-extension`: Cursor/OpenVSX extension package.

## Release

OpenVSX publishing is documented in [docs/openvsx-release.md](docs/openvsx-release.md).
Every release must include `README.md`, `CHANGELOG.md`, `SUPPORT.md`, `LICENSE`,
`NOTICE`, and `THIRD_PARTY_NOTICES.md` in the VSIX.

## Support

Use [GitHub Issues](https://github.com/P451M/Arch4/issues) for bugs,
installation problems, and feature requests after the repository is public. Run
`arch4 doctor` before opening an issue and include the output with the Arch4
version, platform, and Cursor version.

## Security

Security reporting and the local inspection model are documented in
[SECURITY.md](SECURITY.md).

## License

Arch4 is licensed under the [Apache License 2.0](LICENSE).
