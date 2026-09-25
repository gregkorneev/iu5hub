# Private profile and favorites

`/#/profile` is available inside the Telegram Mini App. The existing bottom navigation includes Profile for students and administrators. The page displays the Telegram name and optional `@username` from the client integration layer; it never displays the Telegram ID or an avatar.

## Identity and storage

The frontend sends the original `Telegram.WebApp.initData` in `X-Telegram-Init-Data`. The Worker verifies the Telegram signature and freshness on every personal request. It derives a stable `user_hash` using the Worker-only `USER_ID_HMAC_SECRET` and queries only rows for that hash. It does not trust a user ID or hash in a request body. `ANALYTICS_HMAC_SECRET` remains dedicated to analytics.

Favorites live in the existing `ANALYTICS_DB` D1 binding. Migration `0002_favorites.sql` creates a `favorites` table keyed by owner, course and path, plus an index for listing one user's recent items. Rows contain the item type, display name and creation time. They contain no raw Telegram ID, initData, avatar, photo, or temporary Yandex URL. The analytics event cleanup does not touch this table.

## API

All methods use `/api/profile/favorites` and require validated Telegram initData:

| Method | Purpose | Input |
| --- | --- | --- |
| `GET` | List the authenticated user's favorites | none |
| `PUT` | Idempotently add one favorite | JSON `courseId`, `path`, `type`, `name` |
| `DELETE` | Remove one favorite, including when it is already absent | JSON `courseId`, `path` |

The Worker validates a bounded JSON body, course identifier, path, type and name, and uses parameterized D1 statements. A missing, invalid or expired Telegram launch cannot access personal data. Favorites are loaded in one request; the UI uses that list for local heart state and rolls back failed changes.

## Catalog behavior

The key is `courseId + path`, as returned by the current catalog. Opening a saved folder uses the existing `/#/course/:courseId?path=…` route. Opening a file resolves a fresh URL through `MaterialsRepository.getFileUrl` and uses the existing safe link flow. If the resource was moved or removed, the profile reports that it is unavailable and offers removal; it does not try to track Yandex renames.

## Release

Apply `worker/migrations/0002_favorites.sql` to the existing D1 database before serving the new frontend. Provision `USER_ID_HMAC_SECRET` with `wrangler secret put USER_ID_HMAC_SECRET` using a strong, unique value; keep it stable. Deploy the updated Worker, then publish the Pages frontend. No secret value belongs in Git, `wrangler.toml`, Vite variables or logs. Validate with two distinct Telegram accounts and a reload or second device; local browser fixtures cannot prove a real Telegram WebView launch.
