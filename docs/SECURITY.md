# Security Architecture & Audit Report

> **Current model (updated 26 Nov 2026): employees never sign in.** Every submission is fully anonymous, made from the public pages `/` → `/submit` and followed up at `/track` with a reference and a one-time secret key. No identity is stored, so the earlier "Super Admin reveals identity" feature was **removed**. Only HR, reviewers and Super Admins have accounts. Older sections below that mention employee login, "My submissions" or identity reveal describe the previous design.

Scope: Feed v0.1 (Next.js 15.5, Prisma 6, PostgreSQL 19 embedded), audited 26 Nov 2026.
Method: code review of every route handler and service, plus automated tests (`tests/unit`, `tests/e2e`) that attack the running production build.

## 1. Identity protection model

| Data | Who can see it | How it's enforced |
|---|---|---|
| Feedback text, attachments | HR, Super Admin; reviewers when assigned or in their department (non-sensitive only) | `staffScope()` row filter on every staff query |
| Who submitted it | **Super Admin only**, per case, with reason + fresh MFA | Only `src/server/identity.ts` reads `feedback_identity_mappings` |
| The submitter's own cases | That employee | `owner_hmac = HMAC(userId)`; no user FK on feedback |

- `feedback_submissions` has **no user id**. The link lives in `feedback_identity_mappings.userIdEnc` (AES-256-GCM, random IV, key `IDENTITY_ENCRYPTION_KEY`).
- Employees find their own cases via a keyed HMAC, which can't be reversed or recomputed without the server key.
- Staff only see the submission **date**, not the time, and the same for submitter replies, so they can't infer the author from timing.
- Staff names are hidden from employees ("Feedback team"), and internal notes never reach employees.
- Attachments: the type is checked from the file bytes. EXIF/GPS/author data is stripped from images (re-encoded) and PDF Info/XMP metadata is cleared. The original filename is discarded ("Attachment 1"). Files are stored encrypted under random UUIDs and served with `nosniff`, `sandbox` CSP and a generic filename.
- Reports and exports contain metadata only (no description, messages, notes or identity). Every export is audited.
- Notifications are in-app only (no email) and contain only the reference number and event.
- Reveal flow: Super Admin role, then MFA within the last 5 minutes, then a reason of at least 20 characters. The access log row is written in the **same transaction** as the read. Denied attempts are logged too.
- Database: append-only triggers on `audit_logs` and `identity_access_logs`, and an immutability trigger on `feedback_identity_mappings` (verified by e2e test, including direct SQL).

## 2. Authentication & session

- Passwords: bcrypt cost 12. Timing is equalised for unknown emails, and the error message is the same.
- Lockout for 15 minutes after 5 failures per account, plus an in-memory rate limit of 5 attempts per 15 minutes per email.
- Sessions: 256-bit random token. Only its SHA-256 is stored, so a database leak doesn't expose usable sessions. The cookie is `__Host-`, HttpOnly, Secure, SameSite=Strict, with an 8-hour absolute expiry. A fresh id is issued on every login, which prevents fixation.
- Super Admin: TOTP MFA is mandatory, and every Super Admin request requires an MFA-verified session.
- A password change signs out the user's other sessions. Disabling a user kills their sessions and unassigns their open cases.
- Super Admins can only be created, reset or disabled from the server CLI (`npm run admin`), so a hijacked browser session can't create another one.

## 3. Request-level controls

- Deny by default: `requireAuth(perm)` on every API route. Missing permission returns **404** to avoid leaking whether something exists. Row scope is re-checked inside every service function.
- CSRF: SameSite=Strict cookie, plus an `Origin` must match `Host` check on every mutating request.
- Validation: Zod on every input. Unknown fields are dropped (forged `role`/`status`/`ownerHmac` are ignored; tested).
- Errors: one generic 500 message. Prisma, SQL and stack traces never reach the client (tested).
- Injection: Prisma only (no raw SQL in request paths); React escaping, with no `dangerouslySetInnerHTML`.
- Headers: CSP (`frame-ancestors 'none'`, `object-src 'none'`, self-only sources), X-Frame-Options DENY, nosniff, `Referrer-Policy: no-referrer`, Permissions-Policy, COOP, HSTS in production. `x-powered-by` is removed. API responses are `no-store`.
- PWA: the service worker caches static assets and the offline page only, never `/api/*` or pages with feedback content.

## 4. Audit findings

| # | Severity | Finding | Status |
|---|---|---|---|
| F1 | High | Dashboard crashed (server→client function prop) | **Fixed** in Phase 4 |
| F2 | Medium | Staff could see exact submission time (timing correlation) | **Fixed**: day precision for submitter events |
| F3 | Medium | Auth screens lacked a real heading (a11y) | **Fixed**: h1 |
| F4 | Medium | CSV formula injection via titles | **Fixed**: cells prefixed with `'` (unit + e2e tested) |
| F5 | Low | `script-src 'unsafe-inline'` required by Next.js inline bootstrap | **Accepted**. No user HTML is rendered. Nonce-based CSP is a future hardening step |
| F6 | Low | Rate limiter is in-memory (resets on restart, per process) | **Accepted** for single-server deployment. Account lockout in the DB still applies |
| F7 | Info | `npm audit`: 5 high and 1 moderate, all in **build tooling** (Prisma CLI config loader: `effect`, `deepmerge-ts`; PostCSS bundled in Next's CSS build) | **Accepted**: not reachable at runtime, since PostCSS only processes our own CSS at build time and the Prisma CLI only reads our config. Fixes require Next 16 / Prisma 7 (major). Planned upgrade |
| F8 | Info | Employees get no notifications (by design: the system can't map a case to its author for outbound messages) | **By design**. Employees check My submissions |
| F9 | Info | Content written by the employee can still identify them | **Mitigated** by warnings in the submit flow. Can't be solved technically |

No critical or high-severity issues remain in application code.

## 5. Residual risks & operator duties

1. **Keys** (`IDENTITY_ENCRYPTION_KEY`, `FILE_ENCRYPTION_KEY`, `BACKUP_ENCRYPTION_KEY`, `SESSION_SECRET`): store them outside the server (password manager / sealed envelope). Losing `IDENTITY_ENCRYPTION_KEY` makes identities and the employee's "My submissions" list unrecoverable.
2. **Database superuser**: anyone with OS/DB access to the server and the `.env` file can decrypt identities. Restrict server login to the Super Admin / IT.
3. **TLS** must be terminated in front of the app (see DEPLOYMENT.md). `__Host-` cookies won't be set over plain HTTP except on localhost.
4. Run `npm run restore -- --verify` monthly.

## 6. Fully anonymous mode
- `feedback_submissions.anonymous = true`: `ownerHmac` is NULL and there is **no identity mapping**. A database CHECK constraint and an insert trigger make it impossible to attach an identity later, even by direct SQL (tested).
- The request handler reads no session, IP address, user agent or other device data. Signed-in employees using `/anonymous` aren't linked either (tested).
- Tracking: the sender gets a 20-character secret key (~99 bits). Only `HMAC(server key, reference + key)` is stored. Unlocking sets a 30-minute HttpOnly cookie scoped to that one case. Wrong-key and unknown-reference attempts give identical errors, and attempts are rate limited per reference (10/hour) and globally.
- Abuse controls without tracking people:
  - optional shared **access code**
  - **proof-of-work** check (16 bits, about 1 s in the browser, single use, signed, expires in 10 min, no third party)
  - a company-wide **hourly cap**
- Reveal attempts on anonymous cases return 409 and are logged as DENIED.
- Accepted trade-off: there's no proof the sender is an employee, and no per-person spam limit. HR judges each case on its content.