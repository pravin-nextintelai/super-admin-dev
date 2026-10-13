# All Referral Data API — `/api/admin/sales-referrals/data`

Backend for the **Sales Referrals → All referral data** screen: every workspace (and every solo user
without a workspace), the sales owner and code it came through, its attribution, seats, current plan
and full plan history; a "Plan purchases" view with one row per paid event; and a CSV export with
kind / scope / column selection matching the export dialog.

- Code: [Backend/routes/referralDataRoutes.js](../Backend/routes/referralDataRoutes.js),
  [Backend/controllers/referralDataController.js](../Backend/controllers/referralDataController.js),
  [Backend/services/referralDataService.js](../Backend/services/referralDataService.js)
  (Payment-DB access reused from `onboardedUsersService.js`)
- Also mounted at `/api/v1/admin/sales-referrals/data`. Read-only. Roles: `super-admin`, `admin`.
- Tests: `npm run test:admin-api` → group **M) All referral data** (8 cases)
- Per-user variant of the same data: [ONBOARDED_USERS_API.md](ONBOARDED_USERS_API.md).

## 1. Model

| Term | Meaning |
|---|---|
| Account (row) | A **workspace** (`firms` row; `kind: "workspace"`, `id` = firm UUID) or a **solo user** with no workspace (`kind: "user"`, `id` = user id as text). Together they cover every platform user exactly once. |
| Seats | Distinct active users of a workspace (`firms.admin_user_id` ∪ `firm_users.user_id`); `1` for a solo user. |
| Attribution | Workspace: its `tenant_referrals` row, else the admin user's `user_referrals` row. Solo user: `user_referrals`. `attribution.source` = `SIGNUP` (code entered at signup) · `ADMIN` (attached by a super admin, with `set_by`, `set_at`, `reason`) · `DIRECT` (no code). |
| Owner type | `INTERNAL` / `OUTSOURCED` from `sales_owners.internal`, `DIRECT` when there is no code. Filter `type` accepts `internal`, `outsourced` (aliases `int`, `out`, `agency`). |
| Status | `PAID` if any seat is on a paid `users.active_plan_name`; `LAPSED` if not paid now but a seat ever had a subscription (Payment DB); else `FREE`. |
| Plan history | From the Payment DB for all seats: `trial` (signup), `purchase` (first paid subscription), `upgrade` (higher-priced plan than the previous one), `renewal` (another paid subscription / payment at the same or lower price), `topup` (token top-up), `storage_addon`, `cancelled`. Amounts are captured payments (INR), dates IST. |

## 2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/summary` | Stat cards + totals by owner type and by owner |
| GET | `/workspaces` (also `/`) | One row per account, paginated |
| GET | `/workspaces/:id` | One account: seats, plan-history timeline, raw history per seat |
| GET | `/purchases` | One row per paid event across accounts (Plan purchases tab) |
| GET | `/export` | CSV: `export=workspaces` or `history`, `scope=filtered` or `all`, optional `columns` |
| GET | `/columns` | Column catalogue for the export dialog + vocab |

## 3. Filters (every endpoint)

| Param | Type | Default | Notes |
|---|---|---|---|
| `owner_id` | csv uuid | all | `sales_owners.id` (clicking an owner name sets this) |
| `code` | csv | all | referral codes, case-insensitive |
| `type` | `all` · `internal` · `outsourced` | all | owner type; when not `all`, Direct accounts are excluded |
| `status` | csv | all | `PAID`, `LAPSED`, `FREE` |
| `include_direct` | bool | `true` | `false` hides accounts without a code |
| `source` | csv | all | `SIGNUP`, `ADMIN` |
| `kind` | csv | all | `workspace`, `user` |
| `q` (alias `search`) | string | — | workspace name, user name, email, code, owner name, or exact account id |
| `from`, `to` | `YYYY-MM-DD` | — | IST calendar days on the signup date |
| `page`, `limit` (alias `page_size`) | int | `1` / `25` | max 200 (`/workspaces`, `/purchases`) |
| `sort` | string | `newest` | `newest`, `oldest`, `name`, `owner`, `total_paid`, `last_purchase`, `seats`, `status` (`/workspaces`, `/export`) |
| `include_history` | bool | `false` | `/workspaces` only: also return `events[]` per row (slower) |
| `event` | csv | all | `/purchases` only: `purchase`, `upgrade`, `renewal`, `topup`, `storage_addon` |

Responses echo the applied filters under `data.filters`; `truncated: true` means more than 5 000 accounts matched.

## 4. `GET /workspaces`

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/sales-referrals/data/workspaces?type=outsourced&status=PAID&sort=total_paid&limit=25"
```

`data` (one row shown, captured from a live run):

```json
{
  "rows": [
    {
      "id": "3",
      "kind": "user",
      "name": "Pravin",
      "firm_id": null, "firm_type": null, "city": null, "state": null,
      "approval_status": "APPROVED", "verified": true, "is_active": true,
      "primary_user": { "id": 3, "email": "pravin.sarule@nexintelai.com", "name": "Pravin", "phone": null, "account_type": null },
      "seats": 1, "seat_user_ids": [3],
      "signed_up_at": "2025-12-03T04:45:35.002Z",
      "signed_up_at_ist": { "iso": "2025-12-03T10:15:35+05:30", "date": "03 Dec 2025", "time": "10:15 AM", "time24": "10:15", "weekday": "Wed", "display": "Wed, 03 Dec 2025, 10:15 AM IST", "timezone": "Asia/Kolkata", "utc": "2025-12-03T04:45:35.002Z", "epoch_ms": 1764737135002 },
      "owner_type": "DIRECT",
      "sales_owner": null,
      "code": null,
      "attribution": { "source": "DIRECT", "level": null, "signed_up_at": null, "set_at": null, "set_at_ist": null, "set_by": null, "reason": null },
      "status": "LAPSED",
      "current_plan": { "name": "Max", "billing": "Monthly", "display": "Max · Monthly", "status": "active", "start_date": "2026-06-02T00:00:00.000Z", "end_date": "2026-07-02T00:00:00.000Z", "end_date_ist": { "iso": "2026-07-02T05:30:00+05:30", "date": "02 Jul 2026", "time": "05:30 AM", "time24": "05:30", "weekday": "Thu", "display": "Thu, 02 Jul 2026, 05:30 AM IST", "timezone": "Asia/Kolkata", "utc": "2026-07-02T00:00:00.000Z", "epoch_ms": 1782950400000 }, "is_expired": true, "price": 999, "currency": "INR" },
      "purchases": 6,
      "subscriptions": 1,
      "total_paid": 130998, "subscription_paid": 130998, "topup_paid": 0, "storage_paid": 0, "currency": "INR",
      "first_purchase_at": "2025-12-03T10:17:59.824Z",
      "first_purchase_at_ist": { "iso": "2025-12-03T15:47:59+05:30", "date": "03 Dec 2025", "time": "03:47 PM", "time24": "15:47", "weekday": "Wed", "display": "Wed, 03 Dec 2025, 03:47 PM IST", "timezone": "Asia/Kolkata", "utc": "2025-12-03T10:17:59.824Z", "epoch_ms": 1764757079824 },
      "last_purchase_at": "2026-06-02T12:11:08.429Z",
      "last_purchase_at_ist": { "iso": "2026-06-02T17:41:08+05:30", "date": "02 Jun 2026", "time": "05:41 PM", "time24": "17:41", "weekday": "Tue", "display": "Tue, 02 Jun 2026, 05:41 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-06-02T12:11:08.429Z", "epoch_ms": 1780747268429 },
      "timezone": "Asia/Kolkata"
    }
  ],
  "pagination": { "page": 1, "limit": 25, "total": 72, "totalPages": 3 },
  "filters": { "owner_id": "all", "code": "all", "type": "all", "status": "all", "include_direct": true, "source": "all", "kind": "all", "q": null, "from": null, "to": null, "timezone": "Asia/Kolkata", "sort": "total_paid" },
  "summary": { "accounts": 72, "workspaces": 16, "users": 56, "via_code": 9, "direct": 63, "paid": 12, "lapsed": 21, "free": 39, "seats": 77, "purchases": 63, "total_paid": 150795, "paid_pct": 16.7 },
  "truncated": false,
  "timezone": "Asia/Kolkata"
}
```

An account attributed through a code has `sales_owner: { id, name, internal, type }`,
`code: { code, label, active }` and `attribution: { source: "SIGNUP" | "ADMIN", level: "workspace" | "user",
signed_up_at, set_at, set_at_ist, set_by: { id, name, email } | null, reason }`.
`summary` is over all accounts matching the filters (the five stat cards), not just the page.

## 5. `GET /workspaces/:id` — expanded row

`:id` is the firm UUID or the user id. `data`:

| Part | Content |
|---|---|
| `account` | Same object as a list row |
| `seats[]` | `{ id, email, username, role (ADMIN / STAFF), account_type, approval_status, is_active, active_plan_name, created_at, last_login_at }` |
| `events[]` | Plan-history timeline, oldest first: `{ at, at_ist, kind, title, plan, billing, amount, currency, payment_id, status, user_id, user_email, note?, subscription_id?, period?, tokens?, storage_gb? }` |
| `history` | Raw Payment-DB history per seat user id: `{ subscriptions[], payments[], topups[], storage_addons[] }` in the shapes of ONBOARDED_USERS_API.md §6 |

```json
"events": [
  { "at": "2026-05-18T06:12:19.363Z", "at_ist": { "display": "Mon, 18 May 2026, 11:42 AM IST", "date": "18 May 2026", "time": "11:42 AM", "time24": "11:42", "iso": "2026-05-18T11:42:19+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-05-18T06:12:19.363Z", "epoch_ms": 1779086539363 }, "kind": "trial", "title": "Signed up", "plan": "Free", "billing": null, "amount": 0, "currency": "INR", "payment_id": null, "status": null, "user_id": 75, "user_email": "sk@gmail.com", "note": "direct" },
  { "at": "2026-06-03T08:00:11.000Z", "at_ist": { "display": "Wed, 03 Jun 2026, 01:30 PM IST", "date": "03 Jun 2026", "time": "01:30 PM", "time24": "13:30", "iso": "2026-06-03T13:30:11+05:30", "weekday": "Wed", "timezone": "Asia/Kolkata", "utc": "2026-06-03T08:00:11.000Z", "epoch_ms": 1780473611000 }, "kind": "topup", "title": "Token top-up", "plan": "Freedom_50", "billing": "30 days", "amount": 50, "currency": "INR", "payment_id": "pay_…", "status": "Success", "user_id": 75, "user_email": "sk@gmail.com", "tokens": 50000 },
  { "at": "2026-10-08T05:10:00.000Z", "at_ist": { "display": "Thu, 08 Oct 2026, 10:40 AM IST", "date": "08 Oct 2026", "time": "10:40 AM", "time24": "10:40", "iso": "2026-10-08T10:40:00+05:30", "weekday": "Thu", "timezone": "Asia/Kolkata", "utc": "2026-10-08T05:10:00.000Z", "epoch_ms": 1791436800000 }, "kind": "purchase", "title": "Plan purchased", "plan": "Basic", "billing": "Monthly", "amount": 4176, "currency": "INR", "payment_id": "pay_…", "status": "Success", "user_id": 75, "user_email": "sk@gmail.com", "subscription_id": 120, "period": { "start": "2026-10-08T00:00:00.000Z", "end": "2026-11-08T00:00:00.000Z" } }
]
```

`400` when `:id` is empty, `404` when unknown.

## 6. `GET /purchases` — Plan purchases tab

Paid events only (`amount > 0`), newest first, across all accounts matching the filters.

```json
{
  "rows": [
    { "at": "2026-10-12T12:10:48.204Z", "at_ist": { "display": "Mon, 12 Oct 2026, 05:40 PM IST", "date": "12 Oct 2026", "time": "05:40 PM", "time24": "17:40", "iso": "2026-10-12T17:40:48+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T12:10:48.204Z", "epoch_ms": 1791807048204 }, "kind": "purchase", "title": "Plan purchased", "plan": "Pro", "billing": "Monthly", "amount": 100, "currency": "INR", "payment_id": "pay_TmzYq5xEp4hZmO", "status": "Success", "user_id": 113, "user_email": "doyagag249@leafflip.com", "subscription_id": 138, "period": { "start": "2026-10-12T00:00:00.000Z", "end": "2026-11-12T00:00:00.000Z" },
      "account": { "id": "113", "kind": "user", "name": "Pravin Sarule", "primary_user": { "id": 113, "email": "doyagag249@leafflip.com", "name": "Pravin Sarule", "phone": null, "account_type": "SOLO" }, "sales_owner": { "id": "57b051e6-ca59-4628-b091-2a313fbd9f2d", "name": "Test sale", "internal": false, "type": "OUTSOURCED" }, "owner_type": "OUTSOURCED", "code": { "code": "TS-G2FA", "label": null, "active": true } } }
  ],
  "pagination": { "page": 1, "limit": 25, "total": 36, "totalPages": 2 },
  "totals": { "events": 36, "amount": 150865, "accounts": 21 },
  "filters": { "owner_id": "all", "code": "all", "type": "all", "status": "all", "include_direct": true, "source": "all", "kind": "all", "q": null, "from": null, "to": null, "timezone": "Asia/Kolkata", "event": "all" },
  "truncated": false,
  "timezone": "Asia/Kolkata"
}
```

A `purchase` row whose subscription has no captured payment yet shows the plan price as `amount`, `payment_id: null`
and the subscription's own `status` (e.g. `active`) instead of `Success`.

## 7. `GET /summary`

```json
{
  "totals": { "accounts": 72, "workspaces": 16, "users": 56, "via_code": 9, "direct": 63, "paid": 12, "lapsed": 21, "free": 39, "seats": 77, "purchases": 63, "total_paid": 150795, "paid_pct": 16.7 },
  "by_owner_type": [
    { "owner_type": "INTERNAL", "accounts": 0, "workspaces": 0, "users": 0, "via_code": 0, "direct": 0, "paid": 0, "lapsed": 0, "free": 0, "seats": 0, "purchases": 0, "total_paid": 0, "paid_pct": 0 },
    { "owner_type": "OUTSOURCED", "accounts": 9, "workspaces": 2, "users": 7, "via_code": 9, "direct": 0, "paid": 2, "lapsed": 1, "free": 6, "seats": 9, "purchases": 2, "total_paid": 200, "paid_pct": 22.2 },
    { "owner_type": "DIRECT", "accounts": 63, "workspaces": 14, "users": 49, "via_code": 0, "direct": 63, "paid": 10, "lapsed": 20, "free": 33, "seats": 68, "purchases": 61, "total_paid": 150595, "paid_pct": 15.9 }
  ],
  "by_owner": [ { "owner": { "id": "3311a5ee-…", "name": "pravin", "internal": false, "type": "OUTSOURCED" }, "accounts": 4, "workspaces": 1, "users": 3, "via_code": 4, "direct": 0, "paid": 1, "lapsed": 0, "free": 3, "seats": 4, "purchases": 1, "total_paid": 100, "paid_pct": 25 } ]
}
```

## 8. `GET /export` — CSV (the export dialog)

| Param | Values | Notes |
|---|---|---|
| `export` | `workspaces` (default) · `history` | "Workspaces" = one row per account; "Plan history" = one row per plan event (incl. trial starts) |
| `scope` | `filtered` (default) · `all` | `all` ignores every filter (and includes Direct) |
| `columns` | csv of column keys | subset in catalogue order; omitted = every column. Unknown key → `400` |
| plus every filter of §3 and `sort` | | |

Column keys (`GET /columns` returns the same with headers):

- **workspaces**: `account_id, kind, workspace, firm_type, primary_user, email, phone, verified, seats, signup_date, owner, owner_type, code, code_label, attribution, attributed_by, attribution_reason, status, current_plan, plan_end, purchases, total_paid, subscription_paid, topup_paid, storage_paid, currency, first_purchase, last_purchase, signup_utc`
- **history**: `date, account_id, workspace, email, owner, owner_type, code, event, kind, plan, billing, amount, currency, payment_id, status, note, date_utc`

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" -o referral-workspaces.csv -D - \
  "http://localhost:4000/api/admin/sales-referrals/data/export?export=workspaces&columns=workspace,owner,code,status,total_paid&type=outsourced"
# Content-Disposition: attachment; filename="referral-workspaces-2026-10-13-1530-IST.csv"
# X-Total-Rows: 9  X-Exported-Rows: 9
Workspace / user,Sales owner,Code,Plan status,Total paid
Pravin Sarule,Test sale,TS-G2FA,PAID,100
```

UTF-8 BOM + CRLF (Excel / Sheets open it directly); cells starting with `=`, `+`, `-`, `@` are prefixed with `'`
(formula-injection guard, see `utils/csv.js`). Max 50 000 rows (`X-Total-Rows` > `X-Exported-Rows` means truncated).

## 9. Errors

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | unknown `type` / `status` / `event` / column, bad `owner_id`, bad date, `from` > `to` |
| 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN` | missing / invalid token, role not allowed |
| 404 | `NOT_FOUND` | unknown account id |
| 500 | `INTERNAL_ERROR` | look the `requestId` up in the backend log |
