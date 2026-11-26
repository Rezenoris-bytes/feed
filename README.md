# Feed — Confidential Employee Feedback

Free and self-hosted. No cloud services and no Docker.

## First run
1. `npm install`
2. Copy `.env.example` to `.env` and fill in the secrets (the commands to generate them are in that file).
3. `npm run db` starts a local MySQL-compatible server (MySQL 8 or MariaDB, e.g. from XAMPP, set `MYSQL_BIN_DIR`) on port 3307 with its data in `storage/mysql`. Keep this terminal open.
4. `npx prisma migrate deploy`
5. `npm run db:seed` creates roles, categories and departments, plus starter accounts. Their passwords are saved in `storage/initial-credentials.txt`.
6. `npm run dev`, then open http://localhost:3000

The Super Admin is asked to set up an authenticator app at first sign-in.

Tests: `npm test` (unit), `npm run build; npx playwright test` (end to end). Backups: `npm run backup`, `npm run restore -- --verify`.

Docs: [Architecture](docs/ARCHITECTURE.md) · [Security & audit](docs/SECURITY.md) · [API](docs/API.md) · [Deployment & backups](docs/DEPLOYMENT.md) · [User guide](docs/USER-GUIDE.md) · [Test report](docs/TEST-REPORT.md)
