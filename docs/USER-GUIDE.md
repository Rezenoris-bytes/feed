# User Guide

> **Current model (updated 26 Nov 2026): employees never sign in.** Every submission is fully anonymous, made from the public pages `/` → `/submit` and followed up at `/track` with a reference and a one-time secret key. No identity is stored, so the earlier "Super Admin reveals identity" feature was **removed**. Only HR, reviewers and Super Admins have accounts. Older sections below that mention employee login, "My submissions" or identity reveal describe the previous design.

## Installing the app on your phone
Open the Feed address in your phone's browser and sign in. Then:
- **Android (Chrome or Edge):** menu ⋮ → **Install app**.
- **iPhone (Safari):** Share → **Add to Home Screen**.

Feed then opens full screen, like a normal app. Nothing about your feedback is stored on the phone.

---

## Employees

### Your privacy
- **HR and reviewers see what you wrote, never who you are.** Your name is stored separately and encrypted.
- **The Super Admin can find out who sent a submission**, but only by giving a written reason. Every time they do, it's permanently logged.
- What you write can still identify you. Leave out details only you would know if that matters to you.
- Photos and PDFs have their location, author and file name removed. Screenshots can still show your name, so crop them first.

### Submitting feedback
1. Tap **Submit feedback**.
2. Choose what it's about and how urgent it is. The department is optional.
3. Add a title, a description and up to 5 files (JPG, PNG, WEBP, PDF).
4. Review it and tap **Submit feedback**.
5. You'll get a reference number like `FB-7K3Q-9XMD-P2WA`.

### Following up
Open **My submissions** to see each case's progress. The team replies in the conversation as **Feedback team**.
- If the status is **Awaiting information**, reply with the details they asked for.
- You can add more information at any time until the case is closed.

### Your account
**My account** lets you change your password (at least 12 characters) and sign out other devices.

---

## HR administrators

- **Overview:** totals, trends and charts by category, status, priority and department.
- **Feedback inbox:** search and filter. Sensitive cases (🔒) are visible to HR only, unless assigned.
- **Case page:**
  - **Move to:** change the status. Only valid next steps are offered, and some need a remark.
  - **Assign:** choose a reviewer. This moves the case to *Assigned* and notifies them.
  - **Conversation:** reply to the submitter. They see your message as "Feedback team", not your name.
  - **Internal notes:** for staff only, never shown to the submitter.
- **Reports:** daily to yearly breakdowns, with CSV and PDF downloads. Exports never include descriptions or names, and each download is logged.
- You **cannot** see who submitted feedback. No page, export or notification shows it.

## Department reviewers
You see cases assigned to you, plus non-sensitive cases for your department. You can:
- Move a case to Investigation, Action required, Awaiting information or Resolved (resolving needs a remark).
- Add internal notes.
- Message the submitter.

Rejecting, escalating and closing cases are done by HR.

---

## Super Admin

### Signing in
Every sign-in needs your password plus a code from your authenticator app (Google Authenticator, Microsoft Authenticator, Aegis…). You set this up on first sign-in.

### Revealing a submitter
Open the case from **All feedback** and choose **Reveal submitter**. Then:
1. Give a reason of at least 20 characters. It's recorded permanently.
2. Enter an authenticator code if you haven't entered one in the last 5 minutes.
3. Read the details shown. Closing the dialog discards them.

Only reveal an identity for a legitimate need, such as a safety risk or a legal requirement. **Identity access** lists every reveal and every refused attempt. That log can't be edited.

### Managing the system
- **Employees, and HR & reviewers:** add accounts, reset passwords and deactivate people.
  - A temporary password is shown once. Give it to the person privately.
  - Deactivating someone signs them out and unassigns their open cases.
- **Departments and categories:** add new ones, and switch old ones off instead of deleting them, so history is kept. Marking a category **Sensitive** raises it to High priority and hides it from department reviewers.
- **Notifications:** choose which events notify staff.
- **System settings:** set the company name and a message shown to employees.
- **Security:** change your password, sign out other devices, and see protection status.
- **Audit log:** sign-ins, case changes, exports and admin actions.

### Things only the server can do
These are done on the server, on purpose:
```powershell
npm run admin -- create <email> "<Name>"   # new Super Admin
npm run admin -- reset-password <email>
npm run admin -- reset-mfa <email>          # lost phone
npm run backup
npm run restore -- --verify
```

---

## Fully anonymous feedback (no login)
On the login page, choose **Send feedback anonymously**, or open `/anonymous` (for example from a QR code on the notice board).
- No sign-in. Your name, account and device are **not recorded at all**. Nobody can find out who sent it, including the Super Admin.
- If your company uses an **access code**, it's printed on the notice board.
- After sending you get a **reference** and a **secret key**. Copy them, save them as a file, or take a screenshot. They're shown once and **can't be recovered**.
- To follow up, open **Track** (`/track`) and enter both. You can read replies and add information. Access lasts 30 minutes, and **Lock** ends it straight away.
- You'll get no notifications, because the system doesn't know who you are. Check back yourself.

**For HR:** anonymous cases show an "Anonymous" tag and can be filtered by type. They work like any other case, but you can't follow up outside the conversation.
**For the Super Admin:** turn the feature on or off, set the access code and set the hourly limit under **System settings → Anonymous submissions**. The reveal button doesn't appear on anonymous cases.