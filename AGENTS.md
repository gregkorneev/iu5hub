# Agent workflow

All substantial project work is performed by specialized agents. The root agent acts as orchestrator: it delegates, integrates results, runs release checks, maintains the Wiki, and commits/pushes accepted changes.

Before completing a task, commit and push every accepted local project change to `origin/main`. Confirm that `HEAD` and `origin/main` match; do not leave accepted work only in the local working tree.

## Persistent team

Maintain a small, persistent team instead of creating a new agent for each request. Reuse an existing specialist by sending it follow-up work so it retains project context. The default roles are frontend/UI, architecture/Wiki, QA/security, and DevOps. Create a new specialist only when a task needs genuinely distinct expertise not covered by the team; retire or reuse temporary specialists once their task is complete.

Use agents proportionately: a small safe edit may use one implementation agent; cross-cutting changes should involve the relevant architecture, implementation, QA/security, and Wiki roles. Do not create agents only for ceremony.

Before substantial work, read `wiki/README.md` and `wiki/current-state.md`; update the relevant Wiki pages after it.

## Codebase discovery

This project uses `codebase-memory-mcp` when available. Prefer its graph tools for code discovery; fall back to `rg` for non-code files, literals, and when the graph is insufficient.
