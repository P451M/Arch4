# Security

Arch4 reads repository files, git history, and architecture metadata from the
workspace where it is installed. Do not enable Arch4 on repositories where this
local inspection is not acceptable.

## Supported Versions

Only the latest released version is supported for security fixes before the
project reaches a stable `1.0` release.

## Reporting A Vulnerability

Report security issues privately through GitHub Security Advisories when the
repository is public. If advisories are not available, email the maintainer
listed in the repository profile and avoid posting exploit details in public
issues.

Please include:

- affected Arch4 version or commit
- operating system and Cursor version
- reproduction steps
- impact and any known workaround

## Security Model

Published VSIX packages embed the platform runtime and do not need external
Java or Structurizr installations. Diagram layout runs inside Arch4's packaged
TypeScript renderer and does not require Graphviz. The webview uses a
default-deny CSP, packaged local assets, restricted local resource roots, and no
external network/resource access.
