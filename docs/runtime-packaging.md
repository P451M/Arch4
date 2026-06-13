# Runtime Packaging

Arch4 renderer development uses a repo-local runtime bundle containing:

- Java runtime
- Structurizr CLI
- Runtime libraries required by those tools

Runtime setup must:

1. Pin every runtime version.
2. Verify downloaded artifacts by SHA256.
3. Install tools under `runtime/bundles/<platform>/`.
4. Update `THIRD_PARTY_NOTICES.md` for runtime tools and bundled production
   dependencies.
5. Make `arch4 doctor` show runtime paths.

Builds do not download runtime tools. Run setup explicitly:

```sh
pnpm setup:runtime
```

Then verify the pinned manifests and current platform bundle:

```sh
pnpm verify:runtime
```

The verifier fails if manifests contain placeholders, release dependency notices
are missing, or the current platform bundle has not been installed. During local
manifest shape work only, placeholders can be accepted explicitly:

```sh
ARCH4_ALLOW_RUNTIME_PLACEHOLDERS=1 pnpm verify:runtime
```

Arch4 uses Structurizr CLI to validate and export workspace JSON. Diagram layout
is performed by Arch4's TypeScript renderer, so runtime bundles do not include
Graphviz and `arch4 render` does not depend on Homebrew or a system Graphviz
install.
