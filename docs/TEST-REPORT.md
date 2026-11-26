# Test Execution Report

**Date:** 26 Nov 2026 · **Build:** production (`next build`) · **DB:** MySQL-compatible (MariaDB 10.4 from XAMPP, local; originally PostgreSQL 19) · **Browser:** Microsoft Edge (desktop + Pixel 7 emulation)

| Suite | Command | Result |
|---|---|---|
| Unit (Vitest) | `npm test` | **50 / 50 passed** (incl. anonymous mode) |
| End-to-end (Playwright) | `npx playwright test` | **52 / 52 passed** (incl. 10 anonymous-mode API tests + UI on desktop & mobile) |
| Backup + restore | `npm run backup` / `npm run restore -- --verify` | **Passed**: 21 tables, checksums, row counts, triggers, files |
| Dependency audit | `npm audit --omit=dev` | 6 findings, all in build tooling. See SECURITY.md F7 |

End-to-end tests run against throwaway accounts with random passwords. They never use the seeded accounts, and they remove their data afterwards.

## Unit tests (42)
- **crypto (9):** AES-GCM round trip; fresh IV; tamper detection; no plaintext in ciphertext; reference format; 5,000 unique references; owner tag stable, distinct and opaque; helpers.
- **rbac (6):** only Super Admin can reveal identity; HR has no admin rights; reviewer limits; employees have no staff rights; deny by default; matrix consistency.
- **workflow + CSV (14):** transition table valid; terminal states final; main path reachable; every status reachable; reviewer limits; remark rules; formula injection neutralised (6 cases); CSV quoting.
- **files (6):** EXIF stripped; PDF author/title stripped; encrypted at rest under a random name; spoofed file types rejected; size limit; path traversal refused.
- **identity reveal (7):** HR, reviewer and employee refused with 404 and the attempt logged; stale MFA refused; short reason refused; granted path logs in the same transaction; internal user id never returned.

## End-to-end tests (40)

### Identity protection (mandatory): 15
| Test | Result |
|---|---|
| Reference number contains nothing about the employee | ✅ |
| HR: case page, inbox and dashboard don't reveal the submitter | ✅ |
| Reviewer: same | ✅ |
| Super Admin (normal pages, without reveal): same | ✅ |
| Attachment: EXIF and original filename removed | ✅ |
| CSV and PDF exports contain no identity | ✅ |
| Notifications contain no identity or feedback text | ✅ |
| HR, reviewers and employees can't call the identity endpoint, and each attempt is logged | ✅ |
| Anonymous callers get 401 | ✅ |
| Super Admin reveal needs a reason and is logged as GRANTED | ✅ |
| Identity log and mapping can't be altered, even with direct SQL | ✅ |
| Identity mapping encrypted at rest; no user id on the feedback row | ✅ |
| Employees can't read each other's submissions, messages or attachments (IDOR) | ✅ |
| Reviewer from another department can't see the case | ✅ |
| Staff see the submission date only (no time) | ✅ |

### Security: 11
Security headers · cookie flags (`__Host-`, HttpOnly, Secure, Strict) · no account enumeration · brute-force rate limit · session fixation · CSRF (cross-origin and missing Origin) · privilege escalation (HR, reviewer and employee using the admin API; minting a Super Admin) · forged body fields ignored · SQL injection in search · stored XSS escaped · malformed input leaks no internals. **All ✅**

### Workflow & performance: 4
Full lifecycle with every status transition and history check, Super Admin override audited · sensitive category raised to High and hidden from reviewers · 8 concurrent submissions, unique references · 10,000-character description accepted and 10,001 rejected; inbox page in under 3 s. **All ✅**

### UI (desktop + mobile): 10
Login page installable (manifest, service worker, 512 px icon) with no horizontal scroll · generic login error · employee submits through the 3-step form with an attachment and reaches the case page · employee blocked from staff areas · HR dashboard charts render, no script injection runs, no identity on the page. **All ✅ on both viewports**

## Bugs found and fixed during testing
| Bug | Fix |
|---|---|
| Dashboard crashed when it loaded (icon component passed server→client) | Icons passed by name |
| Login/MFA cards had no heading element (accessibility) | `h1` added |
| Test-harness: leftover rows broke reruns | Unique per-run ids, teardown verified |

## Not covered automatically
- Real phone install prompt (iOS/Android). Manual check is listed in the deployment guide.
- Load beyond 8 concurrent writers; large-volume dashboard performance (more than 100k rows).
- Real TLS deployment (Caddy); this depends on the server.

## Anonymous mode (added later)
Unit tests (8): proof-of-work accepts once and rejects replay, wrong counters, forged or expired challenges; tracking keys are well formed and unique; the key hash ignores case and spacing, is bound to the reference and doesn't contain the key.
E2E tests (12): submit with no login · nothing identifying stored, and the DB refuses an identity mapping · a signed-in employee using the anonymous form isn't linked · access code, proof-of-work and replay enforced · wrong key gives the same error as an unknown reference · right key opens only that case, replies go both ways, internal notes and staff names hidden, Lock works · per-reference brute-force limit · Super Admin reveal refused (409) and logged · type filter and CSV label · switching it off removes every anonymous route · UI flow on desktop and mobile.
Bug found: `/anonymous`, `/track` and `/login` had been pre-built as static pages, so the on/off switch wouldn't apply until a rebuild. Fixed by rendering them on every request.
## Re-run after removing employee login and switching to the white theme
- Unit: **42 / 42 passed** (identity-reveal tests removed with the feature; RBAC now checks that nobody can reveal identity and that employee accounts have no permissions).
- End-to-end: **41 / 41 passed**, including:
  - **Privacy suite (10):** device data planted in every header (User-Agent, X-Forwarded-For, X-Real-IP, Accept-Language, cookies), in the file name and in EXIF is found **nowhere** in any text column of any table; no owner or identity mapping; the DB refuses to add one; no reveal endpoint for anyone; legacy employee accounts can't sign in; old employee pages are 404; a tracking session opens only its own case and isn't a staff login.
  - The anonymous flow, security, workflow and UI suites were rewritten for login-free submissions, plus a white-theme check and a dropdown styling check.
- Test cleanup verified: 0 leftover accounts or cases.
## Re-run after moving from PostgreSQL to MySQL (26 Nov 2026)
- Unit **41/41**, end-to-end **49/49** (run twice), backup + verified restore passed (21 tables, 7 protection triggers, 46 files).
- All data was copied from PostgreSQL with row counts matching for every table.
- **Bug found:** the old PostgreSQL data had 50 role links, 42 sessions, 14 profiles and 188 case rows belonging to deleted test records. The cause was an early version of the test cleanup, which switched off foreign-key enforcement. These rows were removed during the move. All 18 foreign keys were checked consistent, and the current cleanup no longer bypasses enforcement.