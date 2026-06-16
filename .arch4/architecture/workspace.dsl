workspace "arch4" "AI-maintained architecture model." {
    !identifiers hierarchical

    model {
        developer = person "Developer" "Maintains repository code and Arch4 architecture documentation in Cursor."
        maintainer = person "Maintainer" "Builds, packages, and publishes the Arch4 Cursor extension."
        aiAgent = person "AI Agent" "Cursor agent that seeds and updates the architecture model from repository evidence."

        cursor = softwareSystem "Cursor" "Editor host for the Arch4 extension, commands, webview map, and AI-assisted workflows."
        structurizrCli = softwareSystem "Structurizr CLI" "Validates workspace.dsl and exports workspace JSON for Arch4 rendering."
        javaRuntime = softwareSystem "Java Runtime" "Pinned JVM bundled with Arch4 for Structurizr CLI execution."
        git = softwareSystem "Git" "Source-control history used to enrich architecture index metadata."
        openVsx = softwareSystem "OpenVSX" "Marketplace where Arch4 extension packages are published for Cursor."
        targetWorkspace = softwareSystem "Target Repository" "Repository workspace where Arch4 stores architecture source and derived artifacts under .arch4/."

        arch4 = softwareSystem "Arch4" "Cursor plugin for generating, validating, indexing, and viewing enriched C4 architecture documentation." {
            arch4Cli = container "Arch4 CLI" "Initializes, validates, renders, indexes, and serves architecture context for a repository." "Node.js / TypeScript" {
                cliCommands = component "CLI Commands" "Dispatches init, validate, render, index, context, and doctor commands." "TypeScript"
                cliContext = component "Context Lookup" "Maps changed files to architecture elements and renders compact context markdown." "TypeScript"
                cliIndexer = component "Architecture Indexer" "Builds architecture-index.json, context files, and git-enriched element metadata." "TypeScript"
                cliRuntime = component "Runtime Resolver" "Locates bundled or configured Java and Structurizr CLI executables." "TypeScript"
            }

            arch4Core = container "Arch4 Core" "Shared contracts, workspace layout helpers, and JSON validation utilities." "TypeScript"

            arch4Extension = container "Cursor Extension" "Hosts Arch4 commands, explorer tree, webview map, and workspace artifact lifecycle." "TypeScript / VS Code Extension API" {
                extensionHost = component "Extension Host" "Registers commands, tree view, file watchers, and CLI orchestration." "TypeScript"
                extensionWebview = component "Architecture Map Webview" "Embeds the interactive C4 map and layout controls in Cursor." "React / TypeScript"
                extensionArtifacts = component "Workspace Artifacts" "Installs Arch4-owned Cursor helpers and reads rendered build artifacts." "TypeScript"
            }

            arch4Renderer = container "Structurizr Renderer" "Exports Structurizr workspace JSON and converts it into Arch4 diagram specs." "TypeScript" {
                rendererExport = component "Structurizr Export" "Runs Structurizr validate and export against workspace.dsl." "TypeScript"
                rendererNormalize = component "Workspace Normalizer" "Converts Structurizr export JSON into diagram nodes, edges, and boundaries." "TypeScript"
                rendererLayout = component "Diagram Layout Adapter" "Applies Arch4 layout direction and manual node positions to diagram specs." "TypeScript"
                rendererOutput = component "View Output Writer" "Atomically replaces rendered view JSON under .arch4/architecture/build/views/." "TypeScript"
            }

            arch4Viewer = container "Architecture Viewer" "React map UI for exploring rendered diagrams with element details and navigation." "React / TypeScript"

            arch4Layout = container "Diagram Layout Engine" "Computes dagre-based node and boundary layout for diagram specs." "TypeScript"
        }

        developer -> arch4 "Maintains and explores C4 documentation for"
        developer -> cursor "Edits repositories in"
        maintainer -> arch4 "Builds and publishes releases for"
        maintainer -> openVsx "Publishes extension packages to"
        aiAgent -> arch4 "Updates architecture model for"
        aiAgent -> cursor "Runs architecture workflows in"

        arch4 -> cursor "Installs as extension inside"
        arch4 -> structurizrCli "Validates and exports DSL through"
        arch4 -> javaRuntime "Runs Structurizr CLI with"
        arch4 -> git "Enriches architecture index from"
        arch4 -> targetWorkspace "Reads and writes architecture artifacts in"

        developer -> arch4.arch4Extension "Runs Arch4 commands in"
        aiAgent -> arch4.arch4Extension "Triggers model update workflow in"

        arch4.arch4Extension -> arch4.arch4Cli "Executes bundled CLI from"
        arch4.arch4Extension -> arch4.arch4Viewer "Embeds interactive map from"
        arch4.arch4Extension -> targetWorkspace "Reads rendered views and index from"

        arch4.arch4Cli -> arch4.arch4Core "Uses shared contracts from"
        arch4.arch4Cli -> arch4.arch4Renderer "Invokes validate, render, and diagnostics through"
        arch4.arch4Cli -> targetWorkspace "Initializes and writes architecture source in"

        arch4.arch4Renderer -> arch4.arch4Core "Uses shared contracts from"
        arch4.arch4Renderer -> arch4.arch4Layout "Computes diagram layout with"
        arch4.arch4Renderer -> structurizrCli "Exports workspace JSON through"
        arch4.arch4Renderer -> javaRuntime "Runs Structurizr CLI with"
        arch4.arch4Renderer -> targetWorkspace "Writes rendered views and diagnostics to"

        arch4.arch4Viewer -> arch4.arch4Core "Uses shared contracts from"
        arch4.arch4Viewer -> arch4.arch4Layout "Computes diagram layout with"

        arch4.arch4Layout -> arch4.arch4Core "Uses shared contracts from"

        arch4.arch4Cli.cliCommands -> arch4.arch4Cli.cliIndexer "Builds architecture index through"
        arch4.arch4Cli.cliCommands -> arch4.arch4Cli.cliContext "Serves architecture context through"
        arch4.arch4Cli.cliCommands -> arch4.arch4Cli.cliRuntime "Resolves bundled runtime through"
        arch4.arch4Cli.cliCommands -> arch4.arch4Renderer "Invokes validate and render through"

        arch4.arch4Cli.cliIndexer -> git "Enriches elements with history from"
        arch4.arch4Cli.cliIndexer -> targetWorkspace "Reads entity metadata and rendered views from"

        arch4.arch4Extension.extensionHost -> arch4.arch4Cli "Executes CLI commands via"
        arch4.arch4Extension.extensionHost -> arch4.arch4Extension.extensionWebview "Hosts interactive map in"
        arch4.arch4Extension.extensionHost -> arch4.arch4Extension.extensionArtifacts "Manages workspace artifacts through"

        arch4.arch4Extension.extensionArtifacts -> targetWorkspace "Installs Arch4-owned helpers and reads build artifacts from"

        arch4.arch4Extension.extensionWebview -> arch4.arch4Viewer "Renders diagram UI from"

        arch4.arch4Renderer.rendererExport -> structurizrCli "Validates and exports workspace.dsl through"
        arch4.arch4Renderer.rendererExport -> javaRuntime "Runs Structurizr CLI with"
        arch4.arch4Renderer.rendererExport -> arch4.arch4Renderer.rendererNormalize "Passes exported workspace JSON to"

        arch4.arch4Renderer.rendererNormalize -> arch4.arch4Renderer.rendererLayout "Produces diagram specs for"
        arch4.arch4Renderer.rendererLayout -> arch4.arch4Layout "Applies dagre layout through"
        arch4.arch4Renderer.rendererLayout -> arch4.arch4Renderer.rendererOutput "Hands positioned specs to"
        arch4.arch4Renderer.rendererOutput -> targetWorkspace "Writes rendered view JSON to"
    }

    views {
        theme default

        systemContext arch4 "Arch4SystemContext" {
            include developer
            include maintainer
            include aiAgent
            include arch4
            include cursor
            include structurizrCli
            include javaRuntime
            include git
            include openVsx
            include targetWorkspace
            autoLayout lr
        }

        container arch4 "Arch4Containers" {
            include developer
            include aiAgent
            include arch4.arch4Cli
            include arch4.arch4Core
            include arch4.arch4Extension
            include arch4.arch4Renderer
            include arch4.arch4Viewer
            include arch4.arch4Layout
            include cursor
            include structurizrCli
            include javaRuntime
            include git
            include targetWorkspace
            autoLayout lr
        }

        component arch4.arch4Cli "Arch4CliComponents" {
            include arch4.arch4Cli.cliCommands
            include arch4.arch4Cli.cliContext
            include arch4.arch4Cli.cliIndexer
            include arch4.arch4Cli.cliRuntime
            include arch4.arch4Renderer
            include git
            include targetWorkspace
            autoLayout lr
        }

        component arch4.arch4Extension "Arch4ExtensionComponents" {
            include arch4.arch4Extension.extensionHost
            include arch4.arch4Extension.extensionWebview
            include arch4.arch4Extension.extensionArtifacts
            include arch4.arch4Cli
            include arch4.arch4Viewer
            include targetWorkspace
            autoLayout lr
        }

        component arch4.arch4Renderer "Arch4RendererComponents" {
            include arch4.arch4Renderer.rendererExport
            include arch4.arch4Renderer.rendererNormalize
            include arch4.arch4Renderer.rendererLayout
            include arch4.arch4Renderer.rendererOutput
            include arch4.arch4Layout
            include structurizrCli
            include javaRuntime
            include targetWorkspace
            autoLayout lr
        }
    }
}
