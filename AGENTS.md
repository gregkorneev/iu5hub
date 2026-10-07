# Agent workflow

All substantial project work is performed by specialized agents. The root agent acts as orchestrator: it delegates, integrates results, runs release checks, maintains the Wiki, and commits/pushes accepted changes to the currently permitted branch. Confirm that local and remote branch heads match and the working tree is clean before completing a task.

## Persistent team

Maintain a small, persistent team instead of creating a new agent for each request. Reuse an existing specialist by sending it follow-up work so it retains project context. The default roles are frontend/UI, architecture/Wiki, QA/security, and DevOps. Create a new specialist only when a task needs genuinely distinct expertise not covered by the team; retire or reuse temporary specialists once their task is complete.

Use agents proportionately: a small safe edit may use one implementation agent; cross-cutting changes should involve the relevant architecture, implementation, QA/security, and Wiki roles. Do not create agents only for ceremony.

Before substantial work, read `wiki/README.md` and `wiki/current-state.md`; update the relevant Wiki pages after it.

## Codebase discovery

This project uses `codebase-memory-mcp` when available. Prefer its graph tools for code discovery; fall back to `rg` for non-code files, literals, and when the graph is insufficient.

## Branch policy

The only persistent branches are `main` and `beta`. Do not create any other Git branch, temporary branch, pull-request branch, or branch-backed worktree unless the user explicitly asks for a new branch by name. Subagents must not create branches or worktrees. Coordinate code changes in the Orchestrator's current permitted branch.

- `main` is production. Codex does not make development commits on `main` or merge/deploy to it unless the user explicitly says to release (for example, «делаем релиз», «выпускаем релиз», or «переноси beta в main»). A normal implementation, fix, review, or deploy request is not release approval.
- `beta` is the default branch for ordinary feature work, fixes and refactors. Test and publish those changes in beta first.
- Before ordinary coding work, run `git fetch origin`, `git checkout beta`, `git pull --ff-only origin beta`, then `git status`; verify a clean tree before editing. If a normal development task starts on `main`, switch to `beta` before editing.
- Production data refreshes such as the scheduled schedule JSON sync may update generated data on `main` and safely copy only those generated files to `beta`; they are not feature development and must never overwrite beta code.

## Persistent development and release workflow

Normal development flows through `beta` → QA → Beta Telegram Mini App → manual check. Production release requires explicit user approval, then current `main` is synchronized into `beta`, full QA and production release checks run, `beta` is merged into `main`, production migrations and Worker/Pages deployment run, production smoke is completed, and `beta` is synchronized to the released `main`. Keep both persistent branches. See [wiki/development-workflow.md](wiki/development-workflow.md) and [wiki/deployment.md](wiki/deployment.md).
