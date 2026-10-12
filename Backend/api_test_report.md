# Admin Dashboard API — Test Report

**Generated:** 2026-10-12T08:18:23.056Z  
**Base URL:** `http://localhost:4111`  
**Admin Token:** `[REDACTED]`  

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 79 |
| ✅ Passed | 65 |
| ❌ Failed | 14 |
| Avg Latency | 66ms |

### All Tests

| # | Method | Endpoint | Expected | Actual | Result | Latency |
|---|--------|----------|----------|--------|--------|--------|
| 1 | GET | `/api/admin/overview` | 200 + { success: true, data: { total_judgments, ... } } | 404 | ❌ FAIL | 8ms |
| 2 | GET | `/api/admin/hitl` | 200 + data.tasks array | 404 | ❌ FAIL | 8ms |
| 3 | GET | `/api/admin/hitl/00000000-0000-0000-0000-000000000000` | 404 | 404 | ✅ PASS | 3ms |
| 4 | POST | `/api/admin/hitl/1/action` | 400 | 404 | ❌ FAIL | 32ms |
| 5 | GET | `/api/admin/pipeline/summary` | 200 + object | 404 | ❌ FAIL | 3ms |
| 6 | GET | `/api/admin/pipeline/items` | 200 + paginated list | 404 | ❌ FAIL | 4ms |
| 7 | GET | `/api/admin/pipeline/errors` | 200 | 404 | ❌ FAIL | 3ms |
| 8 | GET | `/api/admin/routesdb/summary` | 200 | 404 | ❌ FAIL | 2ms |
| 9 | GET | `/api/admin/routesdb/top-cited` | 200 + array | 404 | ❌ FAIL | 2ms |
| 10 | GET | `/api/admin/routesdb/courts-breakdown` | 200 | 404 | ❌ FAIL | 4ms |
| 11 | GET | `/api/admin/business/summary` | 200 | 404 | ❌ FAIL | 2ms |
| 12 | GET | `/api/admin/business/reports-per-day` | 200 + array | 404 | ❌ FAIL | 2ms |
| 13 | GET | `/api/admin/business/top-users` | 200 + array | 404 | ❌ FAIL | 1ms |
| 14 | GET | `/api/admin/users` | 200 + data.users array | 200 | ✅ PASS | 73ms |
| 15 | GET | `/api/admin/users/pending` | 200 | 200 | ✅ PASS | 37ms |
| 16 | GET | `/api/admin/users/stats` | 200 | 200 | ✅ PASS | 39ms |
| 17 | POST | `/api/admin/users/101/approve` | 200 | 200 | ✅ PASS | 42ms |
| 18 | POST | `/api/admin/users/101/block` | 200 | 200 | ✅ PASS | 40ms |
| 19 | POST | `/api/admin/users/101/unblock` | 200 | 200 | ✅ PASS | 36ms |
| 20 | POST | `/api/public/contact` | 201 + data.reference_no + data.submitted_at_ist | 201 | ✅ PASS | 240ms |
| 21 | GET | `/api/admin/contact-enquiries/stats` | 200 + data.totals | 200 | ✅ PASS | 190ms |
| 22 | GET | `/api/admin/contact-enquiries/meta` | 200 + data.statuses | 200 | ✅ PASS | 40ms |
| 23 | GET | `/api/admin/contact-enquiries` | 200 + data.enquiries[] | 200 | ✅ PASS | 85ms |
| 24 | GET | `/api/admin/contact-enquiries/31` | 200 + data.enquiry + data.activities | 200 | ✅ PASS | 78ms |
| 25 | POST | `/api/admin/contact-enquiries/31/contact-log` | 200 + enquiry.first_contacted_at_ist | 200 | ✅ PASS | 223ms |
| 26 | PATCH | `/api/admin/contact-enquiries/31` | 200 + enquiry.status = closed | 200 | ✅ PASS | 241ms |
| 27 | GET | `/api/admin/contact-enquiries/export` | 200 text/csv | 200 | ✅ PASS | 79ms |
| 28 | DELETE | `/api/admin/contact-enquiries/31` | 200 | 200 | ✅ PASS | 38ms |
| 29 | GET | `/api/admin/error-logs/stats` | 200 + data.totals, daily_trend[], by_service[], top_issues[], top_users[] | 200 | ✅ PASS | 300ms |
| 30 | GET | `/api/admin/error-logs/meta` | 200 + data.vocab, data.used.services[], data.permissions | 200 | ✅ PASS | 39ms |
| 31 | GET | `/api/admin/error-logs` | 200 + data.logs[], data.pagination | 200 | ✅ PASS | 118ms |
| 32 | GET | `/api/admin/error-logs` | 200 + only rows for that service | 200 | ✅ PASS | 166ms |
| 33 | GET | `/api/admin/error-logs` | 200 + every row is_resolved=false | 200 | ✅ PASS | 125ms |
| 34 | GET | `/api/admin/error-logs` | 200 + every row origin=browser with client{} | 200 | ✅ PASS | 123ms |
| 35 | GET | `/api/admin/error-logs` | 200 + no row with is_debug=true + total = stats.total - stats.debug | 200 | ✅ PASS | 194ms |
| 36 | GET | `/api/admin/error-logs` | 200 + filters.search, filters.resolved=false, filters.http_method[] | 200 | ✅ PASS | 82ms |
| 37 | GET | `/api/admin/error-logs` | 200 + logs=[] total=0 | 200 | ✅ PASS | 80ms |
| 38 | GET | `/api/admin/error-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 6ms |
| 39 | GET | `/api/admin/error-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 5ms |
| 40 | GET | `/api/admin/error-logs/users` | 200 + data.users[], data.pagination | 200 | ✅ PASS | 108ms |
| 41 | GET | `/api/admin/error-logs/issues` | 200 + data.issues[] | 200 | ✅ PASS | 43ms |
| 42 | GET | `/api/admin/error-logs/export` | 200 text/csv with header row | 200 | ✅ PASS | 230ms |
| 43 | GET | `/api/admin/error-logs/not-a-uuid` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 7ms |
| 44 | GET | `/api/admin/error-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 40ms |
| 45 | GET | `/api/admin/error-logs/b1a29138-c786-4682-80a4-f06d5fb0f1e1` | 200 + data.log (with stack_trace, payload, origin), data.issue, data.audit, data.related | 200 | ✅ PASS | 112ms |
| 46 | PATCH | `/api/admin/error-logs/b1a29138-c786-4682-80a4-f06d5fb0f1e1/resolve` | 200 + data.log.is_resolved=true | 200 | ✅ PASS | 142ms |
| 47 | PATCH | `/api/admin/error-logs/b1a29138-c786-4682-80a4-f06d5fb0f1e1/resolve` | 200 + data.log.is_resolved=false | 200 | ✅ PASS | 145ms |
| 48 | PATCH | `/api/admin/error-logs/resolve` | 200 + data.changed=1 | 200 | ✅ PASS | 41ms |
| 49 | PATCH | `/api/admin/error-logs/resolve` | 200 + data.changed>=1 | 200 | ✅ PASS | 60ms |
| 50 | PATCH | `/api/admin/error-logs/resolve-fingerprint` | 200 + data.resolved=true, occurrences.unresolved=0 | 200 | ✅ PASS | 74ms |
| 51 | PATCH | `/api/admin/error-logs/resolve` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 8ms |
| 52 | POST | `/api/admin/error-logs/bulk-delete` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 5ms |
| 53 | DELETE | `/api/admin/error-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 37ms |
| 54 | GET | `/api/admin/audit-logs/summary` | 200 + data.totals, per_service[], top_endpoints[], top_users[] | 200 | ✅ PASS | 129ms |
| 55 | GET | `/api/admin/audit-logs/meta` | 200 + data.used.services[], data.vocab | 200 | ✅ PASS | 59ms |
| 56 | GET | `/api/admin/audit-logs` | 200 + data.rows[], data.total, no ping rows, no stack_trace | 200 | ✅ PASS | 183ms |
| 57 | GET | `/api/admin/audit-logs` | 200 + total >= default total | 200 | ✅ PASS | 68ms |
| 58 | GET | `/api/admin/audit-logs` | 200 + every row status=FAILED | 200 | ✅ PASS | 68ms |
| 59 | GET | `/api/admin/audit-logs` | 200 + rows only with those codes, slowest first | 200 | ✅ PASS | 67ms |
| 60 | GET | `/api/admin/audit-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 7ms |
| 61 | GET | `/api/admin/audit-logs/export` | 200 text/csv with header row | 200 | ✅ PASS | 68ms |
| 62 | GET | `/api/admin/audit-logs/not-a-uuid` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 4ms |
| 63 | GET | `/api/admin/audit-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 36ms |
| 64 | GET | `/api/admin/sales-referrals/reports/summary` | 200 + data.totalSignups, viaCode, direct, free/paid/lapsed, paidPercent | 200 | ✅ PASS | 46ms |
| 65 | GET | `/api/admin/sales-referrals/reports/summary` | 400 VALIDATION_FAILED | 400 | ✅ PASS | 6ms |
| 66 | GET | `/api/admin/sales-referrals/reports/owners` | 200 + data.owners[], data.direct, ownerCountAll | 200 | ✅ PASS | 109ms |
| 67 | GET | `/api/admin/sales-referrals/reports/owners` | 200 + data.direct === null | 200 | ✅ PASS | 75ms |
| 68 | GET | `/api/admin/sales-referrals/codes` | 200 + data.groups[].owner + codes[] | 200 | ✅ PASS | 43ms |
| 69 | GET | `/api/admin/sales-referrals/codes/suggest` | 200 + data.suggestions[2] matching SFY-XXXX | 200 | ✅ PASS | 75ms |
| 70 | GET | `/api/admin/sales-referrals/codes/suggest` | 400 VALIDATION_FAILED | 400 | ✅ PASS | 4ms |
| 71 | GET | `/api/admin/sales-referrals/codes/availability` | 200 + data.status === INVALID_FORMAT | 200 | ✅ PASS | 3ms |
| 72 | GET | `/api/admin/sales-referrals/codes/availability` | 200 + data.status === AVAILABLE + upper-cased code | 200 | ✅ PASS | 38ms |
| 73 | GET | `/api/admin/sales-referrals/reports/signups` | 200 + data.scope.type === DIRECT, statusCounts, items[] | 200 | ✅ PASS | 75ms |
| 74 | GET | `/api/admin/sales-referrals/reports/signups` | 400 VALIDATION_FAILED | 400 | ✅ PASS | 5ms |
| 75 | GET | `/api/admin/sales-referrals/owners/00000000-0000-0000-0000-000000000000` | 404 SALES_OWNER_NOT_FOUND | 404 | ✅ PASS | 39ms |
| 76 | POST | `/api/admin/sales-referrals/owners` | 400 VALIDATION_FAILED | 400 | ✅ PASS | 7ms |
| 77 | PUT | `/api/admin/sales-referrals/tenants/00000000-0000-0000-0000-000000000000/referral` | 404 TENANT_NOT_FOUND | 404 | ✅ PASS | 105ms |
| 78 | GET | `/api/admin/overview` | 401 | 404 | ❌ FAIL | 7ms |
| 79 | GET | `/api/admin/overview` | 403 | 404 | ❌ FAIL | 5ms |

---

## Overview

### Overview

**Purpose:** Dashboard summary: total judgments, verified/unverified counts, confidence distribution, HITL pending, blacklist count, ingestion status, today citations.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/overview"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `8ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/hitl?status=PENDING&page=1&pageSize=5&sort=priority_desc"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `8ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/hitl/00000000-0000-0000-0000-000000000000"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `3ms`

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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/hitl/1/action" -H "Content-Type: application/json" -d '{"action":"INVALID"}'
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `32ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/pipeline/summary"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `3ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/pipeline/items?status=FAILED&hasError=true&page=1&pageSize=5"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `4ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/pipeline/errors?limit=5"
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

## Routes & DB

### RoutesDB Summary

**Purpose:** Total judgments, aliases, statutes, verification breakdown.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/routesdb/summary"
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/routesdb/top-cited?limit=5"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/routesdb/courts-breakdown"
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

## Business Metrics

### Business Summary

**Purpose:** Total reports count and average citations per report.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/business/summary"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/business/reports-per-day?days=7"
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/business/top-users?limit=5"
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/users?page=1&pageSize=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `73ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 101,
        "email": "pravinsarule17@gmail.com",
        "username": "Pravin Sarule",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "SOLO",
        "is_active": true,
        "created_at": "2026-09-04T23:02:17.791Z",
        "phone": "+914587258963",
        "location": null
      },
      {
        "id": 100,
        "email": "rutuja.dalal@nexintelai.com",
        "username": "Rutuja Dalal",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "SOLO",
        "is_active": true,
        "created_at": "2026-09-04T22:49:01.024Z",
        "phone": "+919503808108",
        "location": null
      },
      {
        "id": 99,
        "email": "sekjtfndr@fldn.com",
        "username": "rjtg",
        "role": "user",
        "auth_type": "manual",
        "profile_image": null,
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "SOLO",
        "is_active": true,
        "created_at": "2026-08-27T01:53:47.965Z",
        "phone": "+915586387657",
        "location": null
      },
      {
        "id": 98,
        "email": "shethchaitaliv@gmail.com",
        "username": "Adv Chaitali Sheth",
        "role": "user",
        "auth_type": "google",
        "profile_image": "https://lh3.googleusercontent.com/a/ACg8ocIMYRuG9YnUFEsuXiL9tdxvg8sjtRa1cOhKfRjhyPz4Hp3u9g=s96-c",
        "is_blocked": false,
        "approval_status": "APPROVED",
        "account_type": "SOLO",
        "is_active": true,
        "created_at": "2026-08-24T01:20:28.918Z",
        "phone": "+919923659504",
        "location": null
      },
      {
        "id": 97,
        "email": "yash.khant@talentica.com",
        "username": "Yash Khant",
        "role": "user",
        "auth_type": "manua
... (truncated)
```
</details>

### Users Pending

**Purpose:** List users with approval_status=PENDING.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/users/pending"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `37ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/users/stats"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `39ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "total_users": 67,
    "active_users": 65,
    "blocked_users": 1,
    "pending_approvals": 0,
    "firm_admin_count": 26,
    "firm_user_count": 5,
    "solo_users": 31
  }
}
```
</details>

### User Approve

**Purpose:** Approve a user: sets approval_status=APPROVED, is_active=true.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/users/101/approve"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `42ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 101,
      "email": "pravinsarule17@gmail.com",
      "username": "Pravin Sarule",
      "password": "$2b$10$ab.tDNR06yYMBrminAc7We7gY5IyFw02A8hw9hOfyWO2KOCLhIzEG",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": false,
      "created_at": "2026-09-04T23:02:17.791Z",
      "updated_at": "2026-09-11T03:09:39.500Z",
      "razorpay_customer_id": null,
      "phone": "+914587258963",
      "location": null,
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "SOLO",
      "approval_status": "APPROVED",
      "first_login": false,
      "is_active": true,
      "last_login_at": "2026-09-05T04:32:41.623Z",
      "last_seen_at": "2026-09-11T08:39:39.500Z",
      "domain_role": "LEGAL_PROFESSIONAL",
      "role_id": "be1b258a-a8a1-44f7-b4d8-32e0cab06da9",
      "active_plan_id": 5,
      "active_plan_name": "Max",
      "active_plan_updated_at": "2026-09-05T04:33:37.759Z"
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/users/101/block"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `40ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 101,
      "email": "pravinsarule17@gmail.com",
      "username": "Pravin Sarule",
      "password": "$2b$10$ab.tDNR06yYMBrminAc7We7gY5IyFw02A8hw9hOfyWO2KOCLhIzEG",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": true,
      "created_at": "2026-09-04T23:02:17.791Z",
      "updated_at": "2026-09-11T03:09:39.500Z",
      "razorpay_customer_id": null,
      "phone": "+914587258963",
      "location": null,
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "SOLO",
      "approval_status": "APPROVED",
      "first_login": false,
      "is_active": false,
      "last_login_at": "2026-09-05T04:32:41.623Z",
      "last_seen_at": "2026-09-11T08:39:39.500Z",
      "domain_role": "LEGAL_PROFESSIONAL",
      "role_id": "be1b258a-a8a1-44f7-b4d8-32e0cab06da9",
      "active_plan_id": 5,
      "active_plan_name": "Max",
      "active_plan_updated_at": "2026-09-05T04:33:37.759Z"
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/users/101/unblock"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `36ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 101,
      "email": "pravinsarule17@gmail.com",
      "username": "Pravin Sarule",
      "password": "$2b$10$ab.tDNR06yYMBrminAc7We7gY5IyFw02A8hw9hOfyWO2KOCLhIzEG",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": false,
      "created_at": "2026-09-04T23:02:17.791Z",
      "updated_at": "2026-09-11T03:09:39.500Z",
      "razorpay_customer_id": null,
      "phone": "+914587258963",
      "location": null,
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "SOLO",
      "approval_status": "APPROVED",
      "first_login": false,
      "is_active": true,
      "last_login_at": "2026-09-05T04:32:41.623Z",
      "last_seen_at": "2026-09-11T08:39:39.500Z",
      "domain_role": "LEGAL_PROFESSIONAL",
      "role_id": "be1b258a-a8a1-44f7-b4d8-32e0cab06da9",
      "active_plan_id": 5,
      "active_plan_name": "Max",
      "active_plan_updated_at": "2026-09-05T04:33:37.759Z"
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
curl -s -X POST -H "Content-Type: application/json" -d '{"name":"API","surname":"Test","email":"api.test+1791793097659@example.com","mobile":"+91 90000 00000","organisationName":"Automated Test","whatIsThisAbout":"Pricing & plans","additionalDetails":"automated test 1791793097659","consent":true,"pageUrl":"https://jurinex.ai/contact"}' "http://localhost:4111/api/public/contact"
```

**Test Result:** ✅ PASS — Status: `201` — Latency: `240ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "id": 31,
    "reference_no": "CE-20261012-00031",
    "duplicate": false,
    "submitted_at": "2026-10-12T08:17:56.691Z",
    "submitted_at_ist": {
      "iso": "2026-10-12T13:47:56+05:30",
      "date": "12 Oct 2026",
      "time": "01:47 PM",
      "time24": "13:47",
      "weekday": "Mon",
      "display": "Mon, 12 Oct 2026, 01:47 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-12T08:17:56.691Z",
      "epoch_ms": 1791793076691
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/contact-enquiries/stats"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `190ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-12T08:18:17.904Z",
    "generated_at_ist": {
      "iso": "2026-10-12T13:48:17+05:30",
      "date": "12 Oct 2026",
      "time": "01:48 PM",
      "time24": "13:48",
      "weekday": "Mon",
      "display": "Mon, 12 Oct 2026, 01:48 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-12T08:18:17.904Z",
      "epoch_ms": 1791793097904
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/contact-enquiries/meta"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `40ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/contact-enquiries?status=open&sort=awaiting_longest&page=1&limit=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `85ms`

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
        "submitted_ago": "31d 1h",
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
        "awaiting_for": "31d 1h",
        "status_changed_at": "2026-09-11T06:45:54.004Z",
    
... (truncated)
```
</details>

### Contact Enquiry Detail

**Purpose:** Single enquiry + activity timeline.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/contact-enquiries/31"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `78ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 31,
      "reference_no": "CE-20261012-00031",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791793097659@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791793097659",
      "marketing_consent": true,
      "consent_given_at": "2026-10-12T08:17:56.691Z",
      "consent_given_at_ist": {
        "iso": "2026-10-12T13:47:56+05:30",
        "date": "12 Oct 2026",
        "time": "01:47 PM",
        "time24": "13:47",
        "weekday": "Mon",
        "display": "Mon, 12 Oct 2026, 01:47 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-12T08:17:56.691Z",
        "epoch_ms": 1791793076691
      },
      "submitted_at": "2026-10-12T08:17:56.691Z",
      "submitted_at_ist": {
        "iso": "2026-10-12T13:47:56+05:30",
        "date": "12 Oct 2026",
        "time": "01:47 PM",
        "time24": "13:47",
        "weekday": "Mon",
        "display": "Mon, 12 Oct 2026, 01:47 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-12T08:17:56.691Z",
        "epoch_ms": 1791793076691
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/contact-enquiries/31/contact-log" -H "Content-Type: application/json" -d '{"channel":"call","outcome":"connected","note":"automated test call"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `223ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 31,
      "reference_no": "CE-20261012-00031",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791793097659@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791793097659",
      "marketing_consent": true,
      "consent_given_at": "2026-10-12T08:17:56.691Z",
      "consent_given_at_ist": {
        "iso": "2026-10-12T13:47:56+05:30",
        "date": "12 Oct 2026",
        "time": "01:47 PM",
        "time24": "13:47",
        "weekday": "Mon",
        "display": "Mon, 12 Oct 2026, 01:47 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-12T08:17:56.691Z",
        "epoch_ms": 1791793076691
      },
      "submitted_at": "2026-10-12T08:17:56.691Z",
      "submitted_at_ist": {
        "iso": "2026-10-12T13:47:56+05:30",
        "date": "12 Oct 2026",
        "time": "01:47 PM",
        "time24": "13:47",
        "weekday": "Mon",
        "display": "Mon, 12 Oct 2026, 01:47 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-12T08:17:56.691Z",
        "epoch_ms": 1791793076691
      },
      "submitted_ago": "just now",
      "status": "contacted",
      "status_label": "Contacted",
      "priority": "normal",
      "priority_label": "Normal",
      "assigned_to": null,
      "first_contacted_at": "2026-10-12T08:18:18.363Z",
      "first_contacted_at_ist": {
        "iso": "2026-10-12T13:48:18+05:30",
        "date": "12 Oct 2026",
        "time": "01:48 PM",
        "time24": "13:48",
        "weekday": "Mon",
        "display": "Mon, 12 Oct 2026, 01:48 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-12T08:18:18.363Z",
        "epoch_ms": 1791793098363
      },
      "first_contacted_by": null,
      "last_contacted_at": "2026-10-12T08:18:18.363Z",
      "last_contacted_at_ist": {
        "iso": "2026-10-12T13:48:18+05:30
... (truncated)
```
</details>

### Contact Enquiry Update

**Purpose:** Change status / priority / assignee with timeline entries.

**Inputs:** Body: { status?, priority?, assigned_to?, note? }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/contact-enquiries/31" -H "Content-Type: application/json" -d '{"status":"closed","priority":"low","note":"automated test close"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `241ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 31,
      "reference_no": "CE-20261012-00031",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791793097659@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791793097659",
      "marketing_consent": true,
      "consent_given_at": "2026-10-12T08:17:56.691Z",
      "consent_given_at_ist": {
        "iso": "2026-10-12T13:47:56+05:30",
        "date": "12 Oct 2026",
        "time": "01:47 PM",
        "time24": "13:47",
        "weekday": "Mon",
        "display": "Mon, 12 Oct 2026, 01:47 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-12T08:17:56.691Z",
        "epoch_ms": 1791793076691
      },
      "submitted_at": "2026-10-12T08:17:56.691Z",
      "submitted_at_ist": {
        "iso": "2026-10-12T13:47:56+05:30",
        "date": "12 Oct 2026",
        "time": "01:47 PM",
        "time24": "13:47",
        "weekday": "Mon",
        "display": "Mon, 12 Oct 2026, 01:47 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-12T08:17:56.691Z",
        "epoch_ms": 1791793076691
      },
      "submitted_ago": "just now",
      "status": "closed",
      "status_label": "Closed",
      "priority": "low",
      "priority_label": "Low",
      "assigned_to": null,
      "first_contacted_at": "2026-10-12T08:18:18.363Z",
      "first_contacted_at_ist": {
        "iso": "2026-10-12T13:48:18+05:30",
        "date": "12 Oct 2026",
        "time": "01:48 PM",
        "time24": "13:48",
        "weekday": "Mon",
        "display": "Mon, 12 Oct 2026, 01:48 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-12T08:18:18.363Z",
        "epoch_ms": 1791793098363
      },
      "first_contacted_by": null,
      "last_contacted_at": "2026-10-12T08:18:18.363Z",
      "last_contacted_at_ist": {
        "iso": "2026-10-12T13:48:18+05:30",
        "
... (truncated)
```
</details>

### Contact Enquiry CSV Export

**Purpose:** CSV export with IST columns; same filters as the list.

**Inputs:** Query: same as list

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/contact-enquiries/export?search=api.test%2B"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `79ms`

<details><summary>Response sample</summary>

```json
Reference,Submitted (IST),Submitted date (IST),Submitted time (IST),Name,Surname,Email,Mobile,Organisation,What is this about,Additional details,Marketing consent,Status,Priority,Assigned to,First contacted (IST),First contacted by,First response time,Last contacted (IST),Last channel,Contact attempts,Closed (IST),Source,Page URL,Submitted (UTC)
CE-20261012-00031,"Mon, 12 Oct 2026, 01:47 PM IST",2026-10-12,13:47,API,Test,api.test+1791793097659@example.com,'+91 90000 00000,Automated Test,Pricing & plans,automated test 1791793097659,Yes,Closed,Low,,"Mon, 12 Oct 2026, 01:48 PM IST",,just now,"Mo
```
</details>

### Contact Enquiry Delete (cleanup)

**Purpose:** Remove the test enquiry (super-admin / static token only).

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X DELETE -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/contact-enquiries/31"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `38ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "id": 31,
    "reference_no": "CE-20261012-00031",
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/stats"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `300ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-12T08:18:18.877Z",
    "generated_at_ist": {
      "iso": "2026-10-12T13:48:18+05:30",
      "date": "12 Oct 2026",
      "time": "01:48 PM",
      "time24": "13:48",
      "weekday": "Mon",
      "display": "Mon, 12 Oct 2026, 01:48 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-12T08:18:18.877Z",
      "epoch_ms": 1791793098877
    },
    "totals": {
      "total": 221,
      "unresolved": 221,
      "resolved": 0,
      "critical": 0,
      "error": 122,
      "warning": 99,
      "critical_unresolved": 0,
      "last_hour": 0,
      "last_24h": 0,
      "today": 0,
      "yesterday": 0,
      "last_7_days": 221,
      "last_30_days": 221,
      "this_month": 221,
      "with_user": 144,
      "affected_users": 3,
      "affected_users_24h": 0,
      "affected_users_unresolved": 3,
      "distinct_issues": 42,
      "distinct_issues_unresolved": 42,
      "services": 3,
      "external_api": 127,
      "http_5xx": 66,
      "http_4xx": 93,
      "browser": 41,
      "recovered": 13,
      "debug": 10,
      "avg_latency_ms": 693,
      "resolved_rate_pct": 0,
      "last_error_at": "2026-10-09T10:11:17.051Z",
      "last_error_at_ist": {
        "iso": "2026-10-09T15:41:17+05:30",
        "date": "09 Oct 2026",
        "time": "03:41 PM",
        "time24": "15:41",
        "weekday": "Fri",
        "display": "Fri, 09 Oct 2026, 03:41 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-09T10:11:17.051Z",
        "epoch_ms": 1791540677051
      },
      "last_critical_at": null,
      "last_critical_at_ist": null
    },
    "daily_trend": [
      {
        "date": "2026-09-29",
        "label": "29 Sep",
        "total": 0,
        "critical": 0,
        "unresolved": 0,
        "affected_users": 0
      },
      {
        "date": "2026-09-30",
        "label": "30 Sep",
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/meta"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `39ms`

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
          "count": 118
        },
        {
          "value": "gateway-service",
          "count": 59
        },
        {
          "value": "payment-service",
          "count": 44
        }
   
... (truncated)
```
</details>

### Error Logs List

**Purpose:** Paginated list of captured errors with IST timestamps, user enrichment and occurrence counts.

**Inputs:** Query: page, limit, resolved, sort (+ service, source, category, severity, status_code, user, search, from, to ...)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs?page=1&limit=5&resolved=all&sort=newest"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `118ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "b1a29138-c786-4682-80a4-f06d5fb0f1e1",
        "created_at": "2026-10-09T10:11:17.051Z",
        "created_at_ist": {
          "iso": "2026-10-09T15:41:17+05:30",
          "date": "09 Oct 2026",
          "time": "03:41 PM",
          "time24": "15:41",
          "weekday": "Fri",
          "display": "Fri, 09 Oct 2026, 03:41 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-09T10:11:17.051Z",
          "epoch_ms": 1791540677051
        },
        "occurred_ago": "2d 22h",
        "service_name": "gateway-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "4dd1cb1cbeb73e89315db461c7b6ba34",
        "user_id": "76",
        "user_email": "pk@gmail.com",
        "user_email_source": "logged",
        "user_name": "PK",
        "user_key": "76",
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
          "last_seen_at": "2026-10-09T12:29:54.729Z",
          "last_seen_at_ist": {
            "iso": "2026-10-09T17:59:54+05:30",
            "date": "09 Oct 2026",
            "time": "05:59 PM",
            "time24": "17:59",
            "weekday": "Fri",
            "display": "Fri, 09 Oct 2026, 05:59 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-09T12:29:54.729Z",
            "epoch_ms": 1791548994729
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "ip_address": "::1",
        "endpoint": "/api/auth/activity/ping",
        "http_method": "POST",
        "method": "node:net.intern
... (truncated)
```
</details>

### Error Logs List (service filter)

**Purpose:** Filter by service_name; every returned row must belong to that service.

**Inputs:** Query: service=gateway-service

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs?service=gateway-service&limit=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `166ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "b1a29138-c786-4682-80a4-f06d5fb0f1e1",
        "created_at": "2026-10-09T10:11:17.051Z",
        "created_at_ist": {
          "iso": "2026-10-09T15:41:17+05:30",
          "date": "09 Oct 2026",
          "time": "03:41 PM",
          "time24": "15:41",
          "weekday": "Fri",
          "display": "Fri, 09 Oct 2026, 03:41 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-09T10:11:17.051Z",
          "epoch_ms": 1791540677051
        },
        "occurred_ago": "2d 22h",
        "service_name": "gateway-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "4dd1cb1cbeb73e89315db461c7b6ba34",
        "user_id": "76",
        "user_email": "pk@gmail.com",
        "user_email_source": "logged",
        "user_name": "PK",
        "user_key": "76",
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
          "last_seen_at": "2026-10-09T12:29:54.729Z",
          "last_seen_at_ist": {
            "iso": "2026-10-09T17:59:54+05:30",
            "date": "09 Oct 2026",
            "time": "05:59 PM",
            "time24": "17:59",
            "weekday": "Fri",
            "display": "Fri, 09 Oct 2026, 05:59 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-09T12:29:54.729Z",
            "epoch_ms": 1791548994729
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "ip_address": "::1",
        "endpoint": "/api/auth/activity/ping",
        "http_method": "POST",
        "method": "node:net.intern
... (truncated)
```
</details>

### Error Logs List (unresolved only)

**Purpose:** resolved=false returns only open errors.

**Inputs:** Query: resolved=false

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs?resolved=false&limit=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `125ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "b1a29138-c786-4682-80a4-f06d5fb0f1e1",
        "created_at": "2026-10-09T10:11:17.051Z",
        "created_at_ist": {
          "iso": "2026-10-09T15:41:17+05:30",
          "date": "09 Oct 2026",
          "time": "03:41 PM",
          "time24": "15:41",
          "weekday": "Fri",
          "display": "Fri, 09 Oct 2026, 03:41 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-09T10:11:17.051Z",
          "epoch_ms": 1791540677051
        },
        "occurred_ago": "2d 22h",
        "service_name": "gateway-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "4dd1cb1cbeb73e89315db461c7b6ba34",
        "user_id": "76",
        "user_email": "pk@gmail.com",
        "user_email_source": "logged",
        "user_name": "PK",
        "user_key": "76",
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
          "last_seen_at": "2026-10-09T12:29:54.729Z",
          "last_seen_at_ist": {
            "iso": "2026-10-09T17:59:54+05:30",
            "date": "09 Oct 2026",
            "time": "05:59 PM",
            "time24": "17:59",
            "weekday": "Fri",
            "display": "Fri, 09 Oct 2026, 05:59 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-09T12:29:54.729Z",
            "epoch_ms": 1791548994729
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "ip_address": "::1",
        "endpoint": "/api/auth/activity/ping",
        "http_method": "POST",
        "method": "node:net.intern
... (truncated)
```
</details>

### Error Logs List (browser-reported only)

**Purpose:** origin=browser returns only rows reported by the frontend (endpoint client:<flow>, payload.client_report); each carries client.kind / flow / page.

**Inputs:** Query: origin=browser

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs?origin=browser&limit=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `123ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "47140819-364d-4d97-aceb-e1a877657730",
        "created_at": "2026-10-09T09:56:51.860Z",
        "created_at_ist": {
          "iso": "2026-10-09T15:26:51+05:30",
          "date": "09 Oct 2026",
          "time": "03:26 PM",
          "time24": "15:26",
          "weekday": "Fri",
          "display": "Fri, 09 Oct 2026, 03:26 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-09T09:56:51.860Z",
          "epoch_ms": 1791539811860
        },
        "occurred_ago": "2d 22h",
        "service_name": "agentic-document-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "f76ea02607fc4d13b72762b3ac07febc",
        "user_id": "76",
        "user_email": "pk@gmail.com",
        "user_email_source": "logged",
        "user_name": "PK",
        "user_key": "76",
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
          "last_seen_at": "2026-10-09T12:29:54.729Z",
          "last_seen_at_ist": {
            "iso": "2026-10-09T17:59:54+05:30",
            "date": "09 Oct 2026",
            "time": "05:59 PM",
            "time24": "17:59",
            "weekday": "Fri",
            "display": "Fri, 09 Oct 2026, 05:59 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-09T12:29:54.729Z",
            "epoch_ms": 1791548994729
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "ip_address": "127.0.0.1",
        "endpoint": "client:fetch",
        "http_method": "POST",
        "method": "client.fetc
... (truncated)
```
</details>

### Error Logs List (exclude debug rows)

**Purpose:** exclude_debug=true hides rows produced by the errorlog _debug routes / demo triggers; total must equal stats.total - stats.debug.

**Inputs:** Query: exclude_debug=true

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs?exclude_debug=true&limit=100"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `194ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "b1a29138-c786-4682-80a4-f06d5fb0f1e1",
        "created_at": "2026-10-09T10:11:17.051Z",
        "created_at_ist": {
          "iso": "2026-10-09T15:41:17+05:30",
          "date": "09 Oct 2026",
          "time": "03:41 PM",
          "time24": "15:41",
          "weekday": "Fri",
          "display": "Fri, 09 Oct 2026, 03:41 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-09T10:11:17.051Z",
          "epoch_ms": 1791540677051
        },
        "occurred_ago": "2d 22h",
        "service_name": "gateway-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "4dd1cb1cbeb73e89315db461c7b6ba34",
        "user_id": "76",
        "user_email": "pk@gmail.com",
        "user_email_source": "logged",
        "user_name": "PK",
        "user_key": "76",
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
          "last_seen_at": "2026-10-09T12:29:54.729Z",
          "last_seen_at_ist": {
            "iso": "2026-10-09T17:59:54+05:30",
            "date": "09 Oct 2026",
            "time": "05:59 PM",
            "time24": "17:59",
            "weekday": "Fri",
            "display": "Fri, 09 Oct 2026, 05:59 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-09T12:29:54.729Z",
            "epoch_ms": 1791548994729
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "ip_address": "::1",
        "endpoint": "/api/auth/activity/ping",
        "http_method": "POST",
        "method": "node:net.intern
... (truncated)
```
</details>

### Error Logs List (spec alias filters)

**Purpose:** q, is_resolved, http_method (and external_provider) are accepted as aliases and echoed back as search / resolved / http_method.

**Inputs:** Query: q, is_resolved, http_method

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs?q=zzz-no-such-error-zzz&is_resolved=false&http_method=GET%2CPOST"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `82ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs?search=zzz-no-such-error-zzz"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `80ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs?status_code=abc"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `6ms`

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
  "requestId": "b2720895-89c4-4dec-baf1-0b72e38bec20"
}
```
</details>

### Error Logs List (INVALID date range — expect 400)

**Purpose:** "from" must be on or before "to".

**Inputs:** Query: from > to

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs?from=2026-02-01&to=2026-01-01"
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
      "\"from\" must be on or before \"to\""
    ]
  },
  "requestId": "afa8e44c-3e97-46a9-86eb-a034817c38b8"
}
```
</details>

### Error Logs Per User

**Purpose:** Errors grouped per platform user (user_id, else email): totals, unresolved, critical, last 24h, services, last error, enriched with Auth-DB user details.

**Inputs:** Query: page, limit, sort (most_errors | recent | unresolved | critical), service, severity, resolved, search, from, to

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/users?page=1&limit=10&sort=most_errors"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `108ms`

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
          "last_seen_at": "2026-10-09T12:29:54.729Z",
          "last_seen_at_ist": {
            "iso": "2026-10-09T17:59:54+05:30",
            "date": "09 Oct 2026",
            "time": "05:59 PM",
            "time24": "17:59",
            "weekday": "Fri",
            "display": "Fri, 09 Oct 2026, 05:59 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-09T12:29:54.729Z",
            "epoch_ms": 1791548994729
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "total": 118,
        "unresolved": 118,
        "critical": 0,
        "last_24h": 0,
        "last_7_days": 118,
        "distinct_errors": 24,
        "services": [
          "agentic-document-service",
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
        "last_error_at": "2026-10-09T10:11:17.051Z",
        "last_error_at_ist": {
          "iso": "2026-10-09T15:41:17+05:30",
          "date": "09 Oct 2026",
          "time": "03:41 PM",
          "time24": "15:41",
          "weekday": "Fri",
          "display": "Fri, 09 Oct 2026, 03:41 PM
... (truncated)
```
</details>

### Error Logs Issues (by fingerprint)

**Purpose:** Distinct issues: rows grouped by fingerprint with count, unresolved, affected users, first/last seen.

**Inputs:** Query: limit, service, severity, category, resolved, user, search, from, to

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/issues?limit=10"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `43ms`

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
        "last_seen_ago": "3d 21h",
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/export?resolved=all"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `230ms`

<details><summary>Response sample</summary>

```json
ID,Occurred (IST),Date (IST),Time (IST),Service,Environment,Source,Category,Severity,HTTP status,Method,Endpoint,Code location,Action,Resource type,Resource id,Error code,What happened,Reason,Error type,Error message,User message,Suggested fix,User id,User email,User name,IP address,Request id,External provider,External endpoint,External model,External status,External error code,Latency (ms),Occurrences,Fingerprint,Resolved,Resolved by,Resolved at (IST),Resolution note,Occurred (UTC)
b1a29138-c786-4682-80a4-f06d5fb0f1e1,"Fri, 09 Oct 2026, 03:41 PM IST",2026-10-09,15:41,gateway-service,develop
```
</details>

### Error Log Detail (INVALID id — expect 400)

**Purpose:** Row ids are UUIDs; anything else is rejected before touching the DB.

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/not-a-uuid"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `7ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error log id must be a UUID"
  },
  "requestId": "d5589dc9-af6d-4917-8d38-7c300b3f9cd3"
}
```
</details>

### Error Log Detail (UNKNOWN id — expect 404)

**Purpose:** Unknown UUID returns NOT_FOUND.

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/00000000-0000-4000-8000-000000000000"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `40ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Error log not found"
  },
  "requestId": "10d8d7a4-6fb1-491e-a7bf-07305d4f016e"
}
```
</details>

### Error Log Detail

**Purpose:** Full row incl. stack trace, payload, external API response, issue summary (occurrences), the api_audit_logs row of the request, and related rows (same request id / same fingerprint).

**Inputs:** Path: id (UUID)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/b1a29138-c786-4682-80a4-f06d5fb0f1e1"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `112ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "b1a29138-c786-4682-80a4-f06d5fb0f1e1",
      "created_at": "2026-10-09T10:11:17.051Z",
      "created_at_ist": {
        "iso": "2026-10-09T15:41:17+05:30",
        "date": "09 Oct 2026",
        "time": "03:41 PM",
        "time24": "15:41",
        "weekday": "Fri",
        "display": "Fri, 09 Oct 2026, 03:41 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-09T10:11:17.051Z",
        "epoch_ms": 1791540677051
      },
      "occurred_ago": "2d 22h",
      "service_name": "gateway-service",
      "environment": "development",
      "source": "EXTERNAL_API",
      "source_label": "External API call",
      "category": "EXTERNAL_API",
      "category_label": "External API",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "4dd1cb1cbeb73e89315db461c7b6ba34",
      "user_id": "76",
      "user_email": "pk@gmail.com",
      "user_email_source": "logged",
      "user_name": "PK",
      "user_key": "76",
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
        "last_seen_at": "2026-10-09T12:29:54.729Z",
        "last_seen_at_ist": {
          "iso": "2026-10-09T17:59:54+05:30",
          "date": "09 Oct 2026",
          "time": "05:59 PM",
          "time24": "17:59",
          "weekday": "Fri",
          "display": "Fri, 09 Oct 2026, 05:59 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-09T12:29:54.729Z",
          "epoch_ms": 1791548994729
        },
        "registered_at": "2026-05-18T06:47:13.500Z"
      },
      "ip_address": "::1",
      "endpoint": "/api/auth/activity/ping",
      "http_method": "POST",
      "method": "node:net.internalConnectMultiple",
      "action": "CREATE",
      "resource_type": null,
      "resource_id": null,
      "status_code"
... (truncated)
```
</details>

### Error Log Resolve

**Purpose:** Mark a single error resolved with a note; records resolved_by (admin email / admin-token) and resolved_at.

**Inputs:** Body: { resolved: true, note }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/b1a29138-c786-4682-80a4-f06d5fb0f1e1/resolve" -H "Content-Type: application/json" -d '{"resolved":true,"note":"automated test: resolved"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `142ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "b1a29138-c786-4682-80a4-f06d5fb0f1e1",
      "created_at": "2026-10-09T10:11:17.051Z",
      "created_at_ist": {
        "iso": "2026-10-09T15:41:17+05:30",
        "date": "09 Oct 2026",
        "time": "03:41 PM",
        "time24": "15:41",
        "weekday": "Fri",
        "display": "Fri, 09 Oct 2026, 03:41 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-09T10:11:17.051Z",
        "epoch_ms": 1791540677051
      },
      "occurred_ago": "2d 22h",
      "service_name": "gateway-service",
      "environment": "development",
      "source": "EXTERNAL_API",
      "source_label": "External API call",
      "category": "EXTERNAL_API",
      "category_label": "External API",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "4dd1cb1cbeb73e89315db461c7b6ba34",
      "user_id": "76",
      "user_email": "pk@gmail.com",
      "user_email_source": "logged",
      "user_name": "PK",
      "user_key": "76",
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
        "last_seen_at": "2026-10-09T12:29:54.729Z",
        "last_seen_at_ist": {
          "iso": "2026-10-09T17:59:54+05:30",
          "date": "09 Oct 2026",
          "time": "05:59 PM",
          "time24": "17:59",
          "weekday": "Fri",
          "display": "Fri, 09 Oct 2026, 05:59 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-09T12:29:54.729Z",
          "epoch_ms": 1791548994729
        },
        "registered_at": "2026-05-18T06:47:13.500Z"
      },
      "ip_address": "::1",
      "endpoint": "/api/auth/activity/ping",
      "http_method": "POST",
      "method": "node:net.internalConnectMultiple",
      "action": "CREATE",
      "resource_type": null,
      "resource_id": null,
      "status_code"
... (truncated)
```
</details>

### Error Log Reopen

**Purpose:** resolved=false reopens the error and clears resolved_by / resolved_at / resolution_note.

**Inputs:** Body: { resolved: false }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/b1a29138-c786-4682-80a4-f06d5fb0f1e1/resolve" -H "Content-Type: application/json" -d '{"resolved":false}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `145ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "b1a29138-c786-4682-80a4-f06d5fb0f1e1",
      "created_at": "2026-10-09T10:11:17.051Z",
      "created_at_ist": {
        "iso": "2026-10-09T15:41:17+05:30",
        "date": "09 Oct 2026",
        "time": "03:41 PM",
        "time24": "15:41",
        "weekday": "Fri",
        "display": "Fri, 09 Oct 2026, 03:41 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-09T10:11:17.051Z",
        "epoch_ms": 1791540677051
      },
      "occurred_ago": "2d 22h",
      "service_name": "gateway-service",
      "environment": "development",
      "source": "EXTERNAL_API",
      "source_label": "External API call",
      "category": "EXTERNAL_API",
      "category_label": "External API",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "4dd1cb1cbeb73e89315db461c7b6ba34",
      "user_id": "76",
      "user_email": "pk@gmail.com",
      "user_email_source": "logged",
      "user_name": "PK",
      "user_key": "76",
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
        "last_seen_at": "2026-10-09T12:29:54.729Z",
        "last_seen_at_ist": {
          "iso": "2026-10-09T17:59:54+05:30",
          "date": "09 Oct 2026",
          "time": "05:59 PM",
          "time24": "17:59",
          "weekday": "Fri",
          "display": "Fri, 09 Oct 2026, 05:59 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-09T12:29:54.729Z",
          "epoch_ms": 1791548994729
        },
        "registered_at": "2026-05-18T06:47:13.500Z"
      },
      "ip_address": "::1",
      "endpoint": "/api/auth/activity/ping",
      "http_method": "POST",
      "method": "node:net.internalConnectMultiple",
      "action": "CREATE",
      "resource_type": null,
      "resource_id": null,
      "status_code"
... (truncated)
```
</details>

### Error Logs Bulk Resolve (ids)

**Purpose:** Resolve many rows at once by id list (or by fingerprint to close every occurrence of an issue).

**Inputs:** Body: { ids[] | fingerprint, resolved, note? }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/resolve" -H "Content-Type: application/json" -d '{"ids":["b1a29138-c786-4682-80a4-f06d5fb0f1e1"],"resolved":true,"note":"automated test: bulk"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `41ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "resolved": true,
    "changed": 1,
    "ids": [
      "b1a29138-c786-4682-80a4-f06d5fb0f1e1"
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
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/resolve" -H "Content-Type: application/json" -d '{"fingerprint":"c0812713ea85c091c2530fc54cdc4e28976f8da1fa4d211a6a50e8d41dbdb393","resolved":false}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `60ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "resolved": false,
    "changed": 1,
    "ids": [
      "b1a29138-c786-4682-80a4-f06d5fb0f1e1"
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
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/resolve-fingerprint" -H "Content-Type: application/json" -d '{"fingerprint":"c0812713ea85c091c2530fc54cdc4e28976f8da1fa4d211a6a50e8d41dbdb393","resolved_by":"api-test@jurinex","resolution_note":"automated test: resolve-fingerprint"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `74ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "fingerprint": "c0812713ea85c091c2530fc54cdc4e28976f8da1fa4d211a6a50e8d41dbdb393",
    "resolved": true,
    "resolved_by": "api-test@jurinex",
    "changed": 24,
    "ids": [
      "3b1ba79f-685d-45b7-83bc-d0ef05ec1bff",
      "34e8fc0d-2c89-4b65-a93f-e808614dc769",
      "d66f9915-6064-44e1-85fa-f02b2eef7abe",
      "ba0804b0-d49f-413a-89c2-0512375baf3f",
      "8b70da5f-8d14-4f63-8a7c-799323f6be6e",
      "0c6a51bb-1e41-4453-a0e7-6f6b22ba4169",
      "89ac6c4a-998e-42fe-82b4-ab359307da1c",
      "b8a131a9-dfa0-425a-a841-e2a017bb1a26",
      "101634c8-7534-4d72-8535-149fb927b17b",
      "8da23895-dacd-48d7-84b5-872903c04f06",
      "c22bc6a5-d12e-4c36-97c1-33e2121fcbcb",
      "2e02dd32-2fd4-45d4-9927-9d99b749e3f6",
      "745718ac-1293-4cad-b979-3f88d3d278b2",
      "420029dc-8691-414c-93d8-3fcb1160389c",
      "309bd5d3-cae6-4997-a612-4a1c6f77c84b",
      "49c45884-92e4-4a2e-9aec-246dfd111cf8",
      "16b3863e-aeb9-477d-8389-430a68ee89a4",
      "3dd24924-852d-4406-8d1e-e8ae66a4d9a8",
      "4654d6a3-4006-4360-9620-d5afbd3bb4ed",
      "3e468004-9098-43b6-9810-55a025cdd929",
      "53acc5f7-e03d-4e5b-8dff-c59137e6f4c0",
      "47da6e0a-be4c-46e2-82d7-d3186956abf1",
      "5189769f-a6ae-4001-8a3e-805ed094a4b5",
      "b1a29138-c786-4682-80a4-f06d5fb0f1e1"
    ],
    "occurrences": {
      "total": 24,
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
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/resolve" -H "Content-Type: application/json" -d '{"resolved":true}'
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `8ms`

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
  "requestId": "08739eaa-7904-4078-a835-ad098412a7da"
}
```
</details>

### Error Logs Bulk Delete (INVALID — expect 400)

**Purpose:** ids must be UUIDs; nothing is deleted on validation failure.

**Inputs:** Body: { ids: ["not-a-uuid"] }

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/bulk-delete" -H "Content-Type: application/json" -d '{"ids":["not-a-uuid"]}'
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `5ms`

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
  "requestId": "cdf5434c-1d80-4354-9284-324df60738f6"
}
```
</details>

### Error Log Delete (UNKNOWN id — expect 404)

**Purpose:** Deleting an unknown row returns NOT_FOUND. (Real rows are not deleted by the test run.)

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X DELETE -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/error-logs/00000000-0000-4000-8000-000000000000"
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
  "requestId": "e77a2ba9-f18e-47ba-b163-87e85b7c2ea6"
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/audit-logs/summary"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `129ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-12T08:18:21.721Z",
    "generated_at_ist": {
      "iso": "2026-10-12T13:48:21+05:30",
      "date": "12 Oct 2026",
      "time": "01:48 PM",
      "time24": "13:48",
      "weekday": "Mon",
      "display": "Mon, 12 Oct 2026, 01:48 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-12T08:18:21.721Z",
      "epoch_ms": 1791793101721
    },
    "period": {
      "from": "2026-10-11T08:18:21.720Z",
      "from_ist": {
        "iso": "2026-10-11T13:48:21+05:30",
        "date": "11 Oct 2026",
        "time": "01:48 PM",
        "time24": "13:48",
        "weekday": "Sun",
        "display": "Sun, 11 Oct 2026, 01:48 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-11T08:18:21.720Z",
        "epoch_ms": 1791706701720
      },
      "to": null,
      "to_ist": null,
      "since_hours": null
    },
    "filters": {
      "from": "2026-10-11T08:18:21.720Z",
      "from_ist": {
        "iso": "2026-10-11T13:48:21+05:30",
        "date": "11 Oct 2026",
        "time": "01:48 PM",
        "time24": "13:48",
        "weekday": "Sun",
        "display": "Sun, 11 Oct 2026, 01:48 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-11T08:18:21.720Z",
        "epoch_ms": 1791706701720
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
      "calls": 0,
      "succeeded": 0,
      "failed
... (truncated)
```
</details>

### Audit Logs Meta

**Purpose:** Distinct services, resource types, actions, HTTP methods, error types for filter dropdowns + defaults/limits.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/audit-logs/meta"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `59ms`

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
          "value": "gateway-service",
          "count": 251
        },
        {
          "value": "authservice",
          "count": 249
        },
        {
          "value": "agentic-document-service",
          "count": 228
        },
        {
          "value": "payment-service",
          "count": 168
        }
      ],
      "environments": [
        {
          "value": "development",
          "count": 896
        }
      ],
      "resource_types": [
        {
          "value": "STORAGE FOLDER",
          "count": 176
        },
        {
          "value": "USER",
          "count": 81
        },
        {
          "value": "PAYMENT",
          "count": 67
        },
        {
          "value": "CASE",
          "count": 29
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
          "value": "PLAN",
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
          "count": 421
        },
        {
          "value": "CREATE",
          "count": 302
        },
        {
          "value": "UPDATE",
          "count": 12
        }
      ],
      "http_methods": [
        {
          "value": "GET",
          "count": 527
        },
        {
          "value": "POST",
          "count": 353
        },
        {
          "value": "PUT",
          "count": 16
        }
      ],
      "statuses": [
        {
          "val
... (truncated)
```
</details>

### Audit Logs List

**Purpose:** Paginated API-call list (last 7 days by default, activity pings hidden, newest first). Never includes stack_trace.

**Inputs:** Query: page, page_size (+ filters)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/audit-logs?page=1&page_size=20"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `183ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [],
    "total": 0,
    "page": 1,
    "page_size": 20,
    "total_pages": 1,
    "filters": {
      "from": "2026-10-11T08:18:21.905Z",
      "from_ist": {
        "iso": "2026-10-11T13:48:21+05:30",
        "date": "11 Oct 2026",
        "time": "01:48 PM",
        "time24": "13:48",
        "weekday": "Sun",
        "display": "Sun, 11 Oct 2026, 01:48 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-11T08:18:21.905Z",
        "epoch_ms": 1791706701905
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
      "timezone": "Asia/Kolkata",
      "sort": "newest"
    },
    "timezone": "Asia/Kolkata"
  }
}
```
</details>

### Audit Logs List (pings included)

**Purpose:** exclude_pings=false brings /api/auth/activity/ping rows back; total must be >= the default total.

**Inputs:** Query: exclude_pings=false

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/audit-logs?exclude_pings=false&page_size=100"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `68ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [],
    "total": 0,
    "page": 1,
    "page_size": 100,
    "total_pages": 1,
    "filters": {
      "from": "2026-10-11T08:18:22.090Z",
      "from_ist": {
        "iso": "2026-10-11T13:48:22+05:30",
        "date": "11 Oct 2026",
        "time": "01:48 PM",
        "time24": "13:48",
        "weekday": "Sun",
        "display": "Sun, 11 Oct 2026, 01:48 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-11T08:18:22.090Z",
        "epoch_ms": 1791706702090
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
      "exclude_pings": false,
      "kind": "all",
      "min_duration_ms": null,
      "timezone": "Asia/Kolkata",
      "sort": "newest"
    },
    "timezone": "Asia/Kolkata"
  }
}
```
</details>

### Audit Logs List (FAILED only)

**Purpose:** status=FAILED returns only failed calls; these carry error_type / user_message / error_log_id.

**Inputs:** Query: status=FAILED

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/audit-logs?status=FAILED&page_size=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `68ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [],
    "total": 0,
    "page": 1,
    "page_size": 50,
    "total_pages": 1,
    "filters": {
      "from": "2026-10-11T08:18:22.157Z",
      "from_ist": {
        "iso": "2026-10-11T13:48:22+05:30",
        "date": "11 Oct 2026",
        "time": "01:48 PM",
        "time24": "13:48",
        "weekday": "Sun",
        "display": "Sun, 11 Oct 2026, 01:48 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-11T08:18:22.157Z",
        "epoch_ms": 1791706702157
      },
      "to": null,
      "to_ist": null,
      "to_bound": null,
      "since_hours": null,
      "user": null,
      "user_resolved": null,
      "service": "all",
      "environment": "all",
      "status": "FAILED",
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
      "timezone": "Asia/Kolkata",
      "sort": "newest"
    },
    "timezone": "Asia/Kolkata"
  }
}
```
</details>

### Audit Logs List (error_code filter + sort=duration_ms)

**Purpose:** error_code is a csv filter (upper-cased); sort=duration_ms (alias of slowest) orders by duration desc.

**Inputs:** Query: error_code, sort

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/audit-logs?error_code=auth_expired%2Cnot_found&sort=duration_ms&page_size=20"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `67ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [],
    "total": 0,
    "page": 1,
    "page_size": 20,
    "total_pages": 1,
    "filters": {
      "from": "2026-10-11T08:18:22.226Z",
      "from_ist": {
        "iso": "2026-10-11T13:48:22+05:30",
        "date": "11 Oct 2026",
        "time": "01:48 PM",
        "time24": "13:48",
        "weekday": "Sun",
        "display": "Sun, 11 Oct 2026, 01:48 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-11T08:18:22.226Z",
        "epoch_ms": 1791706702226
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
      "error_code": [
        "AUTH_EXPIRED",
        "NOT_FOUND"
      ],
      "status_code": "all",
      "status_class": null,
      "q": null,
      "exclude_pings": true,
      "kind": "all",
      "min_duration_ms": null,
      "timezone": "Asia/Kolkata",
      "sort": "duration_ms"
    },
    "timezone": "Asia/Kolkata"
  }
}
```
</details>

### Audit Logs List (INVALID — expect 400)

**Purpose:** status must be SUCCESS | FAILED; from/to must be YYYY-MM-DD or ISO date-time.

**Inputs:** Query: status=NOPE&from=yesterday

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/audit-logs?status=NOPE&from=yesterday"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `7ms`

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
  "requestId": "85ef43c5-db88-422c-8481-23ba8c3630f2"
}
```
</details>

### Audit Logs CSV Export

**Purpose:** CSV with the same filters as the list (UTF-8 BOM, IST columns), max 50 000 rows.

**Inputs:** Query: same as list

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/audit-logs/export?status=FAILED&exclude_pings=false"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `68ms`

<details><summary>Response sample</summary>

```json
ID,Timestamp (IST),Date (IST),Time (IST),User email,User id,User name,Service,Environment,Action,Resource type,Resource id,Method (handler),HTTP method,Endpoint,Route,Kind,Status,Code,Duration (ms),IP address,User agent,Request id,Error code,What happened,Reason,Error type,Error message,User message,Suggested fix,Error log id,Timestamp (UTC)

```
</details>

### Audit Log Detail (INVALID id — expect 400)

**Purpose:** Row ids are UUIDs.

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/audit-logs/not-a-uuid"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `4ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Audit log id must be a UUID"
  },
  "requestId": "5c9fef9f-372a-43cc-82ef-cda9acb49a2d"
}
```
</details>

### Audit Log Detail (UNKNOWN id — expect 404)

**Purpose:** Unknown UUID returns NOT_FOUND.

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/audit-logs/00000000-0000-4000-8000-000000000000"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `36ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Audit log not found"
  },
  "requestId": "02bd3a11-9a0a-4473-8eb8-4df3f9a8b47d"
}
```
</details>

---

## Sales Referrals

### Sales Referrals Summary

**Purpose:** A12 — six summary cards (total, via code, direct, free / paid / lapsed) + paidPercent + trackingSince.

**Inputs:** Query: from, to (YYYY-MM-DD, IST), type=ALL|INTERNAL|OUTSOURCED

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/reports/summary"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `46ms`

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
    "totalSignups": 0,
    "viaCode": 0,
    "direct": 0,
    "free": {
      "total": 0,
      "viaCode": 0
    },
    "paid": {
      "total": 0,
      "viaCode": 0
    },
    "lapsed": {
      "total": 0,
      "viaCode": 0
    },
    "paidPercent": 0
  }
}
```
</details>

### Sales Referrals Summary (INVALID date range — expect 400)

**Purpose:** A12 — `to` before `from` is rejected with VALIDATION_FAILED.

**Inputs:** {"from":"2026-10-13","to":"2026-10-01"}

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/reports/summary?from=2026-10-13&to=2026-10-01"
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
        "field": "to",
        "message": "\"to\" must be on or after \"from\""
      }
    ]
  },
  "requestId": "b3fdf621-48de-414b-8311-60596c177175"
}
```
</details>

### Sales Referrals Owners Table

**Purpose:** A13 — one row per owner (signups, free, paid, lapsed, paidPercent, code counts) + Direct row + ownerCountAll.

**Inputs:** Query: from, to, type, search, sort=name|signups|free|paid|lapsed|paidPercent, direction

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/reports/owners"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `109ms`

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
    "ownerCountAll": 0,
    "codeCountAll": 0,
    "owners": [],
    "direct": {
      "signups": 0,
      "free": 0,
      "paid": 0,
      "lapsed": 0,
      "paidPercent": 0
    }
  }
}
```
</details>

### Sales Referrals Owners Table (type=INTERNAL, direct row omitted)

**Purpose:** A13 — type filter removes Direct (direct: null) and keeps only internal owners.

**Inputs:** type=INTERNAL

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/reports/owners?type=INTERNAL"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `75ms`

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
    "ownerCountAll": 0,
    "codeCountAll": 0,
    "owners": [],
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/codes?limit=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `43ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "groups": []
  }
}
```
</details>

### Sales Referrals Suggest Codes

**Purpose:** A9 — generates available codes from the owner name (SalesForYou → SFY-XXXX); nothing is reserved.

**Inputs:** {"ownerName":"SalesForYou","count":2,"exclude":"SFY-7K2Q"}

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/codes/suggest?ownerName=SalesForYou&count=2&exclude=SFY-7K2Q"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `75ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "suggestions": [
      "SFY-QBDQ",
      "SFY-9R8E"
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/codes/suggest"
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
        "field": null,
        "message": "\"value\" must contain at least one of [ownerName, ownerId]"
      }
    ]
  },
  "requestId": "a6b6f9cf-02fc-45b0-8128-43c432f3277f"
}
```
</details>

### Sales Referrals Code Availability (invalid format)

**Purpose:** A10 — always 200; status carries AVAILABLE / TAKEN / INVALID_FORMAT.

**Inputs:** {"code":"bad code!"}

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/codes/availability?code=bad+code%21"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `3ms`

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

**Inputs:** {"code":"zz-test-zcmge"}

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/codes/availability?code=zz-test-zcmge"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `38ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "code": "ZZ-TEST-ZCMGE",
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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/reports/signups?direct=true&page=0&size=5"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `75ms`

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
      "search": null
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

### Sales Referrals Signups (no scope — expect 400)

**Purpose:** A15 — exactly one of codeId / ownerId / direct=true is required.

**Inputs:** none

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/reports/signups"
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
        "field": "scope",
        "message": "Pass exactly one of codeId, ownerId or direct=true",
        "given": []
      }
    ]
  },
  "requestId": "6c934b1f-2ae9-4730-8c28-d22d710a43fb"
}
```
</details>

### Sales Referrals Owner Detail (UNKNOWN id — expect 404)

**Purpose:** A3 — unknown owner id → SALES_OWNER_NOT_FOUND.

**Inputs:** ownerId = all-zero UUID

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/owners/00000000-0000-0000-0000-000000000000"
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `39ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "SALES_OWNER_NOT_FOUND",
    "message": "This sales owner no longer exists."
  },
  "requestId": "2642cc6b-ada4-42b3-892d-4dc6732c795a"
}
```
</details>

### Sales Referrals Create Owner (INVALID body — expect 400)

**Purpose:** A1 — body validation: name required, internal boolean, codes array. Nothing is created.

**Inputs:** {"name":"","internal":"maybe","codes":"x"}

**Example curl:**
```bash
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/owners" -H "Content-Type: application/json" -d '{"name":"","internal":"maybe","codes":"x"}'
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `7ms`

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
  "requestId": "460173c6-6bf4-4030-8645-2f7ea6ccd3f3"
}
```
</details>

### Sales Referrals Set Workspace Referral (UNKNOWN tenant — expect 404)

**Purpose:** A16 — unknown workspace id → TENANT_NOT_FOUND. Nothing is written.

**Inputs:** {"codeId":"00000000-0000-0000-0000-000000000000","reason":"Automated test — should fail on the unknown workspace"}

**Example curl:**
```bash
curl -s -X PUT -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4111/api/admin/sales-referrals/tenants/00000000-0000-0000-0000-000000000000/referral" -H "Content-Type: application/json" -d '{"codeId":"00000000-0000-0000-0000-000000000000","reason":"Automated test — should fail on the unknown workspace"}'
```

**Test Result:** ✅ PASS — Status: `404` — Latency: `105ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "TENANT_NOT_FOUND",
    "message": "This workspace no longer exists."
  },
  "requestId": "c78a2dd1-cb39-49d3-87c4-59e21eee8542"
}
```
</details>

---

## Auth Negative

### No Auth Header

**Purpose:** Verify that missing Authorization header returns 401.

**Inputs:** No Authorization header

**Example curl:**
```bash
curl -s "http://localhost:4111/api/admin/overview"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `7ms`

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
curl -s -H "Authorization: Bearer wrong_token" "http://localhost:4111/api/admin/overview"
```

**Test Result:** ❌ FAIL — Status: `404` — Latency: `5ms`

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
