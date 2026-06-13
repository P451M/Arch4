# Third-Party Notices

Arch4 local renderer runtime setup downloads Java, Structurizr CLI, and required
runtime libraries into the repo-local `runtime/bundles/` directory. Release
packaging must pin versions, verify checksums, and document third-party licenses
here before distributing VSIX artifacts.

Current runtime manifests pin the renderer tools used by `arch4 render`.

## Java Runtime

Arch4 uses Eclipse Temurin JRE 21.0.9+10 from Adoptium.

- Project: https://adoptium.net/temurin/
- Source: https://github.com/adoptium/temurin21-binaries
- License: GPL-2.0 with Classpath Exception
- Purpose: runs the Structurizr CLI process during local rendering.

## Structurizr CLI

Arch4 uses Structurizr CLI 2025.11.09.

- Project: https://github.com/structurizr/cli
- Release: https://github.com/structurizr/cli/releases/tag/v2025.11.09
- License: Apache-2.0
- Purpose: validates `workspace.dsl` and exports workspace JSON that Arch4
  normalizes into viewer diagram specs.

## @dagrejs/dagre

Arch4 uses @dagrejs/dagre 3.0.0.

- Project: https://github.com/dagrejs/dagre
- License: MIT
- Purpose: computes deterministic graph layouts for generated Arch4 diagram
  specs.

## @dagrejs/graphlib

Arch4 uses @dagrejs/graphlib 4.0.1 as a transitive dependency of Dagre.

- Project: https://github.com/dagrejs/graphlib
- License: MIT
- Purpose: provides the graph data structures used by Dagre layout processing.

## React

Arch4 uses React 19 in the Cursor extension webview.

- Project: https://react.dev/
- Source: https://github.com/facebook/react
- License: MIT
- Purpose: renders the interactive architecture map UI.

## React DOM

Arch4 uses React DOM 19 in the Cursor extension webview.

- Project: https://react.dev/
- Source: https://github.com/facebook/react
- License: MIT
- Purpose: mounts the React viewer into the VS Code/Cursor webview document.

## @xyflow/react

Arch4 uses @xyflow/react 12.10.2 in the Cursor extension webview.

- Project: https://xyflow.com/
- Source: https://github.com/xyflow/xyflow
- License: MIT
- Purpose: provides the pan/zoom node-edge canvas used by the architecture map.

## lucide-react

Arch4 uses lucide-react 0.468.0 in the Cursor extension webview.

- Project: https://lucide.dev/
- Source: https://github.com/lucide-icons/lucide
- License: ISC
- Purpose: provides UI icons for map nodes, commands, and controls.

## minimatch

Arch4 uses minimatch 10.0.1 in the CLI bundle.

- Project: https://github.com/isaacs/minimatch
- License: ISC
- Purpose: matches repository paths to architecture entity metadata globs.

## esbuild

Arch4 uses esbuild 0.28.1 for release packaging and local extension bundling.

- Project: https://esbuild.github.io/
- Source: https://github.com/evanw/esbuild
- License: MIT
- Purpose: bundles the CLI and extension host code for distribution.

## Vite

Arch4 uses Vite 7.2.0 and @vitejs/plugin-react 5.1.1 for the Cursor extension
webview build.

- Project: https://vite.dev/
- Source: https://github.com/vitejs/vite
- License: MIT
- Purpose: builds the production webview JavaScript and CSS assets.

## yazl

Arch4 uses yazl 3.3.1 for VSIX archive creation.

- Project: https://github.com/thejoshwolfe/yazl
- License: MIT
- Purpose: writes platform-specific VSIX archives during release packaging.
