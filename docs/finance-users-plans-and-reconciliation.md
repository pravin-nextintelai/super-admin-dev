# Finance Admin — Users & Plans API and Razorpay Reconciliation

Delivered 2026-10-15 — **backend only** (per request). Node/Express + `pg` (raw SQL, as the rest of this repo). The existing React screen keeps working unchanged; §6 lists what the frontend needs to add to consume the new fields.

> **Scope note.** This admin backend only *reads* the Payment DB. The Razorpay checkout, signature/webhook
> verification, GST calculation and application-invoice numbering are performed by the user-facing application
> that writes to the same Payment DB (`payments`, `payment_orders`, `payment_refunds`, `payment_webhook_events`,
> `app_invoices`). Nothing in this repo creates, verifies or mutates payments — reconciliation stores its findings
> in separate `reconciliation_*` tables.

---

## 1. Files

### Backend — new
| File | Purpose |
|---|---|
| `utils/money.js` | Integer-paise ↔ exact 2-dp string helpers (no floating point). |
| `services/usersPlansService.js` | All Users & Plans SQL: attribution (sales owner / referral code), derived user status, latest paid payment with GST + invoice + Razorpay refs, transactions view, per-user history, CSV builder (RFC-4180 + formula-injection guard). |
| `services/razorpayClient.js` | Read-only Razorpay REST client (Basic auth, `count/skip` paging, 429/5xx/timeout retry with backoff, `Retry-After`). |
| `services/reconciliationMatcher.js` | Pure matching engine (no I/O): Razorpay payments vs DB rows → issues + summary. |
| `services/reconciliationService.js` | Run lifecycle (queued → running → completed / completed_with_issues / partial / failed), API snapshot, issue persistence, resolve/reopen with audit history, retry, CSV export, schema bootstrap. |
| `routes/usersPlansRoutes.js` | `/api/admin/users-plans/*` (alias of the plan-analytics subscriber handlers). |
| `routes/reconciliationRoutes.js` | `/api/admin/reconciliation/*`. |
| `migrations/create_reconciliation_tables.sql` | 5 new tables (Payment DB). Applied automatically at startup and via `npm run migrate:reconciliation`. |
| `tests/users_plans.test.js`, `tests/reconciliation_matcher.test.js`, `tests/razorpay_client.test.js`, `tests/reconciliation_service.test.js` | See §7. |

### Backend — modified
| File | Change |
|---|---|
| `controllers/planAnalyticsController.js` | `getSubscribers` / `exportSubscribers` extended (new filters, sorting, `view=transactions`, GST/invoice/attribution fields); new `getSubscriberDetail`, `getSubscriberTransactions`, `getSubscriberFilters`; PDF endpoints now print the real `app_invoices` number (404 `NO_INVOICE` otherwise) and GST lines; purchase-date filter uses inclusive-IST → exclusive-UTC boundaries. |
| `routes/planAnalyticsRoutes.js` | New sub-routes (`/subscribers/filters`, `/subscribers/:userId`, `/subscribers/:userId/transactions`). |
| `server.js` | Mounts the two routers; `ensureReconciliationSchema(paymentPool)` at startup. |
| `package.json` | `test:users-plans`, `test:reconciliation-matcher`, `test:razorpay-client`, `test:reconciliation`, `test:finance`, `migrate:reconciliation`. |

### Frontend
No frontend files were changed for this delivery. The list response is backward compatible with the current
`FinanceSubscribers.jsx` (every field it reads is still present); see §6 for the changes required to surface the new data.

---

## 2. Database

### Existing tables reused (no changes)
Auth DB: `users`, `firms`, `firm_users`, `user_referrals`, `tenant_referrals`, `referral_codes`, `sales_owners`.
Payment DB: `payments` (already carries `basic_amount_paise`, `cgst_*`, `sgst_*`, `igst_*`, `total_amount_paise`, `tax_type`, `tax_basis`, `tax_metadata`, `amount_refunded_paise`, `refund_status`, `razorpay_receipt`, `razorpay_invoice_id/number`, `purchase_date`, `app_invoice_id`), `app_invoices`, `payment_refunds`, `user_subscriptions`, `monthly_plans`, `subscription_plans`, `user_token_topup_purchases`, `topup_plans`, `user_storage_addon_purchases`, `addon_plans`.

**No migration was needed for §2 of the requirement** — the GST breakdown (in integer paise), invoice linkage and refund columns already exist and are populated for 50/50 payments (48 backfilled with `tax_metadata.rule = legacy_backfill_inclusive_18_cgst_sgst`, the rest calculated at order time by the payment service). Historical breakdowns are stored per payment and are not recomputed.

### New tables (Payment DB) — `migrations/create_reconciliation_tables.sql`
| Table | Rows |
|---|---|
| `reconciliation_runs` | one per run: IST range, resolved UTC/unix boundaries, status, requester, attempt / `retry_of_run_id`, fetch counters, completeness flags, API call/retry counts, `summary` JSONB, `error`. |
| `reconciliation_razorpay_payments` | API snapshot of every Razorpay payment in the run (raw `payload`, optional `order_payload`). `UNIQUE (run_id, razorpay_payment_id)`. |
| `reconciliation_issues` | findings; `status open|resolved`, `severity`, `expected`/`actual`/`details` JSONB, resolver + reason. |
| `reconciliation_issue_history` | immutable audit trail (`created|resolved|reopened`, previous/new status, admin id/email, reason, snapshot). |
| `reconciliation_run_events` | execution log (pages fetched, retries, failures, phase transitions). |

All FKs cascade from `reconciliation_runs`; indexes on run/status/type/payment id. Sequelize models were **not** added: this repo's convention is raw `pg` with SQL migration files (`migrations/*.sql`) and `ensure*Schema()` bootstraps; the five existing Sequelize models are unrelated to payments.

---

## 3. Users & Plans column → source mapping

| Column | Source |
|---|---|
| Username / Email | Auth `users.username`, `users.email` |
| Sales Owner | `sales_owners.name` via `referral_codes.owner_id`; code resolved from the user's workspace `tenant_referrals` (firm via `firm_users` or `firms.admin_user_id`) first, else `user_referrals` — same rule as the Sales Referrals module |
| Owner Type | `DIRECT` if no referral code; else `sales_owners.internal ? INTERNAL : OUTSOURCED` |
| Referral Code | `referral_codes.code` |
| User Status (derived) | `blocked` if `users.is_blocked`; `pending` if `approval_status ≠ APPROVED`; `inactive` if `is_active = false`; `new` if `last_login_at IS NULL`; else `active` |
| Plan | `users.active_plan_name`, falling back to current `user_subscriptions` → `monthly_plans.name` / `subscription_plans.name`; per payment: `payments.plan_name` → `monthly_plans` / `subscription_plans` via `payments.monthly_plan_id` / `plan_id` / `subscription_id` |
| Basic / CGST / SGST / IGST / Total (INR) | `payments.basic_amount_paise`, `cgst_amount_paise`, `sgst_amount_paise`, `igst_amount_paise`, `total_amount_paise` (÷100 as exact strings; free users show `0.00`) |
| Purchase Date | `COALESCE(payments.purchase_date, captured_at, created_at)` shown in IST |
| Invoice Number | `app_invoices.invoice_number` (via `payments.app_invoice_id` or `app_invoices.payment_id`). Blank when none exists — **never derived from `pay_`/`order_` ids**. |
| Razorpay Payment ID | `payments.razorpay_payment_id` (`pay_…`) |
| Razorpay Receipt | `payments.razorpay_receipt` (receipt string sent at order creation; present for payments created through `payment_orders`) |
| Razorpay Order ID | `payments.razorpay_order_id` (`order_…`) |
| Razorpay invoice (detail only) | `payments.razorpay_invoice_id` / `razorpay_invoice_number` — currently NULL for every row (no Razorpay Invoice resources are used) |
| Refunds (detail) | `payments.amount_refunded_paise`, `refund_status`, `payment_refunds.*` |

The **Users** view shows one row per user with the latest paid plan payment (plus a "N purchases" link); the
**Transactions** view shows one row per paid plan payment so multiple purchases by one user are listed separately.
Top-ups and storage add-ons appear in the user detail drawer / `transactions` endpoint (they have no GST columns in the DB).

### Fields that cannot be populated from current data
* **Razorpay invoice number** — `payments.razorpay_invoice_id/number` are NULL for all 50 payments (no Razorpay Invoice resource is created by the payment flow). Shown blank.
* **Application invoice number** for payments made before invoicing went live — only 1 of 50 payments has an `app_invoices` row (`NXI/2026-27/000001`, 15 Oct 2026). Older payments show no invoice number and the *Invoice* PDF button is disabled (receipt is always available). Reconciliation only flags `MISSING_INVOICE` for payments on/after the first issued invoice (or `RECON_INVOICE_REQUIRED_SINCE`).
* **Razorpay receipt** for legacy payments — `razorpay_receipt` is populated only for payments created via `payment_orders` (1 of 50).
* **Customer state / IGST** — `tax_metadata.customer_state` is null for all rows; every stored transaction is `CGST_SGST`. IGST columns exist and are displayed/validated, but no IGST transaction exists yet.
* **Refunds** — `payment_refunds` is empty; refund columns are wired and tested with fixtures.

---

## 4. API

All endpoints require the dashboard JWT (`Authorization: Bearer …`) and one of the roles below. Responses are `{ success, data }` / `{ success:false, message }`.

### Users & Plans — `/api/admin/users-plans` (roles: super-admin, finance-admin, account-admin, user-admin)
Same handlers also serve `/api/admin/plan-analytics/subscribers…` for the existing screen.

| Method & path | Description |
|---|---|
| `GET /` | Paginated list. Query: `page`, `pageSize` (≤100), `search` (name/email/id), `plan` (free\|pro\|plus\|lite\|enterprise), `topupPlanId`, `addonPlanId`, `status` (subscription status), `ownerType` (INTERNAL\|OUTSOURCED\|DIRECT), `ownerId` (uuid), `code` (referral code, partial), `userStatus` (new\|active\|inactive\|blocked\|pending), `from`, `to` (YYYY-MM-DD IST, **both inclusive**), `sortBy` (joined\|username\|email\|plan\|user_status\|sales_owner\|purchase_date\|total_amount), `sortDir`, `view` (users\|transactions). Returns `rows[]`, `total`, `page`, `pageSize`, `view`, `sortBy`, `sortDir`, `filters` (facets). |
| `GET /filters` | Facets: plans, top-up plans, add-on plans, tiers, sales owners, owner types, user statuses, sort fields. |
| `GET /export` | CSV of **all** rows matching the same query (not just the page). UTF-8 BOM, CRLF, quoted, formula-injection guarded. Columns: Username, Email, Sales Owner, Owner Type, Referral Code, User Status, Plan, Basic/CGST/SGST/IGST/Total (INR), Purchase Date (IST), Payment Status, Invoice Number, Razorpay Payment ID, Razorpay Order ID, Razorpay Receipt. |
| `GET /:userId` | Profile + attribution + firm, `current_subscription`, `subscriptions[]`, `payments[]` (every status, full GST + refs), `latest_payment`, `refunds[]`, `topups[]`, `addons[]`, `totals`. |
| `GET /:userId/transactions` | Complete history: plan payments (any status) + top-ups + add-ons, newest first; `refunds[]`. |
| `GET /:userId/invoices` | Legacy flat list (unchanged). |
| `GET /:userId/payments/:paymentId/invoice` | PDF tax invoice — only when an `app_invoices` row exists, else `404 { code: "NO_INVOICE" }`. |
| `GET /:userId/payments/:paymentId/receipt` | PDF payment receipt (labels Razorpay Payment ID / Order ID / receipt separately). |

Row shape (users view) keeps every field the previous screen used (`plan_name`, `status`, `invoice_count`, `paid_total`, `latest_invoice_id`, …) and adds
`user_status`, `owner_type`, `sales_owner {id,name,internal}`, `referral_code`, `referral {…}`, `plan_transaction_count`, and
`latest_payment` = `{ payment_id, plan_name, status, is_paid, currency, basic_amount, cgst_amount, sgst_amount, igst_amount, total_amount, amount_refunded, paise{…}, tax{type,basis,rates}, refund_status, invoice_number, invoice_kind, razorpay_invoice_id, razorpay_invoice_number, razorpay_payment_id, razorpay_order_id, razorpay_receipt, purchase_date, … }`.
Transactions-view rows are `{ …userFields, plan_name, payment }`.

### Reconciliation — `/api/admin/reconciliation` (roles: super-admin, finance-admin, account-admin)
| Method & path | Description |
|---|---|
| `POST /runs` `{ startDate, endDate }` | Create + start a run (IST days, inclusive; ≤ 92 days; not in the future). `202` with the run. `409` if the same range is already queued/running. |
| `GET /runs?page&pageSize&status` | Runs, newest first, with `open_issues` / `total_issues`. |
| `GET /runs/:runId` | Run + `summary` + `issue_counts[]` + `events[]` (execution log). |
| `GET /runs/:runId/issues?status&type&severity&search&page&pageSize` | Issues ordered by severity. |
| `GET /runs/:runId/export` | CSV of the run's issues. |
| `POST /runs/:runId/retry` | New attempt for a `failed` / `partial` run (`attempt + 1`, `retry_of_run_id`). |
| `GET /issues/:issueId` | Issue + Razorpay snapshot/order payload + history. |
| `PATCH /issues/:issueId/resolve` `{ reason }` | Reason ≥ 5 chars **required**; records admin id/email, timestamp, previous → new state. `409` if already resolved. |
| `PATCH /issues/:issueId/reopen` `{ reason? }` | Reopens; audited. |
| `GET /issues/:issueId/history` | Audit trail. |

Run statuses: `queued`, `running`, `completed` (no issues), `completed_with_issues`, `partial` (one side did not load completely — mismatch checks still run on what matched, but `RAZORPAY_ONLY` / `DB_ONLY` are **not** reported), `failed` (neither side loaded).

Issue types: `RAZORPAY_ONLY`, `DB_ONLY`, `DUPLICATE_REFERENCE`, `AMOUNT_MISMATCH` (exact paise), `CURRENCY_MISMATCH`, `STATUS_MISMATCH`, `ORDER_MISMATCH`, `REFUND_MISMATCH` (full/partial, exact paise), `TAX_BREAKDOWN_MISMATCH` (basic+cgst+sgst+igst ≠ total, total ≠ Razorpay amount, wrong tax type), `MISSING_INVOICE` (low; plan payments on/after invoicing went live only; never for packs), `INCOMPLETE_RECORD`. Failed/pending Razorpay payments without a DB row are reported as `info`, not errors.

Matching: Razorpay payments created in `[startDate 00:00 IST, endDate+1 00:00 IST)` (sent to Razorpay as inclusive unix seconds) vs DB rows from `payments` + `user_token_topup_purchases` + `user_storage_addon_purchases` loaded with a ±1-day pad (so boundary timestamps still match); only DB rows inside the strict window can be `DB_ONLY`. Primary key is `razorpay_payment_id`; order id, amount, currency, status, refunds, GST and invoice are then validated.

---

## 5. Environment variables

| Variable | Required | Notes |
|---|---|---|
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for reconciliation | Basic-auth credentials of the account that created the `pay_…` ids in the DB. **The values currently in `Backend/.env` are rejected by Razorpay (`401 Authentication failed`)** — live runs end as `partial` with that error recorded until valid keys are set. |
| `RAZORPAY_API_BASE` | no | default `https://api.razorpay.com/v1` |
| `RAZORPAY_TIMEOUT_MS` | no | per request, default 15000 |
| `RAZORPAY_MAX_RETRIES` | no | retries on 429/5xx/network, default 4 (exponential backoff, honours `Retry-After`) |
| `RAZORPAY_PAGE_SIZE` | no | ≤100, default 100 |
| `RAZORPAY_MIN_INTERVAL_MS` | no | soft rate limit between calls, default 120 |
| `RECON_INVOICE_REQUIRED_SINCE` | no | `YYYY-MM-DD` (IST). Plan payments on/after this day must have an app invoice. Default: earliest `app_invoices.issued_at`; no invoices ⇒ never required. |
| `RECON_FETCH_ORDERS` | no | `true` to also fetch Razorpay order details for unmatched / order-mismatched payments (extra API calls, ≤200 per run). |

Runs execute in-process in the background (`setImmediate`) and survive only while the server process does; a run interrupted by a restart stays `running` and can be re-created for the same range. No separate worker/queue is required.

---

## 6. Frontend changes required to consume the APIs (not implemented)

The React screen `Frontend/src/pages/dashboard/FinanceSubscribers.jsx` currently calls
`GET /api/admin/plan-analytics/subscribers` and reads `plan_name`, `latest_invoice_id`, `latest_invoice_amount`,
`latest_invoice_at`; all of these are unchanged, so it works as-is against the new backend. To show the full
requirement:

1. **Columns** — read `row.sales_owner.name`, `row.owner_type`, `row.referral_code`, `row.user_status` and
   `row.latest_payment.{basic_amount, cgst_amount, sgst_amount, igst_amount, total_amount, purchase_date,
   invoice_number, razorpay_payment_id, razorpay_order_id, razorpay_receipt}` (amounts are exact 2-dp strings —
   display them without re-rounding). Use `view=transactions` (`row.payment` instead of `row.latest_payment`) to list
   one row per purchase.
2. **Filters** — add `ownerType`, `ownerId` (from `filters.salesOwners`), `code`, `userStatus` query params; the
   existing `from`/`to`, `plan`, `topupPlanId`, `search` keep their meaning. Label the date range as IST with an
   inclusive end date.
3. **Sorting** — send `sortBy` (`joined|username|email|plan|user_status|sales_owner|purchase_date|total_amount`) and
   `sortDir`.
4. **Invoice button** — enable only when `latest_payment.invoice_number` is set (the invoice PDF endpoint now returns
   `404 { code: "NO_INVOICE" }` for payments without an application invoice; the receipt PDF is always available).
   With the current screen the user sees that message in an alert when clicking *Invoice* on such a row.
5. **Detail view** — `GET /api/admin/users-plans/:userId` and `/:userId/transactions` for the full purchase /
   refund / top-up history of a user.
6. **Reconciliation UI** — a page driving `POST /api/admin/reconciliation/runs` (date range), polling
   `GET /runs/:id` while `queued|running`, listing `GET /runs/:id/issues`, and `PATCH /issues/:id/resolve|reopen`
   with a mandatory reason. Suggested route `/dashboard/subscriptions/reconciliation` for super-admin, account-admin
   and finance-admin (same roles the router authorises).

---

## 7. Tests and how to run

```bash
cd Backend
npm run test:finance                 # all four suites below
npm run test:users-plans             # money/CSV/query parsing + live read-only DB checks
npm run test:reconciliation-matcher  # pure matcher fixtures
npm run test:razorpay-client         # paging / 429 retry / timeout exhaustion / 401 not retried
npm run test:reconciliation          # end-to-end against the live Payment DB with a fake Razorpay client (creates then deletes its runs)

npm start                            # backend on :4000 (reconciliation tables are created at startup)
```

Results on 2026-10-15 (live Auth_DB + Payment_DB): **41 / 41 passed** — users & plans 10, matcher 18, client 7, service 6. HTTP smoke against the running server: 401 without token, 403 for support-admin, all Users & Plans / reconciliation routes 200/202/404 as specified.

| Required scenario | Covered by |
|---|---|
| Free user with no purchase | matcher "free user"; users_plans csvLine free row; live list rows with `latest_payment: null` |
| Paid user with valid GST breakup | matcher "paid user with valid GST breakup"; users_plans serializePayment + live GST integrity check (50/50 sum correctly) |
| Multiple purchases by the same user | matcher "multiple purchases"; live history query (user 76: 18 captured payments) |
| Missing invoice number | matcher "missing invoice is LOW and only when invoicing was live"; HTTP: invoice PDF → `404 NO_INVOICE` for payment 49 |
| Successful Razorpay payment | matcher + service "clean run" |
| Failed or pending payment | matcher "failed / pending … informational"; "status mismatch authorized vs captured" |
| Refunded / partially refunded | matcher full + partial refund cases |
| Razorpay-only transaction | matcher + service tampered run (`RAZORPAY_ONLY` high and info) |
| Database-only transaction | matcher "DB-only paid row inside the window" |
| Duplicate payment reference | matcher + service tampered run |
| Incorrect amount or currency | matcher (critical `AMOUNT_MISMATCH`, `CURRENCY_MISMATCH`); service tampered run |
| Custom date-range boundaries | users_plans "inclusive IST day → exclusive UTC"; live "`to` day fully included"; service `parseRange` (swap, >92 days, future) |
| Pagination and filtered CSV export | HTTP smoke (`export?from&to` → 4 lines; transactions export); service runs/issues pagination |
| Unauthorized admin access | HTTP smoke: no token → 401; support-admin → 403 on both routers |
| API timeout, pagination failure, retry | client tests (timeouts exhausted → `RazorpayApiError`, 429 retried, exact page boundary); service "auth failure → partial, no missing-type issues, retry = attempt 2"; live run #10 recorded the real 401 and run #11 was its retry |

### Known limits
* Live Razorpay reconciliation could not be verified end-to-end: the credentials in `.env` are invalid (see §5). The whole pipeline is exercised with a fake client whose answers are derived from the real DB rows.
* `startDate`/`endDate` are IST calendar days; the UI states the end date is inclusive and the API converts to `< next-day 00:00 IST`.
* The Users view's purchase-date filter applies to the user's **latest** paid plan payment; use the Transactions view to filter individual purchases.
