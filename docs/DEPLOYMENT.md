# Deployment, Backup & Recovery Guide

Everything is free and self-hosted. No Docker, no cloud services.

## 1. Requirements
- Windows 10/11/Server or Linux (x64), Node.js 20 LTS or newer
- About 1 GB disk for the app, plus data and backups
- For access from phones outside the office: a domain name and HTTPS (free with Caddy, below)

## 2. Install
```powershell
git clone <repo> C:\Feed; cd C:\Feed
npm ci
copy .env.example .env      # then fill in every value (see section 3)
```

## 3. Environment (`.env`)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `mysql://feed:<password>@127.0.0.1:3307/feed` (MySQL 8.0.16+ or MariaDB 10.4+) |
| `MYSQL_BIN_DIR` | Folder with `mysqld`, used by `npm run db` (e.g. `C:\xampp\mysql\bin`). Not needed if you use an existing MySQL server |
| `SESSION_SECRET` | 32-byte base64 |
| `IDENTITY_ENCRYPTION_KEY` | 32-byte base64. **Losing it = identities unrecoverable** |
| `FILE_ENCRYPTION_KEY` | 32-byte base64, for attachments |
| `BACKUP_ENCRYPTION_KEY` | 32-byte base64, for backups (falls back to `FILE_ENCRYPTION_KEY`) |
| `UPLOAD_DIR`, `MAX_UPLOAD_MB` | Local attachment storage |
| `BACKUP_DIR`, `BACKUP_KEEP` | Backup location (default `./storage/backups`), how many to keep (default 14) |

Generate each key:
```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```
**Copy all keys into your password manager now.** Backups are useless without them.

## 4. First start
```powershell
npm run db                     # terminal 1: local MySQL/MariaDB on 3307 (keep running); skip if you use an existing MySQL server
npx prisma migrate deploy      # terminal 2
npm run db:seed                # roles, categories, departments, starter accounts
npm run build
npx next start -p 3000
```
Starter passwords are in `storage/initial-credentials.txt`. Sign in, change them, then **delete that file**.
The Super Admin must enrol an authenticator app on first sign-in.

Create more Super Admins (CLI only, by design):
```powershell
npm run admin -- create owner@company.com "Full Name"
```

## 5. Run as a service

**Windows** (free [NSSM](https://nssm.cc)):
```powershell
nssm install FeedDB "C:\Program Files\nodejs\npm.cmd" "run db"
nssm set FeedDB AppDirectory C:\Feed
nssm install FeedApp "C:\Program Files\nodejs\npx.cmd" "next start -p 3000"
nssm set FeedApp AppDirectory C:\Feed
nssm set FeedApp DependOnService FeedDB
nssm start FeedDB; nssm start FeedApp
```

**Linux** (systemd): create `feed-db.service` (`ExecStart=/usr/bin/npm run db`) and `feed-app.service` (`ExecStart=/usr/bin/npx next start -p 3000`, `After=feed-db.service`), both with `WorkingDirectory=/opt/feed` and a dedicated non-root user.

## 6. HTTPS (required for phones and PWA install)
Use [Caddy](https://caddyserver.com) (free, automatic Let's Encrypt certificates). `Caddyfile`:
```
feedback.yourcompany.com {
  reverse_proxy 127.0.0.1:3000
}
```
Office-only (LAN) use: `tls internal` in the Caddyfile, then install Caddy's root certificate on staff devices.
Only expose port 443. Never expose 3000 or the database port (3307/3306).

## 7. Backups
```powershell
npm run backup
```
- This takes a consistent snapshot of all tables plus the (already encrypted) attachments. Each file is gzipped and AES-256-GCM encrypted with SHA-256 checksums, and a manifest records row counts.
- Schedule it daily (Windows Task Scheduler / cron), e.g. 02:00:
  ```powershell
  schtasks /create /tn FeedBackup /sc daily /st 02:00 /tr "cmd /c cd /d C:\Feed && npm run backup >> storage\backup.log 2>&1"
  ```
- **Copy `storage/backups` off the server** (USB drive, second PC, NAS) at least weekly. A backup on the same disk doesn't survive disk failure.

## 8. Restore
**Test restore (safe, do this monthly):**
```powershell
npm run restore -- --verify
```
This restores into a throwaway database, checks every checksum, row count and protection trigger, then drops it. Verified working on 26 Nov 2026 (21 tables, 136 rows, 1 file).

**Real restore (after data loss):**
1. Stop the app (`nssm stop FeedApp`). Keep the DB running.
2. Put the correct keys in `.env`.
3. Run:
   ```powershell
   npm run restore -- --into-live storage\backups\<timestamp>
   ```
4. Start the app.

## 9. Updating
```powershell
git pull; npm ci; npx prisma migrate deploy; npm run build; nssm restart FeedApp
```
Run `npm run backup` first.

## 10. Monitoring & logs
- App errors go to stdout (`[api] ...`). Point NSSM/systemd to a log file.
- Check **Admin → Audit log** and **Identity access** weekly.
- Run `npm audit --omit=dev` monthly.

## 11. Tests
```powershell
npm test                 # 42 unit tests
npm run build; npx playwright test   # 40 end-to-end tests (needs the DB running; uses installed Microsoft Edge)
```

## 12. Install on a phone (testing on the office Wi-Fi)
1. Stop `npm run dev` if it's running, then:
   ```powershell
   npm run build
   npm run start:lan
   ```
   This serves the app on every network address of this PC, port 3000.
2. The first time only, allow port 3000 through Windows Firewall (PowerShell as Administrator):
   ```powershell
   New-NetFirewallRule -DisplayName "Feed 3000" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow -Profile Private
   ```
3. Find this PC's address with `ipconfig` (IPv4, e.g. `192.168.1.100`). The phone must be on the same Wi-Fi.
4. **Android (Chrome):** Chrome only installs apps from HTTPS sites. For testing on plain Wi-Fi:
   - open `chrome://flags/#unsafely-treat-insecure-origin-as-secure`
   - enter `http://192.168.1.100:3000`, set it to **Enabled** and relaunch Chrome
   - open the address, then menu ⋮ → **Install app**
5. **iPhone (Safari):** open the address, then Share → **Add to Home Screen**. This works without HTTPS.

The home-screen icon and name come from **System settings → Company logo / Company name**. A phone that already installed the app may take a day to update the icon; uninstall and reinstall to see it straight away.

For real use by all employees, use HTTPS (section 6). Then no Chrome flag is needed and everyone gets the normal "Install" prompt.
## 13. Using an existing MySQL server (instead of `npm run db`)
1. Create a database and a user:
   ```sql
   CREATE DATABASE feed CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   CREATE USER 'feed'@'localhost' IDENTIFIED BY '<strong password>';
   GRANT ALL PRIVILEGES ON feed.* TO 'feed'@'localhost';
   ```
   For `npm run restore -- --verify`, the user also needs `CREATE`/`DROP` on `feed_restore_test`.
   For `prisma migrate dev` (development only), it also needs to create a temporary "shadow" database.
2. Set `DATABASE_URL=mysql://feed:<password>@127.0.0.1:3306/feed`, then run `npx prisma migrate deploy` and `npm run db:seed`.
3. The migrations create triggers. On MySQL with binary logging on, that may need `log_bin_trust_function_creators=1` or SUPER rights for the migration step.
## 14. Hostinger (Node.js web app from GitHub)
1. **Database:** hPanel → Databases → MySQL. Create a database and user, and note the host, name, user and password.
2. **Import the repository** `Rezenoris-bytes/feed`:
   - **Branch:** the branch that has the app: `master` after merging PR #1, or `feature/feedback-system`.
   - **Framework preset:** Next.js. **Node:** 22.x. **Root directory:** `./`.
   - **Build command:** `npm run build`. **Package manager:** npm. **Output directory:** `.next`.
   - Nothing else is needed. `npm install` generates the database client (postinstall), and `npm start` creates or updates the tables (`prisma migrate deploy`) before serving. The build itself doesn't need the database.
3. **Environment variables:**
   - `DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DBNAME`
   - `SESSION_SECRET`, `IDENTITY_ENCRYPTION_KEY`, `FILE_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`: new 32-byte base64 keys (section 3). Save them in a password manager.
   - `UPLOAD_DIR` and `BRANDING_DIR`: folders outside the deployed app folder, so redeploys don't wipe attachments or the logo.
   - `MAX_UPLOAD_MB=10`
4. **First start:** the tables are created automatically. If it fails with a trigger or SUPER privilege error, the MySQL user isn't allowed to create triggers. Ask Hostinger support to enable it, or report the exact error.
5. **First Super Admin** (SSH into the app folder):
   - `npm run db:seed` creates roles, categories and departments.
   - `npm run admin -- create you@company.com "Your Name"`
6. **HTTPS:** Hostinger provides it on your domain, so phones get the normal "Install app" prompt.