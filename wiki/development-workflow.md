# Development and release workflow

## Permanent branch policy

Only `main` and `beta` are persistent branches. GitHub's default/production branch remains `main`; Codex development defaults to `beta`. Codex must not create any other branch or branch-backed worktree unless the user explicitly requests a named branch. Subagents coordinate changes in the orchestrator's permitted checkout.

- `main` is production. Ordinary feature, fix, refactor, review and deploy requests do not authorize changes to `main`.
- `beta` is the default for all ordinary implementation work. Start by fetching, checking out `beta`, fast-forward pulling `origin/beta`, and confirming a clean tree.
- Codex may merge beta to main and deploy production only after explicit user release language such as «делаем релиз», «выпускаем релиз», «релизим», or «переноси beta в main».
- Wiki changes follow the same policy: normal development updates beta's Wiki; production Wiki changes when a release reaches main.

The Phase A/B audit for this migration found six local `codex/*` branches and remote `codex/user-profile-favorites`. Every one was an ancestor of the verified `main` (`618791b`), with zero unique commits and no branch-only diff. The remote branch was 128 commits behind. All were superseded by main and removed after the full baseline QA; no unique functionality was discarded. GitHub default branch remains `main`.

## Environments

| Environment | Source | Frontend | API / Worker | D1 | Telegram |
| --- | --- | --- | --- | --- | --- |
| Production | `main` | Cloudflare Pages `iu5hub.pages.dev` | `iu5hub-analytics` | `iu5hub-analytics` | «Студент ИУ5» |
| Beta | `beta` | Cloudflare Pages `https://beta.iu5hub.pages.dev` | `iu5hub-analytics-beta` (`https://iu5hub-analytics-beta.gregory-korneev.workers.dev`) | `iu5hub-beta` (`89517e15-22fc-48ae-a037-3a1b481137db`) | separate «Студент ИУ5 Beta» bot; BotFather setup pending |

The frontend build uses `VITE_APP_ENV` and the central `VITE_ANALYTICS_API_BASE`. Beta must never point at the production Worker. The Beta Worker uses its own D1 binding, CORS origin, dashboard URL, secrets and webhook. Public read-only Yandex Disk catalogs and schedule source inputs may be shared; private user data and production D1 contents are never cloned.

## Ordinary development

```text
task → beta → CI and full QA → Beta Pages + Beta Worker/D1 → manual Beta Mini App check
```

Apply new D1 migrations to beta first. Keep migrations additive and backward compatible where possible. Pushes to beta run the existing CI. Beta Pages branch deployment is served by the existing Pages Git integration; no workflow on beta may deploy the production Worker, run production migrations, or change the production bot/webhook.

## Release procedure (explicit approval required)

1. Fetch `main` and `beta`; inspect production commits since the last beta sync.
2. Merge/synchronize current `main` into `beta`, resolving conflicts on beta and retaining both sets of changes.
3. Run full QA on beta, inspect the Beta Pages deployment and complete the production release check.
4. Only after explicit user release approval, merge beta into main and push main.
5. Apply reviewed migrations to production D1, deploy the production Worker, and confirm the Pages deployment from main. Production deployment must remain serialized and isolated from beta pushes.
6. Smoke test production routes, Worker, D1-backed profile/favorites/analytics, support webhook and schedule.
7. Synchronize beta with the resulting main while preserving beta's own subsequent work. Keep the beta branch.

Do not infer release approval from «реализуй», «исправь», «добавь», «обнови», «улучши», «проверь» or «задеплой».

## Schedule data refresh

`.github/workflows/schedule-sync.yml` keeps the existing scheduled production refresh: it checks, fetches, validates and commits only `public/data/schedule/` to main. When beta exists, the same workflow snapshots that generated directory and copies only it into the latest beta commit, deleting/replacing only the generated schedule directory. It does not reset beta to main, force-push, or touch beta source code. If beta advances during the sync, the workflow retries a normal fast-forward push up to three times and then fails visibly.

## Rollback

For a frontend regression, redeploy the last known-good main commit through the Cloudflare Pages deployment history. For a Worker regression, redeploy the previously known-good production Worker version and verify its bindings/secrets. Preserve the release commit and record the rollback in the Wiki. D1 data/schema rollback is not assumed: migrations should be additive and backward compatible; destructive changes require a separately reviewed recovery plan and backup.

## Migration status

The branch and release policy was committed to main before beta creation. The shared Pages project keeps production branch `main` and allows branch previews; the `beta` preview deployment is active at the stable alias above. Beta D1 was created empty and migrations 0001–0006 were applied. Independent `ANALYTICS_HMAC_SECRET`, `USER_ID_HMAC_SECRET`, `TELEGRAM_WEBHOOK_SECRET` and `SUPPORT_ENCRYPTION_KEY` secrets are set on beta. `ADMIN_TELEGRAM_IDS` and `TELEGRAM_BOT_TOKEN` are pending the external administrator/BotFather step. See `current-state.md`, `deployment.md`, `security.md` and `support.md` for smoke status.
