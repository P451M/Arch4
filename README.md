<p align="center">
  <img src="assets/media/arch4-icon.svg" width="96" height="96" alt="Arch4 C4 icon">
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
  <img src="assets/media/arch4-demo-cropped.gif" alt="Looping Arch4 demo in Cursor showing workspace initialization, architecture model update, and interactive C4 map exploration">
</p>

Arch4 is a Cursor plugin that keeps C4 architecture documentation next to the
code, generates repository-aware Structurizr DSL artifacts, and opens enriched
interactive C4 maps directly inside Cursor.

It is designed for teams and AI-assisted development workflows that need an
accurate architectural view before changing a system: ownership, source paths,
relationships, confidence, notes, open questions, and generated context stay
connected to the repository.

## Quick Start

Install Arch4 from Cursor's Extensions pane. Search for `Arch4`, install the
extension for your platform, then run:

1. `Arch4: Create/Update Architecture Model`
2. `Arch4: Open Architecture Map`

Local source checkout reinstall:

```sh
pnpm reinstall:cursor
```

## What Arch4 Does

- Installs as a Cursor plugin and adds Arch4 commands, views, rules, and skills.
- Initializes a repository-local C4 documentation workspace under
  `.arch4/architecture/` when creating or updating the model.
- Generates and validates Structurizr DSL models from repository context.
- Renders enriched C4 architecture views in an interactive Cursor webview.
- Indexes architecture entities with ownership, repository paths, confidence,
  notes, and open questions.
- Builds contextual markdown for architecture-aware development workflows.

## Why Arch4?

- Keep architecture documentation close to the code it describes, with
  repository-local C4 and Structurizr DSL artifacts.
- Use Cursor-native commands, views, rules, and skills instead of switching to a
  separate architecture tool.
- Carry implementation context into the map: ownership, source paths,
  confidence, notes, open questions, and generated development context.
- Run packaged builds without installing system Java, Structurizr, Graphviz, or
  `dot`; the extension uses its bundled runtime for the target platform.

## Example Workspace

The [minimal repository example](examples/minimal-repo/README.md) contains a
reviewed mock travel-booking architecture with context, container, component,
deployment, and dynamic views. It is the quickest way to build and inspect a
map and validate extension behavior during development.

## Screenshots

Command Palette access to the Arch4 workflow:

![Cursor Command Palette showing Arch4 commands](assets/media/arch4-command-palette.png)

Interactive architecture map with repository context and element details:

![Arch4 interactive architecture map in Cursor with an element details drawer](assets/media/arch4-full-screenshot.png)

## Commands

Cursor commands:

- `Arch4: Create/Update Architecture Model`
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
- `.arch4/architecture/build/**` is generated output. This repository ignores
  example build output; run `Arch4: Build Architecture Artifacts` or
  `arch4 render && arch4 index` to regenerate maps.
- `.cursor/commands/*`, `.cursor/rules/arch4.mdc`, and `.cursor/skills/*` are
  installed with Arch4 ownership markers. Arch4 refuses to overwrite unmarked
  user-owned Cursor files.
- `.arch4/bin/arch4` is generated local tooling for Cursor agents. It discovers
  the installed Arch4 extension runtime and should be treated as disposable
  Arch4-owned state, not architecture source.
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

## Status

Arch4 is early and pre-1.0. Packaged extension targets are `darwin-arm64`,
`darwin-x64`, `linux-x64`, and `win32-x64`. OpenVSX installation and GitHub
issue intake depend on the current publication and repository visibility state.

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
`.arch4/bin/arch4 doctor` in initialized Cursor workspaces, or `arch4 doctor`
for manual CLI installs, before opening an issue and include the output with the
Arch4 version, platform, and Cursor version.

## Security

Security reporting and the local inspection model are documented in
[SECURITY.md](SECURITY.md).

## Acknowledgements

Arch4 builds on ideas from the software architecture tooling ecosystem. Thanks
to [Simon Brown](https://simonbrown.je/) for the
[C4 model](https://c4model.com/), [Structurizr](https://structurizr.com/), and
[Structurizr DSL](https://docs.structurizr.com/dsl). Arch4 was also influenced
by Kevin Nord's [c4hero](https://github.com/c4hero/c4hero), especially the idea
that C4 and Structurizr DSL workflows can support visual editing, persisted
manual layout adjustments, and Dagre-assisted layout.

## License

Arch4 is licensed under the [Apache License 2.0](LICENSE).
