# Review Arch4 Before Commit

Review whether the current repository changes require Arch4 updates.

Use both the C4 skill and the Arch4 skill. Follow this workflow:

1. Confirm `.arch4/architecture/workspace.dsl` and `.arch4/bin/arch4` exist.
2. Run `.arch4/bin/arch4 doctor`. If the local launcher, workspace, CLI, or runtime is missing, stop without edits and tell the user to run `Arch4: Create/Update Architecture Model` or reinstall Arch4.
3. Inspect changed files using git status and git diff. Include staged and unstaged changes when available.
4. Decide whether the changes affect architecture responsibilities, boundaries, containers, components, relationships, deployment topology, runtime technologies, data ownership, ownership metadata, or path ownership.
5. Review changed files against mapped entities and confirm relevant `.arch4/architecture/entities/*.json` notes are still accurate.
6. If architecture source must change, update only:
   - `.arch4/architecture/workspace.dsl`
   - `.arch4/architecture/entities/*.json`
7. When entity notes are stale, update them using the Arch4 skill's entity notes guidance.
8. Do not edit files under `.arch4/architecture/build/**`; they are derived output.
9. If only derived output is stale, run `.arch4/bin/arch4 render` and `.arch4/bin/arch4 index`. Treat command failure as a blocking error.
10. If render/index runs, inspect rendered view JSON and report node, edge, and boundary counts for each view.
11. Run `git status --short` and classify changes as Arch4 source edits, Arch4 generated/local artifacts, and unexpected non-Arch4 files. Do not label Arch4-owned initialization artifacts under `.cursor/**` or `.arch4/bin/**` as unexpected.
12. If no Arch4 source change is needed, say so and explain why.

Return a concise commit-review summary: changed files inspected, architecture impact, Arch4 updates made or intentionally skipped, validation/rendering result, and open questions.
