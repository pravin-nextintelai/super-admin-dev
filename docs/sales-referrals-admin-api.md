# Sales Referrals — Super Admin API Reference

**Date:** 2026-10-12 · **Backend:** Node.js · **Database:** `authdb` (PostgreSQL)

## Contents

1. [Overview](#1-overview)
2. [Common rules](#2-common-rules)
3. [Sales owner APIs](#3-sales-owner-apis) (A1–A3)
4. [Referral code APIs](#4-referral-code-apis) (A4–A11)
5. [Report APIs](#5-report-apis) (A12–A15)
6. [Workspace referral APIs](#6-workspace-referral-apis) (A16–A17)
7. [Error code catalogue](#7-error-code-catalogue)
8. [Open decisions and assumptions](#8-open-decisions-and-assumptions)

---

## 1. Overview

The Sales Referrals admin surface is 17 APIs in the Node.js auth backend, stored in the `authdb` database, all restricted to super admins. They let a super admin create sales owners and referral codes, manage those codes, read attribution reports, and attach a code to an existing workspace. Public signup-side APIs (code status check, register) are out of scope for this document.

| Item | Value |
| --- | --- |
| Backend | Node.js (existing auth service) |
| Database | `authdb` (PostgreSQL); connection settings read from `.env` |
| Base path | `/api/v1/admin/sales-referrals` (routed by the existing gateway rule for `/api/v1/admin/**`) |
| Authentication | Bearer token, verified by the existing auth middleware |
| Authorisation | Super-admin role-check middleware mounted on the whole router. Any other role gets `403 FORBIDDEN`. |
| Content type | `application/json; charset=utf-8` |
| IDs | UUID strings |
| Timestamps | ISO-8601 with offset, e.g. `2026-10-09T16:12:00+05:30` |
| Date filters | `YYYY-MM-DD`, inclusive on both ends, evaluated in Asia/Kolkata |
| Deletes | None. Owners and codes are retired by status, never deleted. |

### API index

| # | Method | Path | Purpose | Used by (screen → button) |
| --- | --- | --- | --- | --- |
| A1 | POST | `/owners` | Create a sales owner with 1–10 codes | New sales owner dialog → **Create / Create with N codes** |
| A2 | PUT | `/owners/{ownerId}` | Update owner name, type, notes | Owner detail → **Edit owner → Save** |
| A3 | GET | `/owners/{ownerId}` | Owner profile with all its codes | Owner detail → page load |
| A4 | POST | `/owners/{ownerId}/codes` | Add one code to an owner | Owner detail → **Add code → Add code** |
| A5 | PATCH | `/codes/{codeId}` | Edit a code's label | Code row menu → **Edit label → Save** |
| A6 | POST | `/codes/{codeId}/deactivate` | Stop a code accepting new signups | Code row menu → **Deactivate** |
| A7 | POST | `/codes/{codeId}/activate` | Re-enable an inactive code | Code row menu → **Activate** |
| A8 | POST | `/codes/{codeId}/refresh` | Retire a code and issue a replacement | Code row menu → **Refresh code** |
| A9 | GET | `/codes/suggest` | Generate available code suggestions | New owner / Add code dialogs → open, **Suggest**, **+ Add another code** |
| A10 | GET | `/codes/availability` | Check if a code can be used | New owner / Add code dialogs → typing in Code |
| A11 | GET | `/codes` | Search codes for the picker | User detail → **Set referral code** picker |
| A12 | GET | `/reports/summary` | Six summary cards | Overview → page load, filters |
| A13 | GET | `/reports/owners` | Owners table with Direct row | Overview → page load, filters, search, sort |
| A14 | GET | `/reports/owners/{ownerId}/codes` | Per-code breakdown for one owner | Owner detail → page load, date filter |
| A15 | GET | `/reports/signups` | Workspaces under a code, owner or Direct | Signups list → load, status tabs, search, dates, paging |
| A16 | PUT | `/tenants/{tenantId}/referral` | Set or change a workspace's referral | User detail → **Set referral code / Change → Save** |
| A17 | GET | Existing admin user-detail endpoint | Adds a `referral` block to the response | User detail → page load (Referral card) |

Copy code, Copy link and Copy all links are handled entirely in the frontend and call no API.

---

## 2. Common rules

Every API below applies these rules; individual sections only list what differs.

### 2.1 Data model (new migration in authdb)

| Table | Key columns | Notes |
| --- | --- | --- |
| `sales_owners` | `id`, `name`, `internal`, `notes`, `created_by`, `created_at`, `updated_by`, `updated_at` | Unique index on `lower(name)`. Never deleted. |
| `referral_codes` | `id`, `owner_id`, `code`, `label`, `active`, `replaced_by_code_id`, audit columns | Unique index on `code`. Never deleted or reused. |
| `tenant_referrals` | `tenant_id` (PK, FK `ON DELETE CASCADE`), `code_id` (nullable), `source` (`SIGNUP` / `ADMIN`), `signed_up_at`, `set_by`, `set_at`, `reason` | `code_id = NULL` means Direct. Indexes on `code_id` and `signed_up_at`. |

### 2.2 Field rules

| Field | Rule |
| --- | --- |
| Code | Trim, then upper-case. Must match `^[A-Z0-9-]{6,20}$`. Matching is case-insensitive because storage is always upper case. |
| Owner name | Trimmed, 1–100 characters, unique ignoring case. |
| Label | Optional, trimmed, max 60 characters. Empty string is stored as `null`. |
| Notes | Optional, max 1000 characters. |
| Reason | Required where used, trimmed, 5–500 characters. |

### 2.3 Plan status classification

Each workspace is classified by its current tenant data in `authdb`. The same expression is used in every report so totals always reconcile.

```sql
CASE
  WHEN t.billing_source = 'CONTRACT'
    OR (t.subscription_plan = ANY($1::text[]) AND t.subscription_status = 'ACTIVE')
    THEN 'PAID'
  WHEN t.previous_paid_plan IS NOT NULL
    THEN 'LAPSED'
  ELSE 'FREE'
END
```

`$1` is the array of paid plan codes, taken from the same shared constant the backend already uses to decide whether a plan is paid, so JavaScript and SQL share one definition. Unverified workspaces fall under FREE.

### 2.4 Report population and filters

- Reports read only workspaces that have a `tenant_referrals` row: self-signups from go-live onwards, plus workspaces a super admin attached a code to.
- Unverified workspaces deleted by the pending-tenant cleanup job after 24 hours drop out automatically through the cascade.
- `from` / `to` filter on `tenant_referrals.signed_up_at`. Both optional; omitted means all time.
- `type` = `ALL` (default), `INTERNAL` or `OUTSOURCED` filters on `sales_owners.internal`. When `type` is not `ALL`, Direct signups are excluded because they have no owner.
- `paidPercent` = `round(paid × 100 / signups)`, integer, half-up. Returns `0` when `signups` is 0.

### 2.5 Error response

Errors use the existing backend error envelope. Field-level problems go in `details`.

```json
{
  "errorCode": "REFERRAL_CODE_TAKEN",
  "message": "This code is already in use.",
  "details": { "field": "codes[1].code", "value": "SFY-9H3T" },
  "timestamp": "2026-10-12T13:10:00+05:30"
}
```

### 2.6 Pagination

List endpoints take `page` (0-based, default 0) and `size` (default 20, max 100), and return:

```json
{ "items": [], "page": 0, "size": 20, "totalItems": 0, "totalPages": 0 }
```

### 2.7 Audit

Every write sets `created_by` / `updated_by` from the authenticated super admin's user ID and the timestamp from the server clock.

### 2.8 Node.js implementation notes

| Concern | Approach |
| --- | --- |
| Database | All three tables live in `authdb`. Reuse the existing authdb connection pool configured from `.env`; the only new env variable is `REFERRALS_TRACKING_SINCE`. |
| Routing | One router mounted at `/api/v1/admin/sales-referrals`, behind the existing auth middleware and a super-admin role check. |
| Transactions | `const client = await pool.connect()` → `BEGIN` → queries → `COMMIT`; `ROLLBACK` in `catch`; `client.release()` in `finally`. Used by A1, A8 and A16. |
| Unique violations | Postgres error `code === '23505'`. Map by `err.constraint`: the owner-name index → `SALES_OWNER_NAME_TAKEN`, the code index → `REFERRAL_CODE_TAKEN`. |
| Row locking | `SELECT ... FOR UPDATE` on the same transaction client (A8). |
| Random codes | `crypto.randomInt(0, alphabet.length)` from Node's built-in `crypto` module. |
| SQL parameters | Snippets use `:from`-style names for readability; bind them as `$1 … $n` in `pg`. |
| Validation | The project's existing request validator; failures return `400 VALIDATION_FAILED` with the field in `details`. |
| Suggested files | `routes/salesReferrals.routes.js`, `controllers/salesReferrals.controller.js`, `services/salesReferrals.service.js`, `services/referralReports.service.js`, plus one migration file. |

If the backend uses an ORM or query builder (Sequelize, Knex, Prisma), the same logic applies through its transaction and raw-query helpers.

---

## 3. Sales owner APIs

Three APIs create, edit and read sales owners. Owners are never deleted.

### A1. Create sales owner with codes

`POST /api/v1/admin/sales-referrals/owners`

**Purpose:** Creates a sales person or agency together with 1–10 referral codes in one atomic request, so the share screen can show every code immediately.

**Used by:** New sales owner dialog → **Create** / **Create with N codes**.

**Request body**

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `name` | string | Yes | 1–100 chars, unique ignoring case |
| `internal` | boolean | Yes | `true` = Internal, `false` = Outsourced |
| `notes` | string | No | Max 1000 chars |
| `codes` | array | Yes | 1–10 items |
| `codes[].code` | string | Yes | Format rule in 2.2 |
| `codes[].label` | string | No | Max 60 chars |

```json
{
  "name": "SalesForYou",
  "internal": false,
  "notes": "Agency onboarded Sep 2026. Contact: account manager.",
  "codes": [
    { "code": "SFY-7K2Q", "label": "Delhi campaign" },
    { "code": "sfy-9h3t", "label": "Mumbai" },
    { "code": "SFY-2B9D", "label": "Pune" }
  ]
}
```

**Logic**

1. Trim `name`; reject if empty or over 100 chars.
2. Check `lower(name)` against `sales_owners`; if it exists, fail with `SALES_OWNER_NAME_TAKEN`.
3. Reject if `codes` is empty or has more than 10 items (`TOO_MANY_CODES`).
4. Normalise every code (trim, upper-case) and validate the format.
5. Reject duplicates inside the request (`REFERRAL_CODE_DUPLICATE_IN_REQUEST`), naming both row indexes.
6. Look up all codes in one query (`WHERE code = ANY($1)`); any match fails with `REFERRAL_CODE_TAKEN`, including inactive and refreshed codes.
7. In one authdb transaction (`BEGIN` … `COMMIT` on a single pool client), insert the owner, then insert every code with `active = true`.
8. If two admins submit the same code at the same moment, Postgres raises a unique violation (error code `23505`). Catch it in the service, `ROLLBACK`, and return `REFERRAL_CODE_TAKEN`.
9. Return the owner with its codes. The frontend builds each link as `<app URL>/#/signup?ref=<code>`.

**Response `201 Created`**

```json
{
  "id": "4f1c2a8e-6b0d-4c3a-9e57-1d2f3a4b5c6d",
  "name": "SalesForYou",
  "internal": false,
  "notes": "Agency onboarded Sep 2026. Contact: account manager.",
  "createdAt": "2026-09-02T11:05:00+05:30",
  "createdBy": { "id": "a1b2...", "name": "Super Admin" },
  "codes": [
    { "id": "c-01...", "code": "SFY-7K2Q", "label": "Delhi campaign", "active": true, "replacedByCode": null, "createdAt": "2026-09-02T11:05:00+05:30" },
    { "id": "c-02...", "code": "SFY-9H3T", "label": "Mumbai", "active": true, "replacedByCode": null, "createdAt": "2026-09-02T11:05:00+05:30" },
    { "id": "c-03...", "code": "SFY-2B9D", "label": "Pune", "active": true, "replacedByCode": null, "createdAt": "2026-09-02T11:05:00+05:30" }
  ]
}
```

**Errors:** `400 VALIDATION_FAILED`, `400 TOO_MANY_CODES`, `400 REFERRAL_CODE_INVALID_FORMAT`, `400 REFERRAL_CODE_DUPLICATE_IN_REQUEST`, `409 SALES_OWNER_NAME_TAKEN`, `409 REFERRAL_CODE_TAKEN`, `403 FORBIDDEN`.

### A2. Update sales owner

`PUT /api/v1/admin/sales-referrals/owners/{ownerId}`

**Purpose:** Renames an owner, switches Internal/Outsourced, or edits notes. Reports reflect the change immediately because signups link to the owner by ID, not by name.

**Used by:** Owner detail → **Edit owner** → **Save**.

**Request body**

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `name` | string | Yes | 1–100 chars, unique ignoring case (excluding this owner) |
| `internal` | boolean | Yes | |
| `notes` | string | No | Max 1000 chars; `null` clears it |

```json
{ "name": "SalesForYou India", "internal": false, "notes": "Agency onboarded Sep 2026." }
```

**Logic**

1. Load the owner; if missing, return `404 SALES_OWNER_NOT_FOUND`.
2. Trim and validate fields.
3. Check `lower(name)` uniqueness against other owners (`id <> :ownerId`).
4. Update the row and audit columns. Codes and signups are untouched.
5. Return the updated owner (same shape as A3).

**Response `200 OK`:** owner object as in A3.

**Errors:** `400 VALIDATION_FAILED`, `404 SALES_OWNER_NOT_FOUND`, `409 SALES_OWNER_NAME_TAKEN`, `403 FORBIDDEN`.

### A3. Get sales owner

`GET /api/v1/admin/sales-referrals/owners/{ownerId}`

**Purpose:** Returns the owner profile and all its codes (active, inactive and refreshed) for the owner detail header and the Edit owner dialog. Signup numbers come from A14.

**Used by:** Owner detail → page load; reloaded after every action on that page.

**Logic**

1. Load the owner; if missing, `404 SALES_OWNER_NOT_FOUND`.
2. Load its codes ordered by active first, then `created_at` descending.
3. For refreshed codes, resolve `replaced_by_code_id` to the replacement's code text.
4. Compute `codeCounts` (active / total).

**Response `200 OK`**

```json
{
  "id": "4f1c2a8e-6b0d-4c3a-9e57-1d2f3a4b5c6d",
  "name": "SalesForYou",
  "internal": false,
  "notes": "Agency onboarded Sep 2026. Contact: account manager.",
  "createdAt": "2026-09-02T11:05:00+05:30",
  "createdBy": { "id": "a1b2...", "name": "Super Admin" },
  "updatedAt": "2026-10-01T10:00:00+05:30",
  "codeCounts": { "active": 3, "total": 4 },
  "codes": [
    { "id": "c-01...", "code": "SFY-7K2Q", "label": "Delhi campaign", "active": true, "replacedByCode": null, "createdAt": "2026-09-02T11:05:00+05:30" },
    { "id": "c-04...", "code": "SFY-4N6W", "label": "Pune", "active": true, "replacedByCode": null, "createdAt": "2026-10-01T10:00:00+05:30" },
    { "id": "c-03...", "code": "SFY-2B9D", "label": "Pune", "active": false, "replacedByCode": "SFY-4N6W", "createdAt": "2026-09-02T11:05:00+05:30" }
  ]
}
```

**Errors:** `404 SALES_OWNER_NOT_FOUND`, `403 FORBIDDEN`.

---

## 4. Referral code APIs

Eight APIs add, edit, switch, refresh, suggest, check and search codes. A code's text can never be edited, deleted or reused.

All write APIs in this section return the **code object**:

```json
{
  "id": "c-01...",
  "ownerId": "4f1c2a8e-6b0d-4c3a-9e57-1d2f3a4b5c6d",
  "code": "SFY-7K2Q",
  "label": "Delhi campaign",
  "active": true,
  "replacedByCode": null,
  "createdAt": "2026-09-02T11:05:00+05:30",
  "updatedAt": "2026-09-02T11:05:00+05:30"
}
```

### A4. Add code to an owner

`POST /api/v1/admin/sales-referrals/owners/{ownerId}/codes`

**Purpose:** Adds one more code to an existing owner, for example a new city campaign. There is no upper limit here; the 10-code cap applies only to A1.

**Used by:** Owner detail → **Add code** → **Add code**.

**Request body**

```json
{ "code": "SFY-6R4J", "label": "Bengaluru" }
```

**Logic**

1. Load the owner; if missing, `404 SALES_OWNER_NOT_FOUND`.
2. Normalise and validate the code format.
3. If the code exists anywhere in `referral_codes`, fail with `REFERRAL_CODE_TAKEN`.
4. Insert with `active = true`. Map a unique violation (`23505`) to `REFERRAL_CODE_TAKEN`.

**Response `201 Created`:** the code object.

**Errors:** `400 REFERRAL_CODE_INVALID_FORMAT`, `400 VALIDATION_FAILED`, `404 SALES_OWNER_NOT_FOUND`, `409 REFERRAL_CODE_TAKEN`, `403 FORBIDDEN`.

### A5. Edit code label

`PATCH /api/v1/admin/sales-referrals/codes/{codeId}`

**Purpose:** Changes only the label of a code. The code text itself is immutable; to change it, refresh the code (A8).

**Used by:** Code row menu → **Edit label** → **Save**.

**Request body**

```json
{ "label": "Delhi NCR" }
```

**Logic**

1. Load the code; if missing, `404 REFERRAL_CODE_NOT_FOUND`.
2. Reject any field other than `label` (`400 VALIDATION_FAILED`).
3. Trim; empty becomes `null`; max 60 chars.
4. Update the label and audit columns. Works for active and inactive codes.

**Response `200 OK`:** the code object.

**Errors:** `400 VALIDATION_FAILED`, `404 REFERRAL_CODE_NOT_FOUND`, `403 FORBIDDEN`.

### A6. Deactivate code

`POST /api/v1/admin/sales-referrals/codes/{codeId}/deactivate`

**Purpose:** Stops a code being accepted at signup, for example when an agency contract ends. Past signups under the code stay counted.

**Used by:** Code row menu → **Deactivate** → confirm.

**Request body:** none.

**Logic**

1. Load the code; if missing, `404 REFERRAL_CODE_NOT_FOUND`.
2. If already inactive, return it unchanged (idempotent).
3. Otherwise set `active = false` and the audit columns.
4. From this moment the public status check returns `INACTIVE`, and register saves new signups using it as Direct.

**Response `200 OK`:** the code object with `"active": false`.

**Errors:** `404 REFERRAL_CODE_NOT_FOUND`, `403 FORBIDDEN`.

### A7. Activate code

`POST /api/v1/admin/sales-referrals/codes/{codeId}/activate`

**Purpose:** Re-enables a code that was deactivated by mistake or for a paused agency.

**Used by:** Code row menu (inactive code) → **Activate**.

**Request body:** none.

**Logic**

1. Load the code; if missing, `404 REFERRAL_CODE_NOT_FOUND`.
2. If `replaced_by_code_id` is set, fail with `409 REFERRAL_CODE_REPLACED`. A refreshed code stays retired, otherwise the widely shared link would work again.
3. If already active, return it unchanged (idempotent).
4. Otherwise set `active = true` and the audit columns.

**Response `200 OK`:** the code object with `"active": true`.

**Errors:** `404 REFERRAL_CODE_NOT_FOUND`, `409 REFERRAL_CODE_REPLACED`, `403 FORBIDDEN`.

### A8. Refresh code

`POST /api/v1/admin/sales-referrals/codes/{codeId}/refresh`

**Purpose:** Retires a code that has been shared too widely and issues a new one with the same owner and label. History stays with the owner.

**Used by:** Code row menu → **Refresh code** → confirm.

**Request body:** none.

**Logic** (one transaction)

1. Load the code with `SELECT ... FOR UPDATE` so two simultaneous refreshes cannot both succeed.
2. If missing, `404 REFERRAL_CODE_NOT_FOUND`. If not active, `409 REFERRAL_CODE_NOT_ACTIVE` (use A4 to add a fresh code instead).
3. Generate a new code with the A9 generator from the owner's name; retry on collision, up to 10 attempts.
4. Insert the new code: same `owner_id`, same `label`, `active = true`.
5. Update the old code: `active = false`, `replaced_by_code_id = <new id>`.
6. `COMMIT`. Signups already under the old code keep pointing at it, so owner totals do not change.

**Response `200 OK`**

```json
{
  "oldCode": { "id": "c-03...", "code": "SFY-2B9D", "label": "Pune", "active": false, "replacedByCode": "SFY-4N6W" },
  "newCode": { "id": "c-04...", "code": "SFY-4N6W", "label": "Pune", "active": true, "replacedByCode": null }
}
```

**Errors:** `404 REFERRAL_CODE_NOT_FOUND`, `409 REFERRAL_CODE_NOT_ACTIVE`, `503 CODE_SUGGESTION_FAILED`, `403 FORBIDDEN`.

### A9. Suggest codes

`GET /api/v1/admin/sales-referrals/codes/suggest`

**Purpose:** Produces ready-to-use, currently available codes from an owner's name so the admin rarely types one.

**Used by:** New owner dialog → open, name typing, **Suggest**, **+ Add another code**; Add code dialog → open.

**Query parameters**

| Param | Type | Required | Rule |
| --- | --- | --- | --- |
| `ownerName` | string | One of the two | Used to build the prefix |
| `ownerId` | UUID | One of the two | Uses the stored owner name |
| `count` | int | No | 1–10, default 1 |
| `exclude` | string | No | Comma-separated codes already in the form, never suggested again |

Example: `GET .../codes/suggest?ownerName=SalesForYou&count=1&exclude=SFY-7K2Q,SFY-9H3T`

**Logic**

1. Split the name on camel case and non-alphanumerics ("SalesForYou" → Sales, For, You).
2. Prefix: initials when there are several words (`SFY`), else the first 4 letters. Letters only, upper case, max 4. Pad to 2 with `JX` if shorter.
3. Append `-` and 4 random characters from `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0, O, 1, I or L) using `crypto.randomInt`.
4. Drop any candidate that exists in `referral_codes` or in `exclude`; retry up to 20 times per requested code.
5. A suggestion is not reserved. A1 / A4 re-check uniqueness on save.

**Response `200 OK`**

```json
{ "suggestions": ["SFY-2B9D"] }
```

**Errors:** `400 VALIDATION_FAILED` (neither or both of `ownerName`/`ownerId`), `404 SALES_OWNER_NOT_FOUND`, `503 CODE_SUGGESTION_FAILED`, `403 FORBIDDEN`.

### A10. Check code availability

`GET /api/v1/admin/sales-referrals/codes/availability?code=SFY-7K2Q`

**Purpose:** Live feedback while the admin types a code, before Save.

**Used by:** New owner and Add code dialogs → Code field (debounced about 300 ms). Duplicates between rows of the same form are checked in the frontend.

**Logic**

1. Normalise the code.
2. Format fails → `INVALID_FORMAT`.
3. Exists in `referral_codes` (any status) → `TAKEN`.
4. Otherwise → `AVAILABLE`.

**Response `200 OK`** (always 200; the status carries the result)

```json
{ "code": "SFY-7K2Q", "status": "AVAILABLE" }
```

`status` is one of `AVAILABLE`, `TAKEN`, `INVALID_FORMAT`.

**Errors:** `400 VALIDATION_FAILED` (missing `code`), `403 FORBIDDEN`.

### A11. Search codes (picker)

`GET /api/v1/admin/sales-referrals/codes`

**Purpose:** Feeds the searchable code picker in the Set referral code dialog. Inactive codes are included because the signup may have happened while they were active.

**Used by:** User detail → **Set referral code** / **Change** → picker typing.

**Query parameters**

| Param | Type | Required | Rule |
| --- | --- | --- | --- |
| `search` | string | No | Matches code or owner name, case-insensitive |
| `includeInactive` | boolean | No | Default `true` |
| `limit` | int | No | 1–50, default 20 |

**Logic**

1. Join `referral_codes` with `sales_owners`.
2. Filter with `code ILIKE %search%` OR `owner.name ILIKE %search%`.
3. Order by owner name, then active first, then code.
4. Group rows by owner in the response.

**Response `200 OK`**

```json
{
  "groups": [
    {
      "owner": { "id": "4f1c...", "name": "SalesForYou", "internal": false },
      "codes": [
        { "id": "c-01...", "code": "SFY-7K2Q", "label": "Delhi campaign", "active": true },
        { "id": "c-02...", "code": "SFY-9H3T", "label": "Mumbai", "active": true },
        { "id": "c-04...", "code": "SFY-4N6W", "label": "Pune", "active": true },
        { "id": "c-03...", "code": "SFY-2B9D", "label": "Pune", "active": false }
      ]
    }
  ]
}
```

**Errors:** `403 FORBIDDEN`.

---

## 5. Report APIs

Four read-only APIs power every number on the Sales Referrals pages. All four share one base query and the plan status expression in 2.3, so a number on one screen always equals the matching count on another.

Shared base query:

```sql
FROM tenant_referrals tr
JOIN tenants t              ON t.id = tr.tenant_id
LEFT JOIN referral_codes rc ON rc.id = tr.code_id
LEFT JOIN sales_owners so   ON so.id = rc.owner_id
WHERE (:from IS NULL OR tr.signed_up_at >= :from)
  AND (:to   IS NULL OR tr.signed_up_at <  :to + INTERVAL '1 day')
```

Shared query parameters (A12–A15):

| Param | Type | Default | Rule |
| --- | --- | --- | --- |
| `from` | date | none | Inclusive signup date |
| `to` | date | none | Inclusive signup date; must be on or after `from` |
| `type` | enum | `ALL` | `ALL`, `INTERNAL`, `OUTSOURCED` (A12, A13 only) |

### A12. Summary cards

`GET /api/v1/admin/sales-referrals/reports/summary`

**Purpose:** Returns the six headline numbers at the top of the overview page.

**Used by:** Overview → page load, Signup date filter, All / Internal / Outsourced toggle.

Example: `GET .../reports/summary?from=2026-09-01&to=2026-10-12&type=ALL`

**Logic**

1. Run the base query with the plan status expression in a subquery.
2. Apply `type`: `INTERNAL` → `so.internal = true`; `OUTSOURCED` → `so.internal = false`. Either one removes Direct rows.
3. Aggregate in one pass with `COUNT(*) FILTER (WHERE ...)`: total, via code (`code_id IS NOT NULL`), Direct, and Free / Paid / Lapsed both overall and via code.
4. Return `trackingSince` from `.env` (`REFERRALS_TRACKING_SINCE`, the go-live date) so the page can show "Tracking since".

**Response `200 OK`**

```json
{
  "trackingSince": "2026-08-28",
  "filters": { "from": "2026-09-01", "to": "2026-10-12", "type": "ALL" },
  "totalSignups": 179,
  "viaCode": 83,
  "direct": 96,
  "free":   { "total": 124, "viaCode": 54 },
  "paid":   { "total": 51,  "viaCode": 27 },
  "lapsed": { "total": 4,   "viaCode": 2 },
  "paidPercent": 28
}
```

**Errors:** `400 VALIDATION_FAILED` (bad date, `to` before `from`, unknown `type`), `403 FORBIDDEN`.

### A13. Owners table

`GET /api/v1/admin/sales-referrals/reports/owners`

**Purpose:** One row per sales owner with signups, plan mix and Paid %, plus a Direct row for comparison.

**Used by:** Overview → page load, filters, **Search sales owner…**, column sort, **Open**.

**Extra query parameters**

| Param | Type | Default | Rule |
| --- | --- | --- | --- |
| `search` | string | none | Owner name contains, case-insensitive |
| `sort` | enum | `signups` | `name`, `signups`, `free`, `paid`, `lapsed`, `paidPercent` |
| `direction` | enum | `desc` | `asc`, `desc` |

**Logic**

1. Start from `sales_owners` and LEFT JOIN codes, then signups, so owners with zero signups still appear.
2. Put the date filter inside the LEFT JOIN condition, not in `WHERE`; otherwise zero-signup owners disappear when a date range is set.
3. Apply `type` and `search` to `sales_owners`.
4. `GROUP BY so.id` and count signups, Free, Paid, Lapsed; compute `paidPercent`.
5. Compute `codes.active` / `codes.total` in a separate subquery. Code counts ignore the date range.
6. Build the Direct row from `code_id IS NULL`. Return `direct: null` when `type` is not `ALL`.
7. Return `ownerCountAll` (owners ignoring search and filters) so the page can tell "no owners yet" (empty state) apart from "no search results".
8. Not paginated; owner count is expected to stay small.

**Response `200 OK`**

```json
{
  "ownerCountAll": 4,
  "codeCountAll": 8,
  "owners": [
    {
      "id": "4f1c...", "name": "SalesForYou", "internal": false,
      "createdAt": "2026-09-02T11:05:00+05:30",
      "codes": { "active": 3, "total": 4 },
      "signups": 34, "free": 22, "paid": 11, "lapsed": 1, "paidPercent": 32
    },
    {
      "id": "9a7b...", "name": "Ravi Sharma", "internal": true,
      "createdAt": "2026-08-28T10:00:00+05:30",
      "codes": { "active": 1, "total": 1 },
      "signups": 21, "free": 12, "paid": 8, "lapsed": 1, "paidPercent": 38
    }
  ],
  "direct": { "signups": 96, "free": 70, "paid": 24, "lapsed": 2, "paidPercent": 25 }
}
```

**Errors:** `400 VALIDATION_FAILED`, `403 FORBIDDEN`.

### A14. Per-code breakdown for an owner

`GET /api/v1/admin/sales-referrals/reports/owners/{ownerId}/codes`

**Purpose:** Splits one owner's results by code for the owner detail page: four stat cards and the codes table.

**Used by:** Owner detail → page load, Signup date filter; reloaded after Add code, Refresh, Activate and Deactivate.

Example: `GET .../reports/owners/4f1c.../codes?from=2026-09-01`

**Logic**

1. Load the owner; if missing, `404 SALES_OWNER_NOT_FOUND`.
2. Start from that owner's `referral_codes` and LEFT JOIN signups with the date filter in the join condition, so every code is listed even with zero signups.
3. `GROUP BY rc.id`; count signups, Free, Paid, Lapsed; compute `paidPercent`.
4. Sum the code rows into `totals` for the stat cards.
5. Order codes the same way as A3 (active first, newest first).

**Response `200 OK`**

```json
{
  "owner": { "id": "4f1c...", "name": "SalesForYou", "internal": false },
  "totals": { "signups": 34, "free": 22, "paid": 11, "lapsed": 1, "paidPercent": 32 },
  "codes": [
    { "id": "c-01...", "code": "SFY-7K2Q", "label": "Delhi campaign", "active": true,  "replacedByCode": null,
      "signups": 18, "free": 11, "paid": 6, "lapsed": 1, "paidPercent": 33 },
    { "id": "c-02...", "code": "SFY-9H3T", "label": "Mumbai",         "active": true,  "replacedByCode": null,
      "signups": 9,  "free": 6,  "paid": 3, "lapsed": 0, "paidPercent": 33 },
    { "id": "c-04...", "code": "SFY-4N6W", "label": "Pune",           "active": true,  "replacedByCode": null,
      "signups": 2,  "free": 2,  "paid": 0, "lapsed": 0, "paidPercent": 0 },
    { "id": "c-03...", "code": "SFY-2B9D", "label": "Pune",           "active": false, "replacedByCode": "SFY-4N6W",
      "signups": 5,  "free": 3,  "paid": 2, "lapsed": 0, "paidPercent": 40 }
  ]
}
```

**Errors:** `400 VALIDATION_FAILED`, `404 SALES_OWNER_NOT_FOUND`, `403 FORBIDDEN`.

### A15. Signups list

`GET /api/v1/admin/sales-referrals/reports/signups`

**Purpose:** Lists the workspaces behind any signup number, with each workspace's current plan status, seats and verification.

**Used by:** Signups list page → page load, **All / Free / Paid / Lapsed** tabs, **Search firm or email…**, Signup date filter, **Previous / Next**.

**Extra query parameters**

| Param | Type | Required | Rule |
| --- | --- | --- | --- |
| `codeId` | UUID | Exactly one of the three | Signups under one code |
| `ownerId` | UUID | Exactly one of the three | Signups under all of an owner's codes |
| `direct` | boolean | Exactly one of the three | `true` = signups with no code |
| `status` | enum | No | `FREE`, `PAID`, `LAPSED`; omitted = all |
| `search` | string | No | Firm name or owner email contains, case-insensitive |
| `page`, `size` | int | No | See 2.6 |

Example: `GET .../reports/signups?codeId=c-01...&status=PAID&page=0&size=20`

**Logic**

1. Require exactly one scope (`codeId`, `ownerId` or `direct=true`); validate that the code or owner exists.
2. Apply scope, dates and `search` to the base query.
3. Compute `statusCounts` at this point, **before** the `status` filter, so every tab shows its own count.
4. Apply `status`, sort by `signed_up_at` descending, then paginate.
5. For each workspace, resolve the owner user (the workspace's first admin). If that user deleted their account, return `ownerEmail: null` and `ownerAccountDeleted: true`; the UI shows "Account deleted".
6. `seats` = count of active users in the tenant. `emailVerified` = the owner user's verification flag.
7. Return `source` (`SIGNUP` or `ADMIN`) so admin-attached workspaces can be marked.

**Response `200 OK`**

```json
{
  "scope": {
    "type": "CODE",
    "code": { "id": "c-01...", "code": "SFY-7K2Q", "label": "Delhi campaign", "active": true },
    "owner": { "id": "4f1c...", "name": "SalesForYou", "internal": false }
  },
  "statusCounts": { "all": 18, "free": 11, "paid": 6, "lapsed": 1 },
  "items": [
    {
      "tenantId": "t-11...",
      "firmName": "Kapoor Law Chambers",
      "ownerEmail": "a.kapoor@example.com",
      "ownerAccountDeleted": false,
      "signedUpAt": "2026-10-05T14:22:00+05:30",
      "code": "SFY-7K2Q",
      "planStatus": "PAID",
      "seats": 4,
      "emailVerified": true,
      "source": "SIGNUP"
    }
  ],
  "page": 0, "size": 20, "totalItems": 6, "totalPages": 1
}
```

`scope.type` is `CODE`, `OWNER` or `DIRECT`; `code` and `owner` are `null` where they do not apply.

**Errors:** `400 VALIDATION_FAILED` (no scope or more than one), `404 REFERRAL_CODE_NOT_FOUND`, `404 SALES_OWNER_NOT_FOUND`, `403 FORBIDDEN`.

---

## 6. Workspace referral APIs

One new API sets a workspace's referral, and the existing admin user-detail response gains a `referral` block to show it. Both return the same **referral block**:

```json
{
  "referredBy": "CODE",
  "tracked": true,
  "code": { "id": "c-01...", "code": "SFY-7K2Q", "label": "Delhi campaign", "active": true },
  "owner": { "id": "4f1c...", "name": "SalesForYou", "internal": false },
  "source": "ADMIN",
  "signedUpAt": "2026-09-14T09:30:00+05:30",
  "setBy": { "id": "a1b2...", "name": "Super Admin" },
  "setAt": "2026-10-09T16:12:00+05:30",
  "reason": "Customer confirmed on a call that SalesForYou onboarded them; they signed up without the link."
}
```

| Field | Meaning |
| --- | --- |
| `referredBy` | `CODE` or `DIRECT` |
| `tracked` | `false` when the workspace has no `tenant_referrals` row (created before go-live or contract-provisioned), so it is not in reports |
| `code`, `owner` | `null` when Direct |
| `source` | `SIGNUP` (saved at register) or `ADMIN` (set via A16); `null` when not tracked |
| `setBy`, `setAt`, `reason` | Present only when `source` is `ADMIN` |

### A16. Set or change a workspace's referral code

`PUT /api/v1/admin/sales-referrals/tenants/{tenantId}/referral`

**Purpose:** Attributes a workspace to a code after the fact, for example when a customer signed up without the link or under the wrong code. The change applies to the whole workspace and is recorded with who, when and why.

**Used by:** User detail → **Set referral code** or **Change** → **Save**.

**Request body**

| Field | Type | Required | Rule |
| --- | --- | --- | --- |
| `codeId` | UUID | Yes | Any existing code, active or inactive |
| `reason` | string | Yes | 5–500 chars |

```json
{
  "codeId": "c-01...",
  "reason": "Customer confirmed on a call that SalesForYou onboarded them; they signed up without the link."
}
```

**Logic** (one transaction)

1. Load the tenant; if missing, `404 TENANT_NOT_FOUND`.
2. Validate `reason` (`REASON_REQUIRED` if blank).
3. Load the code; if missing, `404 REFERRAL_CODE_NOT_FOUND`. Inactive codes are allowed because the signup may have happened while the code was active.
4. Upsert `tenant_referrals` with `INSERT ... ON CONFLICT (tenant_id) DO UPDATE`:
    - `code_id` = the chosen code
    - `source` = `ADMIN`
    - `set_by` = current super admin, `set_at` = now, `reason` = request reason
    - `signed_up_at`: kept if the row exists; otherwise taken from `tenants.created_at`
5. A workspace without a row (pre-go-live or contract-provisioned) gets one, which brings it into the reports from that point.
6. Write the previous and new code to the existing audit log table so earlier attributions are not lost.
7. Return the referral block. Reports reflect the change on their next load.

**Response `200 OK`:** the referral block with `"source": "ADMIN"`.

**Errors:** `400 VALIDATION_FAILED`, `400 REASON_REQUIRED`, `404 TENANT_NOT_FOUND`, `404 REFERRAL_CODE_NOT_FOUND`, `403 FORBIDDEN`.

### A17. Referral block on admin user detail

Existing admin user-detail endpoint (path and other fields unchanged).

**Purpose:** Shows "Referred by" and, for admin-set referrals, who set it, when and why, on the Referral card.

**Used by:** User detail → page load; reloaded after A16 succeeds.

**Logic**

1. From the user, take their `tenant_id`.
2. LEFT JOIN `tenant_referrals`, `referral_codes` and `sales_owners` in the existing query (or a second small query).
3. No row → `referredBy: DIRECT`, `tracked: false`.
4. Row with `code_id` null → `referredBy: DIRECT`, `tracked: true`.
5. Row with a code → `referredBy: CODE` with code and owner.
6. Resolve `set_by` to the admin's display name.

**Response change** (added to the existing payload)

```json
{
  "...existing user-detail fields...": "unchanged",
  "referral": {
    "referredBy": "DIRECT",
    "tracked": true,
    "code": null,
    "owner": null,
    "source": "SIGNUP",
    "signedUpAt": "2026-10-03T12:00:00+05:30",
    "setBy": null,
    "setAt": null,
    "reason": null
  }
}
```

The field is additive, so older frontends that ignore it keep working.

---

## 7. Error code catalogue

The frontend maps each `errorCode` to a UI message; the suggested text is below.

| HTTP | `errorCode` | Raised by | When | Suggested UI message |
| --- | --- | --- | --- | --- |
| 400 | `VALIDATION_FAILED` | All | Missing or malformed field or parameter | Field-specific message from `details` |
| 400 | `TOO_MANY_CODES` | A1 | 0 codes or more than 10 | Add 1 to 10 codes. |
| 400 | `REFERRAL_CODE_INVALID_FORMAT` | A1, A4 | Fails `^[A-Z0-9-]{6,20}$` | Use A–Z, 0–9 and "-", 6–20 characters. |
| 400 | `REFERRAL_CODE_DUPLICATE_IN_REQUEST` | A1 | Same code twice in one form | Same as code N. |
| 400 | `REASON_REQUIRED` | A16 | Reason blank or too short | Please give a reason. |
| 403 | `FORBIDDEN` | All | Caller is not a super admin | You don't have access to this page. |
| 404 | `SALES_OWNER_NOT_FOUND` | A2, A3, A4, A9, A14, A15 | Unknown owner ID | This sales owner no longer exists. |
| 404 | `REFERRAL_CODE_NOT_FOUND` | A5–A8, A15, A16 | Unknown code ID | This code no longer exists. |
| 404 | `TENANT_NOT_FOUND` | A16 | Unknown workspace ID | This workspace no longer exists. |
| 409 | `SALES_OWNER_NAME_TAKEN` | A1, A2 | Name already used, ignoring case | A sales owner with this name already exists. |
| 409 | `REFERRAL_CODE_TAKEN` | A1, A4 | Code exists in any status, or lost a concurrent race | Already in use. Pick another code. |
| 409 | `REFERRAL_CODE_REPLACED` | A7 | Activating a refreshed code | This code was refreshed and can't be reactivated. |
| 409 | `REFERRAL_CODE_NOT_ACTIVE` | A8 | Refreshing an inactive code | Only active codes can be refreshed. |
| 503 | `CODE_SUGGESTION_FAILED` | A8, A9 | No free code after all retries | Couldn't generate a code. Try again. |

---

## 8. Open decisions and assumptions

This document assumes the recommended defaults from the estimate; the items below need a confirmed answer before build.

- [ ] **F1 — Unverified signups:** they leave the reports when the pending-tenant cleanup job deletes them after 24 hours. Alternative (+0.5 h) keeps an anonymous row and a "Never verified" count.
- [ ] **F2 — Tracking start:** reports cover self-signups from go-live; older and contract-provisioned workspaces enter only through A16. Set the go-live date as `REFERRALS_TRACKING_SINCE` in `.env`.
- [ ] **authdb schema names:** table and column names for workspaces and users (`tenants`, `subscription_plan`, `subscription_status`, `previous_paid_plan`, `billing_source`) come from the estimate. Confirm them against the actual authdb schema.
- [ ] **A7 — Reactivating refreshed codes:** blocked with `REFERRAL_CODE_REPLACED`. Confirm, or allow it.
- [ ] **A8 — Refreshing inactive codes:** blocked with `REFERRAL_CODE_NOT_ACTIVE`. Confirm, or allow it.
- [ ] **A16 — Clearing back to Direct:** not supported; `codeId` is required. Confirm whether an admin should be able to remove a wrong attribution entirely.
- [ ] **Error envelope:** examples assume `errorCode` / `message` / `details` / `timestamp`. Align with the backend's actual error format.
- [ ] **A17 path:** the existing admin user-detail endpoint keeps its current path; only the `referral` field is added.
- [ ] **Date filters:** evaluated in Asia/Kolkata. Confirm this matches other admin reports.

---

## 9. Implementation notes (super-admin-dev backend, 2026-10-12)

All 17 APIs are implemented in this repository. Where the backend's real schema or conventions differ from the assumptions in sections 1–8, the implementation follows the backend and the difference is listed here.

### 9.1 Files

| Layer | File |
| --- | --- |
| Routes | `Backend/src/modules/referrals/salesReferrals.routes.js` |
| Controller (validation, envelope, logging) | `Backend/src/modules/referrals/salesReferrals.controller.js` |
| Owners / codes / workspace referral | `Backend/src/modules/referrals/salesReferrals.service.js` |
| Reports (A12–A15) | `Backend/src/modules/referrals/referralReports.service.js` |
| Migration (idempotent, also run at server start) | `Backend/database/migrations/create_sales_referrals_tables.sql`, `npm run migrate:sales-referrals` |
| Tests | `npm run test:admin-api` → group **K) Sales Referrals** in `Backend/tests/run_admin_api_tests.js` |

### 9.2 Differences from the draft above

| Topic | Draft said | Implemented |
| --- | --- | --- |
| Base path | `/api/v1/admin/sales-referrals` | `/api/admin/sales-referrals` (repo convention). `/api/v1/admin/sales-referrals` is mounted as an alias to the same router. |
| Auth | super-admin only | `adminAuth.middleware` (static `ADMIN_TOKEN` or dashboard JWT) + role gate: `super-admin` and the legacy generic `admin` role. Every other role → `403 FORBIDDEN`. |
| Envelope | bare object / `errorCode` | Backend envelope: success `{ "success": true, "data": … }`; error `{ "success": false, "error": { "code", "message", "details"? }, "requestId" }`. Error codes are exactly those in section 7, plus `VALIDATION_FAILED` for Joi failures. |
| Workspace table | `tenants` | **`firms`**. `tenant_referrals.tenant_id` → `firms.id` (`ON DELETE CASCADE`). `firmName` = `firms.firm_name`; owner user = `firms.admin_user_id`. |
| Actor ids | UUID | `super_admins.id` and `users.id` are **integers**; `created_by` / `updated_by` / `set_by` are `INTEGER`. Requests made with the static `ADMIN_TOKEN` store `null`. `createdBy` / `setBy` resolve to `{ id, name }` from `super_admins`. |
| Plan status (2.3) | `billing_source`, `subscription_plan`, … on tenants | Classified from the workspace's admin user: **PAID** when `users.active_plan_name` is set and not a free plan name; **LAPSED** when not paid but the user has a `user_subscriptions` row; else **FREE**. Free names come from `REFERRALS_FREE_PLAN_NAMES` (default `Free,Free Trial,Trial`, case-insensitive). |
| `emailVerified` (A15) | owner user's verification flag | `users.approval_status = 'APPROVED'` (the users table has no email-verified column). |
| `seats` (A15) | active users in the tenant | Distinct active users among `firms.admin_user_id` ∪ `firm_users.user_id`. |
| A16 audit (step 6) | "existing audit log table" | New table `tenant_referral_history` (previous code, new code, previous source, reason, admin, time). The response also returns `previous: { codeId, source }`. |
| A17 | referral block added to the existing user-detail endpoint | This repo has no user-detail endpoint, so the block is exposed on its own: `GET /tenants/{tenantId}/referral` and `GET /users/{userId}/referral` (resolves the user's workspace through `firms` / `firm_users`). Both return `{ tenantId, firmName, referral }`. The signup-side service can embed the same block in its user-detail payload. |
| Timestamps | ISO with offset | ISO with `+05:30` offset, e.g. `2026-10-12T13:10:00+05:30`. |
| List responses | `{ items, page, size, totalItems, totalPages }` | Same, inside `data`; `page` is 0-based, `size` 1–100 (default 20). Each report also echoes `filters`. |

### 9.3 Environment

| Variable | Purpose | Default |
| --- | --- | --- |
| `REFERRALS_TRACKING_SINCE` | Go-live date returned as `trackingSince` by A12 | unset → `null` |
| `REFERRALS_FREE_PLAN_NAMES` | Comma-separated plan names counted as FREE | `Free,Free Trial,Trial` |

### 9.4 Not in this repository

- Public signup APIs (code status check, register) that insert `tenant_referrals` rows with `source = SIGNUP` live in the signup-side auth service. Until they exist, reports only contain workspaces attached through A16.
- A workspace with no `tenant_referrals` row answers `referredBy: DIRECT, tracked: false`.

### 9.5 All referral data screen (2026-10-13)

The "All referral data" page (one row per workspace / solo user with owner, code, attribution, seats, current plan, plan history; Plan purchases tab; CSV export with kind / scope / column selection) is served by `/api/admin/sales-referrals/data` — see [REFERRAL_DATA_API.md](REFERRAL_DATA_API.md).
