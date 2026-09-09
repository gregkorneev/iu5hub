# Deployment

## Current target

The production frontend is a static React + TypeScript + Vite build hosted on **Beget FreeHosting**. Beget hosts only the interface: `index.html`, compiled assets, icons, small images and static metadata. PDFs, presentations, archives, video and other large study files remain on Yandex Disk and are opened through external links.

The web browser and Telegram Mini App use the same application, production build and URL. Telegram opens the deployed web interface in its WebView; it is not a second deployment.

## URLs and domain policy

| Purpose | URL |
| --- | --- |
| Development | `http://localhost:<vite-port>` |
| Temporary Beget endpoint | `https://<project>.bget.ru` |
| Canonical public endpoint | approved custom domain, for example `https://studenthub.ru` |

The Beget technical domain is a deployment and recovery endpoint only. Do not put it in QR codes, presentations, student chats, social posts or permanent documents. Long-lived public links and Telegram configuration must use the approved custom domain, so a later host migration is only a DNS change.

Configure `VITE_APP_PUBLIC_URL` from `.env.example` per environment. It must be empty locally, the HTTPS Beget address for technical deployment, and the custom HTTPS domain in public production. Never put secrets in this variable or any `VITE_*` variable.

## Release procedure

1. Start from the desired Git commit and run `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.
2. Upload the **contents** of `dist/` to Beget's web root. The production build copies `public/.htaccess` into `dist/.htaccess`. Do not upload `src/`, `node_modules/`, `.git/`, tests, `.env`, or other development files.
3. Verify HTTPS and configure HTTP-to-HTTPS redirect in the Beget control panel if it is available for the domain.
4. Confirm that `.htaccess` is active: existing files are served directly and an unknown physical path falls back to `index.html` so React Router handles direct routes.
5. Smoke-test `/`, a direct `/subject/<slug>`, `/material/<id>`, search, an external Yandex Disk link, and the configured Telegram Mini App URL.
6. Record the released commit, update this Wiki, commit the documentation, and push to GitHub.

GitHub Actions already gates push and pull-request changes with install, lint, typecheck, tests and production build. Publication to Beget remains a controlled upload until Beget access is supplied and an automation method is approved.

## Rollback

Never patch production outside Git. To roll back, select the last known-good commit, run the same checks and build, upload that commit's `dist/` contents to Beget, and repeat the smoke test. Then document and push the rollback record.

## DNS, HTTPS and future migration

Connect the approved custom domain to Beget through DNS and enable HTTPS before making it public or using it in Telegram. The frontend uses relative internal routes and contains no Beget-domain links, so it remains portable: any static host can serve the same `dist/` artifact and the public URL can be preserved by changing DNS.

## Limitations

Beget FreeHosting is frontend-only for this MVP. Authentication, Yandex Disk API access, notifications, databases and admin functions, if needed later, should run on separately managed backend services. Secrets stay outside the frontend repository and bundle.
