# API Reference

> **Current model (updated 26 Nov 2026): employees never sign in.** Every submission is fully anonymous, made from the public pages `/` → `/submit` and followed up at `/track` with a reference and a one-time secret key. No identity is stored, so the earlier "Super Admin reveals identity" feature was **removed**. Only HR, reviewers and Super Admins have accounts. Older sections below that mention employee login, "My submissions" or identity reveal describe the previous design.

All endpoints are Next.js Route Handlers under `/api`. They use JSON unless stated.

- **Auth:** the session cookie `__Host-feed_sid`, set by login.
- **CSRF:** every `POST` and `DELETE` must send an `Origin` header that matches the host.
- **Errors:** `{ "error": "<safe message>" }`, plus `fields` on a 400 validation error.
- **No permission:** returns `404`, not `403`, so callers can't tell whether something exists.
- **Rate limited:** returns `429`.

## Auth
| Method | Path | Who | Body / result |
|---|---|---|---|
| POST | `/api/auth/login` | anyone | `{email, password}` → `{next}` and sets cookie. Limit: 5 per 15 min per email. 5 failures lock the account for 15 min |
| POST | `/api/auth/logout` | signed in | Destroys the session |
| GET | `/api/auth/mfa` | signed in, MFA not enrolled | Starts enrolment → `{secret, otpauth}` |
| POST | `/api/auth/mfa` | signed in | `{code}` (6 digits) → marks the session MFA-verified |
| POST | `/api/auth/password` | signed in | `{current, next}` (next at least 12 characters). Signs out other sessions |
| DELETE | `/api/auth/password` | signed in | Signs out all other sessions → `{revoked}` |

## Employee
| Method | Path | Body / result |
|---|---|---|
| GET | `/api/feedback` | Own submissions `{items:[{reference,title,status,submittedOn,category}]}` |
| POST | `/api/feedback` | `multipart/form-data`: `title` (5–150), `description` (20–10000), `categoryId`, `priorityId`, `departmentId?`, `files[]` (≤5, JPG/PNG/WEBP/PDF, ≤`MAX_UPLOAD_MB`) → `201 {reference}`. Limit: 10 per hour |
| POST | `/api/feedback/{reference}/messages` | `{body}`. Only for your own reference. Moves `AWAITING_INFO` to `UNDER_REVIEW` |

## Staff (HR, Reviewer, Super Admin)
| Method | Path | Body |
|---|---|---|
| POST | `/api/cases/{id}` | `{action:"status", to, remarks?}` · `{action:"assign", assigneeId}` (HR/SA) · `{action:"note", body}` · `{action:"message", body}` |
| GET | `/api/reports?format=csv\|pdf&period=day\|week\|month\|quarter\|year` | HR / Super Admin. Metadata only, audited |
| GET | `/api/notifications` | `{items, unread}` |
| POST | `/api/notifications` | Mark all as read |

Status rules: `src/lib/feedback-meta.ts` (`TRANSITIONS`).
- Reviewers can only move a case to Investigation, Action required, Awaiting info or Resolved.
- These need a remark: Rejected, Duplicate, Escalated, Resolved, Closed, and any Super Admin override.

## Shared
| Method | Path | Notes |
|---|---|---|
| GET | `/api/attachments/{id}` | Owner employee or staff in scope. Decrypted stream, generic filename, `sandbox` CSP |

## Super Admin
| Method | Path | Body |
|---|---|---|
| POST | `/api/admin/feedback/{id}/identity` | `{reason}` (≥20 chars). Requires MFA within 5 min, otherwise `403`. Every attempt is logged → `{identity:{name,email,department,employeeNo,jobTitle}}` |
| POST | `/api/admin/manage` | `action` is one of: `user.create` (role EMPLOYEE/HR/REVIEWER only), `user.update`, `user.active`, `user.resetPassword`, `dept.create`, `dept.update`, `category.create`, `category.update`, `settings.set` (`company` or `notifications`). Create/reset → `{tempPassword}` (shown once) |

## Server-side data contracts
Server components call the same services directly (`src/server/feedback.ts`, `stats.ts`, `admin.ts`) and receive the same row scoping. Staff selects list their fields explicitly. `ownerHmac` and identity tables are never selected for staff.

## Anonymous (no login, only when enabled; otherwise 404)
| Method | Path | Body / result |
|---|---|---|
| GET | `/api/anonymous/challenge` | `{challenge, difficulty}`. Proof-of-work for the next submission |
| POST | `/api/anonymous` | multipart: same fields as `/api/feedback`, plus `accessCode`, `challenge`, `counter` → `201 {reference, key}` (key shown once) |
| POST | `/api/anonymous/track` | `{reference, key}` → sets a 30-minute cookie for that case → `{next}` |
| DELETE | `/api/anonymous/track` | Locks the case again |
| POST | `/api/anonymous/messages` | `{reference, body}`. Needs the tracking cookie |