# Local Telegram Mini App development

## Scope

This is a **development-only** path for opening the local Vite application through Telegram. It does not deploy anything to Cloud.ru, create a permanent URL, configure a bot, or replace production release checks.

The designated development test bot is `@iu5_archive_bot`. Its current Mini App URL is deliberately not recorded here and must not be inferred as configured. The production Student Hub Bot and its technical Cloud.ru endpoint remain separate.

## Start

Install `cloudflared` locally, then run:

```bash
npm run dev:telegram
```

The script starts Vite bound to `127.0.0.1`, waits for its local URL, then starts a Cloudflare Quick Tunnel to it. It prints a temporary HTTPS URL matching `https://<random>.trycloudflare.com`; copy that value only into the test-bot configuration for the current test session if access to that configuration is available.

The URL is ephemeral. It changes after every tunnel restart and must never be committed, placed in `.env`, used in production configuration, distributed to students, or entered in Wiki/changelog.

## Network and host behavior

- The tunnel command explicitly uses `cloudflared tunnel --protocol http2`. This is the HTTP/2 fallback/compatibility path for local testing when the default tunnel transport is unsuitable; the script does not silently change production networking.
- Vite remains bound to loopback (`127.0.0.1`), so it is not exposed directly on the LAN.
- Vite's `server.allowedHosts` allows only the `.trycloudflare.com` host suffix required for the Quick Tunnel. Do not broaden this list for convenience.
- Cloudflare Quick Tunnels are not a production hosting service. Use Cloud.ru only for production artifacts and the permanent technical Mini App URL.

## Telegram test flow

1. Start `npm run dev:telegram` and wait until it prints the temporary HTTPS URL.
2. If authorized to edit the test bot, set that temporary URL for `@iu5_archive_bot`; do not commit any bot token or URL.
3. Open the Mini App from Telegram and test the intended scenario.
4. For UI changes, Vite HMR may update the WebView, but Telegram clients/webviews can drop or delay the HMR WebSocket. If the view does not update, reload/reopen the Mini App; do not treat a failed HMR refresh as an application failure.
5. End the process with `Ctrl+C` when testing is complete. The script sends `SIGTERM` to both Vite and `cloudflared`; the temporary URL then stops working.

## Troubleshooting

| Symptom | Check / resolution |
| --- | --- |
| `cloudflared` cannot start | Install `cloudflared`, confirm it is on `PATH`, then rerun `npm run dev:telegram`. The script reports the underlying spawn error. |
| No temporary URL appears | Check Vite output first; the tunnel starts only after Vite prints its local URL. Check network access to Cloudflare Quick Tunnels. |
| Telegram cannot open the app | Confirm the currently running temporary HTTPS URL, then update the authorized test-bot setting for this session. A URL from a previous run is invalid. |
| Changes do not appear | Wait briefly for HMR; if it does not connect in the Telegram WebView, reload or close and reopen the Mini App. |
| Tunnel has stopped | Restart `npm run dev:telegram`, use the newly printed URL, and update the test-bot setting if required. |

## Security and cleanup

No credentials are needed by the script. Telegram Bot tokens, Cloud.ru credentials, permanent endpoints and temporary Quick Tunnel URLs remain outside Git. Stop the command after each test session; do not leave a development tunnel running unnecessarily.
