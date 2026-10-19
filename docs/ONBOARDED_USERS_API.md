# Onboarded Users & Subscription History API — `/api/admin/onboarded-users`

Every platform user with **how they were onboarded** (self signup, internal sales, outsourced / agency),
their workspace, their current plan and their **complete subscription history** (every subscription, payment,
token top-up and storage add-on), as JSON and as CSV.

- Code: [Backend/src/modules/users/onboardedUsers.routes.js](../Backend/src/modules/users/onboardedUsers.routes.js),
  [Backend/src/modules/users/onboardedUsers.controller.js](../Backend/src/modules/users/onboardedUsers.controller.js),
  [Backend/src/modules/users/onboardedUsers.service.js](../Backend/src/modules/users/onboardedUsers.service.js)
- Tests: `npm run test:admin-api` → group **L) Onboarded Users** (10 cases)
- Read-only. Nothing here writes to any database.

## 1. Where the data comes from

| Data | Database / tables |
|---|---|
| User, workspace, profile | **Auth DB**: `users`, `firms`, `firm_users`, `user_professional_profiles` |
| Onboarding channel | **Auth DB**: `user_referrals` (user's own code) else `tenant_referrals` (workspace's code) → `referral_codes` → `sales_owners.internal` |
| Referral changes | **Auth DB**: `user_referral_history`, `tenant_referral_history` |
| Current plan | **Auth DB**: `users.active_plan_name` / `active_plan_id` / `active_plan_updated_at` |
| Subscription history | **Payment DB**: `user_subscriptions` (+ `monthly_plans`, `subscription_plans`), `payments`, `user_token_topup_purchases` (+ `topup_plans`), `user_storage_addon_purchases` (+ `addon_plans`), `user_storage_stats` |

The two databases cannot be joined in SQL, so the API reads the matching users from the Auth DB (max 5 000 per
request, `truncated: true` tells you when the cap was hit) and then the Payment DB for exactly those user ids.

### Onboarding channel

| `channel` | Meaning | Rule |
|---|---|---|
| `SELF` | Direct signup | No referral code on the user and none on their workspace |
| `INTERNAL` | Brought in by in-house sales | Referral code whose sales owner has `internal = true` |
| `OUTSOURCED` | Brought in by an external partner / agency | Referral code whose sales owner has `internal = false` |

The user's own referral (`level: "user"`) wins over the workspace's (`level: "workspace"`). `source` says how the
code got there: `SIGNUP` (entered at signup) or `ADMIN` (attached by a super admin). Filter aliases:
`agency` = OUTSOURCED, `direct` = SELF, `inhouse` = INTERNAL.

### Plan status

| `plan.status` | Rule |
|---|---|
| `PAID` | `users.active_plan_name` is set and not a free plan name (`REFERRALS_FREE_PLAN_NAMES`, default `Free, Free Trial, Trial`) |
| `LAPSED` | Not paid now, but the Payment DB has at least one subscription for the user |
| `FREE` | Everything else |

### Auth and roles

`Authorization: Bearer <ADMIN_TOKEN or dashboard JWT>`. Roles: `super-admin`, `admin`, `account-admin`, `finance-admin`.
Responses use the backend envelope (`{ success, data }` / `{ success: false, error: { code, message, details } }`);
every timestamp is UTC ISO plus an `*_ist` object (Asia/Kolkata) exactly as in `ERROR_LOGS_API.md` §1.4.

## 2. Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/onboarded-users/summary` | Totals by channel, sales owner, plan, account type |
| GET | `/api/admin/onboarded-users/meta` | Channels, sales owners, referral codes, plans, account types for filters |
| GET | `/api/admin/onboarded-users` | Paginated users with onboarding, plan, subscription summary |
| GET | `/api/admin/onboarded-users/export` | CSV: `mode=users` (one row per user) or `mode=history` (one row per event) |
| GET | `/api/admin/onboarded-users/:userId` | One user with the complete subscription history and a timeline |

## 3. Filters (list, export, summary)

| Param | Type | Notes |
|---|---|---|
| `channel` | csv | `self`, `internal`, `outsourced` (alias `agency`) |
| `owner_id` | csv uuid | `sales_owners.id` |
| `code` | csv | referral codes, case-insensitive |
| `source` | csv | `SIGNUP`, `ADMIN` |
| `account_type` | csv | `SOLO`, `FIRM_ADMIN`, `FIRM_USER` |
| `approval_status` | csv | `APPROVED`, `PENDING`, … |
| `plan_status` | csv | `PAID`, `LAPSED`, `FREE` |
| `plan` | csv | `users.active_plan_name` values (`Pro`, `Max`, …) |
| `active` | bool | `true` = active and not blocked |
| `has_payments` | bool | has at least one captured payment |
| `has_subscription` | bool | has at least one subscription row |
| `min_total_paid` | number | total paid (subscriptions + top-ups + storage) ≥ value |
| `firm_id` | uuid | one workspace |
| `search` (alias `q`) | string | email, name, phone, workspace, referral code, sales owner, organisation, or exact user id |
| `from`, `to` | `YYYY-MM-DD` | IST calendar days on `users.created_at` (onboarding date) |
| `page`, `limit` (alias `page_size`) | int | default `1` / `25`, max 200 (list only) |
| `sort` | string | `newest` (default), `oldest`, `email`, `name`, `last_login`, `plan`, `revenue`, `last_payment` |
| `mode` | `users` · `history` | export only |

## 4. `GET /api/admin/onboarded-users` — list

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/onboarded-users?channel=agency,internal&plan_status=PAID&sort=revenue&limit=25"
```

Response (`data`):

```json
{
  "users": [
    {
      "id": 114,
      "email": "user@example.com",
      "username": "test",
      "phone": null,
      "account_type": "SOLO",
      "domain_role": "LEGAL_PROFESSIONAL",
      "approval_status": "APPROVED",
      "is_active": true,
      "is_blocked": false,
      "created_at": "2026-10-12T06:48:19.469Z",
      "created_at_ist": { "display": "Mon, 12 Oct 2026, 12:18 PM IST", "date": "12 Oct 2026", "time": "12:18 PM", "time24": "12:18", "iso": "2026-10-12T12:18:19+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T06:48:19.469Z", "epoch_ms": 1791787699469 },
      "onboarded_ago": "1d 3h",
      "last_login_at": "2026-10-12T06:50:01.000Z",
      "last_login_at_ist": { "display": "Mon, 12 Oct 2026, 12:20 PM IST", "date": "12 Oct 2026", "time": "12:20 PM", "time24": "12:20", "iso": "2026-10-12T12:20:01+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T06:50:01.000Z", "epoch_ms": 1791787801000 },
      "workspace": { "id": "…uuid…", "name": "Sharma & Associates", "type": "LLP", "approval_status": "APPROVED", "city": "Pune", "state": "Maharashtra", "is_admin": true, "member_role": "admin" },
      "profile": { "organization_name": "Sharma & Associates", "organization_type": "Law firm", "primary_role": "Advocate", "primary_jurisdiction": "Bombay HC", "main_areas_of_practice": "Civil" },
      "onboarding": {
        "channel": "OUTSOURCED",
        "channel_label": "Outsourced / agency",
        "tracked": true,
        "level": "user",
        "source": "SIGNUP",
        "referral_code": "TS-KE7N",
        "referral_label": null,
        "referral_code_active": true,
        "sales_owner": { "id": "57b051e6-ca59-4628-b091-2a313fbd9f2d", "name": "Test sale", "internal": false },
        "signed_up_at": "2026-10-12T06:48:19.469Z",
        "signed_up_at_ist": { "display": "Mon, 12 Oct 2026, 12:18 PM IST", "date": "12 Oct 2026", "time": "12:18 PM", "time24": "12:18", "iso": "2026-10-12T12:18:19+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T06:48:19.469Z", "epoch_ms": 1791787699469 },
        "set_at": null, "set_at_ist": null, "reason": null
      },
      "plan": {
        "status": "PAID",
        "active_plan_id": 4,
        "active_plan_name": "Pro",
        "is_paid": true,
        "active_plan_updated_at": "2026-10-12T12:10:48.204Z",
        "active_plan_updated_at_ist": { "display": "Mon, 12 Oct 2026, 05:40 PM IST", "date": "12 Oct 2026", "time": "05:40 PM", "time24": "17:40", "iso": "2026-10-12T17:40:48+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T12:10:48.204Z", "epoch_ms": 1791807048204 },
        "current_subscription": {
          "subscription_id": 138, "plan_name": "Pro", "plan_source": "monthly_plan", "plan_category": "solo",
          "plan_price": 100, "plan_currency": "INR", "billing_interval_months": 1, "status": "active",
          "start_date": "2026-10-12T00:00:00.000Z", "start_date_ist": { "display": "Mon, 12 Oct 2026, 05:30 AM IST", "date": "12 Oct 2026", "time": "05:30 AM", "time24": "05:30", "iso": "2026-10-12T05:30:00+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T00:00:00.000Z", "epoch_ms": 1791763200000 },
          "end_date": "2026-11-12T00:00:00.000Z", "end_date_ist": { "display": "Thu, 12 Nov 2026, 05:30 AM IST", "date": "12 Nov 2026", "time": "05:30 AM", "time24": "05:30", "iso": "2026-11-12T05:30:00+05:30", "weekday": "Thu", "timezone": "Asia/Kolkata", "utc": "2026-11-12T00:00:00.000Z", "epoch_ms": 1794441600000 },
          "is_expired": false, "activated_at": "2026-10-12T12:10:48.204Z", "activated_at_ist": { "display": "Mon, 12 Oct 2026, 05:40 PM IST", "date": "12 Oct 2026", "time": "05:40 PM", "time24": "17:40", "iso": "2026-10-12T17:40:48+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T12:10:48.204Z", "epoch_ms": 1791807048204 },
          "cancelled_at": null, "cancelled_at_ist": null, "last_charged_at": null, "last_charged_at_ist": null,
          "monthly_tokens": 500000, "current_token_balance": 480000, "topup_token_balance": 0, "plan_tokens_used": 20000,
          "extra_storage_bytes": 0, "storage_limit_gb": 10, "razorpay_subscription_id": null, "razorpay_payment_id": "pay_TmzYq5xEp4hZmO"
        }
      },
      "subscription_summary": {
        "subscriptions": 1, "active_subscriptions": 1, "cancelled_subscriptions": 0, "plan_names": ["Pro"],
        "first_subscribed_at": "2026-10-12T12:10:48.204Z", "first_subscribed_at_ist": { "display": "Mon, 12 Oct 2026, 05:40 PM IST", "date": "12 Oct 2026", "time": "05:40 PM", "time24": "17:40", "iso": "2026-10-12T17:40:48+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T12:10:48.204Z", "epoch_ms": 1791807048204 },
        "last_subscribed_at": "2026-10-12T12:10:48.204Z", "last_subscribed_at_ist": { "display": "Mon, 12 Oct 2026, 05:40 PM IST", "date": "12 Oct 2026", "time": "05:40 PM", "time24": "17:40", "iso": "2026-10-12T17:40:48+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T12:10:48.204Z", "epoch_ms": 1791807048204 },
        "first_subscription_start": "2026-10-12T00:00:00.000Z", "last_subscription_end": "2026-11-12T00:00:00.000Z",
        "last_subscription_end_ist": { "display": "Thu, 12 Nov 2026, 05:30 AM IST", "date": "12 Nov 2026", "time": "05:30 AM", "time24": "05:30", "iso": "2026-11-12T05:30:00+05:30", "weekday": "Thu", "timezone": "Asia/Kolkata", "utc": "2026-11-12T00:00:00.000Z", "epoch_ms": 1794441600000 },
        "payments": 1, "captured_payments": 1, "subscription_paid": 100,
        "topups": 0, "completed_topups": 0, "topup_paid": 0, "tokens_credited": 0,
        "storage_addons": 0, "completed_storage_addons": 0, "storage_paid": 0, "storage_bytes_granted": 0,
        "total_paid": 100, "currency": "INR",
        "first_payment_at": "2026-10-12T12:10:48.204Z", "first_payment_at_ist": { "display": "Mon, 12 Oct 2026, 05:40 PM IST", "date": "12 Oct 2026", "time": "05:40 PM", "time24": "17:40", "iso": "2026-10-12T17:40:48+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T12:10:48.204Z", "epoch_ms": 1791807048204 },
        "last_payment_at": "2026-10-12T12:10:48.204Z", "last_payment_at_ist": { "display": "Mon, 12 Oct 2026, 05:40 PM IST", "date": "12 Oct 2026", "time": "05:40 PM", "time24": "17:40", "iso": "2026-10-12T17:40:48+05:30", "weekday": "Mon", "timezone": "Asia/Kolkata", "utc": "2026-10-12T12:10:48.204Z", "epoch_ms": 1791807048204 },
        "last_payment_amount": 100, "last_topup_at": null, "last_storage_addon_at": null
      },
      "timezone": "Asia/Kolkata"
    }
  ],
  "pagination": { "page": 1, "limit": 25, "total": 2, "totalPages": 1 },
  "filters": { "channel": ["OUTSOURCED", "INTERNAL"], "plan_status": ["PAID"], "owner_id": "all", "code": "all", "source": "all", "account_type": "all", "approval_status": "all", "plan": "all", "active": null, "has_payments": null, "has_subscription": null, "min_total_paid": null, "firm_id": null, "search": null, "from": null, "to": null, "timezone": "Asia/Kolkata", "sort": "revenue" },
  "summary": { "users": 2, "paid": 2, "lapsed": 0, "free": 0, "with_workspace": 1, "total_paid": 200, "subscription_paid": 200, "topup_paid": 0, "storage_paid": 0, "payments": 2, "paid_rate_pct": 100 },
  "truncated": false,
  "timezone": "Asia/Kolkata"
}
```

`summary` is computed over **all** users matching the filters, not just the page. `total_paid` =
subscription payments (captured) + completed top-ups + completed storage add-ons.

## 5. `GET /api/admin/onboarded-users/summary`

Same filters. Returns `totals`, `by_channel` (always SELF / INTERNAL / OUTSOURCED, summing to `totals.users`),
`by_owner`, `by_plan`, `by_account_type`; each bucket has `users, paid, lapsed, free, with_workspace, total_paid,
subscription_paid, topup_paid, storage_paid, payments, paid_rate_pct`.

```json
{
  "totals": { "users": 77, "paid": 12, "lapsed": 21, "free": 44, "with_workspace": 21, "total_paid": 150795, "subscription_paid": 149161, "topup_paid": 490, "storage_paid": 1144, "payments": 48, "paid_rate_pct": 15.6 },
  "by_channel": [
    { "channel": "SELF", "users": 68, "paid": 10, "lapsed": 20, "free": 38, "with_workspace": 15, "total_paid": 150595, "subscription_paid": 148961, "topup_paid": 490, "storage_paid": 1144, "payments": 46, "paid_rate_pct": 14.7 },
    { "channel": "INTERNAL", "users": 0, "paid": 0, "lapsed": 0, "free": 0, "with_workspace": 0, "total_paid": 0, "subscription_paid": 0, "topup_paid": 0, "storage_paid": 0, "payments": 0, "paid_rate_pct": 0 },
    { "channel": "OUTSOURCED", "users": 9, "paid": 2, "lapsed": 1, "free": 6, "with_workspace": 6, "total_paid": 200, "subscription_paid": 200, "topup_paid": 0, "storage_paid": 0, "payments": 2, "paid_rate_pct": 22.2 }
  ],
  "by_owner": [ { "owner": { "id": "3311a5ee-…", "name": "pravin", "internal": false }, "channel": "OUTSOURCED", "users": 4, "paid": 1, "lapsed": 0, "free": 3, "with_workspace": 3, "total_paid": 100, "subscription_paid": 100, "topup_paid": 0, "storage_paid": 0, "payments": 1, "paid_rate_pct": 25 } ],
  "by_plan": [ { "plan_name": "(no plan)", "users": 65, "paid": 0, "lapsed": 21, "free": 44, "with_workspace": 15, "total_paid": 149695, "subscription_paid": 148061, "topup_paid": 490, "storage_paid": 1144, "payments": 40, "paid_rate_pct": 0 }, { "plan_name": "Max", "users": 8, "paid": 8, "lapsed": 0, "free": 0, "with_workspace": 4, "total_paid": 800, "subscription_paid": 800, "topup_paid": 0, "storage_paid": 0, "payments": 6, "paid_rate_pct": 100 } ],
  "by_account_type": [ { "account_type": "SOLO", "users": 39, "paid": 6, "lapsed": 10, "free": 23, "with_workspace": 0, "total_paid": 100795, "subscription_paid": 99161, "topup_paid": 490, "storage_paid": 1144, "payments": 30, "paid_rate_pct": 15.4 } ]
}
```

(Counts are from the 2026-10-13 run; `by_plan` / `by_account_type` / `by_owner` trimmed.)

## 6. `GET /api/admin/onboarded-users/:userId` — complete history

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" "http://localhost:4000/api/admin/onboarded-users/3"
```

`data`:

| Part | Content |
|---|---|
| `user` | The same object as a list row |
| `subscription_history.subscriptions[]` | Every `user_subscriptions` row, oldest first: `id, plan_name, plan_source (monthly_plan / subscription_plan), plan_category, plan_price, plan_currency, billing_interval_months, monthly_tokens, daily_token_limit, storage_limit_gb, status, created_at, start_date, end_date, is_expired, activated_at, cancelled_at, completed_at, last_charged_at, last_reset_date, current_token_balance, topup_token_balance, topup_expires_at, plan_tokens_used, extra_storage_bytes, razorpay_subscription_id, razorpay_payment_id` (+ `_ist` for every date) |
| `subscription_history.payments[]` | Every `payments` row: `id, subscription_id, plan_name, amount, currency, status (captured / authorized / failed), payment_method, razorpay_payment_id, razorpay_order_id, created_at, transaction_date` |
| `subscription_history.topups[]` | Every token top-up: `id, topup_plan_name, tokens_credited, plan_tokens, validity_days, amount, currency, status (completed / pending), razorpay ids, expires_at, created_at` |
| `subscription_history.storage_addons[]` | Every storage add-on: `id, addon_plan_name, storage_gb, storage_bytes_granted, billing_type, billing_interval_months, validity_years, amount, currency, status, razorpay ids, expires_at, created_at` |
| `storage` | `user_storage_stats`: file / chat / draft / citation counts and bytes, `total_bytes`, `total_gb` (or `null`) |
| `referral_history[]` | Every referral-code change on the user or their workspace: `level, changed_at, previous_code, previous_owner, previous_source, new_code, new_owner, reason, changed_by { id, name, email }` |
| `timeline[]` | Everything in one chronological list: `{ at, at_ist, type (SIGNUP / SUBSCRIPTION / SUBSCRIPTION_CANCELLED / PAYMENT / TOKEN_TOPUP / STORAGE_ADDON), title, detail, amount, currency, status, ref_id }` |

```json
{
  "user": { "id": 3, "email": "pravin.sarule@nexintelai.com", "onboarding": { "channel": "SELF", "...": "..." }, "plan": { "status": "LAPSED", "active_plan_name": null, "...": "..." }, "subscription_summary": { "subscriptions": 1, "captured_payments": 6, "total_paid": 130998, "...": "..." }, "...": "..." },
  "subscription_history": {
    "subscriptions": [ { "id": 1, "plan_name": "Max", "plan_source": "monthly_plan", "plan_price": 999, "plan_currency": "INR", "status": "active", "start_date": "2026-06-02T00:00:00.000Z", "end_date": "2026-07-02T00:00:00.000Z", "is_expired": true, "monthly_tokens": 1000000000, "storage_limit_gb": 50, "...": "..." } ],
    "payments": [ { "id": 1, "subscription_id": 1, "plan_name": "Max", "amount": 10, "currency": "INR", "status": "captured", "payment_method": "netbanking", "razorpay_payment_id": "pay_…", "created_at": "2025-12-03T10:16:22.497Z", "...": "..." } ],
    "topups": [],
    "storage_addons": []
  },
  "storage": { "file_count": 12, "total_bytes": 3191234567, "total_gb": 2.972, "...": "..." },
  "referral_history": [],
  "timeline": [
    { "at": "2025-12-03T04:45:35.002Z", "type": "SIGNUP", "title": "Signed up (Self signup)", "detail": "direct", "amount": null, "currency": null, "status": null, "ref_id": null, "at_ist": { "display": "Wed, 03 Dec 2025, 10:15 AM IST", "...": "..." } },
    { "at": "2025-12-03T10:16:22.497Z", "type": "SUBSCRIPTION", "title": "Max subscription active", "detail": "02 Jun 2026 → 02 Jul 2026", "amount": 999, "currency": "INR", "status": "active", "ref_id": 1, "at_ist": { "display": "Wed, 03 Dec 2025, 03:46 PM IST", "...": "..." } },
    { "at": "2025-12-03T10:16:22.497Z", "type": "PAYMENT", "title": "Payment captured · Max", "detail": "netbanking · pay_…", "amount": 10, "currency": "INR", "status": "captured", "ref_id": 1, "at_ist": { "display": "Wed, 03 Dec 2025, 03:46 PM IST", "...": "..." } }
  ],
  "timezone": "Asia/Kolkata"
}
```

`400` when `userId` is not a positive integer, `404` when unknown.

## 7. `GET /api/admin/onboarded-users/export` — CSV download

Same filters as the list (`page` / `limit` ignored), at most 50 000 rows, UTF-8 BOM + CRLF so Excel opens it directly.
Headers `X-Total-Rows` / `X-Exported-Rows`; file name `onboarded-users-YYYY-MM-DD-HHMM-IST.csv`
(`onboarded-users-history-…` for `mode=history`).

**`mode=users` (default)** — one row per user:

```
User id,Email,Name,Phone,Account type,Role,Approval status,Active,Onboarded (IST),Onboarded date (IST),Last login (IST),Workspace,Workspace type,Workspace role,Organisation,Onboarding channel,Channel label,Referral level,Referral source,Referral code,Code label,Sales owner,Owner type,Referral signed up (IST),Plan status,Active plan,Plan updated (IST),Current subscription plan,Current subscription status,Current subscription start (IST),Current subscription end (IST),Subscriptions,Active subscriptions,Plans used,First subscribed (IST),Last subscribed (IST),Payments (captured),Subscription paid,Top-ups (completed),Top-up paid,Tokens credited,Storage add-ons (completed),Storage paid,Total paid,Currency,First payment (IST),Last payment (IST),Last payment amount,Razorpay customer id,Onboarded (UTC)
```

**`mode=history`** — one row per event (signup, subscription, cancellation, payment, top-up, storage add-on), the
user's identity and onboarding columns repeated on every row, oldest first per user:

```
User id,Email,Name,Onboarding channel,Sales owner,Referral code,Workspace,Event (IST),Event date (IST),Event type,Title,Detail,Status,Amount,Currency,Reference id,Event (UTC)
```

Examples:

| Need | Query |
|---|---|
| Everyone brought in by agencies, with revenue | `/export?channel=agency&sort=revenue` |
| Internal sales signups this month | `/export?channel=internal&from=2026-10-01&to=2026-10-31` |
| All paying users, full payment history | `/export?mode=history&has_payments=true` |
| One sales owner's users | `/export?owner_id=<uuid>` |
| Users who paid once but lapsed | `/export?plan_status=LAPSED&has_payments=true` |

## 8. `GET /api/admin/onboarded-users/meta`

`channels` (with aliases), `plan_statuses`, `sources`, `sales_owners` (`id, name, internal, channel`),
`referral_codes` (`id, code, label, active, owner_id, owner_name`), `account_types`, `active_plan_names`,
`monthly_plans`, `subscription_plans`, `free_plan_names`, `sort_options`, `limits`.

## 9. Errors

| HTTP | code | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | unknown channel / plan_status, bad owner_id, bad date, `from` > `to`, non-integer userId |
| 401 / 403 | `UNAUTHORIZED` / `FORBIDDEN` | missing / invalid token, role not allowed |
| 404 | `NOT_FOUND` | unknown user |
| 500 | `INTERNAL_ERROR` | look the `requestId` up in the backend log |
