# Agent workflow

All substantial project work is performed by specialized agents. The root agent acts as orchestrator: it delegates, integrates results, runs release checks, maintains the Wiki, and commits/pushes accepted changes.

Use agents proportionately: a small safe edit may use one implementation agent; cross-cutting changes should involve the relevant architecture, implementation, QA/security, and Wiki roles. Do not create agents only for ceremony.

Before substantial work, read `wiki/README.md` and `wiki/current-state.md`; update the relevant Wiki pages after it.

## Codebase discovery

This project uses `codebase-memory-mcp` when available. Prefer its graph tools for code discovery; fall back to `rg` for non-code files, literals, and when the graph is insufficient.
