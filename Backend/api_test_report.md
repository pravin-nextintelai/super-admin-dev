# Admin Dashboard API — Test Report

**Generated:** 2026-10-13T04:47:08.092Z  
**Base URL:** `http://localhost:4010`  
**Admin Token:** `[REDACTED]`  

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 106 |
| ✅ Passed | 92 |
| ❌ Failed | 14 |
| Avg Latency | 129ms |

### All Tests

| # | Method | Endpoint | Expected | Actual | Result | Latency |
|---|--------|----------|----------|--------|--------|--------|
| 1 | GET | `/api/admin/overview` | 200 + { success: true, data: { total_judgments, ... } } | 404 | ❌ FAIL | 3ms |
| 2 | GET | `/api/admin/hitl` | 200 + data.tasks array | 404 | ❌ FAIL | 4ms |
| 3 | GET | `/api/admin/hitl/00000000-0000-0000-0000-000000000000` | 404 | 404 | ✅ PASS | 1ms |
| 4 | POST | `/api/admin/hitl/1/action` | 400 | 404 | ❌ FAIL | 4ms |
| 5 | GET | `/api/admin/pipeline/summary` | 200 + object | 404 | ❌ FAIL | 1ms |
| 6 | GET | `/api/admin/pipeline/items` | 200 + paginated list | 404 | ❌ FAIL | 2ms |
| 7 | GET | `/api/admin/pipeline/errors` | 200 | 404 | ❌ FAIL | 1ms |
| 8 | GET | `/api/admin/routesdb/summary` | 200 | 404 | ❌ FAIL | 2ms |
| 9 | GET | `/api/admin/routesdb/top-cited` | 200 + array | 404 | ❌ FAIL | 1ms |
| 10 | GET | `/api/admin/routesdb/courts-breakdown` | 200 | 404 | ❌ FAIL | 1ms |
| 11 | GET | `/api/admin/business/summary` | 200 | 404 | ❌ FAIL | 1ms |
| 12 | GET | `/api/admin/business/reports-per-day` | 200 + array | 404 | ❌ FAIL | 2ms |
| 13 | GET | `/api/admin/business/top-users` | 200 + array | 404 | ❌ FAIL | 1ms |
| 14 | GET | `/api/admin/users` | 200 + data.users array | 200 | ✅ PASS | 76ms |
| 15 | GET | `/api/admin/users/pending` | 200 | 200 | ✅ PASS | 36ms |
| 16 | GET | `/api/admin/users/stats` | 200 | 200 | ✅ PASS | 36ms |
| 17 | POST | `/api/admin/users/115/approve` | 200 | 200 | ✅ PASS | 38ms |
| 18 | POST | `/api/admin/users/115/block` | 200 | 200 | ✅ PASS | 37ms |
| 19 | POST | `/api/admin/users/115/unblock` | 200 | 200 | ✅ PASS | 33ms |
| 20 | POST | `/api/public/contact` | 201 + data.reference_no + data.submitted_at_ist | 201 | ✅ PASS | 221ms |
| 21 | GET | `/api/admin/contact-enquiries/stats` | 200 + data.totals | 200 | ✅ PASS | 40ms |
| 22 | GET | `/api/admin/contact-enquiries/meta` | 200 + data.statuses | 200 | ✅ PASS | 37ms |
| 23 | GET | `/api/admin/contact-enquiries` | 200 + data.enquiries[] | 200 | ✅ PASS | 73ms |
| 24 | GET | `/api/admin/contact-enquiries/35` | 200 + data.enquiry + data.activities | 200 | ✅ PASS | 68ms |
| 25 | POST | `/api/admin/contact-enquiries/35/contact-log` | 200 + enquiry.first_contacted_at_ist | 200 | ✅ PASS | 201ms |
| 26 | PATCH | `/api/admin/contact-enquiries/35` | 200 + enquiry.status = closed | 200 | ✅ PASS | 223ms |
| 27 | GET | `/api/admin/contact-enquiries/export` | 200 text/csv | 200 | ✅ PASS | 67ms |
| 28 | DELETE | `/api/admin/contact-enquiries/35` | 200 | 200 | ✅ PASS | 35ms |
| 29 | GET | `/api/admin/error-logs/stats` | 200 + data.totals, daily_trend[], by_service[], top_issues[], top_users[] | 200 | ✅ PASS | 259ms |
| 30 | GET | `/api/admin/error-logs/meta` | 200 + data.vocab, data.used.services[], data.permissions | 200 | ✅ PASS | 37ms |
| 31 | GET | `/api/admin/error-logs` | 200 + data.logs[], data.pagination | 200 | ✅ PASS | 112ms |
| 32 | GET | `/api/admin/error-logs` | 200 + only rows for that service | 200 | ✅ PASS | 114ms |
| 33 | GET | `/api/admin/error-logs` | 200 + every row is_resolved=false | 200 | ✅ PASS | 141ms |
| 34 | GET | `/api/admin/error-logs` | 200 + every row origin=browser with client{} | 200 | ✅ PASS | 113ms |
| 35 | GET | `/api/admin/error-logs` | 200 + no row with is_debug=true + total = stats.total - stats.debug | 200 | ✅ PASS | 213ms |
| 36 | GET | `/api/admin/error-logs` | 200 + filters.search, filters.resolved=false, filters.http_method[] | 200 | ✅ PASS | 124ms |
| 37 | GET | `/api/admin/error-logs` | 200 + logs=[] total=0 | 200 | ✅ PASS | 81ms |
| 38 | GET | `/api/admin/error-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 5ms |
| 39 | GET | `/api/admin/error-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 3ms |
| 40 | GET | `/api/admin/error-logs/users` | 200 + data.users[], data.pagination | 200 | ✅ PASS | 102ms |
| 41 | GET | `/api/admin/error-logs/issues` | 200 + data.issues[] | 200 | ✅ PASS | 44ms |
| 42 | GET | `/api/admin/error-logs/export` | 200 text/csv with header row | 200 | ✅ PASS | 178ms |
| 43 | GET | `/api/admin/error-logs/not-a-uuid` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 2ms |
| 44 | GET | `/api/admin/error-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 37ms |
| 45 | GET | `/api/admin/error-logs/8de3c18b-1d1f-4c31-9686-bac2152332b9` | 200 + data.log (with stack_trace, payload, origin), data.issue, data.audit, data.related | 200 | ✅ PASS | 137ms |
| 46 | PATCH | `/api/admin/error-logs/8de3c18b-1d1f-4c31-9686-bac2152332b9/resolve` | 200 + data.log.is_resolved=true | 200 | ✅ PASS | 136ms |
| 47 | PATCH | `/api/admin/error-logs/8de3c18b-1d1f-4c31-9686-bac2152332b9/resolve` | 200 + data.log.is_resolved=false | 200 | ✅ PASS | 139ms |
| 48 | PATCH | `/api/admin/error-logs/resolve` | 200 + data.changed=1 | 200 | ✅ PASS | 38ms |
| 49 | PATCH | `/api/admin/error-logs/resolve` | 200 + data.changed>=1 | 200 | ✅ PASS | 38ms |
| 50 | PATCH | `/api/admin/error-logs/resolve-fingerprint` | 200 + data.resolved=true, occurrences.unresolved=0 | 200 | ✅ PASS | 73ms |
| 51 | PATCH | `/api/admin/error-logs/resolve` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 4ms |
| 52 | POST | `/api/admin/error-logs/bulk-delete` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 2ms |
| 53 | DELETE | `/api/admin/error-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 35ms |
| 54 | GET | `/api/admin/audit-logs/summary` | 200 + data.totals, per_service[], top_endpoints[], top_users[] | 200 | ✅ PASS | 109ms |
| 55 | GET | `/api/admin/audit-logs/meta` | 200 + data.used.services[], data.vocab | 200 | ✅ PASS | 40ms |
| 56 | GET | `/api/admin/audit-logs` | 200 + data.rows[], data.total, no ping rows, no stack_trace | 200 | ✅ PASS | 75ms |
| 57 | GET | `/api/admin/audit-logs` | 200 + total >= default total | 200 | ✅ PASS | 142ms |
| 58 | GET | `/api/admin/audit-logs` | 200 + every row status=FAILED | 200 | ✅ PASS | 115ms |
| 59 | GET | `/api/admin/audit-logs` | 200 + rows only with those codes, slowest first | 200 | ✅ PASS | 111ms |
| 60 | GET | `/api/admin/audit-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 4ms |
| 61 | GET | `/api/admin/audit-logs/export` | 200 text/csv with header row | 200 | ✅ PASS | 105ms |
| 62 | GET | `/api/admin/audit-logs/not-a-uuid` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 3ms |
| 63 | GET | `/api/admin/audit-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 35ms |
| 64 | GET | `/api/admin/audit-logs/a08f2ff4-4628-4f5b-9ca1-3efc01060790` | 200 + data.audit (with stack_trace), data.error (linked error_logs row or null), data.errors[] | 200 | ✅ PASS | 141ms |
| 65 | GET | `/api/admin/sales-referrals/reports/summary` | 200 + data.totalSignups, viaCode, direct, free/paid/lapsed, paidPercent | 200 | ✅ PASS | 37ms |
| 66 | GET | `/api/admin/sales-referrals/reports/summary` | 400 VALIDATION_FAILED | 400 | ✅ PASS | 4ms |
| 67 | GET | `/api/admin/sales-referrals/reports/owners` | 200 + data.owners[], data.direct, ownerCountAll | 200 | ✅ PASS | 103ms |
| 68 | GET | `/api/admin/sales-referrals/reports/owners` | 200 + data.direct === null | 200 | ✅ PASS | 70ms |
| 69 | GET | `/api/admin/sales-referrals/codes` | 200 + data.groups[].owner + codes[] | 200 | ✅ PASS | 48ms |
| 70 | GET | `/api/admin/sales-referrals/codes/suggest` | 200 + data.suggestions[2] matching SFY-XXXX | 200 | ✅ PASS | 67ms |
| 71 | GET | `/api/admin/sales-referrals/codes/suggest` | 400 VALIDATION_FAILED | 400 | ✅ PASS | 2ms |
| 72 | GET | `/api/admin/sales-referrals/codes/availability` | 200 + data.status === INVALID_FORMAT | 200 | ✅ PASS | 2ms |
| 73 | GET | `/api/admin/sales-referrals/codes/availability` | 200 + data.status === AVAILABLE + upper-cased code | 200 | ✅ PASS | 33ms |
| 74 | GET | `/api/admin/sales-referrals/reports/signups` | 200 + data.scope.type === DIRECT, statusCounts, items[] | 200 | ✅ PASS | 68ms |
| 75 | GET | `/api/admin/sales-referrals/reports/summary` | 200 + data.byTenantType { FIRM, SOLO } summing to totalSignups | 200 | ✅ PASS | 37ms |
| 76 | GET | `/api/admin/sales-referrals/reports/signups` | 200 + every item.tenantType === SOLO | 200 | ✅ PASS | 67ms |
| 77 | GET | `/api/admin/sales-referrals/reports/signups` | 400 VALIDATION_FAILED | 400 | ✅ PASS | 5ms |
| 78 | GET | `/api/admin/sales-referrals/tenants/2147483000/referral` | 404 TENANT_NOT_FOUND | 404 | ✅ PASS | 35ms |
| 79 | GET | `/api/admin/sales-referrals/tenants/110/referral` | 200 + data.tenantType === SOLO, referral.tracked | 200 | ✅ PASS | 145ms |
| 80 | GET | `/api/admin/sales-referrals/reports/signups` | 400 VALIDATION_FAILED | 400 | ✅ PASS | 4ms |
| 81 | GET | `/api/admin/sales-referrals/owners/00000000-0000-0000-0000-000000000000` | 404 SALES_OWNER_NOT_FOUND | 404 | ✅ PASS | 38ms |
| 82 | GET | `/api/admin/sales-referrals/owners/3311a5ee-2121-44ed-b7cc-aa16dd07374d` | 200 + data.codes[], codeCounts | 200 | ✅ PASS | 98ms |
| 83 | GET | `/api/admin/sales-referrals/reports/owners/3311a5ee-2121-44ed-b7cc-aa16dd07374d/codes` | 200 + data.totals, data.codes[] | 200 | ✅ PASS | 66ms |
| 84 | GET | `/api/admin/sales-referrals/reports/signups` | 200 + data.scope.type === CODE | 200 | ✅ PASS | 108ms |
| 85 | POST | `/api/admin/sales-referrals/owners` | 400 VALIDATION_FAILED | 400 | ✅ PASS | 6ms |
| 86 | PUT | `/api/admin/sales-referrals/tenants/00000000-0000-0000-0000-000000000000/referral` | 404 TENANT_NOT_FOUND | 404 | ✅ PASS | 104ms |
| 87 | GET | `/api/admin/onboarded-users/summary` | 200 + totals, by_channel (3 buckets summing to totals.users), by_owner[], by_plan[] | 200 | ✅ PASS | 80ms |
| 88 | GET | `/api/admin/onboarded-users/meta` | 200 + channels[], sales_owners[], monthly_plans[] | 200 | ✅ PASS | 38ms |
| 89 | GET | `/api/admin/onboarded-users` | 200 + users[] with onboarding, plan, subscription_summary | 200 | ✅ PASS | 91ms |
| 90 | GET | `/api/admin/onboarded-users` | 200 + only INTERNAL / OUTSOURCED users | 200 | ✅ PASS | 77ms |
| 91 | GET | `/api/admin/onboarded-users` | 200 + every user PAID | 200 | ✅ PASS | 108ms |
| 92 | GET | `/api/admin/onboarded-users` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 3ms |
| 93 | GET | `/api/admin/onboarded-users/3` | 200 + user, subscription_history{subscriptions,payments,topups,storage_addons}, timeline[], referral_history[] | 200 | ✅ PASS | 234ms |
| 94 | GET | `/api/admin/onboarded-users/999999999` | 404 NOT_FOUND | 404 | ✅ PASS | 35ms |
| 95 | GET | `/api/admin/onboarded-users/export` | 200 text/csv with onboarding + subscription columns | 200 | ✅ PASS | 89ms |
| 96 | GET | `/api/admin/onboarded-users/export` | 200 text/csv with Event type column and SUBSCRIPTION rows | 200 | ✅ PASS | 1257ms |
| 97 | GET | `/api/admin/sales-referrals/data/summary` | 200 + totals (via_code + direct = accounts), by_owner_type[], by_owner[] | 200 | ✅ PASS | 100ms |
| 98 | GET | `/api/admin/sales-referrals/data/workspaces` | 200 + rows[] with owner / code / attribution / plan / purchases / seats | 200 | ✅ PASS | 83ms |
| 99 | GET | `/api/admin/sales-referrals/data/workspaces` | 200 + every row OUTSOURCED with a code | 200 | ✅ PASS | 76ms |
| 100 | GET | `/api/admin/sales-referrals/data/workspaces/3` | 200 + account, seats[], events[] (first = trial), history{} | 200 | ✅ PASS | 116ms |
| 101 | GET | `/api/admin/sales-referrals/data/purchases` | 200 + rows[] all with amount > 0, totals.amount | 200 | ✅ PASS | 2889ms |
| 102 | GET | `/api/admin/sales-referrals/data/workspaces` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 1ms |
| 103 | GET | `/api/admin/sales-referrals/data/export` | 200 text/csv, header = chosen columns | 200 | ✅ PASS | 75ms |
| 104 | GET | `/api/admin/sales-referrals/data/export` | 200 text/csv with Event kind column and trial rows | 200 | ✅ PASS | 2889ms |
| 105 | GET | `/api/admin/overview` | 401 | 404 | ❌ FAIL | 3ms |
| 106 | GET | `/api/admin/overview` | 403 | 404 | ❌ FAIL | 2ms |

---

## Overview

### Overview

**Purpose:** Dashboard summary: total judgments, verified/unverified counts, confidence distribution, HITL pending, blacklist count, ingestion status, today citations.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/overview"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `3ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

---

## HITL Queue

### HITL List

**Purpose:** List HITL pending tasks with pagination, sortable by priority.

**Inputs:** Query: status, page, pageSize, sort

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/hitl?status=PENDING&page=1&pageSize=5&sort=priority_desc"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `4ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

### HITL Detail

**Purpose:** Get single HITL task detail by ID.

**Inputs:** Params: taskId

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/hitl/00000000-0000-0000-0000-000000000000"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `1ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

### HITL Action (INVALID — expect 400)

**Purpose:** Validate action body — invalid action should return 400.

**Inputs:** Body: { action: "INVALID" }

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/hitl/1/action" -H "Content-Type: application/json" -d '{"action":"INVALID"}'
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `4ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

---

## Data Pipeline

### Pipeline Summary

**Purpose:** Ingestion queue status counts grouped by status.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/pipeline/summary"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `1ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

### Pipeline Items

**Purpose:** List ingestion queue items with filters: status, source, date range, hasError.

**Inputs:** Query: status, hasError, page, pageSize

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/pipeline/items?status=FAILED&hasError=true&page=1&pageSize=5"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

### Pipeline Errors

**Purpose:** Recent ingestion errors.

**Inputs:** Query: limit

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/pipeline/errors?limit=5"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `1ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

---

## Routes & DB

### RoutesDB Summary

**Purpose:** Total judgments, aliases, statutes, verification breakdown.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/routesdb/summary"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

### RoutesDB Top Cited

**Purpose:** Top judgments by citation_frequency.

**Inputs:** Query: limit

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/routesdb/top-cited?limit=5"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `1ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

### RoutesDB Courts Breakdown

**Purpose:** Court distribution grouped by court_tier and court_code.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/routesdb/courts-breakdown"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `1ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

---

## Business Metrics

### Business Summary

**Purpose:** Total reports count and average citations per report.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/business/summary"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `1ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

### Business Reports/Day

**Purpose:** Reports count per day for the last N days.

**Inputs:** Query: days

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/business/reports-per-day?days=7"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

### Business Top Users

**Purpose:** Top users by report count, enriched with email/username from Auth DB.

**Inputs:** Query: limit

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/business/top-users?limit=5"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `1ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

---

## User Management

### Users List

**Purpose:** List users with pagination, filterable by role, approval_status, account_type, search.

**Inputs:** Query: page, pageSize, role, approval_status, account_type, search

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users?page=1&pageSize=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `76ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 115,
        "email": "jesoxel161@18lover.com",
        "username": "Rutuja ",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "SOLO",
        "is_active": true,
        "created_at": "2026-10-12T22:26:19.406Z",
        "phone": "+919503887353",
        "location": null
      },
      {
        "id": 114,
        "email": "vodeye2305@copytosh.com",
        "username": "test",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "SOLO",
        "is_active": true,
        "created_at": "2026-10-12T06:48:19.469Z",
        "phone": "+919863426543",
        "location": null
      },
      {
        "id": 113,
        "email": "doyagag249@leafflip.com",
        "username": "Pravin Sarule",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "SOLO",
        "is_active": true,
        "created_at": "2026-10-12T06:40:17.811Z",
        "phone": "+919634568596",
        "location": null
      },
      {
        "id": 112,
        "email": "firm@gmail.com",
        "username": "Rutuja",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "FIRM_ADMIN",
        "is_active": true,
        "created_at": "2026-10-12T06:27:23.828Z",
        "phone": "8390775699",
        "location": null
      },
      {
        "id": 111,
        "email": "dalalrutuja2004@gmail.com",
        "username": "rutuja",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account
... (truncated)
```
</details>

### Users Pending

**Purpose:** List users with approval_status=PENDING.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/pending"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `36ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": []
  }
}
```
</details>

### Users Stats

**Purpose:** User statistics: total, active, blocked, pending, by account type.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/stats"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `36ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "total_users": 77,
    "active_users": 75,
    "blocked_users": 1,
    "pending_approvals": 0,
    "firm_admin_count": 28,
    "firm_user_count": 5,
    "solo_users": 39
  }
}
```
</details>

### User Approve

**Purpose:** Approve a user: sets approval_status=APPROVED, is_active=true.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/115/approve"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `38ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 115,
      "email": "jesoxel161@18lover.com",
      "username": "Rutuja ",
      "password": "$2b$10$EDw1aHt0v1xWpzGmQycuDOn0xiyJ0Vp6Q9ApngannaS8L63L7vH32",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": false,
      "created_at": "2026-10-12T22:26:19.406Z",
      "updated_at": "2026-10-12T22:26:24.536Z",
      "razorpay_customer_id": null,
      "phone": "+919503887353",
      "location": null,
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "SOLO",
      "approval_status": "APPROVED",
      "first_login": false,
      "is_active": true,
      "last_login_at": "2026-10-13T03:56:19.485Z",
      "last_seen_at": "2026-10-13T03:56:19.485Z",
      "domain_role": "LEGAL_PROFESSIONAL",
      "role_id": "c50f7dd4-18b7-4456-9064-0b201c64aff7",
      "active_plan_id": null,
      "active_plan_name": null,
      "active_plan_updated_at": null
    },
    "message": "User approved successfully"
  }
}
```
</details>

### User Block

**Purpose:** Block a user: sets is_blocked=true, is_active=false.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/115/block"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `37ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 115,
      "email": "jesoxel161@18lover.com",
      "username": "Rutuja ",
      "password": "$2b$10$EDw1aHt0v1xWpzGmQycuDOn0xiyJ0Vp6Q9ApngannaS8L63L7vH32",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": true,
      "created_at": "2026-10-12T22:26:19.406Z",
      "updated_at": "2026-10-12T22:26:24.536Z",
      "razorpay_customer_id": null,
      "phone": "+919503887353",
      "location": null,
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "SOLO",
      "approval_status": "APPROVED",
      "first_login": false,
      "is_active": false,
      "last_login_at": "2026-10-13T03:56:19.485Z",
      "last_seen_at": "2026-10-13T03:56:19.485Z",
      "domain_role": "LEGAL_PROFESSIONAL",
      "role_id": "c50f7dd4-18b7-4456-9064-0b201c64aff7",
      "active_plan_id": null,
      "active_plan_name": null,
      "active_plan_updated_at": null
    },
    "message": "User blocked successfully"
  }
}
```
</details>

### User Unblock

**Purpose:** Unblock a user: sets is_blocked=false, is_active=true.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/115/unblock"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `33ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 115,
      "email": "jesoxel161@18lover.com",
      "username": "Rutuja ",
      "password": "$2b$10$EDw1aHt0v1xWpzGmQycuDOn0xiyJ0Vp6Q9ApngannaS8L63L7vH32",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": false,
      "created_at": "2026-10-12T22:26:19.406Z",
      "updated_at": "2026-10-12T22:26:24.536Z",
      "razorpay_customer_id": null,
      "phone": "+919503887353",
      "location": null,
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "SOLO",
      "approval_status": "APPROVED",
      "first_login": false,
      "is_active": true,
      "last_login_at": "2026-10-13T03:56:19.485Z",
      "last_seen_at": "2026-10-13T03:56:19.485Z",
      "domain_role": "LEGAL_PROFESSIONAL",
      "role_id": "c50f7dd4-18b7-4456-9064-0b201c64aff7",
      "active_plan_id": null,
      "active_plan_name": null,
      "active_plan_updated_at": null
    },
    "message": "User unblocked successfully"
  }
}
```
</details>

---

## Contact Enquiries

### Public Contact Submit

**Purpose:** Website "Contact Jurinex" form intake (no auth). Returns reference number + IST submission time.

**Inputs:** Body: { name, surname, email, mobile, organisationName, whatIsThisAbout, additionalDetails, consent, pageUrl }

**Example curl:**
```bash
curl -s -X POST -H "Content-Type: application/json" -d '{"name":"API","surname":"Test","email":"api.test+1791866813986@example.com","mobile":"+91 90000 00000","organisationName":"Automated Test","whatIsThisAbout":"Pricing & plans","additionalDetails":"automated test 1791866813986","consent":true,"pageUrl":"https://jurinex.ai/contact"}' "http://localhost:4010/api/public/contact"
```

**Test Result:** ✅ PASS — Status: `201` — Latency: `221ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "id": 35,
    "reference_no": "CE-20261013-00035",
    "duplicate": false,
    "submitted_at": "2026-10-13T04:46:31.800Z",
    "submitted_at_ist": {
      "iso": "2026-10-13T10:16:31+05:30",
      "date": "13 Oct 2026",
      "time": "10:16 AM",
      "time24": "10:16",
      "weekday": "Tue",
      "display": "Tue, 13 Oct 2026, 10:16 AM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-13T04:46:31.800Z",
      "epoch_ms": 1791866791800
    },
    "message": "Thank you, API. A member of the Jurinex team will reply within one working day."
  }
}
```
</details>

### Contact Enquiry Stats

**Purpose:** KPI totals (today / 7d / month in IST), response time, by-status, by-topic, 14-day trend.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/stats"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `40ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-13T04:46:54.210Z",
    "generated_at_ist": {
      "iso": "2026-10-13T10:16:54+05:30",
      "date": "13 Oct 2026",
      "time": "10:16 AM",
      "time24": "10:16",
      "weekday": "Tue",
      "display": "Tue, 13 Oct 2026, 10:16 AM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-13T04:46:54.210Z",
      "epoch_ms": 1791866814210
    },
    "totals": {
      "total": 4,
      "open": 4,
      "new": 4,
      "contacted": 0,
      "in_progress": 0,
      "converted": 0,
      "closed": 0,
      "spam": 0,
      "today": 1,
      "yesterday": 0,
      "last_7_days": 1,
      "last_30_days": 1,
      "this_month": 1,
      "with_marketing_consent": 4,
      "open_unassigned": 4,
      "new_older_than_24h": 3,
      "ever_contacted": 0,
      "conversion_rate_pct": 0
    },
    "response_time": {
      "avg_first_response_minutes": null,
      "avg_first_response_display": null,
      "avg_first_response_minutes_30d": null,
      "avg_first_response_display_30d": null,
      "target_minutes": 1440,
      "target_display": "1 working day"
    },
    "by_status": [
      {
        "status": "new",
        "label": "New",
        "count": 4
      },
      {
        "status": "contacted",
        "label": "Contacted",
        "count": 0
      },
      {
        "status": "in_progress",
        "label": "In progress",
        "count": 0
      },
      {
        "status": "converted",
        "label": "Converted",
        "count": 0
      },
      {
        "status": "closed",
        "label": "Closed",
        "count": 0
      },
      {
        "status": "spam",
        "label": "Spam",
        "count": 0
      }
    ],
    "by_topic": [
      {
        "topic": "pricing",
        "count": 2,
        "open": 2
      },
      {
        "topic": "other",
        "count": 1,
        "open": 1
      },
      {
        "topic": "Pricing & plans",
        "count": 1,
        "open": 1
      }
    ],
    "daily_trend":
... (truncated)
```
</details>

### Contact Enquiry Meta

**Purpose:** Dropdown values (statuses, channels, topics) and assignable admins.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/meta"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `37ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "statuses": [
      {
        "value": "new",
        "label": "New",
        "open": true
      },
      {
        "value": "contacted",
        "label": "Contacted",
        "open": true
      },
      {
        "value": "in_progress",
        "label": "In progress",
        "open": true
      },
      {
        "value": "converted",
        "label": "Converted",
        "open": false
      },
      {
        "value": "closed",
        "label": "Closed",
        "open": false
      },
      {
        "value": "spam",
        "label": "Spam",
        "open": false
      }
    ],
    "priorities": [
      {
        "value": "low",
        "label": "Low"
      },
      {
        "value": "normal",
        "label": "Normal"
      },
      {
        "value": "high",
        "label": "High"
      }
    ],
    "contact_channels": [
      {
        "value": "call",
        "label": "Phone call"
      },
      {
        "value": "email",
        "label": "Email"
      },
      {
        "value": "whatsapp",
        "label": "WhatsApp"
      },
      {
        "value": "sms",
        "label": "SMS"
      },
      {
        "value": "meeting",
        "label": "Meeting"
      },
      {
        "value": "other",
        "label": "Other"
      }
    ],
    "contact_outcomes": [
      {
        "value": "connected",
        "label": "Connected"
      },
      {
        "value": "no_answer",
        "label": "No answer"
      },
      {
        "value": "busy",
        "label": "Busy"
      },
      {
        "value": "callback_requested",
        "label": "Callback requested"
      },
      {
        "value": "wrong_number",
        "label": "Wrong number"
      },
      {
        "value": "email_sent",
        "label": "Email sent"
      },
      {
        "value": "not_interested",
        "label": "Not interested"
      },
      {
        "value": "other",
        "label": "Other"
      }
    ],
    "topics": {
      "suggested": [
        "Product walk
... (truncated)
```
</details>

### Contact Enquiry List

**Purpose:** Paginated list with filters; every row carries submitted_at_ist.

**Inputs:** Query: status, topic, priority, consent, assigned, search, from, to, sort, page, limit

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries?status=open&sort=awaiting_longest&page=1&limit=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `73ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiries": [
      {
        "id": 12,
        "reference_no": "CE-20260911-00001",
        "first_name": "Rutuja",
        "last_name": "Dalal",
        "full_name": "Rutuja Dalal",
        "email": "rutujadalal@nexintelai.com",
        "mobile_number": "+919503808108",
        "organisation_name": "nexintel",
        "topic": "pricing",
        "message": "test",
        "marketing_consent": true,
        "consent_given_at": "2026-09-11T06:45:54.004Z",
        "consent_given_at_ist": {
          "iso": "2026-09-11T12:15:54+05:30",
          "date": "11 Sep 2026",
          "time": "12:15 PM",
          "time24": "12:15",
          "weekday": "Fri",
          "display": "Fri, 11 Sep 2026, 12:15 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-09-11T06:45:54.004Z",
          "epoch_ms": 1789109154004
        },
        "submitted_at": "2026-09-11T06:45:54.004Z",
        "submitted_at_ist": {
          "iso": "2026-09-11T12:15:54+05:30",
          "date": "11 Sep 2026",
          "time": "12:15 PM",
          "time24": "12:15",
          "weekday": "Fri",
          "display": "Fri, 11 Sep 2026, 12:15 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-09-11T06:45:54.004Z",
          "epoch_ms": 1789109154004
        },
        "submitted_ago": "31d 22h",
        "status": "new",
        "status_label": "New",
        "priority": "normal",
        "priority_label": "Normal",
        "assigned_to": null,
        "first_contacted_at": null,
        "first_contacted_at_ist": null,
        "first_contacted_by": null,
        "last_contacted_at": null,
        "last_contacted_at_ist": null,
        "last_contacted_by": null,
        "last_contact_channel": null,
        "last_contact_channel_label": null,
        "contact_attempts": 0,
        "first_response_minutes": null,
        "first_response_time": null,
        "awaiting_first_contact": true,
        "awaiting_for": "31d 22h",
        "status_changed_at": "2026-09-11T06:45:54.004Z",
  
... (truncated)
```
</details>

### Contact Enquiry Detail

**Purpose:** Single enquiry + activity timeline.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/35"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `68ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 35,
      "reference_no": "CE-20261013-00035",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791866813986@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791866813986",
      "marketing_consent": true,
      "consent_given_at": "2026-10-13T04:46:31.800Z",
      "consent_given_at_ist": {
        "iso": "2026-10-13T10:16:31+05:30",
        "date": "13 Oct 2026",
        "time": "10:16 AM",
        "time24": "10:16",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 10:16 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T04:46:31.800Z",
        "epoch_ms": 1791866791800
      },
      "submitted_at": "2026-10-13T04:46:31.800Z",
      "submitted_at_ist": {
        "iso": "2026-10-13T10:16:31+05:30",
        "date": "13 Oct 2026",
        "time": "10:16 AM",
        "time24": "10:16",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 10:16 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T04:46:31.800Z",
        "epoch_ms": 1791866791800
      },
      "submitted_ago": "just now",
      "status": "new",
      "status_label": "New",
      "priority": "normal",
      "priority_label": "Normal",
      "assigned_to": null,
      "first_contacted_at": null,
      "first_contacted_at_ist": null,
      "first_contacted_by": null,
      "last_contacted_at": null,
      "last_contacted_at_ist": null,
      "last_contacted_by": null,
      "last_contact_channel": null,
      "last_contact_channel_label": null,
      "contact_attempts": 0,
      "first_response_minutes": null,
      "first_response_time": null,
      "awaiting_first_contact": true,
      "awaiting_for": "just now",
      "status_changed_at": null,
      "status_changed_at_ist": null,
      "closed_at": null,
      "closed_at_ist": null,
      "upda
... (truncated)
```
</details>

### Contact Enquiry Contact Log

**Purpose:** Record that the team contacted the lead; stamps first/last contacted time in IST and moves new → contacted.

**Inputs:** Body: { channel, outcome, note, contacted_at?, set_status? }

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/35/contact-log" -H "Content-Type: application/json" -d '{"channel":"call","outcome":"connected","note":"automated test call"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `201ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 35,
      "reference_no": "CE-20261013-00035",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791866813986@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791866813986",
      "marketing_consent": true,
      "consent_given_at": "2026-10-13T04:46:31.800Z",
      "consent_given_at_ist": {
        "iso": "2026-10-13T10:16:31+05:30",
        "date": "13 Oct 2026",
        "time": "10:16 AM",
        "time24": "10:16",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 10:16 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T04:46:31.800Z",
        "epoch_ms": 1791866791800
      },
      "submitted_at": "2026-10-13T04:46:31.800Z",
      "submitted_at_ist": {
        "iso": "2026-10-13T10:16:31+05:30",
        "date": "13 Oct 2026",
        "time": "10:16 AM",
        "time24": "10:16",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 10:16 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T04:46:31.800Z",
        "epoch_ms": 1791866791800
      },
      "submitted_ago": "just now",
      "status": "contacted",
      "status_label": "Contacted",
      "priority": "normal",
      "priority_label": "Normal",
      "assigned_to": null,
      "first_contacted_at": "2026-10-13T04:46:54.497Z",
      "first_contacted_at_ist": {
        "iso": "2026-10-13T10:16:54+05:30",
        "date": "13 Oct 2026",
        "time": "10:16 AM",
        "time24": "10:16",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 10:16 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T04:46:54.497Z",
        "epoch_ms": 1791866814497
      },
      "first_contacted_by": null,
      "last_contacted_at": "2026-10-13T04:46:54.497Z",
      "last_contacted_at_ist": {
        "iso": "2026-10-13T10:16:54+05:30
... (truncated)
```
</details>

### Contact Enquiry Update

**Purpose:** Change status / priority / assignee with timeline entries.

**Inputs:** Body: { status?, priority?, assigned_to?, note? }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/35" -H "Content-Type: application/json" -d '{"status":"closed","priority":"low","note":"automated test close"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `223ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 35,
      "reference_no": "CE-20261013-00035",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791866813986@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791866813986",
      "marketing_consent": true,
      "consent_given_at": "2026-10-13T04:46:31.800Z",
      "consent_given_at_ist": {
        "iso": "2026-10-13T10:16:31+05:30",
        "date": "13 Oct 2026",
        "time": "10:16 AM",
        "time24": "10:16",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 10:16 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T04:46:31.800Z",
        "epoch_ms": 1791866791800
      },
      "submitted_at": "2026-10-13T04:46:31.800Z",
      "submitted_at_ist": {
        "iso": "2026-10-13T10:16:31+05:30",
        "date": "13 Oct 2026",
        "time": "10:16 AM",
        "time24": "10:16",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 10:16 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T04:46:31.800Z",
        "epoch_ms": 1791866791800
      },
      "submitted_ago": "just now",
      "status": "closed",
      "status_label": "Closed",
      "priority": "low",
      "priority_label": "Low",
      "assigned_to": null,
      "first_contacted_at": "2026-10-13T04:46:54.497Z",
      "first_contacted_at_ist": {
        "iso": "2026-10-13T10:16:54+05:30",
        "date": "13 Oct 2026",
        "time": "10:16 AM",
        "time24": "10:16",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 10:16 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T04:46:54.497Z",
        "epoch_ms": 1791866814497
      },
      "first_contacted_by": null,
      "last_contacted_at": "2026-10-13T04:46:54.497Z",
      "last_contacted_at_ist": {
        "iso": "2026-10-13T10:16:54+05:30",
        "
... (truncated)
```
</details>

### Contact Enquiry CSV Export

**Purpose:** CSV export with IST columns; same filters as the list.

**Inputs:** Query: same as list

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/export?search=api.test%2B"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `67ms`

<details><summary>Response sample</summary>

```json
Reference,Submitted (IST),Submitted date (IST),Submitted time (IST),Name,Surname,Email,Mobile,Organisation,What is this about,Additional details,Marketing consent,Status,Priority,Assigned to,First contacted (IST),First contacted by,First response time,Last contacted (IST),Last channel,Contact attempts,Closed (IST),Source,Page URL,Submitted (UTC)
CE-20261013-00035,"Tue, 13 Oct 2026, 10:16 AM IST",2026-10-13,10:16,API,Test,api.test+1791866813986@example.com,'+91 90000 00000,Automated Test,Pricing & plans,automated test 1791866813986,Yes,Closed,Low,,"Tue, 13 Oct 2026, 10:16 AM IST",,just now,"Tu
```
</details>

### Contact Enquiry Delete (cleanup)

**Purpose:** Remove the test enquiry (super-admin / static token only).

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X DELETE -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/35"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `35ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "id": 35,
    "reference_no": "CE-20261013-00035",
    "message": "Enquiry deleted"
  }
}
```
</details>

---

## Error Logs

### Error Logs Stats

**Purpose:** KPIs (total / unresolved / last 24h / affected users), 14-day trend, breakdowns by service, category, source, severity, status code, top issues, top endpoints, top users.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/stats"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `259ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-13T04:46:54.956Z",
    "generated_at_ist": {
      "iso": "2026-10-13T10:16:54+05:30",
      "date": "13 Oct 2026",
      "time": "10:16 AM",
      "time24": "10:16",
      "weekday": "Tue",
      "display": "Tue, 13 Oct 2026, 10:16 AM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-13T04:46:54.956Z",
      "epoch_ms": 1791866814956
    },
    "totals": {
      "total": 241,
      "unresolved": 241,
      "resolved": 0,
      "critical": 0,
      "error": 142,
      "warning": 99,
      "critical_unresolved": 0,
      "last_hour": 2,
      "last_24h": 20,
      "today": 2,
      "yesterday": 18,
      "last_7_days": 241,
      "last_30_days": 241,
      "this_month": 241,
      "with_user": 163,
      "affected_users": 8,
      "affected_users_24h": 7,
      "affected_users_unresolved": 8,
      "distinct_issues": 46,
      "distinct_issues_unresolved": 46,
      "services": 4,
      "external_api": 145,
      "http_5xx": 66,
      "http_4xx": 93,
      "browser": 50,
      "recovered": 13,
      "debug": 10,
      "avg_latency_ms": 796,
      "resolved_rate_pct": 0,
      "last_error_at": "2026-10-13T03:56:22.860Z",
      "last_error_at_ist": {
        "iso": "2026-10-13T09:26:22+05:30",
        "date": "13 Oct 2026",
        "time": "09:26 AM",
        "time24": "09:26",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 09:26 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T03:56:22.860Z",
        "epoch_ms": 1791863782860
      },
      "last_critical_at": null,
      "last_critical_at_ist": null
    },
    "daily_trend": [
      {
        "date": "2026-09-30",
        "label": "30 Sep",
        "total": 0,
        "critical": 0,
        "unresolved": 0,
        "affected_users": 0
      },
      {
        "date": "2026-10-01",
        "label": "01 Oct",
        "total": 0,
        "critical": 0,
        "unresolved": 0,
        "affected_users": 0
      },
      {
  
... (truncated)
```
</details>

### Error Logs Meta

**Purpose:** Filter vocabulary (sources, categories, severities) + distinct values actually present (services, environments, error types, providers, status codes) + permissions.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/meta"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `37ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "vocab": {
      "sources": [
        {
          "value": "HTTP",
          "label": "HTTP request"
        },
        {
          "value": "EXTERNAL_API",
          "label": "External API call"
        },
        {
          "value": "JOB",
          "label": "Background job"
        },
        {
          "value": "LOGGER",
          "label": "Logged error"
        },
        {
          "value": "PROCESS",
          "label": "Process crash"
        }
      ],
      "categories": [
        {
          "value": "INTERNAL",
          "label": "Internal error"
        },
        {
          "value": "DATABASE",
          "label": "Database"
        },
        {
          "value": "TIMEOUT",
          "label": "Timeout"
        },
        {
          "value": "AI_PROVIDER",
          "label": "AI provider"
        },
        {
          "value": "AI_SAFETY_BLOCK",
          "label": "AI safety block"
        },
        {
          "value": "AI_EMPTY_RESPONSE",
          "label": "AI empty response"
        },
        {
          "value": "AI_INVALID_OUTPUT",
          "label": "AI invalid output"
        },
        {
          "value": "CITATION_PROVIDER",
          "label": "Citation provider"
        },
        {
          "value": "EXTERNAL_API",
          "label": "External API"
        }
      ],
      "severities": [
        {
          "value": "CRITICAL",
          "label": "Critical"
        },
        {
          "value": "ERROR",
          "label": "Error"
        },
        {
          "value": "WARNING",
          "label": "Warning"
        }
      ],
      "status_classes": [
        "2xx",
        "3xx",
        "4xx",
        "5xx"
      ]
    },
    "used": {
      "services": [
        {
          "value": "agentic-document-service",
          "count": 119
        },
        {
          "value": "gateway-service",
          "count": 59
        },
        {
          "value": "payment-service",
          "count": 52
        },
  
... (truncated)
```
</details>

### Error Logs List

**Purpose:** Paginated list of captured errors with IST timestamps, user enrichment and occurrence counts.

**Inputs:** Query: page, limit, resolved, sort (+ service, source, category, severity, status_code, user, search, from, to ...)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?page=1&limit=5&resolved=all&sort=newest"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `112ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "8de3c18b-1d1f-4c31-9686-bac2152332b9",
        "created_at": "2026-10-13T03:56:22.860Z",
        "created_at_ist": {
          "iso": "2026-10-13T09:26:22+05:30",
          "date": "13 Oct 2026",
          "time": "09:26 AM",
          "time24": "09:26",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:26 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T03:56:22.860Z",
          "epoch_ms": 1791863782860
        },
        "occurred_ago": "50m",
        "service_name": "authservice",
        "environment": "production",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "1c1980c6f002b239990424c68aeff832",
        "user_id": "111",
        "user_email": "dalalrutuja2004@gmail.com",
        "user_email_source": "logged",
        "user_name": "rutuja",
        "user_key": "111",
        "user": {
          "id": 111,
          "email": "dalalrutuja2004@gmail.com",
          "username": "rutuja",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": null,
          "last_seen_at": "2026-10-13T04:15:59.812Z",
          "last_seen_at_ist": {
            "iso": "2026-10-13T09:45:59+05:30",
            "date": "13 Oct 2026",
            "time": "09:45 AM",
            "time24": "09:45",
            "weekday": "Tue",
            "display": "Tue, 13 Oct 2026, 09:45 AM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-13T04:15:59.812Z",
            "epoch_ms": 1791864959812
          },
          "registered_at": "2026-10-12T06:25:36.663Z"
        },
        "ip_address": "49.36.35.73",
        "endpoint": "/api/auth/register/solo",
        "http_method": "POST
... (truncated)
```
</details>

### Error Logs List (service filter)

**Purpose:** Filter by service_name; every returned row must belong to that service.

**Inputs:** Query: service=authservice

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?service=authservice&limit=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `114ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "8de3c18b-1d1f-4c31-9686-bac2152332b9",
        "created_at": "2026-10-13T03:56:22.860Z",
        "created_at_ist": {
          "iso": "2026-10-13T09:26:22+05:30",
          "date": "13 Oct 2026",
          "time": "09:26 AM",
          "time24": "09:26",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:26 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T03:56:22.860Z",
          "epoch_ms": 1791863782860
        },
        "occurred_ago": "50m",
        "service_name": "authservice",
        "environment": "production",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "1c1980c6f002b239990424c68aeff832",
        "user_id": "111",
        "user_email": "dalalrutuja2004@gmail.com",
        "user_email_source": "logged",
        "user_name": "rutuja",
        "user_key": "111",
        "user": {
          "id": 111,
          "email": "dalalrutuja2004@gmail.com",
          "username": "rutuja",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": null,
          "last_seen_at": "2026-10-13T04:15:59.812Z",
          "last_seen_at_ist": {
            "iso": "2026-10-13T09:45:59+05:30",
            "date": "13 Oct 2026",
            "time": "09:45 AM",
            "time24": "09:45",
            "weekday": "Tue",
            "display": "Tue, 13 Oct 2026, 09:45 AM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-13T04:15:59.812Z",
            "epoch_ms": 1791864959812
          },
          "registered_at": "2026-10-12T06:25:36.663Z"
        },
        "ip_address": "49.36.35.73",
        "endpoint": "/api/auth/register/solo",
        "http_method": "POST
... (truncated)
```
</details>

### Error Logs List (unresolved only)

**Purpose:** resolved=false returns only open errors.

**Inputs:** Query: resolved=false

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?resolved=false&limit=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `141ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "8de3c18b-1d1f-4c31-9686-bac2152332b9",
        "created_at": "2026-10-13T03:56:22.860Z",
        "created_at_ist": {
          "iso": "2026-10-13T09:26:22+05:30",
          "date": "13 Oct 2026",
          "time": "09:26 AM",
          "time24": "09:26",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:26 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T03:56:22.860Z",
          "epoch_ms": 1791863782860
        },
        "occurred_ago": "50m",
        "service_name": "authservice",
        "environment": "production",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "1c1980c6f002b239990424c68aeff832",
        "user_id": "111",
        "user_email": "dalalrutuja2004@gmail.com",
        "user_email_source": "logged",
        "user_name": "rutuja",
        "user_key": "111",
        "user": {
          "id": 111,
          "email": "dalalrutuja2004@gmail.com",
          "username": "rutuja",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": null,
          "last_seen_at": "2026-10-13T04:15:59.812Z",
          "last_seen_at_ist": {
            "iso": "2026-10-13T09:45:59+05:30",
            "date": "13 Oct 2026",
            "time": "09:45 AM",
            "time24": "09:45",
            "weekday": "Tue",
            "display": "Tue, 13 Oct 2026, 09:45 AM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-13T04:15:59.812Z",
            "epoch_ms": 1791864959812
          },
          "registered_at": "2026-10-12T06:25:36.663Z"
        },
        "ip_address": "49.36.35.73",
        "endpoint": "/api/auth/register/solo",
        "http_method": "POST
... (truncated)
```
</details>

### Error Logs List (browser-reported only)

**Purpose:** origin=browser returns only rows reported by the frontend (endpoint client:<flow>, payload.client_report); each carries client.kind / flow / page.

**Inputs:** Query: origin=browser

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?origin=browser&limit=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `113ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "7a1e28d8-5f5f-456c-8553-d92b95e3bb46",
        "created_at": "2026-10-13T03:53:25.670Z",
        "created_at_ist": {
          "iso": "2026-10-13T09:23:25+05:30",
          "date": "13 Oct 2026",
          "time": "09:23 AM",
          "time24": "09:23",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:23 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T03:53:25.670Z",
          "epoch_ms": 1791863605670
        },
        "occurred_ago": "53m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "8184d1a906084aa0870507543da64868",
        "user_id": "111",
        "user_email": "dalalrutuja2004@gmail.com",
        "user_email_source": "logged",
        "user_name": "rutuja",
        "user_key": "111",
        "user": {
          "id": 111,
          "email": "dalalrutuja2004@gmail.com",
          "username": "rutuja",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": null,
          "last_seen_at": "2026-10-13T04:15:59.812Z",
          "last_seen_at_ist": {
            "iso": "2026-10-13T09:45:59+05:30",
            "date": "13 Oct 2026",
            "time": "09:45 AM",
            "time24": "09:45",
            "weekday": "Tue",
            "display": "Tue, 13 Oct 2026, 09:45 AM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-13T04:15:59.812Z",
            "epoch_ms": 1791864959812
          },
          "registered_at": "2026-10-12T06:25:36.663Z"
        },
        "ip_address": "49.36.35.73",
        "endpoint": "client:fetch",
        "http_method": "P
... (truncated)
```
</details>

### Error Logs List (exclude debug rows)

**Purpose:** exclude_debug=true hides rows produced by the errorlog _debug routes / demo triggers; total must equal stats.total - stats.debug.

**Inputs:** Query: exclude_debug=true

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?exclude_debug=true&limit=100"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `213ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "8de3c18b-1d1f-4c31-9686-bac2152332b9",
        "created_at": "2026-10-13T03:56:22.860Z",
        "created_at_ist": {
          "iso": "2026-10-13T09:26:22+05:30",
          "date": "13 Oct 2026",
          "time": "09:26 AM",
          "time24": "09:26",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:26 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T03:56:22.860Z",
          "epoch_ms": 1791863782860
        },
        "occurred_ago": "50m",
        "service_name": "authservice",
        "environment": "production",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "1c1980c6f002b239990424c68aeff832",
        "user_id": "111",
        "user_email": "dalalrutuja2004@gmail.com",
        "user_email_source": "logged",
        "user_name": "rutuja",
        "user_key": "111",
        "user": {
          "id": 111,
          "email": "dalalrutuja2004@gmail.com",
          "username": "rutuja",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": null,
          "last_seen_at": "2026-10-13T04:15:59.812Z",
          "last_seen_at_ist": {
            "iso": "2026-10-13T09:45:59+05:30",
            "date": "13 Oct 2026",
            "time": "09:45 AM",
            "time24": "09:45",
            "weekday": "Tue",
            "display": "Tue, 13 Oct 2026, 09:45 AM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-13T04:15:59.812Z",
            "epoch_ms": 1791864959812
          },
          "registered_at": "2026-10-12T06:25:36.663Z"
        },
        "ip_address": "49.36.35.73",
        "endpoint": "/api/auth/register/solo",
        "http_method": "POST
... (truncated)
```
</details>

### Error Logs List (spec alias filters)

**Purpose:** q, is_resolved, http_method (and external_provider) are accepted as aliases and echoed back as search / resolved / http_method.

**Inputs:** Query: q, is_resolved, http_method

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?q=zzz-no-such-error-zzz&is_resolved=false&http_method=GET%2CPOST"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `124ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 1
    },
    "filters": {
      "service": "all",
      "environment": "all",
      "source": "all",
      "category": "all",
      "severity": "all",
      "http_method": [
        "GET",
        "POST"
      ],
      "status_code": "all",
      "status_class": null,
      "error_type": null,
      "error_code": "all",
      "provider": null,
      "user": null,
      "user_id": null,
      "user_email": null,
      "request_id": null,
      "fingerprint": null,
      "endpoint": null,
      "route": null,
      "method": null,
      "resolved": false,
      "has_user": null,
      "origin": "all",
      "exclude_debug": false,
      "search": "zzz-no-such-error-zzz",
      "from": null,
      "to": null,
      "since_hours": null,
      "timezone": "Asia/Kolkata",
      "sort": "newest"
    },
    "timezone": "Asia/Kolkata"
  }
}
```
</details>

### Error Logs List (search, no match)

**Purpose:** Free-text search across message, endpoint, user, request id; a nonsense term returns an empty page, not an error.

**Inputs:** Query: search

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?search=zzz-no-such-error-zzz"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `81ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 0,
      "totalPages": 1
    },
    "filters": {
      "service": "all",
      "environment": "all",
      "source": "all",
      "category": "all",
      "severity": "all",
      "http_method": "all",
      "status_code": "all",
      "status_class": null,
      "error_type": null,
      "error_code": "all",
      "provider": null,
      "user": null,
      "user_id": null,
      "user_email": null,
      "request_id": null,
      "fingerprint": null,
      "endpoint": null,
      "route": null,
      "method": null,
      "resolved": "all",
      "has_user": null,
      "origin": "all",
      "exclude_debug": false,
      "search": "zzz-no-such-error-zzz",
      "from": null,
      "to": null,
      "since_hours": null,
      "timezone": "Asia/Kolkata",
      "sort": "newest"
    },
    "timezone": "Asia/Kolkata"
  }
}
```
</details>

### Error Logs List (INVALID status_code — expect 400)

**Purpose:** status_code must be a comma-separated list of 100–599 integers.

**Inputs:** Query: status_code=abc

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?status_code=abc"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `5ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      "Unknown status_code \"abc\" (expected 100–599)"
    ]
  },
  "requestId": "9c0bc89c-d3dc-413d-bb6f-780cf62457de"
}
```
</details>

### Error Logs List (INVALID date range — expect 400)

**Purpose:** "from" must be on or before "to".

**Inputs:** Query: from > to

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?from=2026-02-01&to=2026-01-01"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `3ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      "\"from\" must be on or before \"to\""
    ]
  },
  "requestId": "2d054674-61db-4295-adc0-9777c617fca5"
}
```
</details>

### Error Logs Per User

**Purpose:** Errors grouped per platform user (user_id, else email): totals, unresolved, critical, last 24h, services, last error, enriched with Auth-DB user details.

**Inputs:** Query: page, limit, sort (most_errors | recent | unresolved | critical), service, severity, resolved, search, from, to

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/users?page=1&limit=10&sort=most_errors"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `102ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "user_key": "76",
        "user_id": "76",
        "user_email": "pk@gmail.com",
        "user_email_source": "logged",
        "user_name": "PK",
        "user": {
          "id": 76,
          "email": "pk@gmail.com",
          "username": "PK",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": null,
          "last_seen_at": "2026-10-12T12:25:44.943Z",
          "last_seen_at_ist": {
            "iso": "2026-10-12T17:55:44+05:30",
            "date": "12 Oct 2026",
            "time": "05:55 PM",
            "time24": "17:55",
            "weekday": "Mon",
            "display": "Mon, 12 Oct 2026, 05:55 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-12T12:25:44.943Z",
            "epoch_ms": 1791807944943
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "total": 120,
        "unresolved": 120,
        "critical": 0,
        "last_24h": 2,
        "last_7_days": 120,
        "distinct_errors": 25,
        "services": [
          "agentic-document-service",
          "authservice",
          "gateway-service",
          "payment-service"
        ],
        "first_error_at": "2026-10-08T09:57:48.236Z",
        "first_error_at_ist": {
          "iso": "2026-10-08T15:27:48+05:30",
          "date": "08 Oct 2026",
          "time": "03:27 PM",
          "time24": "15:27",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 03:27 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T09:57:48.236Z",
          "epoch_ms": 1791453468236
        },
        "last_error_at": "2026-10-12T12:10:20.145Z",
        "last_error_at_ist": {
          "iso": "2026-10-12T17:40:20+05:30",
          "date": "12 Oct 2026",
          "time": "05:40 PM",
          "time24": "17:40",
          "weekday": "Mon",
          "display": "M
... (truncated)
```
</details>

### Error Logs Issues (by fingerprint)

**Purpose:** Distinct issues: rows grouped by fingerprint with count, unresolved, affected users, first/last seen.

**Inputs:** Query: limit, service, severity, category, resolved, user, search, from, to

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/issues?limit=10"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `44ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "fingerprint": "15b973371d8d64ff7e4091b5c4792320111c9b1c28b76062c6ee2db55555649c",
        "service_name": "agentic-document-service",
        "services": [
          "agentic-document-service"
        ],
        "source": "HTTP",
        "category": "INTERNAL",
        "category_label": "Internal error",
        "severity": "WARNING",
        "error_type": "HttpErrorResponse404",
        "error_message": "Not Found",
        "error_summary": null,
        "error_code": null,
        "what_happened": null,
        "endpoint": "/audit",
        "http_method": "POST",
        "status_code": 404,
        "count": 43,
        "unresolved": 43,
        "last_24h": 0,
        "affected_users": 0,
        "first_seen": "2026-10-08T10:32:24.137Z",
        "first_seen_ist": {
          "iso": "2026-10-08T16:02:24+05:30",
          "date": "08 Oct 2026",
          "time": "04:02 PM",
          "time24": "16:02",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 04:02 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T10:32:24.137Z",
          "epoch_ms": 1791455544137
        },
        "last_seen": "2026-10-08T10:51:34.059Z",
        "last_seen_ist": {
          "iso": "2026-10-08T16:21:34+05:30",
          "date": "08 Oct 2026",
          "time": "04:21 PM",
          "time24": "16:21",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 04:21 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T10:51:34.059Z",
          "epoch_ms": 1791456694059
        },
        "last_seen_ago": "4d 17h",
        "latest_id": "bd630875-447e-4cc6-8c56-8d5c484eefa9"
      },
      {
        "fingerprint": "c0812713ea85c091c2530fc54cdc4e28976f8da1fa4d211a6a50e8d41dbdb393",
        "service_name": "gateway-service",
        "services": [
          "gateway-service"
        ],
        "source": "EXTERNAL_API",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        
... (truncated)
```
</details>

### Error Logs CSV Export

**Purpose:** CSV download (UTF-8 BOM, IST columns) honouring the same filters as the list. Max 5000 rows.

**Inputs:** Query: same as list

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/export?resolved=all"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `178ms`

<details><summary>Response sample</summary>

```json
ID,Occurred (IST),Date (IST),Time (IST),Service,Environment,Source,Category,Severity,HTTP status,Method,Endpoint,Code location,Action,Resource type,Resource id,Error code,What happened,Reason,Error type,Error message,User message,Suggested fix,User id,User email,User name,IP address,Request id,External provider,External endpoint,External model,External status,External error code,Latency (ms),Occurrences,Fingerprint,Resolved,Resolved by,Resolved at (IST),Resolution note,Occurred (UTC)
8de3c18b-1d1f-4c31-9686-bac2152332b9,"Tue, 13 Oct 2026, 09:26 AM IST",2026-10-13,09:26,authservice,production,
```
</details>

### Error Log Detail (INVALID id — expect 400)

**Purpose:** Row ids are UUIDs; anything else is rejected before touching the DB.

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/not-a-uuid"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `2ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error log id must be a UUID"
  },
  "requestId": "8c18f100-9382-44da-bbd3-e866ffcecbe0"
}
```
</details>

### Error Log Detail (UNKNOWN id — expect 404)

**Purpose:** Unknown UUID returns NOT_FOUND.

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/00000000-0000-4000-8000-000000000000"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `37ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Error log not found"
  },
  "requestId": "82834496-96c5-41c9-8efe-e95c6693fd57"
}
```
</details>

### Error Log Detail

**Purpose:** Full row incl. stack trace, payload, external API response, issue summary (occurrences), the api_audit_logs row of the request, and related rows (same request id / same fingerprint).

**Inputs:** Path: id (UUID)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/8de3c18b-1d1f-4c31-9686-bac2152332b9"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `137ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "8de3c18b-1d1f-4c31-9686-bac2152332b9",
      "created_at": "2026-10-13T03:56:22.860Z",
      "created_at_ist": {
        "iso": "2026-10-13T09:26:22+05:30",
        "date": "13 Oct 2026",
        "time": "09:26 AM",
        "time24": "09:26",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 09:26 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T03:56:22.860Z",
        "epoch_ms": 1791863782860
      },
      "occurred_ago": "50m",
      "service_name": "authservice",
      "environment": "production",
      "source": "EXTERNAL_API",
      "source_label": "External API call",
      "category": "EXTERNAL_API",
      "category_label": "External API",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "1c1980c6f002b239990424c68aeff832",
      "user_id": "111",
      "user_email": "dalalrutuja2004@gmail.com",
      "user_email_source": "logged",
      "user_name": "rutuja",
      "user_key": "111",
      "user": {
        "id": 111,
        "email": "dalalrutuja2004@gmail.com",
        "username": "rutuja",
        "role": "user",
        "account_type": "SOLO",
        "approval_status": "APPROVED",
        "is_blocked": false,
        "is_active": true,
        "active_plan_name": null,
        "last_seen_at": "2026-10-13T04:15:59.812Z",
        "last_seen_at_ist": {
          "iso": "2026-10-13T09:45:59+05:30",
          "date": "13 Oct 2026",
          "time": "09:45 AM",
          "time24": "09:45",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:45 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T04:15:59.812Z",
          "epoch_ms": 1791864959812
        },
        "registered_at": "2026-10-12T06:25:36.663Z"
      },
      "ip_address": "49.36.35.73",
      "endpoint": "/api/auth/register/solo",
      "http_method": "POST",
      "method": "src.services.brevoService.syncContactToBrevo",
      "action": "CREATE",
      "resource_type": nul
... (truncated)
```
</details>

### Error Log Resolve

**Purpose:** Mark a single error resolved with a note; records resolved_by (admin email / admin-token) and resolved_at.

**Inputs:** Body: { resolved: true, note }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/8de3c18b-1d1f-4c31-9686-bac2152332b9/resolve" -H "Content-Type: application/json" -d '{"resolved":true,"note":"automated test: resolved"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `136ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "8de3c18b-1d1f-4c31-9686-bac2152332b9",
      "created_at": "2026-10-13T03:56:22.860Z",
      "created_at_ist": {
        "iso": "2026-10-13T09:26:22+05:30",
        "date": "13 Oct 2026",
        "time": "09:26 AM",
        "time24": "09:26",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 09:26 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T03:56:22.860Z",
        "epoch_ms": 1791863782860
      },
      "occurred_ago": "50m",
      "service_name": "authservice",
      "environment": "production",
      "source": "EXTERNAL_API",
      "source_label": "External API call",
      "category": "EXTERNAL_API",
      "category_label": "External API",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "1c1980c6f002b239990424c68aeff832",
      "user_id": "111",
      "user_email": "dalalrutuja2004@gmail.com",
      "user_email_source": "logged",
      "user_name": "rutuja",
      "user_key": "111",
      "user": {
        "id": 111,
        "email": "dalalrutuja2004@gmail.com",
        "username": "rutuja",
        "role": "user",
        "account_type": "SOLO",
        "approval_status": "APPROVED",
        "is_blocked": false,
        "is_active": true,
        "active_plan_name": null,
        "last_seen_at": "2026-10-13T04:15:59.812Z",
        "last_seen_at_ist": {
          "iso": "2026-10-13T09:45:59+05:30",
          "date": "13 Oct 2026",
          "time": "09:45 AM",
          "time24": "09:45",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:45 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T04:15:59.812Z",
          "epoch_ms": 1791864959812
        },
        "registered_at": "2026-10-12T06:25:36.663Z"
      },
      "ip_address": "49.36.35.73",
      "endpoint": "/api/auth/register/solo",
      "http_method": "POST",
      "method": "src.services.brevoService.syncContactToBrevo",
      "action": "CREATE",
      "resource_type": nul
... (truncated)
```
</details>

### Error Log Reopen

**Purpose:** resolved=false reopens the error and clears resolved_by / resolved_at / resolution_note.

**Inputs:** Body: { resolved: false }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/8de3c18b-1d1f-4c31-9686-bac2152332b9/resolve" -H "Content-Type: application/json" -d '{"resolved":false}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `139ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "8de3c18b-1d1f-4c31-9686-bac2152332b9",
      "created_at": "2026-10-13T03:56:22.860Z",
      "created_at_ist": {
        "iso": "2026-10-13T09:26:22+05:30",
        "date": "13 Oct 2026",
        "time": "09:26 AM",
        "time24": "09:26",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 09:26 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T03:56:22.860Z",
        "epoch_ms": 1791863782860
      },
      "occurred_ago": "50m",
      "service_name": "authservice",
      "environment": "production",
      "source": "EXTERNAL_API",
      "source_label": "External API call",
      "category": "EXTERNAL_API",
      "category_label": "External API",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "1c1980c6f002b239990424c68aeff832",
      "user_id": "111",
      "user_email": "dalalrutuja2004@gmail.com",
      "user_email_source": "logged",
      "user_name": "rutuja",
      "user_key": "111",
      "user": {
        "id": 111,
        "email": "dalalrutuja2004@gmail.com",
        "username": "rutuja",
        "role": "user",
        "account_type": "SOLO",
        "approval_status": "APPROVED",
        "is_blocked": false,
        "is_active": true,
        "active_plan_name": null,
        "last_seen_at": "2026-10-13T04:15:59.812Z",
        "last_seen_at_ist": {
          "iso": "2026-10-13T09:45:59+05:30",
          "date": "13 Oct 2026",
          "time": "09:45 AM",
          "time24": "09:45",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:45 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T04:15:59.812Z",
          "epoch_ms": 1791864959812
        },
        "registered_at": "2026-10-12T06:25:36.663Z"
      },
      "ip_address": "49.36.35.73",
      "endpoint": "/api/auth/register/solo",
      "http_method": "POST",
      "method": "src.services.brevoService.syncContactToBrevo",
      "action": "CREATE",
      "resource_type": nul
... (truncated)
```
</details>

### Error Logs Bulk Resolve (ids)

**Purpose:** Resolve many rows at once by id list (or by fingerprint to close every occurrence of an issue).

**Inputs:** Body: { ids[] | fingerprint, resolved, note? }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/resolve" -H "Content-Type: application/json" -d '{"ids":["8de3c18b-1d1f-4c31-9686-bac2152332b9"],"resolved":true,"note":"automated test: bulk"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `38ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "resolved": true,
    "changed": 1,
    "ids": [
      "8de3c18b-1d1f-4c31-9686-bac2152332b9"
    ]
  }
}
```
</details>

### Error Logs Bulk Reopen (fingerprint)

**Purpose:** Reopen every row sharing a fingerprint (restores the test row to unresolved).

**Inputs:** Body: { fingerprint, resolved: false }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/resolve" -H "Content-Type: application/json" -d '{"fingerprint":"cae1e80399345babeb371a1bd26984247feb4eb40cb47b19a59c4481a7f99eeb","resolved":false}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `38ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "resolved": false,
    "changed": 1,
    "ids": [
      "8de3c18b-1d1f-4c31-9686-bac2152332b9"
    ]
  }
}
```
</details>

### Error Logs Resolve by Fingerprint

**Purpose:** Resolves every open occurrence of one issue; body carries resolved_by and resolution_note (spec aliases).

**Inputs:** Body: { fingerprint, resolved_by, resolution_note }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/resolve-fingerprint" -H "Content-Type: application/json" -d '{"fingerprint":"cae1e80399345babeb371a1bd26984247feb4eb40cb47b19a59c4481a7f99eeb","resolved_by":"api-test@jurinex","resolution_note":"automated test: resolve-fingerprint"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `73ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "fingerprint": "cae1e80399345babeb371a1bd26984247feb4eb40cb47b19a59c4481a7f99eeb",
    "resolved": true,
    "resolved_by": "api-test@jurinex",
    "changed": 10,
    "ids": [
      "93a2a237-965f-4305-be90-36fba021ca05",
      "45d3b7f5-7b29-46b7-bfff-b180fb297926",
      "7487b543-2d86-416e-9747-dfc47bb29c0c",
      "6220475c-30f8-4220-a7ec-c05c27edbfd1",
      "8b84f4cb-a8a5-480f-bff7-6e111cbdd040",
      "6e266bd1-0b0b-4d49-9253-8022c728b45e",
      "e68386e3-86d2-4091-90f5-5be15cd1cc3c",
      "12f8ea9d-5054-4519-a47c-611a3b2c4584",
      "9e5fcfd4-31da-4b2e-a162-4c23dfa9d66d",
      "8de3c18b-1d1f-4c31-9686-bac2152332b9"
    ],
    "occurrences": {
      "total": 10,
      "unresolved": 0
    }
  }
}
```
</details>

### Error Logs Bulk Resolve (INVALID — expect 400)

**Purpose:** Exactly one of ids[] or fingerprint is required.

**Inputs:** Body: { resolved: true } (no target)

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/resolve" -H "Content-Type: application/json" -d '{"resolved":true}'
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `4ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid payload",
    "details": [
      "\"value\" must contain at least one of [ids, fingerprint]"
    ]
  },
  "requestId": "6f91ae89-0143-42c2-9235-0732a3b636fa"
}
```
</details>

### Error Logs Bulk Delete (INVALID — expect 400)

**Purpose:** ids must be UUIDs; nothing is deleted on validation failure.

**Inputs:** Body: { ids: ["not-a-uuid"] }

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/bulk-delete" -H "Content-Type: application/json" -d '{"ids":["not-a-uuid"]}'
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `2ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid payload",
    "details": [
      "each id must be a UUID"
    ]
  },
  "requestId": "18c382d0-f664-4d22-8af4-7695c25599ba"
}
```
</details>

### Error Log Delete (UNKNOWN id — expect 404)

**Purpose:** Deleting an unknown row returns NOT_FOUND. (Real rows are not deleted by the test run.)

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X DELETE -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/00000000-0000-4000-8000-000000000000"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `35ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Error log not found"
  },
  "requestId": "ecf4e05d-a8eb-4e13-9b38-81e5cd56a923"
}
```
</details>

---

## Audit Logs

### Audit Logs Summary

**Purpose:** Per-service calls / failed / failure rate / avg + p50 + p95 duration, top 20 APIs, top 20 users, breakdowns, daily trend (default: last 7 days, pings excluded).

**Inputs:** Query: from, to, since_hours, user, service, status, exclude_pings …

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs/summary"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `109ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-13T04:46:57.551Z",
    "generated_at_ist": {
      "iso": "2026-10-13T10:16:57+05:30",
      "date": "13 Oct 2026",
      "time": "10:16 AM",
      "time24": "10:16",
      "weekday": "Tue",
      "display": "Tue, 13 Oct 2026, 10:16 AM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-13T04:46:57.551Z",
      "epoch_ms": 1791866817551
    },
    "period": {
      "from": "2026-10-12T04:46:57.551Z",
      "from_ist": {
        "iso": "2026-10-12T10:16:57+05:30",
        "date": "12 Oct 2026",
        "time": "10:16 AM",
        "time24": "10:16",
        "weekday": "Mon",
        "display": "Mon, 12 Oct 2026, 10:16 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-12T04:46:57.551Z",
        "epoch_ms": 1791780417551
      },
      "to": null,
      "to_ist": null,
      "since_hours": null
    },
    "filters": {
      "from": "2026-10-12T04:46:57.551Z",
      "from_ist": {
        "iso": "2026-10-12T10:16:57+05:30",
        "date": "12 Oct 2026",
        "time": "10:16 AM",
        "time24": "10:16",
        "weekday": "Mon",
        "display": "Mon, 12 Oct 2026, 10:16 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-12T04:46:57.551Z",
        "epoch_ms": 1791780417551
      },
      "to": null,
      "to_ist": null,
      "to_bound": null,
      "since_hours": null,
      "user": null,
      "user_resolved": null,
      "service": "all",
      "environment": "all",
      "status": "all",
      "method": "all",
      "endpoint": null,
      "route": null,
      "resource_type": "all",
      "action": "all",
      "request_id": null,
      "error_log_id": null,
      "error_type": null,
      "error_code": "all",
      "status_code": "all",
      "status_class": null,
      "q": null,
      "exclude_pings": true,
      "kind": "all",
      "min_duration_ms": null,
      "timezone": "Asia/Kolkata"
    },
    "totals": {
      "calls": 387,
      "succeeded": 353,
      "fa
... (truncated)
```
</details>

### Audit Logs Meta

**Purpose:** Distinct services, resource types, actions, HTTP methods, error types for filter dropdowns + defaults/limits.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs/meta"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `40ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "vocab": {
      "statuses": [
        "SUCCESS",
        "FAILED"
      ],
      "actions": [
        "VIEW",
        "CREATE",
        "UPDATE",
        "DELETE"
      ],
      "kinds": [
        "request",
        "job",
        "browser"
      ],
      "status_classes": [
        "2xx",
        "3xx",
        "4xx",
        "5xx"
      ]
    },
    "used": {
      "services": [
        {
          "value": "authservice",
          "count": 774
        },
        {
          "value": "payment-service",
          "count": 276
        },
        {
          "value": "gateway-service",
          "count": 251
        },
        {
          "value": "agentic-document-service",
          "count": 233
        }
      ],
      "environments": [
        {
          "value": "development",
          "count": 1259
        },
        {
          "value": "production",
          "count": 275
        }
      ],
      "resource_types": [
        {
          "value": "STORAGE FOLDER",
          "count": 177
        },
        {
          "value": "PAYMENT",
          "count": 130
        },
        {
          "value": "USER",
          "count": 83
        },
        {
          "value": "CASE",
          "count": 31
        },
        {
          "value": "PLAN",
          "count": 11
        },
        {
          "value": "CHAT",
          "count": 8
        },
        {
          "value": "FILE",
          "count": 4
        },
        {
          "value": "SUPPORT TICKET",
          "count": 2
        }
      ],
      "actions": [
        {
          "value": "VIEW",
          "count": 740
        },
        {
          "value": "CREATE",
          "count": 589
        },
        {
          "value": "UPDATE",
          "count": 44
        }
      ],
      "http_methods": [
        {
          "value": "GET",
          "count": 846
        },
        {
          "value": "POST",
          "count": 640
        },
        {
          "value": "PUT",
     
... (truncated)
```
</details>

### Audit Logs List

**Purpose:** Paginated API-call list (last 7 days by default, activity pings hidden, newest first). Never includes stack_trace.

**Inputs:** Query: page, page_size (+ filters)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs?page=1&page_size=20"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `75ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "50d26e08-33d8-4f62-a5df-78c03eee1c08",
        "created_at": "2026-10-13T04:43:58.676Z",
        "created_at_ist": {
          "iso": "2026-10-13T10:13:58+05:30",
          "date": "13 Oct 2026",
          "time": "10:13 AM",
          "time24": "10:13",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 10:13 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T04:43:58.676Z",
          "epoch_ms": 1791866638676
        },
        "occurred_ago": "2m",
        "service_name": "authservice",
        "environment": "production",
        "request_id": "17c2221bedc30f69dd87c1e15d5a8be1",
        "user_id": null,
        "user_email": null,
        "user_email_source": null,
        "user_name": null,
        "user_key": null,
        "user": null,
        "ip_address": "117.248.9.154",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
        "kind": "request",
        "http_method": "GET",
        "endpoint": "/api/auth/marketing-promos/header",
        "route": "/api/auth/marketing-promos/header",
        "api": "GET /api/auth/marketing-promos/header",
        "action": "VIEW",
        "resource_type": null,
        "resource_id": null,
        "method": "Authservice.getHeaderPromos",
        "status": "SUCCESS",
        "failed": false,
        "status_code": 200,
        "status_class": "2xx",
        "duration_ms": 19,
        "duration_display": "19 ms",
        "streaming": false,
        "error_log_id": null,
        "error_log_ids": [],
        "error_type": null,
        "error_message": null,
        "user_message": null,
        "error_summary": null,
        "error_code": null,
        "what_happened": null,
        "suggested_fix": null,
        "display": null,
        "has_stack_trace": false,
        "source": null,
        "category": null,
        "severity": null,
        "external_provider": null,
    
... (truncated)
```
</details>

### Audit Logs List (pings included)

**Purpose:** exclude_pings=false brings /api/auth/activity/ping rows back; total must be >= the default total.

**Inputs:** Query: exclude_pings=false

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs?exclude_pings=false&page_size=100"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `142ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "50d26e08-33d8-4f62-a5df-78c03eee1c08",
        "created_at": "2026-10-13T04:43:58.676Z",
        "created_at_ist": {
          "iso": "2026-10-13T10:13:58+05:30",
          "date": "13 Oct 2026",
          "time": "10:13 AM",
          "time24": "10:13",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 10:13 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T04:43:58.676Z",
          "epoch_ms": 1791866638676
        },
        "occurred_ago": "2m",
        "service_name": "authservice",
        "environment": "production",
        "request_id": "17c2221bedc30f69dd87c1e15d5a8be1",
        "user_id": null,
        "user_email": null,
        "user_email_source": null,
        "user_name": null,
        "user_key": null,
        "user": null,
        "ip_address": "117.248.9.154",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
        "kind": "request",
        "http_method": "GET",
        "endpoint": "/api/auth/marketing-promos/header",
        "route": "/api/auth/marketing-promos/header",
        "api": "GET /api/auth/marketing-promos/header",
        "action": "VIEW",
        "resource_type": null,
        "resource_id": null,
        "method": "Authservice.getHeaderPromos",
        "status": "SUCCESS",
        "failed": false,
        "status_code": 200,
        "status_class": "2xx",
        "duration_ms": 19,
        "duration_display": "19 ms",
        "streaming": false,
        "error_log_id": null,
        "error_log_ids": [],
        "error_type": null,
        "error_message": null,
        "user_message": null,
        "error_summary": null,
        "error_code": null,
        "what_happened": null,
        "suggested_fix": null,
        "display": null,
        "has_stack_trace": false,
        "source": null,
        "category": null,
        "severity": null,
        "external_provider": null,
    
... (truncated)
```
</details>

### Audit Logs List (FAILED only)

**Purpose:** status=FAILED returns only failed calls; these carry error_type / user_message / error_log_id.

**Inputs:** Query: status=FAILED

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs?status=FAILED&page_size=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `115ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "a08f2ff4-4628-4f5b-9ca1-3efc01060790",
        "created_at": "2026-10-13T03:53:25.672Z",
        "created_at_ist": {
          "iso": "2026-10-13T09:23:25+05:30",
          "date": "13 Oct 2026",
          "time": "09:23 AM",
          "time24": "09:23",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:23 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T03:53:25.672Z",
          "epoch_ms": 1791863605672
        },
        "occurred_ago": "53m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "request_id": "8184d1a906084aa0870507543da64868",
        "user_id": "111",
        "user_email": "dalalrutuja2004@gmail.com",
        "user_email_source": "logged",
        "user_name": "rutuja",
        "user_key": "111",
        "user": {
          "id": 111,
          "email": "dalalrutuja2004@gmail.com",
          "username": "rutuja",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": null,
          "last_seen_at": "2026-10-13T04:15:59.812Z",
          "last_seen_at_ist": {
            "iso": "2026-10-13T09:45:59+05:30",
            "date": "13 Oct 2026",
            "time": "09:45 AM",
            "time24": "09:45",
            "weekday": "Tue",
            "display": "Tue, 13 Oct 2026, 09:45 AM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-13T04:15:59.812Z",
            "epoch_ms": 1791864959812
          },
          "registered_at": "2026-10-12T06:25:36.663Z"
        },
        "ip_address": "49.36.35.73",
        "user_agent": null,
        "kind": "browser",
        "http_method": "POST",
        "endpoint": "client:fetch",
        "route": null,
        "api": "POST client:fetch",
        "action": "CREATE",
        "resource_type": "STORAGE FOLDER",
        "resource_id": null,
 
... (truncated)
```
</details>

### Audit Logs List (error_code filter + sort=duration_ms)

**Purpose:** error_code is a csv filter (upper-cased); sort=duration_ms (alias of slowest) orders by duration desc.

**Inputs:** Query: error_code, sort

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs?error_code=auth_expired%2Cnot_found&sort=duration_ms&page_size=20"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `111ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "39140233-c80b-45db-9e90-371f835f750a",
        "created_at": "2026-10-12T11:56:03.592Z",
        "created_at_ist": {
          "iso": "2026-10-12T17:26:03+05:30",
          "date": "12 Oct 2026",
          "time": "05:26 PM",
          "time24": "17:26",
          "weekday": "Mon",
          "display": "Mon, 12 Oct 2026, 05:26 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-12T11:56:03.592Z",
          "epoch_ms": 1791806163592
        },
        "occurred_ago": "16h 50m",
        "service_name": "payment-service",
        "environment": "production",
        "request_id": "e754399c7602c3c58a1d32fc061d7055",
        "user_id": "111",
        "user_email": "dalalrutuja2004@gmail.com",
        "user_email_source": "logged",
        "user_name": "rutuja",
        "user_key": "111",
        "user": {
          "id": 111,
          "email": "dalalrutuja2004@gmail.com",
          "username": "rutuja",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": null,
          "last_seen_at": "2026-10-13T04:15:59.812Z",
          "last_seen_at_ist": {
            "iso": "2026-10-13T09:45:59+05:30",
            "date": "13 Oct 2026",
            "time": "09:45 AM",
            "time24": "09:45",
            "weekday": "Tue",
            "display": "Tue, 13 Oct 2026, 09:45 AM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-13T04:15:59.812Z",
            "epoch_ms": 1791864959812
          },
          "registered_at": "2026-10-12T06:25:36.663Z"
        },
        "ip_address": "2600:1900:0:3905::201",
        "user_agent": "axios/1.12.2",
        "kind": "request",
        "http_method": "GET",
        "endpoint": "/api/user-resources/user-plan/111",
        "route": "/api/user-resources/user-plan/:userId",
        "api": "GET /api/user-resources/user-plan/111",
        "act
... (truncated)
```
</details>

### Audit Logs List (INVALID — expect 400)

**Purpose:** status must be SUCCESS | FAILED; from/to must be YYYY-MM-DD or ISO date-time.

**Inputs:** Query: status=NOPE&from=yesterday

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs?status=NOPE&from=yesterday"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `4ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      "\"status\" must be one of [SUCCESS, FAILED, ALL, ]"
    ]
  },
  "requestId": "3e1acdfb-eab6-42bc-8617-6129e424b0e2"
}
```
</details>

### Audit Logs CSV Export

**Purpose:** CSV with the same filters as the list (UTF-8 BOM, IST columns), max 50 000 rows.

**Inputs:** Query: same as list

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs/export?status=FAILED&exclude_pings=false"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `105ms`

<details><summary>Response sample</summary>

```json
ID,Timestamp (IST),Date (IST),Time (IST),User email,User id,User name,Service,Environment,Action,Resource type,Resource id,Method (handler),HTTP method,Endpoint,Route,Kind,Status,Code,Duration (ms),IP address,User agent,Request id,Error code,What happened,Reason,Error type,Error message,User message,Suggested fix,Error log id,Timestamp (UTC)
a08f2ff4-4628-4f5b-9ca1-3efc01060790,"Tue, 13 Oct 2026, 09:23 AM IST",2026-10-13,09:23,dalalrutuja2004@gmail.com,111,rutuja,agentic-document-service,development,CREATE,STORAGE FOLDER,,client.fetch.network,POST,client:fetch,,browser,FAILED,,,49.36.35.73,,8
```
</details>

### Audit Log Detail (INVALID id — expect 400)

**Purpose:** Row ids are UUIDs.

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs/not-a-uuid"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `3ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Audit log id must be a UUID"
  },
  "requestId": "5df8c649-01d4-4532-8963-57c32e592edc"
}
```
</details>

### Audit Log Detail (UNKNOWN id — expect 404)

**Purpose:** Unknown UUID returns NOT_FOUND.

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs/00000000-0000-4000-8000-000000000000"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `35ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Audit log not found"
  },
  "requestId": "8165f712-6192-4748-80f5-569d27748627"
}
```
</details>

### Audit Log Detail

**Purpose:** Full row incl. stack_trace and payload, plus the linked error_logs row(s) (error_log_id / payload.error_log_ids) with their stack traces.

**Inputs:** Path: id (UUID)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs/a08f2ff4-4628-4f5b-9ca1-3efc01060790"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `141ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "audit": {
      "id": "a08f2ff4-4628-4f5b-9ca1-3efc01060790",
      "created_at": "2026-10-13T03:53:25.672Z",
      "created_at_ist": {
        "iso": "2026-10-13T09:23:25+05:30",
        "date": "13 Oct 2026",
        "time": "09:23 AM",
        "time24": "09:23",
        "weekday": "Tue",
        "display": "Tue, 13 Oct 2026, 09:23 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-13T03:53:25.672Z",
        "epoch_ms": 1791863605672
      },
      "occurred_ago": "53m",
      "service_name": "agentic-document-service",
      "environment": "development",
      "request_id": "8184d1a906084aa0870507543da64868",
      "user_id": "111",
      "user_email": "dalalrutuja2004@gmail.com",
      "user_email_source": "logged",
      "user_name": "rutuja",
      "user_key": "111",
      "user": {
        "id": 111,
        "email": "dalalrutuja2004@gmail.com",
        "username": "rutuja",
        "role": "user",
        "account_type": "SOLO",
        "approval_status": "APPROVED",
        "is_blocked": false,
        "is_active": true,
        "active_plan_name": null,
        "last_seen_at": "2026-10-13T04:15:59.812Z",
        "last_seen_at_ist": {
          "iso": "2026-10-13T09:45:59+05:30",
          "date": "13 Oct 2026",
          "time": "09:45 AM",
          "time24": "09:45",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:45 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T04:15:59.812Z",
          "epoch_ms": 1791864959812
        },
        "registered_at": "2026-10-12T06:25:36.663Z"
      },
      "ip_address": "49.36.35.73",
      "user_agent": null,
      "kind": "browser",
      "http_method": "POST",
      "endpoint": "client:fetch",
      "route": null,
      "api": "POST client:fetch",
      "action": "CREATE",
      "resource_type": "STORAGE FOLDER",
      "resource_id": null,
      "method": "client.fetch.network",
      "status": "FAILED",
      "failed": true,
      "status_code": null,
     
... (truncated)
```
</details>

---

## Sales Referrals

### Sales Referrals Summary

**Purpose:** A12 — six summary cards (total, via code, direct, free / paid / lapsed) + paidPercent + trackingSince.

**Inputs:** Query: from, to (YYYY-MM-DD, IST), type=ALL|INTERNAL|OUTSOURCED

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/summary"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `37ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "trackingSince": null,
    "filters": {
      "from": null,
      "to": null,
      "type": "ALL"
    },
    "totalSignups": 9,
    "viaCode": 9,
    "direct": 0,
    "free": {
      "total": 7,
      "viaCode": 7
    },
    "paid": {
      "total": 2,
      "viaCode": 2
    },
    "lapsed": {
      "total": 0,
      "viaCode": 0
    },
    "paidPercent": 22,
    "byTenantType": {
      "FIRM": 2,
      "SOLO": 7
    }
  }
}
```
</details>

### Sales Referrals Summary (INVALID date range — expect 400)

**Purpose:** A12 — `to` before `from` is rejected with VALIDATION_FAILED.

**Inputs:** {"from":"2026-10-13","to":"2026-10-01"}

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/summary?from=2026-10-13&to=2026-10-01"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `4ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid request",
    "details": [
      {
        "field": "to",
        "message": "\"to\" must be on or after \"from\""
      }
    ]
  },
  "requestId": "ca7341d4-c7ab-46e2-a90f-260f66645ae4"
}
```
</details>

### Sales Referrals Owners Table

**Purpose:** A13 — one row per owner (signups, free, paid, lapsed, paidPercent, code counts) + Direct row + ownerCountAll.

**Inputs:** Query: from, to, type, search, sort=name|signups|free|paid|lapsed|paidPercent, direction

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/owners"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `103ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "filters": {
      "from": null,
      "to": null,
      "type": "ALL",
      "search": null,
      "sort": "signups",
      "direction": "desc"
    },
    "ownerCountAll": 5,
    "codeCountAll": 15,
    "owners": [
      {
        "id": "3311a5ee-2121-44ed-b7cc-aa16dd07374d",
        "name": "pravin",
        "internal": false,
        "createdAt": "2026-10-12T15:44:50+05:30",
        "codes": {
          "active": 2,
          "total": 2
        },
        "signups": 4,
        "free": 3,
        "paid": 1,
        "lapsed": 0,
        "paidPercent": 25
      },
      {
        "id": "7d6db562-102f-48db-b6f3-e146ef125f0d",
        "name": "Rutuja",
        "internal": false,
        "createdAt": "2026-10-12T17:23:57+05:30",
        "codes": {
          "active": 2,
          "total": 2
        },
        "signups": 2,
        "free": 2,
        "paid": 0,
        "lapsed": 0,
        "paidPercent": 0
      },
      {
        "id": "57b051e6-ca59-4628-b091-2a313fbd9f2d",
        "name": "Test sale",
        "internal": false,
        "createdAt": "2026-10-12T17:38:48+05:30",
        "codes": {
          "active": 4,
          "total": 4
        },
        "signups": 2,
        "free": 1,
        "paid": 1,
        "lapsed": 0,
        "paidPercent": 50
      },
      {
        "id": "e585e5c9-4391-4f73-8732-7fa94b49bb02",
        "name": "cybermall",
        "internal": false,
        "createdAt": "2026-10-13T09:20:50+05:30",
        "codes": {
          "active": 3,
          "total": 3
        },
        "signups": 1,
        "free": 1,
        "paid": 0,
        "lapsed": 0,
        "paidPercent": 0
      },
      {
        "id": "5bd9cddb-7339-4110-9b6f-622527abd132",
        "name": "Sales12",
        "internal": true,
        "createdAt": "2026-10-12T15:39:01+05:30",
        "codes": {
          "active": 2,
          "total": 4
        },
        "signups": 0,
        "free": 0,
        "paid": 0,
        "lapsed": 0,
        "paidPercent": 0
      }
    ],
    "direct
... (truncated)
```
</details>

### Sales Referrals Owners Table (type=INTERNAL, direct row omitted)

**Purpose:** A13 — type filter removes Direct (direct: null) and keeps only internal owners.

**Inputs:** type=INTERNAL

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/owners?type=INTERNAL"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `70ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "filters": {
      "from": null,
      "to": null,
      "type": "INTERNAL",
      "search": null,
      "sort": "signups",
      "direction": "desc"
    },
    "ownerCountAll": 5,
    "codeCountAll": 15,
    "owners": [
      {
        "id": "5bd9cddb-7339-4110-9b6f-622527abd132",
        "name": "Sales12",
        "internal": true,
        "createdAt": "2026-10-12T15:39:01+05:30",
        "codes": {
          "active": 2,
          "total": 4
        },
        "signups": 0,
        "free": 0,
        "paid": 0,
        "lapsed": 0,
        "paidPercent": 0
      }
    ],
    "direct": null
  }
}
```
</details>

### Sales Referrals Code Picker Search

**Purpose:** A11 — codes grouped by owner for the Set referral code picker (inactive included by default).

**Inputs:** Query: search, includeInactive, limit (1–50)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/codes?limit=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `48ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "groups": [
      {
        "owner": {
          "id": "e585e5c9-4391-4f73-8732-7fa94b49bb02",
          "name": "cybermall",
          "internal": false
        },
        "codes": [
          {
            "id": "b71e3539-488f-49bd-af52-87be6f678750",
            "code": "CYBE-DNYJ",
            "label": "10%",
            "active": true
          },
          {
            "id": "92f01657-d754-4705-8094-af9063947e05",
            "code": "CYBE-JKD4",
            "label": "5%",
            "active": true
          },
          {
            "id": "4e74e006-3f8e-4cd3-9c13-8c5f7f515068",
            "code": "CYBE-VXND",
            "label": "15%",
            "active": true
          }
        ]
      },
      {
        "owner": {
          "id": "3311a5ee-2121-44ed-b7cc-aa16dd07374d",
          "name": "pravin",
          "internal": false
        },
        "codes": [
          {
            "id": "d513fb63-0b57-4a0e-9208-c7b5b20cca4e",
            "code": "PRAV-7DQJ",
            "label": "Pune",
            "active": true
          },
          {
            "id": "ec246619-4376-4afb-a7eb-b07476ba64f6",
            "code": "PRAV-PNTG",
            "label": "Delhi",
            "active": true
          }
        ]
      }
    ]
  }
}
```
</details>

### Sales Referrals Suggest Codes

**Purpose:** A9 — generates available codes from the owner name (SalesForYou → SFY-XXXX); nothing is reserved.

**Inputs:** {"ownerName":"SalesForYou","count":2,"exclude":"SFY-7K2Q"}

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/codes/suggest?ownerName=SalesForYou&count=2&exclude=SFY-7K2Q"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `67ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "suggestions": [
      "SFY-WESX",
      "SFY-U52K"
    ]
  }
}
```
</details>

### Sales Referrals Suggest Codes (no ownerName/ownerId — expect 400)

**Purpose:** A9 — exactly one of ownerName / ownerId is required.

**Inputs:** none

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/codes/suggest"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `2ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid request",
    "details": [
      {
        "field": null,
        "message": "\"value\" must contain at least one of [ownerName, ownerId]"
      }
    ]
  },
  "requestId": "7f816b16-3463-4f26-83c8-42365e21b65c"
}
```
</details>

### Sales Referrals Code Availability (invalid format)

**Purpose:** A10 — always 200; status carries AVAILABLE / TAKEN / INVALID_FORMAT.

**Inputs:** {"code":"bad code!"}

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/codes/availability?code=bad+code%21"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `2ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "code": "BAD CODE!",
    "status": "INVALID_FORMAT"
  }
}
```
</details>

### Sales Referrals Code Availability (available)

**Purpose:** A10 — code is normalised (trim + upper-case) and reported AVAILABLE when unused.

**Inputs:** {"code":"zz-test-78m36"}

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/codes/availability?code=zz-test-78m36"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `33ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "code": "ZZ-TEST-78M36",
    "status": "AVAILABLE"
  }
}
```
</details>

### Sales Referrals Signups (direct)

**Purpose:** A15 — workspaces with no code; statusCounts computed before the status filter; 0-based paging.

**Inputs:** direct=true&page=0&size=5

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/signups?direct=true&page=0&size=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `68ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "scope": {
      "type": "DIRECT",
      "code": null,
      "owner": null
    },
    "filters": {
      "from": null,
      "to": null,
      "status": null,
      "search": null,
      "source": null,
      "tenantType": null
    },
    "statusCounts": {
      "all": 0,
      "free": 0,
      "paid": 0,
      "lapsed": 0
    },
    "items": [],
    "page": 0,
    "size": 5,
    "totalItems": 0,
    "totalPages": 0
  }
}
```
</details>

### Sales Referrals Summary (byTenantType = FIRM + SOLO)

**Purpose:** A12 — reports read tenant_referrals (FIRM) and user_referrals (SOLO); byTenantType sums to totalSignups.

**Inputs:** none

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/summary"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `37ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "trackingSince": null,
    "filters": {
      "from": null,
      "to": null,
      "type": "ALL"
    },
    "totalSignups": 9,
    "viaCode": 9,
    "direct": 0,
    "free": {
      "total": 7,
      "viaCode": 7
    },
    "paid": {
      "total": 2,
      "viaCode": 2
    },
    "lapsed": {
      "total": 0,
      "viaCode": 0
    },
    "paidPercent": 22,
    "byTenantType": {
      "FIRM": 2,
      "SOLO": 7
    }
  }
}
```
</details>

### Sales Referrals Signups (tenantType=SOLO filter)

**Purpose:** A15 — items carry tenantType; tenantType=SOLO returns only solo-lawyer rows (user_referrals).

**Inputs:** {"direct":true,"tenantType":"SOLO","page":0,"size":5}

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/signups?direct=true&tenantType=SOLO&page=0&size=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `67ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "scope": {
      "type": "DIRECT",
      "code": null,
      "owner": null
    },
    "filters": {
      "from": null,
      "to": null,
      "status": null,
      "search": null,
      "source": null,
      "tenantType": "SOLO"
    },
    "statusCounts": {
      "all": 0,
      "free": 0,
      "paid": 0,
      "lapsed": 0
    },
    "items": [],
    "page": 0,
    "size": 5,
    "totalItems": 0,
    "totalPages": 0
  }
}
```
</details>

### Sales Referrals Signups (tenantType invalid — expect 400)

**Purpose:** A15 — tenantType must be FIRM or SOLO.

**Inputs:** {"direct":true,"tenantType":"BOGUS"}

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/signups?direct=true&tenantType=BOGUS"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `5ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid request",
    "details": [
      {
        "field": "tenantType",
        "message": "\"tenantType\" must be one of [FIRM, SOLO, ]"
      }
    ]
  },
  "requestId": "b3e5a1f4-12c6-42f3-bbd8-438b85f8430f"
}
```
</details>

### Sales Referrals Tenant Referral (UNKNOWN solo user id — expect 404)

**Purpose:** A17 — an integer id is looked up in users / user_referrals; unknown → TENANT_NOT_FOUND.

**Inputs:** tenantId = 2147483000

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/tenants/2147483000/referral"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `35ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "This workspace no longer exists."
  },
  "requestId": "411cae2e-e986-4497-ab39-00dc409ad983"
}
```
</details>

### Sales Referrals Tenant Referral (solo user id resolves)

**Purpose:** A17 — /tenants/{id} accepts a users.id for solo lawyers and reads user_referrals.

**Inputs:** tenantId = 110

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/tenants/110/referral"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `145ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "tenantId": "110",
    "tenantType": "SOLO",
    "firmName": "Pravin Sarule",
    "referral": {
      "referredBy": "CODE",
      "tracked": true,
      "code": {
        "id": "d513fb63-0b57-4a0e-9208-c7b5b20cca4e",
        "code": "PRAV-7DQJ",
        "label": "Pune",
        "active": true
      },
      "owner": {
        "id": "3311a5ee-2121-44ed-b7cc-aa16dd07374d",
        "name": "pravin",
        "internal": false
      },
      "source": "SIGNUP",
      "signedUpAt": "2026-10-12T16:56:58+05:30",
      "setBy": null,
      "setAt": null,
      "reason": null
    }
  }
}
```
</details>

### Sales Referrals Signups (no scope — expect 400)

**Purpose:** A15 — exactly one of codeId / ownerId / direct=true is required.

**Inputs:** none

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/signups"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `4ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid request",
    "details": [
      {
        "field": "scope",
        "message": "Pass exactly one of codeId, ownerId or direct=true",
        "given": []
      }
    ]
  },
  "requestId": "92d8f847-4d97-4897-b51c-b714704b5d15"
}
```
</details>

### Sales Referrals Owner Detail (UNKNOWN id — expect 404)

**Purpose:** A3 — unknown owner id → SALES_OWNER_NOT_FOUND.

**Inputs:** ownerId = all-zero UUID

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/owners/00000000-0000-0000-0000-000000000000"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `38ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "SALES_OWNER_NOT_FOUND",
    "message": "This sales owner no longer exists."
  },
  "requestId": "4b7dbae2-5c10-4725-b32b-f880d03a0e8f"
}
```
</details>

### Sales Referrals Owner Detail

**Purpose:** A3 — owner profile + every code (active, inactive, refreshed) + codeCounts.

**Inputs:** ownerId = 3311a5ee-2121-44ed-b7cc-aa16dd07374d

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/owners/3311a5ee-2121-44ed-b7cc-aa16dd07374d"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `98ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "id": "3311a5ee-2121-44ed-b7cc-aa16dd07374d",
    "name": "pravin",
    "internal": false,
    "notes": "test",
    "createdAt": "2026-10-12T15:44:50+05:30",
    "createdBy": {
      "id": 1,
      "name": "Santosh Dahadrai"
    },
    "updatedAt": "2026-10-12T15:44:50+05:30",
    "updatedBy": {
      "id": 1,
      "name": "Santosh Dahadrai"
    },
    "codeCounts": {
      "active": 2,
      "total": 2
    },
    "codes": [
      {
        "id": "d513fb63-0b57-4a0e-9208-c7b5b20cca4e",
        "code": "PRAV-7DQJ",
        "label": "Pune",
        "active": true,
        "replacedByCode": null,
        "createdAt": "2026-10-12T15:44:50+05:30"
      },
      {
        "id": "ec246619-4376-4afb-a7eb-b07476ba64f6",
        "code": "PRAV-PNTG",
        "label": "Delhi",
        "active": true,
        "replacedByCode": null,
        "createdAt": "2026-10-12T15:44:50+05:30"
      }
    ]
  }
}
```
</details>

### Sales Referrals Owner Code Breakdown

**Purpose:** A14 — per-code signups / free / paid / lapsed / paidPercent + totals for the owner detail page.

**Inputs:** ownerId = 3311a5ee-2121-44ed-b7cc-aa16dd07374d; Query: from, to

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/owners/3311a5ee-2121-44ed-b7cc-aa16dd07374d/codes"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `66ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "owner": {
      "id": "3311a5ee-2121-44ed-b7cc-aa16dd07374d",
      "name": "pravin",
      "internal": false
    },
    "filters": {
      "from": null,
      "to": null
    },
    "totals": {
      "signups": 4,
      "free": 3,
      "paid": 1,
      "lapsed": 0,
      "paidPercent": 25
    },
    "codes": [
      {
        "id": "d513fb63-0b57-4a0e-9208-c7b5b20cca4e",
        "code": "PRAV-7DQJ",
        "label": "Pune",
        "active": true,
        "replacedByCode": null,
        "createdAt": "2026-10-12T15:44:50+05:30",
        "signups": 4,
        "free": 3,
        "paid": 1,
        "lapsed": 0,
        "paidPercent": 25
      },
      {
        "id": "ec246619-4376-4afb-a7eb-b07476ba64f6",
        "code": "PRAV-PNTG",
        "label": "Delhi",
        "active": true,
        "replacedByCode": null,
        "createdAt": "2026-10-12T15:44:50+05:30",
        "signups": 0,
        "free": 0,
        "paid": 0,
        "lapsed": 0,
        "paidPercent": 0
      }
    ]
  }
}
```
</details>

### Sales Referrals Signups (by code)

**Purpose:** A15 — workspaces that signed up under one code.

**Inputs:** codeId = b71e3539-488f-49bd-af52-87be6f678750

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/reports/signups?codeId=b71e3539-488f-49bd-af52-87be6f678750"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `108ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "scope": {
      "type": "CODE",
      "code": {
        "id": "b71e3539-488f-49bd-af52-87be6f678750",
        "code": "CYBE-DNYJ",
        "label": "10%",
        "active": true
      },
      "owner": {
        "id": "e585e5c9-4391-4f73-8732-7fa94b49bb02",
        "name": "cybermall",
        "internal": false
      }
    },
    "filters": {
      "from": null,
      "to": null,
      "status": null,
      "search": null,
      "source": null,
      "tenantType": null
    },
    "statusCounts": {
      "all": 1,
      "free": 1,
      "paid": 0,
      "lapsed": 0
    },
    "items": [
      {
        "tenantType": "SOLO",
        "tenantId": "115",
        "firmName": "Rutuja ",
        "ownerEmail": "jesoxel161@18lover.com",
        "ownerAccountDeleted": false,
        "signedUpAt": "2026-10-13T09:26:19+05:30",
        "code": "CYBE-DNYJ",
        "planStatus": "FREE",
        "seats": 1,
        "emailVerified": true,
        "source": "SIGNUP"
      }
    ],
    "page": 0,
    "size": 20,
    "totalItems": 1,
    "totalPages": 1
  }
}
```
</details>

### Sales Referrals Create Owner (INVALID body — expect 400)

**Purpose:** A1 — body validation: name required, internal boolean, codes array. Nothing is created.

**Inputs:** {"name":"","internal":"maybe","codes":"x"}

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/owners" -H "Content-Type: application/json" -d '{"name":"","internal":"maybe","codes":"x"}'
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `6ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Invalid request",
    "details": [
      {
        "field": "name",
        "message": "\"name\" is not allowed to be empty"
      },
      {
        "field": "internal",
        "message": "\"internal\" must be a boolean"
      },
      {
        "field": "codes",
        "message": "\"codes\" must be an array"
      }
    ]
  },
  "requestId": "936e7980-ee80-4c18-bc19-f65f95418893"
}
```
</details>

### Sales Referrals Set Workspace Referral (UNKNOWN tenant — expect 404)

**Purpose:** A16 — unknown workspace id → TENANT_NOT_FOUND. Nothing is written.

**Inputs:** {"codeId":"00000000-0000-0000-0000-000000000000","reason":"Automated test — should fail on the unknown workspace"}

**Example curl:**
```bash
curl -s -X PUT -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/tenants/00000000-0000-0000-0000-000000000000/referral" -H "Content-Type: application/json" -d '{"codeId":"00000000-0000-0000-0000-000000000000","reason":"Automated test — should fail on the unknown workspace"}'
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `104ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "This workspace no longer exists."
  },
  "requestId": "53103539-7511-46b1-a687-104b9435e4d8"
}
```
</details>

---

## Onboarded Users

### Onboarded Users Summary

**Purpose:** Users / paid / lapsed / free / revenue totals, split by onboarding channel (SELF, INTERNAL, OUTSOURCED), sales owner, plan and account type. Channel buckets must add up to the total.

**Inputs:** Query: same filters as the list

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/onboarded-users/summary"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `80ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-13T04:46:59.838Z",
    "generated_at_ist": {
      "iso": "2026-10-13T10:16:59+05:30",
      "date": "13 Oct 2026",
      "time": "10:16 AM",
      "time24": "10:16",
      "weekday": "Tue",
      "display": "Tue, 13 Oct 2026, 10:16 AM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-13T04:46:59.838Z",
      "epoch_ms": 1791866819838
    },
    "filters": {
      "channel": "all",
      "owner_id": "all",
      "code": "all",
      "source": "all",
      "account_type": "all",
      "approval_status": "all",
      "plan": "all",
      "plan_status": "all",
      "active": null,
      "has_payments": null,
      "has_subscription": null,
      "min_total_paid": null,
      "firm_id": null,
      "search": null,
      "from": null,
      "to": null,
      "timezone": "Asia/Kolkata"
    },
    "truncated": false,
    "totals": {
      "users": 77,
      "paid": 12,
      "lapsed": 21,
      "free": 44,
      "with_workspace": 21,
      "total_paid": 150795,
      "subscription_paid": 149161,
      "topup_paid": 490,
      "storage_paid": 1144,
      "payments": 48,
      "paid_rate_pct": 15.6
    },
    "by_channel": [
      {
        "channel": "SELF",
        "users": 68,
        "paid": 10,
        "lapsed": 17,
        "free": 41,
        "with_workspace": 19,
        "total_paid": 150595,
        "subscription_paid": 148961,
        "topup_paid": 490,
        "storage_paid": 1144,
        "payments": 46,
        "paid_rate_pct": 14.7
      },
      {
        "channel": "INTERNAL",
        "users": 0,
        "paid": 0,
        "lapsed": 0,
        "free": 0,
        "with_workspace": 0,
        "total_paid": 0,
        "subscription_paid": 0,
        "topup_paid": 0,
        "storage_paid": 0,
        "payments": 0,
        "paid_rate_pct": 0
      },
      {
        "channel": "OUTSOURCED",
        "users": 9,
        "paid": 2,
        "lapsed": 4,
        "free": 3,
        "with_workspace": 2,
        
... (truncated)
```
</details>

### Onboarded Users Meta

**Purpose:** Channels (with aliases), sales owners, referral codes, plans, account types for filter dropdowns.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/onboarded-users/meta"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `38ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "channels": [
      {
        "value": "SELF",
        "label": "Self signup",
        "aliases": [
          "DIRECT"
        ]
      },
      {
        "value": "INTERNAL",
        "label": "Internal sales",
        "aliases": [
          "INHOUSE"
        ]
      },
      {
        "value": "OUTSOURCED",
        "label": "Outsourced / agency",
        "aliases": [
          "AGENCY"
        ]
      }
    ],
    "plan_statuses": [
      "PAID",
      "LAPSED",
      "FREE"
    ],
    "sources": [
      "SIGNUP",
      "ADMIN"
    ],
    "sales_owners": [
      {
        "id": "e585e5c9-4391-4f73-8732-7fa94b49bb02",
        "name": "cybermall",
        "internal": false,
        "channel": "OUTSOURCED"
      },
      {
        "id": "3311a5ee-2121-44ed-b7cc-aa16dd07374d",
        "name": "pravin",
        "internal": false,
        "channel": "OUTSOURCED"
      },
      {
        "id": "7d6db562-102f-48db-b6f3-e146ef125f0d",
        "name": "Rutuja",
        "internal": false,
        "channel": "OUTSOURCED"
      },
      {
        "id": "5bd9cddb-7339-4110-9b6f-622527abd132",
        "name": "Sales12",
        "internal": true,
        "channel": "INTERNAL"
      },
      {
        "id": "57b051e6-ca59-4628-b091-2a313fbd9f2d",
        "name": "Test sale",
        "internal": false,
        "channel": "OUTSOURCED"
      }
    ],
    "referral_codes": [
      {
        "id": "b71e3539-488f-49bd-af52-87be6f678750",
        "code": "CYBE-DNYJ",
        "label": "10%",
        "active": true,
        "owner_id": "e585e5c9-4391-4f73-8732-7fa94b49bb02",
        "owner_name": "cybermall"
      },
      {
        "id": "92f01657-d754-4705-8094-af9063947e05",
        "code": "CYBE-JKD4",
        "label": "5%",
        "active": true,
        "owner_id": "e585e5c9-4391-4f73-8732-7fa94b49bb02",
        "owner_name": "cybermall"
      },
      {
        "id": "4e74e006-3f8e-4cd3-9c13-8c5f7f515068",
        "code": "CYBE-VXND",
        "label": "15%",
    
... (truncated)
```
</details>

### Onboarded Users List

**Purpose:** Every user with workspace, onboarding channel / referral code / sales owner, current plan + status (PAID / LAPSED / FREE) and a subscription summary (counts, totals, first / last payment) from the Payment DB.

**Inputs:** Query: page, limit, sort, channel, owner_id, code, source, account_type, plan_status, plan, has_payments, search, from, to

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/onboarded-users?page=1&limit=10&sort=revenue"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `91ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 3,
        "email": "pravin.sarule@nexintelai.com",
        "username": "Pravin",
        "phone": null,
        "location": null,
        "auth_type": "manual",
        "role": "user",
        "domain_role": null,
        "account_type": null,
        "approval_status": "APPROVED",
        "is_active": true,
        "is_blocked": false,
        "first_login": true,
        "created_at": "2025-12-03T04:45:35.002Z",
        "created_at_ist": {
          "iso": "2025-12-03T10:15:35+05:30",
          "date": "03 Dec 2025",
          "time": "10:15 AM",
          "time24": "10:15",
          "weekday": "Wed",
          "display": "Wed, 03 Dec 2025, 10:15 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2025-12-03T04:45:35.002Z",
          "epoch_ms": 1764737135002
        },
        "onboarded_ago": "314d",
        "last_login_at": "2026-09-16T03:54:27.439Z",
        "last_login_at_ist": {
          "iso": "2026-09-16T09:24:27+05:30",
          "date": "16 Sep 2026",
          "time": "09:24 AM",
          "time24": "09:24",
          "weekday": "Wed",
          "display": "Wed, 16 Sep 2026, 09:24 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-09-16T03:54:27.439Z",
          "epoch_ms": 1789530867439
        },
        "last_seen_at": "2026-10-08T08:48:30.638Z",
        "last_seen_at_ist": {
          "iso": "2026-10-08T14:18:30+05:30",
          "date": "08 Oct 2026",
          "time": "02:18 PM",
          "time24": "14:18",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 02:18 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T08:48:30.638Z",
          "epoch_ms": 1791449310638
        },
        "razorpay_customer_id": "cust_S0ZGcW6p5EXvnE",
        "workspace": null,
        "profile": {
          "organization_name": null,
          "organization_type": null,
          "primary_role": null,
          "primary_jurisdiction": null,
          "main_areas_of_pract
... (truncated)
```
</details>

### Onboarded Users List (channel filter)

**Purpose:** channel=agency,internal (agency is an alias of OUTSOURCED) returns only referred users, each with a code and sales owner.

**Inputs:** Query: channel

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/onboarded-users?channel=agency%2Cinternal&limit=100"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `77ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 115,
        "email": "jesoxel161@18lover.com",
        "username": "Rutuja ",
        "phone": "+919503887353",
        "location": null,
        "auth_type": "manual",
        "role": "user",
        "domain_role": "LEGAL_PROFESSIONAL",
        "account_type": "SOLO",
        "approval_status": "APPROVED",
        "is_active": true,
        "is_blocked": false,
        "first_login": false,
        "created_at": "2026-10-12T22:26:19.406Z",
        "created_at_ist": {
          "iso": "2026-10-13T03:56:19+05:30",
          "date": "13 Oct 2026",
          "time": "03:56 AM",
          "time24": "03:56",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 03:56 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-12T22:26:19.406Z",
          "epoch_ms": 1791843979406
        },
        "onboarded_ago": "6h 20m",
        "last_login_at": "2026-10-13T03:56:19.485Z",
        "last_login_at_ist": {
          "iso": "2026-10-13T09:26:19+05:30",
          "date": "13 Oct 2026",
          "time": "09:26 AM",
          "time24": "09:26",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:26 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T03:56:19.485Z",
          "epoch_ms": 1791863779485
        },
        "last_seen_at": "2026-10-13T03:56:19.485Z",
        "last_seen_at_ist": {
          "iso": "2026-10-13T09:26:19+05:30",
          "date": "13 Oct 2026",
          "time": "09:26 AM",
          "time24": "09:26",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 09:26 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-13T03:56:19.485Z",
          "epoch_ms": 1791863779485
        },
        "razorpay_customer_id": null,
        "workspace": null,
        "profile": {
          "organization_name": null,
          "organization_type": null,
          "primary_role": null,
          "primary_jurisdiction": null,
          "main_ar
... (truncated)
```
</details>

### Onboarded Users List (plan_status=PAID)

**Purpose:** plan_status filters on the derived status (PAID = paid active_plan_name; LAPSED = not paid now but has subscriptions; FREE otherwise).

**Inputs:** Query: plan_status=PAID

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/onboarded-users?plan_status=PAID&limit=100"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `108ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 113,
        "email": "doyagag249@leafflip.com",
        "username": "Pravin Sarule",
        "phone": "+919634568596",
        "location": null,
        "auth_type": "manual",
        "role": "user",
        "domain_role": "LEGAL_PROFESSIONAL",
        "account_type": "SOLO",
        "approval_status": "APPROVED",
        "is_active": true,
        "is_blocked": false,
        "first_login": false,
        "created_at": "2026-10-12T06:40:17.811Z",
        "created_at_ist": {
          "iso": "2026-10-12T12:10:17+05:30",
          "date": "12 Oct 2026",
          "time": "12:10 PM",
          "time24": "12:10",
          "weekday": "Mon",
          "display": "Mon, 12 Oct 2026, 12:10 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-12T06:40:17.811Z",
          "epoch_ms": 1791787217811
        },
        "onboarded_ago": "22h 6m",
        "last_login_at": "2026-10-12T12:10:17.843Z",
        "last_login_at_ist": {
          "iso": "2026-10-12T17:40:17+05:30",
          "date": "12 Oct 2026",
          "time": "05:40 PM",
          "time24": "17:40",
          "weekday": "Mon",
          "display": "Mon, 12 Oct 2026, 05:40 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-12T12:10:17.843Z",
          "epoch_ms": 1791807017843
        },
        "last_seen_at": "2026-10-12T12:10:17.843Z",
        "last_seen_at_ist": {
          "iso": "2026-10-12T17:40:17+05:30",
          "date": "12 Oct 2026",
          "time": "05:40 PM",
          "time24": "17:40",
          "weekday": "Mon",
          "display": "Mon, 12 Oct 2026, 05:40 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-12T12:10:17.843Z",
          "epoch_ms": 1791807017843
        },
        "razorpay_customer_id": null,
        "workspace": null,
        "profile": {
          "organization_name": null,
          "organization_type": null,
          "primary_role": null,
          "primary_jurisdiction": null,
          "
... (truncated)
```
</details>

### Onboarded Users List (INVALID channel — expect 400)

**Purpose:** channel must be self, internal, outsourced (alias agency).

**Inputs:** Query: channel=bogus

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/onboarded-users?channel=bogus"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `3ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      "Unknown channel \"BOGUS\". Allowed: self, internal, outsourced (alias agency)"
    ]
  },
  "requestId": "2a799ff6-8490-4ddc-9e97-6f828ffb3421"
}
```
</details>

### Onboarded User Detail

**Purpose:** One user with the complete subscription history: every subscription (plan, dates, tokens), payment, token top-up and storage add-on, storage usage, referral-code history and a chronological timeline.

**Inputs:** Path: userId

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/onboarded-users/3"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `234ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 3,
      "email": "pravin.sarule@nexintelai.com",
      "username": "Pravin",
      "phone": null,
      "location": null,
      "auth_type": "manual",
      "role": "user",
      "domain_role": null,
      "account_type": null,
      "approval_status": "APPROVED",
      "is_active": true,
      "is_blocked": false,
      "first_login": true,
      "created_at": "2025-12-03T04:45:35.002Z",
      "created_at_ist": {
        "iso": "2025-12-03T10:15:35+05:30",
        "date": "03 Dec 2025",
        "time": "10:15 AM",
        "time24": "10:15",
        "weekday": "Wed",
        "display": "Wed, 03 Dec 2025, 10:15 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2025-12-03T04:45:35.002Z",
        "epoch_ms": 1764737135002
      },
      "onboarded_ago": "314d",
      "last_login_at": "2026-09-16T03:54:27.439Z",
      "last_login_at_ist": {
        "iso": "2026-09-16T09:24:27+05:30",
        "date": "16 Sep 2026",
        "time": "09:24 AM",
        "time24": "09:24",
        "weekday": "Wed",
        "display": "Wed, 16 Sep 2026, 09:24 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-09-16T03:54:27.439Z",
        "epoch_ms": 1789530867439
      },
      "last_seen_at": "2026-10-08T08:48:30.638Z",
      "last_seen_at_ist": {
        "iso": "2026-10-08T14:18:30+05:30",
        "date": "08 Oct 2026",
        "time": "02:18 PM",
        "time24": "14:18",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 02:18 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T08:48:30.638Z",
        "epoch_ms": 1791449310638
      },
      "razorpay_customer_id": "cust_S0ZGcW6p5EXvnE",
      "workspace": null,
      "profile": {
        "organization_name": null,
        "organization_type": null,
        "primary_role": null,
        "primary_jurisdiction": null,
        "main_areas_of_practice": null
      },
      "onboarding": {
        "channel": "SELF",
        "channel_label": "Self signup",
        "tracked
... (truncated)
```
</details>

### Onboarded User Detail (UNKNOWN — expect 404)

**Purpose:** Unknown user id returns NOT_FOUND.

**Inputs:** Path: userId

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/onboarded-users/999999999"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `35ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  },
  "requestId": "7ce6fabc-eedc-45d2-998a-b7a95e117854"
}
```
</details>

### Onboarded Users CSV (users)

**Purpose:** CSV, one row per user: profile, workspace, onboarding channel / code / owner, plan status, current subscription, counts and totals.

**Inputs:** Query: same filters as the list, mode=users

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/onboarded-users/export"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `89ms`

<details><summary>Response sample</summary>

```json
User id,Email,Name,Phone,Account type,Role,Approval status,Active,Onboarded (IST),Onboarded date (IST),Last login (IST),Workspace,Workspace type,Workspace role,Organisation,Onboarding channel,Channel label,Referral level,Referral source,Referral code,Code label,Sales owner,Owner type,Referral signed up (IST),Plan status,Active plan,Plan updated (IST),Current subscription plan,Current subscription status,Current subscription start (IST),Current subscription end (IST),Subscriptions,Active subscriptions,Plans used,First subscribed (IST),Last subscribed (IST),Payments (captured),Subscription paid,
```
</details>

### Onboarded Users CSV (history)

**Purpose:** CSV, one row per subscription / payment / top-up / storage add-on event with the user columns repeated.

**Inputs:** Query: mode=history (+ filters)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/onboarded-users/export?mode=history&has_subscription=true"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `1257ms`

<details><summary>Response sample</summary>

```json
User id,Email,Name,Onboarding channel,Sales owner,Referral code,Workspace,Event (IST),Event date (IST),Event type,Title,Detail,Status,Amount,Currency,Reference id,Event (UTC)
114,vodeye2305@copytosh.com,test,OUTSOURCED,Test sale,TS-KE7N,,"Mon, 12 Oct 2026, 12:18 PM IST",2026-10-12,SIGNUP,Signed up (Outsourced / agency),code TS-KE7N · Test sale,,,,,2026-10-12T06:48:19.469Z
114,vodeye2305@copytosh.com,test,OUTSOURCED,Test sale,TS-KE7N,,"Mon, 12 Oct 2026, 05:49 PM IST",2026-10-12,SUBSCRIPTION,Basic subscription active,12 Oct 2026 → 12 Nov 2026,active,10,INR,140,2026-10-12T12:19:21.202Z
113,doy
```
</details>

---

## Referral Data

### Referral Data Summary

**Purpose:** Stat cards for the All referral data screen: accounts, via code, direct, paid / lapsed / free, seats, purchases, total paid; split by owner type and by owner.

**Inputs:** Query: same filters as the list

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/data/summary"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `100ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-13T04:47:01.854Z",
    "generated_at_ist": {
      "iso": "2026-10-13T10:17:01+05:30",
      "date": "13 Oct 2026",
      "time": "10:17 AM",
      "time24": "10:17",
      "weekday": "Tue",
      "display": "Tue, 13 Oct 2026, 10:17 AM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-13T04:47:01.854Z",
      "epoch_ms": 1791866821854
    },
    "filters": {
      "owner_id": "all",
      "code": "all",
      "type": "all",
      "status": "all",
      "include_direct": true,
      "source": "all",
      "kind": "all",
      "q": null,
      "from": null,
      "to": null,
      "timezone": "Asia/Kolkata"
    },
    "truncated": false,
    "totals": {
      "accounts": 72,
      "workspaces": 16,
      "users": 56,
      "via_code": 9,
      "direct": 63,
      "paid": 12,
      "lapsed": 21,
      "free": 39,
      "seats": 77,
      "purchases": 63,
      "total_paid": 150795,
      "paid_pct": 16.7
    },
    "by_owner_type": [
      {
        "owner_type": "INTERNAL",
        "accounts": 0,
        "workspaces": 0,
        "users": 0,
        "via_code": 0,
        "direct": 0,
        "paid": 0,
        "lapsed": 0,
        "free": 0,
        "seats": 0,
        "purchases": 0,
        "total_paid": 0,
        "paid_pct": 0
      },
      {
        "owner_type": "OUTSOURCED",
        "accounts": 9,
        "workspaces": 2,
        "users": 7,
        "via_code": 9,
        "direct": 0,
        "paid": 2,
        "lapsed": 4,
        "free": 3,
        "seats": 9,
        "purchases": 2,
        "total_paid": 200,
        "paid_pct": 22.2
      },
      {
        "owner_type": "DIRECT",
        "accounts": 63,
        "workspaces": 14,
        "users": 49,
        "via_code": 0,
        "direct": 63,
        "paid": 10,
        "lapsed": 17,
        "free": 36,
        "seats": 68,
        "purchases": 61,
        "total_paid": 150595,
        "paid_pct": 15.9
      }
    ],
    "by_owner": [
      {
    
... (truncated)
```
</details>

### Referral Data Workspaces

**Purpose:** One row per account (workspace or solo user): sales owner, code, signup date, attribution (SIGNUP / ADMIN / DIRECT), current plan, purchases, total paid, last purchase, seats.

**Inputs:** Query: page, limit, sort, owner_id, code, type, status, include_direct, source, kind, q, from, to, include_history

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/data/workspaces?page=1&limit=10&sort=total_paid"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `83ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "3",
        "kind": "user",
        "name": "Pravin",
        "firm_id": null,
        "firm_type": null,
        "city": null,
        "state": null,
        "approval_status": "APPROVED",
        "verified": true,
        "is_active": true,
        "primary_user": {
          "id": 3,
          "email": "pravin.sarule@nexintelai.com",
          "name": "Pravin",
          "phone": null,
          "account_type": null
        },
        "seats": 1,
        "seat_user_ids": [
          3
        ],
        "signed_up_at": "2025-12-03T04:45:35.002Z",
        "signed_up_at_ist": {
          "iso": "2025-12-03T10:15:35+05:30",
          "date": "03 Dec 2025",
          "time": "10:15 AM",
          "time24": "10:15",
          "weekday": "Wed",
          "display": "Wed, 03 Dec 2025, 10:15 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2025-12-03T04:45:35.002Z",
          "epoch_ms": 1764737135002
        },
        "owner_type": "DIRECT",
        "sales_owner": null,
        "code": null,
        "attribution": {
          "source": "DIRECT",
          "level": null,
          "signed_up_at": null,
          "set_at": null,
          "set_at_ist": null,
          "set_by": null,
          "reason": null
        },
        "status": "LAPSED",
        "current_plan": {
          "name": "Max",
          "billing": "Monthly",
          "display": "Max · Monthly",
          "status": "active",
          "start_date": "2026-06-02T00:00:00.000Z",
          "end_date": "2026-07-02T00:00:00.000Z",
          "end_date_ist": {
            "iso": "2026-07-02T05:30:00+05:30",
            "date": "02 Jul 2026",
            "time": "05:30 AM",
            "time24": "05:30",
            "weekday": "Thu",
            "display": "Thu, 02 Jul 2026, 05:30 AM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-07-02T00:00:00.000Z",
            "epoch_ms": 1782950400000
          },
          "is_expired": true,
          "price":
... (truncated)
```
</details>

### Referral Data Workspaces (type + no Direct)

**Purpose:** type=outsourced with include_direct=false returns only accounts attributed to an outsourced owner.

**Inputs:** Query: type=outsourced&include_direct=false

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/data/workspaces?include_direct=false&type=outsourced&limit=100"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `76ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "115",
        "kind": "user",
        "name": "Rutuja ",
        "firm_id": null,
        "firm_type": null,
        "city": null,
        "state": null,
        "approval_status": "APPROVED",
        "verified": true,
        "is_active": true,
        "primary_user": {
          "id": 115,
          "email": "jesoxel161@18lover.com",
          "name": "Rutuja ",
          "phone": "+919503887353",
          "account_type": "SOLO"
        },
        "seats": 1,
        "seat_user_ids": [
          115
        ],
        "signed_up_at": "2026-10-12T22:26:19.406Z",
        "signed_up_at_ist": {
          "iso": "2026-10-13T03:56:19+05:30",
          "date": "13 Oct 2026",
          "time": "03:56 AM",
          "time24": "03:56",
          "weekday": "Tue",
          "display": "Tue, 13 Oct 2026, 03:56 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-12T22:26:19.406Z",
          "epoch_ms": 1791843979406
        },
        "owner_type": "OUTSOURCED",
        "sales_owner": {
          "id": "e585e5c9-4391-4f73-8732-7fa94b49bb02",
          "name": "cybermall",
          "internal": false,
          "type": "OUTSOURCED"
        },
        "code": {
          "code": "CYBE-DNYJ",
          "label": "10%",
          "active": true
        },
        "attribution": {
          "source": "SIGNUP",
          "level": "user",
          "signed_up_at": "2026-10-13T03:56:19.412Z",
          "set_at": null,
          "set_at_ist": null,
          "set_by": null,
          "reason": null
        },
        "status": "FREE",
        "current_plan": {
          "name": null,
          "billing": null,
          "display": "Free",
          "status": null,
          "start_date": null,
          "end_date": null,
          "end_date_ist": null,
          "is_expired": null,
          "price": null,
          "currency": null
        },
        "purchases": 0,
        "subscriptions": 0,
        "total_paid": 0,
        "subscription_pa
... (truncated)
```
</details>

### Referral Data Account Detail

**Purpose:** Expanded row: the account, its seats, the plan-history timeline (trial, purchase, upgrade, renewal, top-up, storage add-on, cancelled) and raw Payment-DB history per seat.

**Inputs:** Path: id (firm UUID or user id)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/data/workspaces/3"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `116ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "account": {
      "id": "3",
      "kind": "user",
      "name": "Pravin",
      "firm_id": null,
      "firm_type": null,
      "city": null,
      "state": null,
      "approval_status": "APPROVED",
      "verified": true,
      "is_active": true,
      "primary_user": {
        "id": 3,
        "email": "pravin.sarule@nexintelai.com",
        "name": "Pravin",
        "phone": null,
        "account_type": null
      },
      "seats": 1,
      "seat_user_ids": [
        3
      ],
      "signed_up_at": "2025-12-03T04:45:35.002Z",
      "signed_up_at_ist": {
        "iso": "2025-12-03T10:15:35+05:30",
        "date": "03 Dec 2025",
        "time": "10:15 AM",
        "time24": "10:15",
        "weekday": "Wed",
        "display": "Wed, 03 Dec 2025, 10:15 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2025-12-03T04:45:35.002Z",
        "epoch_ms": 1764737135002
      },
      "owner_type": "DIRECT",
      "sales_owner": null,
      "code": null,
      "attribution": {
        "source": "DIRECT",
        "level": null,
        "signed_up_at": null,
        "set_at": null,
        "set_at_ist": null,
        "set_by": null,
        "reason": null
      },
      "status": "LAPSED",
      "current_plan": {
        "name": "Max",
        "billing": "Monthly",
        "display": "Max · Monthly",
        "status": "active",
        "start_date": "2026-06-02T00:00:00.000Z",
        "end_date": "2026-07-02T00:00:00.000Z",
        "end_date_ist": {
          "iso": "2026-07-02T05:30:00+05:30",
          "date": "02 Jul 2026",
          "time": "05:30 AM",
          "time24": "05:30",
          "weekday": "Thu",
          "display": "Thu, 02 Jul 2026, 05:30 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-07-02T00:00:00.000Z",
          "epoch_ms": 1782950400000
        },
        "is_expired": true,
        "price": 999,
        "currency": "INR"
      },
      "purchases": 6,
      "subscriptions": 1,
      "total_paid": 130998,
      "subscription_
... (truncated)
```
</details>

### Referral Data Purchases

**Purpose:** Plan purchases tab: one row per paid event across all accounts (date, workspace, owner, code, event, plan, billing, amount, payment id, status).

**Inputs:** Query: same filters + event (purchase, upgrade, renewal, topup, storage_addon)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/data/purchases?page=1&limit=10"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `2889ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "at": "2026-10-12T12:19:21.202Z",
        "kind": "purchase",
        "title": "Plan purchased",
        "plan": "Basic",
        "billing": "Monthly",
        "amount": 10,
        "currency": "INR",
        "payment_id": null,
        "status": "active",
        "user_id": 114,
        "user_email": null,
        "subscription_id": 140,
        "period": {
          "start": "2026-10-12T00:00:00.000Z",
          "end": "2026-11-12T00:00:00.000Z"
        },
        "at_ist": {
          "iso": "2026-10-12T17:49:21+05:30",
          "date": "12 Oct 2026",
          "time": "05:49 PM",
          "time24": "17:49",
          "weekday": "Mon",
          "display": "Mon, 12 Oct 2026, 05:49 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-12T12:19:21.202Z",
          "epoch_ms": 1791807561202
        },
        "account": {
          "id": "114",
          "kind": "user",
          "name": "test",
          "primary_user": {
            "id": 114,
            "email": "vodeye2305@copytosh.com",
            "name": "test",
            "phone": "+919863426543",
            "account_type": "SOLO"
          },
          "sales_owner": {
            "id": "57b051e6-ca59-4628-b091-2a313fbd9f2d",
            "name": "Test sale",
            "internal": false,
            "type": "OUTSOURCED"
          },
          "owner_type": "OUTSOURCED",
          "code": {
            "code": "TS-KE7N",
            "label": null,
            "active": true
          }
        }
      },
      {
        "at": "2026-10-12T12:10:48.204Z",
        "kind": "purchase",
        "title": "Plan purchased",
        "plan": "Pro",
        "billing": "Monthly",
        "amount": 100,
        "currency": "INR",
        "payment_id": "pay_TmzYq5xEp4hZmO",
        "status": "Success",
        "user_id": 113,
        "user_email": null,
        "subscription_id": 138,
        "period": {
          "start": "2026-10-12T00:00:00.000Z",
          "end": "2026-11-12T00:0
... (truncated)
```
</details>

### Referral Data (INVALID type — expect 400)

**Purpose:** type must be all, internal or outsourced.

**Inputs:** Query: type=bogus

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/data/workspaces?type=bogus"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `1ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      "Unknown type \"bogus\". Allowed: all, internal, outsourced"
    ]
  },
  "requestId": "dd5fe3c4-02b1-49ca-925a-5a2469d60be2"
}
```
</details>

### Referral Data CSV (workspaces, chosen columns)

**Purpose:** Export dialog: kind=workspaces with a column selection; the header must contain exactly the chosen columns in catalogue order.

**Inputs:** Query: export=workspaces&columns=…

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/data/export?export=workspaces&columns=workspace%2Cowner%2Ccode%2Cstatus%2Ctotal_paid"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `75ms`

<details><summary>Response sample</summary>

```json
Workspace / user,Sales owner,Code,Plan status,Total paid
"Rutuja ",cybermall,CYBE-DNYJ,FREE,0
test,Test sale,TS-KE7N,LAPSED,0
Pravin Sarule,Test sale,TS-G2FA,PAID,100
test,Rutuja,RUTU-32K6,FREE,0
rutuja,Rutuja,RUTU-9PAD,FREE,0
Pravin Sarule,pravin,PRAV-7DQJ,PAID,100
dgvdfxgvdfxvg,pravin,PRAV-7DQJ,LAPSED,0
Pravin Sarule,pravin,PRAV-7DQJ,LAPSED,0
Pravin Sarule,pravin,PRAV-7DQJ,LAPSED,0
Pra
```
</details>

### Referral Data CSV (plan history, all data)

**Purpose:** Export dialog: kind=history, scope=all (ignores filters): one row per plan event incl. trial starts.

**Inputs:** Query: export=history&scope=all

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/sales-referrals/data/export?export=history&scope=all"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `2889ms`

<details><summary>Response sample</summary>

```json
Date (IST),Account id,Workspace / user,User email,Sales owner,Owner type,Code,Event,Event kind,Plan,Billing,Amount,Currency,Payment ID,Status,Note,Date (UTC)
"Tue, 13 Oct 2026, 03:56 AM IST",115,"Rutuja ",jesoxel161@18lover.com,cybermall,Outsourced,CYBE-DNYJ,Signed up,trial,Free,,0,INR,,,via CYBE-DNYJ,2026-10-12T22:26:19.406Z
"Mon, 12 Oct 2026, 05:49 PM IST",114,test,vodeye2305@copytosh.com,Test
```
</details>

---

## Auth Negative

### No Auth Header

**Purpose:** Verify that missing Authorization header returns 401.

**Inputs:** No Authorization header

**Example curl:**
```bash
curl -s "http://localhost:4010/api/admin/overview"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `3ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

### Wrong Token

**Purpose:** Verify that wrong Bearer token returns 403.

**Inputs:** Authorization: Bearer wrong_token

**Example curl:**
```bash
curl -s -H "Authorization: Bearer wrong_token" "http://localhost:4010/api/admin/overview"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

<details><summary>Response sample</summary>

```json
{
  "message": "API Endpoint Not Found"
}
```
</details>

---

## ❌ Failed Tests — Debugging Hints

### Overview (GET /api/admin/overview)

- **Expected:** 200 + { success: true, data: { total_judgments, ... } }
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### HITL List (GET /api/admin/hitl)

- **Expected:** 200 + data.tasks array
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### HITL Action (INVALID — expect 400) (POST /api/admin/hitl/1/action)

- **Expected:** 400
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### Pipeline Summary (GET /api/admin/pipeline/summary)

- **Expected:** 200 + object
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### Pipeline Items (GET /api/admin/pipeline/items)

- **Expected:** 200 + paginated list
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### Pipeline Errors (GET /api/admin/pipeline/errors)

- **Expected:** 200
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### RoutesDB Summary (GET /api/admin/routesdb/summary)

- **Expected:** 200
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### RoutesDB Top Cited (GET /api/admin/routesdb/top-cited)

- **Expected:** 200 + array
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### RoutesDB Courts Breakdown (GET /api/admin/routesdb/courts-breakdown)

- **Expected:** 200
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### Business Summary (GET /api/admin/business/summary)

- **Expected:** 200
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### Business Reports/Day (GET /api/admin/business/reports-per-day)

- **Expected:** 200 + array
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### Business Top Users (GET /api/admin/business/top-users)

- **Expected:** 200 + array
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### No Auth Header (GET /api/admin/overview)

- **Expected:** 401
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

### Wrong Token (GET /api/admin/overview)

- **Expected:** 403
- **Actual:** 404
- **Hints:**
  - Resource not found — verify seed data exists in DB

---

*End of report.*
