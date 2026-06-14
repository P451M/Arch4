<!-- arch4-owned: true -->

# Review Arch4 Before Commit

Review whether the current repository changes require Arch4 updates.

Use both the C4 skill and the Arch4 skill. Follow this workflow:

1. Inspect changed files using git status and git diff. Include staged and unstaged changes when available.
2. Decide whether the changes affect architecture responsibilities, boundaries, containers, components, relationships, deployment topology, runtime technologies, data ownership, ownership metadata, or path ownership.
3. If architecture source must change, update only:
   - `.arch4/architecture/workspace.dsl`
   - `.arch4/architecture/entities/*.json`
4. Do not edit files under `.arch4/architecture/build/**`; they are derived output.
5. If only derived output is stale, run `arch4 render` and `arch4 index` when available.
6. If render/index runs, inspect rendered view JSON and report node, edge, and boundary counts for each view.
7. Run `git status --short` and call out unexpected changes outside the intended architecture files.
8. If no Arch4 source change is needed, say so and explain why.

Return a concise commit-review summary: changed files inspected, architecture impact, Arch4 updates made or intentionally skipped, validation/rendering result, and open questions.
