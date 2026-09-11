# Deployment

## Current target and public entry

Production frontend is a static React + TypeScript + Vite build on **Cloud.ru Evolution Object Storage** with Static Website Hosting and an HTTPS endpoint. Cloud.ru serves only the `dist/` artifact: `index.html`, compiled JS/CSS assets, `logo-iu5.jpeg` and other small static assets. The current catalog is bundled into the frontend; PDFs, presentations, archives, video and other study files stay on Yandex Disk.

Student-facing entry is Student Hub Bot (`https://t.me/<bot_username>`), which opens the Telegram Mini App. The Cloud.ru HTTPS endpoint is a technical URL configured in BotFather/the bot. Do not distribute it in student chats, QR codes, presentations, handbooks or social posts.

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
Cloud.ru HTTPS endpoint → Student Hub Bot → Telegram Mini App
```

`verify` runs on every push and pull request. `deploy-cloudru` is deliberately disabled by default and runs only when all conditions are true:

- event is `push` to `main`;
- `verify` succeeded;
- GitHub Actions variable `CLOUDRU_DEPLOY_ENABLED` exactly equals `true`;
- the `cloudru-production` environment can supply the required secrets and variables.

The deploy job uses a production concurrency group, so production deploys never overlap. It rebuilds rather than reusing the `verify` artifact. This keeps the workflow simple, but both jobs must use the same lockfile and Node 22 setup; `npm ci` makes the dependency install deterministic.

## GitHub Environment configuration

The `cloudru-production` Environment exists and its `CLOUDRU_DEPLOY_ENABLED` variable is explicitly `false`, so deploy is currently safe by default. Configure the remaining values there; change the flag to literal `true` only for a reviewed deployment target.

| Kind | Name | Required | Purpose |
| --- | --- | --- | --- |
| Secret | `CLOUDRU_ACCESS_KEY_ID` | yes | S3-compatible Object Storage access key |
| Secret | `CLOUDRU_SECRET_ACCESS_KEY` | yes | matching secret key |
| Secret | `CLOUDRU_BUCKET` | yes | dedicated production frontend bucket name |
| Variable | `CLOUDRU_PREFIX` | no | relative object-key prefix; leave empty for the bucket root |
| Variable | `CLOUDRU_DEPLOY_ENABLED` | yes, to deploy | set to literal `true` only after the remaining configuration is ready |

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
4. Create the least-privilege service account and populate the exact GitHub Environment secrets/variables above. Keep the existing `CLOUDRU_DEPLOY_ENABLED=false` until the target has been reviewed.
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
| Configuration validation fails | Populate the three required secrets, including `CLOUDRU_BUCKET`; ensure `CLOUDRU_PREFIX` is empty or matches the workflow's relative-key validation and contains no `..`. |
| `aws` command or S3 request fails | The job expects AWS CLI on `ubuntu-latest`. Check runner output, endpoint `https://s3.cloud.ru`, region, credentials and the service-account policy; do not print secrets for diagnosis. |
| Unexpected files disappear | Disable deployment, inspect the exact bucket/prefix, restore versioned objects, then correct the target. `--delete` is intentional only for a dedicated deploy target. |
| Old interface persists | Confirm `index.html` has the explicit no-cache header; fingerprinted `assets/` should have `public, max-age=31536000, immutable`. Then inspect Cloud.ru/CDN cache behavior. |
| Base URL works but a route does not | Use the hash form `/#/…`; verify the web-site index document is `index.html`. |
| Telegram refuses to launch | Verify the configured Mini App endpoint is HTTPS, reachable without authentication, and exactly matches the endpoint tested in Cloud.ru. |

## Limitations

Cloud.ru Object Storage is frontend hosting, not a backend. Authentication, server-side Telegram `initData` validation, Yandex Disk API access, notifications, databases and admin functions remain future services and are not part of the MVP.
