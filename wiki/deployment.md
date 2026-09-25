# Deployment

## Current target and public entry

Production frontend is a static React + TypeScript + Vite build on **Cloudflare Pages**. The current public project is [`iu5hub`](https://iu5hub.pages.dev), deployed from `dist/`: `index.html`, compiled JS/CSS assets, `logo-iu5.jpeg` and other small static assets. The current catalog is bundled into the frontend; PDFs, presentations, archives, video and other study files stay on Yandex Disk.

Student-facing entry is the bot «Студент ИУ5» (`https://t.me/<bot_username>`), which opens the Telegram Mini App. The Cloudflare Pages HTTPS endpoint is the technical URL to configure in BotFather/the bot.

The Mini App uses `HashRouter`; client routes are URLs such as `/#/material/<id>`. No provider-specific SPA fallback is needed for them. Static Website Hosting must return `index.html` for the base endpoint and should use generated `error.html` as its error document.

## Implemented GitHub Actions pipeline

The repository workflow is `.github/workflows/ci.yml`.

```text
push or pull request
  ↓
verify: npm ci → lint → typecheck → test → build
  ↓ (only direct push to main, only when explicitly enabled)
deploy-cloudru: npm ci → build → validate config → publish dist/
  ↓
Cloud.ru HTTPS endpoint → бот «Студент ИУ5» → Telegram Mini App
```

`verify` runs on every push and pull request. `deploy-cloudru` and `deploy-cloudflare-pages` are deliberately disabled by default; each runs only after `verify` on a direct push to `main` when its own enable variable is literal `true`. They are independent static-host deploy targets and neither deploys a bot backend.

- event is `push` to `main`;
- `verify` succeeded;
- GitHub Actions variable `CLOUDRU_DEPLOY_ENABLED` exactly equals `true`;
- the `cloudru-production` environment can supply the required secrets and variables.

The deploy job uses a production concurrency group, so production deploys never overlap. It rebuilds rather than reusing the `verify` artifact. This keeps the workflow simple, but both jobs must use the same lockfile and Node 22 setup; `npm ci` makes the dependency install deterministic.

## Optional Cloudflare Pages deployment

`deploy-cloudflare-pages` publishes only `dist/` to Cloudflare Pages with `npx --yes wrangler@4 pages deploy`. It has its own `cloudflare-pages-production` concurrency group and runs only when `CLOUDFLARE_PAGES_DEPLOY_ENABLED=true` on a push to `main` after `verify` succeeds.

Provision it as follows:

1. Create the Cloudflare Pages project for this Mini App and record its lowercase project name.
2. Add repository secrets `CLOUDFLARE_API_TOKEN` (least-privilege Pages deploy token) and `CLOUDFLARE_ACCOUNT_ID`.
3. Add repository variables `CLOUDFLARE_PAGES_PROJECT` and the public HTTPS Worker origin `VITE_ANALYTICS_API_BASE`; keep `CLOUDFLARE_PAGES_DEPLOY_ENABLED=false` until review is complete.
4. Push a verified commit to `main`, set the enable variable to literal `true`, then confirm the job validates all three values and deploys `dist/` to the `main` branch.

The Pages URL is a technical HTTPS endpoint for the Telegram Mini App. Do not make it the public product entry or include Telegram credentials in Cloudflare Pages settings.

## Current Cloudflare Pages release

Schedule JSON is included in the existing static Pages `dist/` artifact and is deployed by the already-connected GitHub integration when `main` changes. `.github/workflows/schedule-sync.yml` only refreshes, validates and commits static source data; it does not run a second Cloudflare deploy. The initial release also applies Worker D1 migration `0003_profile_preferences.sql` and deploys the small preference API. No schedule lesson data enters D1.

On 2026-09-21 the production build was published by Cloudflare Pages Direct Upload at [`https://iu5hub.pages.dev`](https://iu5hub.pages.dev), configured as both the Main App and menu-button URL in BotFather, and verified by opening it in Telegram. It contains only generated `dist/` files; no Telegram token, bot relay, or support backend is included.

The Telegram Web App SDK script must remain in `<head>` before the Vite module script. This lets `initializeTelegram()` call `Telegram.WebApp.ready()` when the Mini App starts and prevents Telegram's native loading indicator from remaining on screen.

The GitHub App integration is connected to `gregkorneev/iu5hub`; the production branch is `main` and automatic deployments are enabled. A push to `main` runs the Pages build with its production build variables. The disabled GitHub Actions job remains an optional later automation path and requires its documented Cloudflare API secrets before it can be enabled.

## GitHub Environment configuration

The `cloudru-production` Environment exists for deployment secrets and the optional prefix. `CLOUDRU_DEPLOY_ENABLED` must be a repository variable because the job condition is evaluated before GitHub selects the Environment. Leave it unset or `false` until the target is ready; set it to literal `true` only for a reviewed deployment target. Both optional deploy jobs require the public repository variable `VITE_ANALYTICS_API_BASE` so their production builds connect to the Worker.

| Kind | Name | Required | Purpose |
| --- | --- | --- | --- |
| Secret | `CLOUDRU_ACCESS_KEY_ID` | yes | S3-compatible Object Storage access key |
| Secret | `CLOUDRU_SECRET_ACCESS_KEY` | yes | matching secret key |
| Secret | `CLOUDRU_BUCKET` | yes | dedicated production frontend bucket name |
| Variable | `CLOUDRU_PREFIX` | no | relative object-key prefix; leave empty for the bucket root |
| Repository variable | `CLOUDRU_DEPLOY_ENABLED` | yes, to deploy | set to literal `true` only after the remaining configuration is ready |
| Repository variable | `VITE_ANALYTICS_API_BASE` | yes, to deploy | public HTTPS Worker origin included in the Vite build |

Cloudflare Pages uses separate repository configuration: secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`; variables `CLOUDFLARE_PAGES_PROJECT`, `CLOUDFLARE_PAGES_DEPLOY_ENABLED` and the shared `VITE_ANALYTICS_API_BASE`. The validator rejects missing values and project names outside lowercase letters, digits and hyphens.

The workflow uses `https://s3.cloud.ru`, `ru-central-1`, disables EC2 metadata discovery and has repository token permission `contents: read`. It prints `aws --version` before publishing. No bot token, Cloud.ru secret or `VITE_*` secret belongs in the repository or frontend bundle. `.env.example` intentionally contains no runtime value.

## Least-privilege Object Storage access

Use a dedicated deploy service account and a dedicated bucket (or an otherwise empty, dedicated prefix). Its policy should permit only the S3-compatible operations needed by the workflow:

- `ListBucket`, restricted to `CLOUDRU_PREFIX` when a prefix is used;
- `GetObject`, `PutObject` and `DeleteObject` only for objects below that exact deployment target.

Do not grant permissions for other buckets, bucket-policy/ACL changes, credential management, object-version deletion or account administration. The frontend endpoint may need public **read-only** access through the static-hosting configuration; this is separate from deploy credentials. Enable bucket versioning before the first production deployment so accidental deletion or an incorrect artifact remains recoverable.

## Publish and cache behavior

Before publishing, the job copies `dist/index.html` to `dist/error.html`. The actual publish commands are equivalent to:

```bash
cp dist/index.html dist/error.html
aws s3 sync dist/assets/ s3://<bucket>/<optional-prefix>/assets/ --delete \
  --cache-control 'public, max-age=31536000, immutable'
aws s3 sync dist/ s3://<bucket>/<optional-prefix>/ --delete \
  --exclude 'assets/*' --exclude index.html --cache-control 'no-cache'
aws s3 cp dist/index.html s3://<bucket>/<optional-prefix>/index.html \
  --cache-control 'no-cache, no-store, must-revalidate'
```

Consequences:

- only the configured bucket/prefix is targeted; validate it is dedicated before setting the enable variable because `--delete` removes remote objects absent from `dist/`;
- fingerprinted Vite JS/CSS assets in `assets/` are uploaded separately with `public, max-age=31536000, immutable`;
- root files, including `error.html`, are uploaded with `no-cache`; `index.html` is excluded from that sync and uploaded last, reducing the interval in which it can reference an incomplete new asset set;
- `index.html` explicitly has `no-cache, no-store, must-revalidate`;
- `logo-iu5.jpeg` and future root-level mutable data receive `no-cache`. Cache headers still need verification through the actual Cloud.ru endpoint/CDN during first release.

## Provisioning and first release

1. Create the dedicated bucket, enable Static Website Hosting, configure `index.html` as its index document and `error.html` as its error document.
2. Obtain and test an HTTPS endpoint accepted by Telegram Mini Apps. Do not make the raw endpoint the public product link.
3. Enable versioning; make public-read behavior no broader than the static frontend endpoint requires.
4. Create the least-privilege service account and populate the GitHub Environment secrets/optional prefix above. Keep the repository variable `CLOUDRU_DEPLOY_ENABLED` unset or `false` until the target has been reviewed.
5. Push a verified commit to `main`, set `CLOUDRU_DEPLOY_ENABLED=true`, and inspect the first `deploy-cloudru` log. It must show no missing configuration and must not expose secret values.
6. Verify the base endpoint, a hash route, assets, HTTPS and cache headers. Then set the technical HTTPS endpoint as the Mini App URL in BotFather/the bot.
7. Complete the Telegram smoke matrix in `testing.md`, record the released commit and update Wiki.

## Rollback

The current sync-based deployment is not transactional. Bucket versioning is the primary recovery mechanism. Before release, retain the last-known-good commit and either preserve its object versions or keep a separately reproducible `dist/` artifact.

To roll back application code, revert to the last-known-good commit on `main`; after `verify`, the same deploy job publishes the historical build when enabled. To recover from an accidental object deletion or a bad publish, restore the corresponding object versions in the bucket, then repeat endpoint and Telegram smoke checks. Never patch production outside Git except for an emergency Object Storage version restore; record any emergency action in Wiki and follow it with a Git-based corrective release.

## Troubleshooting

| Symptom | Check / resolution |
| --- | --- |
| `deploy-cloudru` is skipped | Confirm a push (not pull request) reached `main`, `verify` passed, and `CLOUDRU_DEPLOY_ENABLED` is the literal `true`. |
| `deploy-cloudflare-pages` is skipped | Confirm a push reached `main`, `verify` passed, and `CLOUDFLARE_PAGES_DEPLOY_ENABLED` is the literal `true`. |
| Cloudflare Pages configuration validation fails | Set both Cloudflare secrets and a valid lowercase `CLOUDFLARE_PAGES_PROJECT`; do not print their values while diagnosing. |
| Configuration validation fails | Populate the three required secrets, including `CLOUDRU_BUCKET`; ensure `CLOUDRU_PREFIX` is empty or matches the workflow's relative-key validation and contains no `..`. |
| `aws` command or S3 request fails | The job expects AWS CLI on `ubuntu-latest`. Check runner output, endpoint `https://s3.cloud.ru`, region, credentials and the service-account policy; do not print secrets for diagnosis. |
| Unexpected files disappear | Disable deployment, inspect the exact bucket/prefix, restore versioned objects, then correct the target. `--delete` is intentional only for a dedicated deploy target. |
| Old interface persists | Confirm `index.html` has the explicit no-cache header; fingerprinted `assets/` should have `public, max-age=31536000, immutable`. Then inspect Cloud.ru/CDN cache behavior. |
| Base URL works but a route does not | Use the hash form `/#/…`; verify the web-site index document is `index.html`. |
| Telegram refuses to launch | Verify the configured Mini App endpoint is HTTPS, reachable without authentication, and exactly matches the endpoint tested in Cloud.ru. |

## Profile and favorites release order

The personal profile uses the existing Worker and `ANALYTICS_DB` D1 database. Before releasing the Pages bundle, apply `worker/migrations/0002_favorites.sql` to the production D1 binding with the existing Wrangler workflow (`npx wrangler d1 migrations apply iu5hub-analytics --remote`). Set a unique, strong, durable Worker secret with `npx wrangler secret put USER_ID_HMAC_SECRET`, then deploy the updated Worker (`npx wrangler deploy`). Never pass a secret on the command line or commit its value. The Worker's `/api/profile/favorites` route uses the existing public `VITE_ANALYTICS_API_BASE` origin; no second frontend API variable is needed. Verify a real Telegram launch with two accounts before treating the feature as released. See `profile.md` for the API and privacy model.

## Limitations

Cloudflare Pages is static frontend hosting, not the analytics backend. Private analytics additionally requires the Worker, D1 binding/migrations, Worker-only secrets and protected Telegram webhook described in `analytics.md`. Deploy and smoke-test it independently of a Pages artifact: a successful Pages deployment alone does not enable `/stats`, authentication, D1 or admin functions. When the Worker has its own hostname, set the public Pages build variable `VITE_ANALYTICS_API_BASE` to that HTTPS origin; it contains no credential and is protected by the Worker's origin allowlist and server-side Telegram validation.

On 2026-09-21 the production Worker `iu5hub-analytics` was published on its `workers.dev` HTTPS origin, bound to D1 `iu5hub-analytics`, and its protected Telegram webhook was configured. The Pages production environment has `VITE_ANALYTICS_API_BASE` set to that origin. A subsequent Pages build is required whenever this build-time variable is changed.
