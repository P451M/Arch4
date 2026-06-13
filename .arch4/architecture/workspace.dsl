workspace "arch4" "AI-maintained architecture model." {
    !identifiers hierarchical

    model {
        group "Arch4 Users and Maintainers" {
            developer = person "Developer" "Develops and maintains repository code in Cursor."
            maintainer = person "Maintainer" "Builds, packages, and publishes Arch4 releases."
            aiAgent = person "AI Agent" "Updates architecture models and retrieves architecture context during agent workflows."
        }

        group "External Editor, Marketplace, and Tooling" {
            cursor = softwareSystem "Cursor" "Editor platform that hosts the Arch4 extension, commands, tree view, and architecture map webview."
            openVsx = softwareSystem "OpenVSX" "Extension marketplace used to publish and distribute Arch4 VSIX packages."
            structurizrCli = softwareSystem "Structurizr CLI" "Validates Structurizr DSL workspaces and exports workspace JSON."
            javaRuntime = softwareSystem "Java Runtime" "Embedded JVM used to run the bundled Structurizr CLI."
            git = softwareSystem "Git" "Source-control history used for architecture indexing and contributor evidence."
        }

        group "Modeled Repository" {
            targetWorkspace = softwareSystem "Target Workspace" "Repository where Arch4 is installed and whose architecture DSL, entities, and source files are modeled."
        }

        group "Arch4 Platform" {
            arch4 = softwareSystem "Arch4" "Enriched C4 architecture maps for Cursor repositories." {
                arch4Core = container "Arch4 Core" "Shared contracts, workspace layout, JSON helpers, and validation." "TypeScript"

                arch4Layout = container "Arch4 Layout" "Diagram layout engine using dagre graph layout." "TypeScript"

                arch4Viewer = container "Arch4 Viewer" "React diagram viewer for interactive architecture maps." "TypeScript / React"

                arch4Renderer = container "Arch4 Renderer" "Structurizr export normalization, layout application, and rendered view output." "TypeScript" {
                    rendererExport = component "Renderer Export" "Invokes Structurizr CLI validate and export." "TypeScript"
                    rendererNormalize = component "Renderer Normalize" "Transforms Structurizr workspace JSON into DiagramSpec." "TypeScript"
                    rendererLayout = component "Renderer Layout" "Applies layout configuration and manual positions to diagram specs." "TypeScript"
                    rendererOutput = component "Renderer Output" "Atomically writes rendered view JSON to build output." "TypeScript"
                }

                arch4Cli = container "Arch4 CLI" "Terminal CLI for init, validate, render, index, context, and doctor commands." "TypeScript / Node.js" {
                    cliCommands = component "CLI Commands" "Command routing and workspace artifact orchestration." "TypeScript"
                    cliIndexer = component "CLI Indexer" "Builds architecture index and context markdown from rendered views and entity metadata." "TypeScript"
                    cliContext = component "CLI Context" "Maps changed files to architecture elements and renders compact context." "TypeScript"
                    cliRuntime = component "CLI Runtime" "Resolves bundled Java, Structurizr CLI, and platform runtime manifests." "TypeScript"
                }

                arch4Extension = container "Arch4 Cursor Extension" "Cursor extension host, explorer tree, commands, and architecture map webview." "TypeScript / VS Code Extension API" {
                    extensionHost = component "Extension Host" "Registers commands, tree provider, file watchers, and CLI orchestration." "TypeScript"
                    extensionWebview = component "Extension Webview" "Hosts interactive architecture map UI in a Cursor webview panel." "TypeScript / React"
                    extensionArtifacts = component "Extension Artifacts" "Installs and removes Arch4-owned Cursor rules, skills, and commands." "TypeScript"
                }
            }
        }

        developer -> cursor "Develops repositories in"
        developer -> arch4 "Maintains architecture maps for"
        developer -> targetWorkspace "Develops and maintains code in"
        maintainer -> arch4 "Maintains and publishes releases of"
        aiAgent -> cursor "Runs agent workflows in"
        aiAgent -> arch4 "Updates architecture model for"
        arch4 -> cursor "Runs as extension in"
        arch4 -> openVsx "Publishes extension packages to"
        arch4 -> structurizrCli "Validates and exports DSL through"
        arch4 -> javaRuntime "Runs Structurizr CLI with"
        arch4 -> git "Indexes contributor and commit evidence from"
        arch4 -> targetWorkspace "Reads architecture source and repository files from"

        developer -> arch4.arch4Extension "Runs Arch4 commands and views maps in"
        maintainer -> arch4.arch4Extension "Packages and tests extension through"
        aiAgent -> arch4.arch4Extension "Triggers architecture update workflows through"

        arch4.arch4Extension -> arch4.arch4Cli "Invokes bundled CLI through"
        arch4.arch4Extension -> arch4.arch4Viewer "Renders maps with"
        arch4.arch4Extension -> arch4.arch4Core "Reads architecture paths and contracts from"
        arch4.arch4Extension -> cursor "Registers commands and webview in"

        arch4.arch4Cli -> arch4.arch4Renderer "Renders workspace DSL through"
        arch4.arch4Cli -> arch4.arch4Core "Uses shared contracts and layout helpers from"
        arch4.arch4Cli -> targetWorkspace "Reads DSL, entities, and repository files from"
        arch4.arch4Cli -> git "Collects git history from"

        arch4.arch4Renderer -> arch4.arch4Layout "Applies diagram layout through"
        arch4.arch4Renderer -> arch4.arch4Core "Uses shared diagram types from"
        arch4.arch4Renderer -> structurizrCli "Validates and exports workspace DSL with"
        arch4.arch4Renderer -> javaRuntime "Runs Structurizr through"
        arch4.arch4Renderer -> targetWorkspace "Reads workspace.dsl from"

        arch4.arch4Viewer -> arch4.arch4Layout "Uses layout helpers from"
        arch4.arch4Viewer -> arch4.arch4Core "Uses diagram types from"

        arch4.arch4Layout -> arch4.arch4Core "Uses diagram layout types from"

        arch4.arch4Cli.cliCommands -> arch4.arch4Cli.cliRuntime "Resolves bundled runtime through"
        arch4.arch4Cli.cliCommands -> arch4.arch4Renderer "Calls render pipeline in"
        arch4.arch4Cli.cliCommands -> arch4.arch4Cli.cliIndexer "Builds architecture index through"
        arch4.arch4Cli.cliCommands -> arch4.arch4Cli.cliContext "Renders context markdown through"
        arch4.arch4Cli.cliIndexer -> git "Reads commit history from"
        arch4.arch4Cli.cliIndexer -> targetWorkspace "Scans repository files in"
        arch4.arch4Cli.cliContext -> targetWorkspace "Matches changed files against path globs in"

        arch4.arch4Renderer.rendererExport -> structurizrCli "Validates and exports DSL with"
        arch4.arch4Renderer.rendererExport -> javaRuntime "Runs Structurizr with"
        arch4.arch4Renderer.rendererExport -> arch4.arch4Renderer.rendererNormalize "Passes workspace JSON to"
        arch4.arch4Renderer.rendererNormalize -> arch4.arch4Renderer.rendererLayout "Produces diagram specs for"
        arch4.arch4Renderer.rendererLayout -> arch4.arch4Layout "Applies dagre layout through"
        arch4.arch4Renderer.rendererLayout -> arch4.arch4Renderer.rendererOutput "Hands laid-out specs to"
        arch4.arch4Renderer.rendererOutput -> targetWorkspace "Writes rendered views to"

        arch4.arch4Extension.extensionHost -> arch4.arch4Cli "Executes CLI commands through"
        arch4.arch4Extension.extensionHost -> arch4.arch4Extension.extensionWebview "Loads architecture maps in"
        arch4.arch4Extension.extensionHost -> arch4.arch4Extension.extensionArtifacts "Installs and removes Cursor workflow files through"
        arch4.arch4Extension.extensionHost -> targetWorkspace "Watches architecture source files in"
        arch4.arch4Extension.extensionHost -> cursor "Registers tree provider and commands in"
        arch4.arch4Extension.extensionWebview -> arch4.arch4Viewer "Embeds diagram viewer from"
    }

    views {
        systemContext arch4 "Arch4SystemContext" {
            include arch4
            include developer
            include maintainer
            include aiAgent
            include cursor
            include openVsx
            include structurizrCli
            include javaRuntime
            include git
            include targetWorkspace
            autoLayout lr
        }

        container arch4 "Arch4Containers" {
            include *
            autoLayout lr
        }

        component arch4.arch4Cli "Arch4CliComponents" {
            include arch4.arch4Cli.cliCommands
            include arch4.arch4Cli.cliIndexer
            include arch4.arch4Cli.cliContext
            include arch4.arch4Cli.cliRuntime
            include arch4.arch4Renderer
            include targetWorkspace
            include git
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

        component arch4.arch4Extension "Arch4ExtensionComponents" {
            include arch4.arch4Extension.extensionHost
            include arch4.arch4Extension.extensionWebview
            include arch4.arch4Extension.extensionArtifacts
            include arch4.arch4Cli
            include arch4.arch4Viewer
            include cursor
            include targetWorkspace
            autoLayout lr
        }

        theme default
    }
}
