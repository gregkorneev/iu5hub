# ADR-0004: Telegram identity for private profile and favorites

## Context

Students need a private list of catalog folders and files that survives a Mini App reload and follows the same Telegram account across devices. The existing analytics HMAC key is intended for analytics, and its rotation must not change ownership of persistent user data.

## Decision

- Telegram Mini App `initData` is the only authentication input. The existing Worker verifies its signature and freshness, then derives the owner from the verified `user.id`. Browser-supplied user identifiers never authorize access.
- The Worker derives `user_hash = HMAC-SHA-256(USER_ID_HMAC_SECRET, verified Telegram user ID)` for persistent data. This secret is separate from `ANALYTICS_HMAC_SECRET`; raw Telegram IDs are not stored in D1.
- Favorites are individual rows in the existing D1 database, owned by `user_hash` and keyed by `courseId + path`. D1 is the source of truth. Client memory may hold a temporary lookup set, but localStorage is not an account store.
- The catalog continues to resolve folders and files through `MaterialsRepository`. Favorites store only type and name as display metadata; no temporary Yandex download URL is stored. A renamed or removed item is shown as unavailable when opened and can be removed by the user.
- Telegram name and username may be shown directly from the client integration layer. Profile records do not store name, username, photo, avatar, phone number, or email.

## Alternatives

The analytics HMAC key would couple persistent data to analytics key rotation. LocalStorage would not synchronize devices or separate trusted accounts. A separate authentication provider, Worker, or database would add infrastructure without meeting a product need.

## Consequences

`USER_ID_HMAC_SECRET` must be provisioned as a Worker secret and retained across deployments. Rotating it requires a deliberate data migration or users will see new, empty favorite lists. The existing analytics HMAC and its retention schedule remain independent; event cleanup must never remove favorites.

## Status

Accepted — 2026-09-25.
