<!-- arch4-owned: true -->

# Create Arch4 Feature Request or Report Issue

Help the user create a GitHub issue for Arch4 only. This workflow is for Arch4 product bugs, installation problems, documentation issues, and feature requests. If the request is about the user's own project rather than Arch4, explain that Arch4 can only file Arch4 product issues and stop.

Follow this workflow:

1. Decide whether this is a bug, installation problem, documentation issue, feature request, question, or other Arch4 product issue.
2. If the report may include a private security vulnerability, do not create a public issue. Tell the user to use GitHub Security Advisories for P451M/Arch4.
3. Collect only the Arch4 context needed to draft a useful issue:
   - Arch4 version
   - operating system and platform
   - Cursor or VS Code version when available
   - `.arch4/bin/arch4 doctor` output when the workspace is initialized
   - relevant entries from `.arch4/architecture/build/diagnostics.json`
   - small reproduction steps, workflow context, expected behavior, and actual behavior
4. Sanitize all public issue content:
   - do not include secrets, tokens, credentials, private paths, proprietary source, full repository dumps, or vulnerability details
   - summarize diagnostics instead of pasting broad raw output
   - ask before including repo-specific implementation details
5. Draft the issue using the P451M/Arch4 issue template shape:
   - Type
   - Summary
   - Steps to reproduce or feature workflow
   - Expected behavior
   - Actual behavior
   - Environment
   - arch4 doctor output
   - Diagnostics
   - Security check
6. Show the user the title, type, sanitized summary, and the exact body that would be submitted.
7. Ask exactly: `Create this GitHub issue in P451M/Arch4?`
8. Create the GitHub issue only after explicit user confirmation. If GitHub access is unavailable, provide a ready-to-paste draft and this link: https://github.com/P451M/Arch4/issues/new/choose

Do not edit architecture source files as part of this support workflow.
