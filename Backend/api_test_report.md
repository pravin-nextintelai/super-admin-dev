# Admin Dashboard API — Test Report

**Generated:** 2026-10-08T12:00:00.627Z  
**Base URL:** `http://localhost:4010`  
**Admin Token:** `[REDACTED]`  

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 64 |
| ✅ Passed | 50 |
| ❌ Failed | 14 |
| Avg Latency | 65ms |

### All Tests

| # | Method | Endpoint | Expected | Actual | Result | Latency |
|---|--------|----------|----------|--------|--------|--------|
| 1 | GET | `/api/admin/overview` | 200 + { success: true, data: { total_judgments, ... } } | 404 | ❌ FAIL | 3ms |
| 2 | GET | `/api/admin/hitl` | 200 + data.tasks array | 404 | ❌ FAIL | 2ms |
| 3 | GET | `/api/admin/hitl/00000000-0000-0000-0000-000000000000` | 404 | 404 | ✅ PASS | 2ms |
| 4 | POST | `/api/admin/hitl/1/action` | 400 | 404 | ❌ FAIL | 2ms |
| 5 | GET | `/api/admin/pipeline/summary` | 200 + object | 404 | ❌ FAIL | 1ms |
| 6 | GET | `/api/admin/pipeline/items` | 200 + paginated list | 404 | ❌ FAIL | 1ms |
| 7 | GET | `/api/admin/pipeline/errors` | 200 | 404 | ❌ FAIL | 1ms |
| 8 | GET | `/api/admin/routesdb/summary` | 200 | 404 | ❌ FAIL | 2ms |
| 9 | GET | `/api/admin/routesdb/top-cited` | 200 + array | 404 | ❌ FAIL | 1ms |
| 10 | GET | `/api/admin/routesdb/courts-breakdown` | 200 | 404 | ❌ FAIL | 2ms |
| 11 | GET | `/api/admin/business/summary` | 200 | 404 | ❌ FAIL | 1ms |
| 12 | GET | `/api/admin/business/reports-per-day` | 200 + array | 404 | ❌ FAIL | 1ms |
| 13 | GET | `/api/admin/business/top-users` | 200 + array | 404 | ❌ FAIL | 1ms |
| 14 | GET | `/api/admin/users` | 200 + data.users array | 200 | ✅ PASS | 65ms |
| 15 | GET | `/api/admin/users/pending` | 200 | 200 | ✅ PASS | 38ms |
| 16 | GET | `/api/admin/users/stats` | 200 | 200 | ✅ PASS | 34ms |
| 17 | POST | `/api/admin/users/52/approve` | 200 | 200 | ✅ PASS | 36ms |
| 18 | POST | `/api/admin/users/52/block` | 200 | 200 | ✅ PASS | 37ms |
| 19 | POST | `/api/admin/users/52/unblock` | 200 | 200 | ✅ PASS | 36ms |
| 20 | POST | `/api/public/contact` | 201 + data.reference_no + data.submitted_at_ist | 201 | ✅ PASS | 224ms |
| 21 | GET | `/api/admin/contact-enquiries/stats` | 200 + data.totals | 200 | ✅ PASS | 37ms |
| 22 | GET | `/api/admin/contact-enquiries/meta` | 200 + data.statuses | 200 | ✅ PASS | 36ms |
| 23 | GET | `/api/admin/contact-enquiries` | 200 + data.enquiries[] | 200 | ✅ PASS | 70ms |
| 24 | GET | `/api/admin/contact-enquiries/25` | 200 + data.enquiry + data.activities | 200 | ✅ PASS | 70ms |
| 25 | POST | `/api/admin/contact-enquiries/25/contact-log` | 200 + enquiry.first_contacted_at_ist | 200 | ✅ PASS | 514ms |
| 26 | PATCH | `/api/admin/contact-enquiries/25` | 200 + enquiry.status = closed | 200 | ✅ PASS | 229ms |
| 27 | GET | `/api/admin/contact-enquiries/export` | 200 text/csv | 200 | ✅ PASS | 69ms |
| 28 | DELETE | `/api/admin/contact-enquiries/25` | 200 | 200 | ✅ PASS | 34ms |
| 29 | GET | `/api/admin/error-logs/stats` | 200 + data.totals, daily_trend[], by_service[], top_issues[], top_users[] | 200 | ✅ PASS | 130ms |
| 30 | GET | `/api/admin/error-logs/meta` | 200 + data.vocab, data.used.services[], data.permissions | 200 | ✅ PASS | 36ms |
| 31 | GET | `/api/admin/error-logs` | 200 + data.logs[], data.pagination | 200 | ✅ PASS | 99ms |
| 32 | GET | `/api/admin/error-logs` | 200 + only rows for that service | 200 | ✅ PASS | 104ms |
| 33 | GET | `/api/admin/error-logs` | 200 + every row is_resolved=false | 200 | ✅ PASS | 112ms |
| 34 | GET | `/api/admin/error-logs` | 200 + every row origin=browser with client{} | 200 | ✅ PASS | 107ms |
| 35 | GET | `/api/admin/error-logs` | 200 + no row with is_debug=true + total = stats.total - stats.debug | 200 | ✅ PASS | 199ms |
| 36 | GET | `/api/admin/error-logs` | 200 + logs=[] total=0 | 200 | ✅ PASS | 70ms |
| 37 | GET | `/api/admin/error-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 2ms |
| 38 | GET | `/api/admin/error-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 2ms |
| 39 | GET | `/api/admin/error-logs/users` | 200 + data.users[], data.pagination | 200 | ✅ PASS | 100ms |
| 40 | GET | `/api/admin/error-logs/issues` | 200 + data.issues[] | 200 | ✅ PASS | 35ms |
| 41 | GET | `/api/admin/error-logs/export` | 200 text/csv with header row | 200 | ✅ PASS | 140ms |
| 42 | GET | `/api/admin/error-logs/not-a-uuid` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 2ms |
| 43 | GET | `/api/admin/error-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 35ms |
| 44 | GET | `/api/admin/error-logs/d7e5f33d-5f89-487e-be54-25d548963481` | 200 + data.log (with stack_trace, payload, origin), data.issue, data.audit, data.related | 200 | ✅ PASS | 133ms |
| 45 | PATCH | `/api/admin/error-logs/d7e5f33d-5f89-487e-be54-25d548963481/resolve` | 200 + data.log.is_resolved=true | 200 | ✅ PASS | 142ms |
| 46 | PATCH | `/api/admin/error-logs/d7e5f33d-5f89-487e-be54-25d548963481/resolve` | 200 + data.log.is_resolved=false | 200 | ✅ PASS | 138ms |
| 47 | PATCH | `/api/admin/error-logs/resolve` | 200 + data.changed=1 | 200 | ✅ PASS | 37ms |
| 48 | PATCH | `/api/admin/error-logs/resolve` | 200 + data.changed>=1 | 200 | ✅ PASS | 37ms |
| 49 | PATCH | `/api/admin/error-logs/resolve` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 4ms |
| 50 | POST | `/api/admin/error-logs/bulk-delete` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 3ms |
| 51 | DELETE | `/api/admin/error-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 36ms |
| 52 | GET | `/api/admin/audit-logs/summary` | 200 + data.totals, per_service[], top_endpoints[], top_users[] | 200 | ✅ PASS | 76ms |
| 53 | GET | `/api/admin/audit-logs/meta` | 200 + data.used.services[], data.vocab | 200 | ✅ PASS | 35ms |
| 54 | GET | `/api/admin/audit-logs` | 200 + data.rows[], data.total, no ping rows, no stack_trace | 200 | ✅ PASS | 107ms |
| 55 | GET | `/api/admin/audit-logs` | 200 + total >= default total | 200 | ✅ PASS | 148ms |
| 56 | GET | `/api/admin/audit-logs` | 200 + every row status=FAILED | 200 | ✅ PASS | 109ms |
| 57 | GET | `/api/admin/audit-logs` | 200 + only that user's rows | 200 | ✅ PASS | 153ms |
| 58 | GET | `/api/admin/audit-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 2ms |
| 59 | GET | `/api/admin/audit-logs/export` | 200 text/csv with header row | 200 | ✅ PASS | 114ms |
| 60 | GET | `/api/admin/audit-logs/not-a-uuid` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 2ms |
| 61 | GET | `/api/admin/audit-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 38ms |
| 62 | GET | `/api/admin/audit-logs/04ed84e7-ddf2-4660-88e7-36a379932efc` | 200 + data.audit (with stack_trace), data.error (linked error_logs row or null), data.errors[] | 200 | ✅ PASS | 114ms |
| 63 | GET | `/api/admin/overview` | 401 | 404 | ❌ FAIL | 2ms |
| 64 | GET | `/api/admin/overview` | 403 | 404 | ❌ FAIL | 1ms |

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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

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

**Test Result:** ✅ PASS — Status: `404` — Latency: `2ms`

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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `1ms`

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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `1ms`

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

**Test Result:** ✅ PASS — Status: `200` — Latency: `65ms`

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
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/pending"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `38ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 52,
        "email": "sarule@nexintelai.com",
        "username": "Pravin Sarule",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-03-31T03:38:49.124Z",
        "phone": "7499303475",
        "location": "teset, teset"
      },
      {
        "id": 51,
        "email": "pravin@nexintelai.com",
        "username": "Pravin",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-03-31T03:32:20.954Z",
        "phone": "7499303475",
        "location": "Test, Test"
      },
      {
        "id": 33,
        "email": "test@gmail.com",
        "username": "test",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-01-19T00:41:24.466Z",
        "phone": "1475683596",
        "location": "test, test"
      },
      {
        "id": 12,
        "email": "rutuja@gmail.com",
        "username": "Rutuja",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-01-06T05:30:18.079Z",
        "phone": "+914345456567",
        "location": "vcdv, vfcxvfc"
      },
      {
        "id": 11,
        "email": "vishal.bainade@nexintelai.com",
        "username": "Vishal Bainade",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-01-06T05:13:26.206Z",
        "phone": "+917418529633",
        "location": "A.Bad, Maharashtra"
      },
      {
        "id": 9,
        "email": "firm@example.com",
        "username": "Test",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "
... (truncated)
```
</details>

### Users Stats

**Purpose:** User statistics: total, active, blocked, pending, by account type.

**Inputs:** Headers: Authorization

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/stats"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `34ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "total_users": 67,
    "active_users": 59,
    "blocked_users": 1,
    "pending_approvals": 6,
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/52/approve"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `36ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 52,
      "email": "sarule@nexintelai.com",
      "username": "Pravin Sarule",
      "password": "$2b$10$nuOLMZyNMzZwC52JUGvSge70zxwiEbYoLLkE9Vo0MEEeyxKhDdOUK",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": false,
      "created_at": "2026-03-31T03:38:49.124Z",
      "updated_at": "2026-03-31T03:38:49.124Z",
      "razorpay_customer_id": null,
      "phone": "7499303475",
      "location": "teset, teset",
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "FIRM_ADMIN",
      "approval_status": "APPROVED",
      "first_login": true,
      "is_active": true,
      "last_login_at": null,
      "last_seen_at": null,
      "domain_role": null,
      "role_id": null,
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/52/block"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `37ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 52,
      "email": "sarule@nexintelai.com",
      "username": "Pravin Sarule",
      "password": "$2b$10$nuOLMZyNMzZwC52JUGvSge70zxwiEbYoLLkE9Vo0MEEeyxKhDdOUK",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": true,
      "created_at": "2026-03-31T03:38:49.124Z",
      "updated_at": "2026-03-31T03:38:49.124Z",
      "razorpay_customer_id": null,
      "phone": "7499303475",
      "location": "teset, teset",
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "FIRM_ADMIN",
      "approval_status": "APPROVED",
      "first_login": true,
      "is_active": false,
      "last_login_at": null,
      "last_seen_at": null,
      "domain_role": null,
      "role_id": null,
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/52/unblock"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `36ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 52,
      "email": "sarule@nexintelai.com",
      "username": "Pravin Sarule",
      "password": "$2b$10$nuOLMZyNMzZwC52JUGvSge70zxwiEbYoLLkE9Vo0MEEeyxKhDdOUK",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": false,
      "created_at": "2026-03-31T03:38:49.124Z",
      "updated_at": "2026-03-31T03:38:49.124Z",
      "razorpay_customer_id": null,
      "phone": "7499303475",
      "location": "teset, teset",
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "FIRM_ADMIN",
      "approval_status": "APPROVED",
      "first_login": true,
      "is_active": true,
      "last_login_at": null,
      "last_seen_at": null,
      "domain_role": null,
      "role_id": null,
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
curl -s -X POST -H "Content-Type: application/json" -d '{"name":"API","surname":"Test","email":"api.test+1791460796357@example.com","mobile":"+91 90000 00000","organisationName":"Automated Test","whatIsThisAbout":"Pricing & plans","additionalDetails":"automated test 1791460796357","consent":true,"pageUrl":"https://jurinex.ai/contact"}' "http://localhost:4010/api/public/contact"
```

**Test Result:** ✅ PASS — Status: `201` — Latency: `224ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "id": 25,
    "reference_no": "CE-20261008-00025",
    "duplicate": false,
    "submitted_at": "2026-10-08T11:59:39.851Z",
    "submitted_at_ist": {
      "iso": "2026-10-08T17:29:39+05:30",
      "date": "08 Oct 2026",
      "time": "05:29 PM",
      "time24": "17:29",
      "weekday": "Thu",
      "display": "Thu, 08 Oct 2026, 05:29 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-08T11:59:39.851Z",
      "epoch_ms": 1791460779851
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `37ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-08T11:59:56.584Z",
    "generated_at_ist": {
      "iso": "2026-10-08T17:29:56+05:30",
      "date": "08 Oct 2026",
      "time": "05:29 PM",
      "time24": "17:29",
      "weekday": "Thu",
      "display": "Thu, 08 Oct 2026, 05:29 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-08T11:59:56.584Z",
      "epoch_ms": 1791460796584
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
      "last_30_days": 4,
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `36ms`

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

**Test Result:** ✅ PASS — Status: `200` — Latency: `70ms`

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
        "submitted_ago": "27d 5h",
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
        "awaiting_for": "27d 5h",
        "status_changed_at": "2026-09-11T06:45:54.004Z",
    
... (truncated)
```
</details>

### Contact Enquiry Detail

**Purpose:** Single enquiry + activity timeline.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/25"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `70ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 25,
      "reference_no": "CE-20261008-00025",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791460796357@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791460796357",
      "marketing_consent": true,
      "consent_given_at": "2026-10-08T11:59:39.851Z",
      "consent_given_at_ist": {
        "iso": "2026-10-08T17:29:39+05:30",
        "date": "08 Oct 2026",
        "time": "05:29 PM",
        "time24": "17:29",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:29 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:59:39.851Z",
        "epoch_ms": 1791460779851
      },
      "submitted_at": "2026-10-08T11:59:39.851Z",
      "submitted_at_ist": {
        "iso": "2026-10-08T17:29:39+05:30",
        "date": "08 Oct 2026",
        "time": "05:29 PM",
        "time24": "17:29",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:29 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:59:39.851Z",
        "epoch_ms": 1791460779851
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/25/contact-log" -H "Content-Type: application/json" -d '{"channel":"call","outcome":"connected","note":"automated test call"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `514ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 25,
      "reference_no": "CE-20261008-00025",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791460796357@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791460796357",
      "marketing_consent": true,
      "consent_given_at": "2026-10-08T11:59:39.851Z",
      "consent_given_at_ist": {
        "iso": "2026-10-08T17:29:39+05:30",
        "date": "08 Oct 2026",
        "time": "05:29 PM",
        "time24": "17:29",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:29 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:59:39.851Z",
        "epoch_ms": 1791460779851
      },
      "submitted_at": "2026-10-08T11:59:39.851Z",
      "submitted_at_ist": {
        "iso": "2026-10-08T17:29:39+05:30",
        "date": "08 Oct 2026",
        "time": "05:29 PM",
        "time24": "17:29",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:29 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:59:39.851Z",
        "epoch_ms": 1791460779851
      },
      "submitted_ago": "just now",
      "status": "contacted",
      "status_label": "Contacted",
      "priority": "normal",
      "priority_label": "Normal",
      "assigned_to": null,
      "first_contacted_at": "2026-10-08T11:59:56.861Z",
      "first_contacted_at_ist": {
        "iso": "2026-10-08T17:29:56+05:30",
        "date": "08 Oct 2026",
        "time": "05:29 PM",
        "time24": "17:29",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:29 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:59:56.861Z",
        "epoch_ms": 1791460796861
      },
      "first_contacted_by": null,
      "last_contacted_at": "2026-10-08T11:59:56.861Z",
      "last_contacted_at_ist": {
        "iso": "2026-10-08T17:29:56+05:30
... (truncated)
```
</details>

### Contact Enquiry Update

**Purpose:** Change status / priority / assignee with timeline entries.

**Inputs:** Body: { status?, priority?, assigned_to?, note? }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/25" -H "Content-Type: application/json" -d '{"status":"closed","priority":"low","note":"automated test close"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `229ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 25,
      "reference_no": "CE-20261008-00025",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791460796357@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791460796357",
      "marketing_consent": true,
      "consent_given_at": "2026-10-08T11:59:39.851Z",
      "consent_given_at_ist": {
        "iso": "2026-10-08T17:29:39+05:30",
        "date": "08 Oct 2026",
        "time": "05:29 PM",
        "time24": "17:29",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:29 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:59:39.851Z",
        "epoch_ms": 1791460779851
      },
      "submitted_at": "2026-10-08T11:59:39.851Z",
      "submitted_at_ist": {
        "iso": "2026-10-08T17:29:39+05:30",
        "date": "08 Oct 2026",
        "time": "05:29 PM",
        "time24": "17:29",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:29 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:59:39.851Z",
        "epoch_ms": 1791460779851
      },
      "submitted_ago": "just now",
      "status": "closed",
      "status_label": "Closed",
      "priority": "low",
      "priority_label": "Low",
      "assigned_to": null,
      "first_contacted_at": "2026-10-08T11:59:56.861Z",
      "first_contacted_at_ist": {
        "iso": "2026-10-08T17:29:56+05:30",
        "date": "08 Oct 2026",
        "time": "05:29 PM",
        "time24": "17:29",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:29 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:59:56.861Z",
        "epoch_ms": 1791460796861
      },
      "first_contacted_by": null,
      "last_contacted_at": "2026-10-08T11:59:56.861Z",
      "last_contacted_at_ist": {
        "iso": "2026-10-08T17:29:56+05:30",
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `69ms`

<details><summary>Response sample</summary>

```json
Reference,Submitted (IST),Submitted date (IST),Submitted time (IST),Name,Surname,Email,Mobile,Organisation,What is this about,Additional details,Marketing consent,Status,Priority,Assigned to,First contacted (IST),First contacted by,First response time,Last contacted (IST),Last channel,Contact attempts,Closed (IST),Source,Page URL,Submitted (UTC)
CE-20261008-00025,"Thu, 08 Oct 2026, 05:29 PM IST",2026-10-08,17:29,API,Test,api.test+1791460796357@example.com,'+91 90000 00000,Automated Test,Pricing & plans,automated test 1791460796357,Yes,Closed,Low,,"Thu, 08 Oct 2026, 05:29 PM IST",,just now,"Th
```
</details>

### Contact Enquiry Delete (cleanup)

**Purpose:** Remove the test enquiry (super-admin / static token only).

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X DELETE -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/25"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `34ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "id": 25,
    "reference_no": "CE-20261008-00025",
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `130ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-08T11:59:57.644Z",
    "generated_at_ist": {
      "iso": "2026-10-08T17:29:57+05:30",
      "date": "08 Oct 2026",
      "time": "05:29 PM",
      "time24": "17:29",
      "weekday": "Thu",
      "display": "Thu, 08 Oct 2026, 05:29 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-08T11:59:57.644Z",
      "epoch_ms": 1791460797644
    },
    "totals": {
      "total": 149,
      "unresolved": 149,
      "resolved": 0,
      "critical": 0,
      "error": 60,
      "warning": 89,
      "critical_unresolved": 0,
      "last_hour": 39,
      "last_24h": 149,
      "today": 149,
      "yesterday": 0,
      "last_7_days": 149,
      "last_30_days": 149,
      "this_month": 149,
      "with_user": 86,
      "affected_users": 3,
      "affected_users_24h": 3,
      "affected_users_unresolved": 3,
      "distinct_issues": 35,
      "distinct_issues_unresolved": 35,
      "services": 3,
      "external_api": 62,
      "http_5xx": 23,
      "http_4xx": 83,
      "browser": 26,
      "recovered": 9,
      "debug": 10,
      "avg_latency_ms": 1546,
      "resolved_rate_pct": 0,
      "last_error_at": "2026-10-08T11:36:19.391Z",
      "last_error_at_ist": {
        "iso": "2026-10-08T17:06:19+05:30",
        "date": "08 Oct 2026",
        "time": "05:06 PM",
        "time24": "17:06",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:06 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:36:19.391Z",
        "epoch_ms": 1791459379391
      },
      "last_critical_at": null,
      "last_critical_at_ist": null
    },
    "daily_trend": [
      {
        "date": "2026-09-25",
        "label": "25 Sep",
        "total": 0,
        "critical": 0,
        "unresolved": 0,
        "affected_users": 0
      },
      {
        "date": "2026-09-26",
        "label": "26 Sep",
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `36ms`

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
          "count": 99
        },
        {
          "value": "payment-service",
          "count": 34
        },
        {
          "value": "gateway-service",
          "count": 16
        }
    
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `99ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "d7e5f33d-5f89-487e-be54-25d548963481",
        "created_at": "2026-10-08T11:36:19.391Z",
        "created_at_ist": {
          "iso": "2026-10-08T17:06:19+05:30",
          "date": "08 Oct 2026",
          "time": "05:06 PM",
          "time24": "17:06",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:06 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:36:19.391Z",
          "epoch_ms": 1791459379391
        },
        "occurred_ago": "23m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "AI_PROVIDER",
        "category_label": "AI provider",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "c88c79632ab34ce8baf701e65ccaf337",
        "user_id": "75",
        "user_email": "sk@gmail.com",
        "user_email_source": "logged",
        "user_name": "sk",
        "user_key": "75",
        "user": {
          "id": 75,
          "email": "sk@gmail.com",
          "username": "sk",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": "Pro",
          "last_seen_at": "2026-10-08T11:46:44.307Z",
          "last_seen_at_ist": {
            "iso": "2026-10-08T17:16:44+05:30",
            "date": "08 Oct 2026",
            "time": "05:16 PM",
            "time24": "17:16",
            "weekday": "Thu",
            "display": "Thu, 08 Oct 2026, 05:16 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-08T11:46:44.307Z",
            "epoch_ms": 1791460004307
          },
          "registered_at": "2026-05-18T06:12:19.363Z"
        },
        "ip_address": "127.0.0.1",
        "endpoint": "/api/files/Kisan_s_o_Bansi_Salampure_vs_Union_of_India___Others/intelligent-chat
... (truncated)
```
</details>

### Error Logs List (service filter)

**Purpose:** Filter by service_name; every returned row must belong to that service.

**Inputs:** Query: service=agentic-document-service

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?service=agentic-document-service&limit=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `104ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "d7e5f33d-5f89-487e-be54-25d548963481",
        "created_at": "2026-10-08T11:36:19.391Z",
        "created_at_ist": {
          "iso": "2026-10-08T17:06:19+05:30",
          "date": "08 Oct 2026",
          "time": "05:06 PM",
          "time24": "17:06",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:06 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:36:19.391Z",
          "epoch_ms": 1791459379391
        },
        "occurred_ago": "23m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "AI_PROVIDER",
        "category_label": "AI provider",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "c88c79632ab34ce8baf701e65ccaf337",
        "user_id": "75",
        "user_email": "sk@gmail.com",
        "user_email_source": "logged",
        "user_name": "sk",
        "user_key": "75",
        "user": {
          "id": 75,
          "email": "sk@gmail.com",
          "username": "sk",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": "Pro",
          "last_seen_at": "2026-10-08T11:46:44.307Z",
          "last_seen_at_ist": {
            "iso": "2026-10-08T17:16:44+05:30",
            "date": "08 Oct 2026",
            "time": "05:16 PM",
            "time24": "17:16",
            "weekday": "Thu",
            "display": "Thu, 08 Oct 2026, 05:16 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-08T11:46:44.307Z",
            "epoch_ms": 1791460004307
          },
          "registered_at": "2026-05-18T06:12:19.363Z"
        },
        "ip_address": "127.0.0.1",
        "endpoint": "/api/files/Kisan_s_o_Bansi_Salampure_vs_Union_of_India___Others/intelligent-chat
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `112ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "d7e5f33d-5f89-487e-be54-25d548963481",
        "created_at": "2026-10-08T11:36:19.391Z",
        "created_at_ist": {
          "iso": "2026-10-08T17:06:19+05:30",
          "date": "08 Oct 2026",
          "time": "05:06 PM",
          "time24": "17:06",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:06 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:36:19.391Z",
          "epoch_ms": 1791459379391
        },
        "occurred_ago": "23m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "AI_PROVIDER",
        "category_label": "AI provider",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "c88c79632ab34ce8baf701e65ccaf337",
        "user_id": "75",
        "user_email": "sk@gmail.com",
        "user_email_source": "logged",
        "user_name": "sk",
        "user_key": "75",
        "user": {
          "id": 75,
          "email": "sk@gmail.com",
          "username": "sk",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": "Pro",
          "last_seen_at": "2026-10-08T11:46:44.307Z",
          "last_seen_at_ist": {
            "iso": "2026-10-08T17:16:44+05:30",
            "date": "08 Oct 2026",
            "time": "05:16 PM",
            "time24": "17:16",
            "weekday": "Thu",
            "display": "Thu, 08 Oct 2026, 05:16 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-08T11:46:44.307Z",
            "epoch_ms": 1791460004307
          },
          "registered_at": "2026-05-18T06:12:19.363Z"
        },
        "ip_address": "127.0.0.1",
        "endpoint": "/api/files/Kisan_s_o_Bansi_Salampure_vs_Union_of_India___Others/intelligent-chat
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `107ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "d298f7fb-f5a4-440a-8402-3caba73c812a",
        "created_at": "2026-10-08T11:31:41.610Z",
        "created_at_ist": {
          "iso": "2026-10-08T17:01:41+05:30",
          "date": "08 Oct 2026",
          "time": "05:01 PM",
          "time24": "17:01",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:01 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:31:41.610Z",
          "epoch_ms": 1791459101610
        },
        "occurred_ago": "28m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "EXTERNAL_API",
        "category_label": "External API",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "7c23a1e7155142818b800b4185799d36",
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
          "last_seen_at": "2026-10-08T11:48:05.703Z",
          "last_seen_at_ist": {
            "iso": "2026-10-08T17:18:05+05:30",
            "date": "08 Oct 2026",
            "time": "05:18 PM",
            "time24": "17:18",
            "weekday": "Thu",
            "display": "Thu, 08 Oct 2026, 05:18 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-08T11:48:05.703Z",
            "epoch_ms": 1791460085703
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "ip_address": "127.0.0.1",
        "endpoint": "client:fetch",
        "http_method": "POST",
        "method": "client.fetch.n
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `199ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "d7e5f33d-5f89-487e-be54-25d548963481",
        "created_at": "2026-10-08T11:36:19.391Z",
        "created_at_ist": {
          "iso": "2026-10-08T17:06:19+05:30",
          "date": "08 Oct 2026",
          "time": "05:06 PM",
          "time24": "17:06",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:06 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:36:19.391Z",
          "epoch_ms": 1791459379391
        },
        "occurred_ago": "23m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "source": "EXTERNAL_API",
        "source_label": "External API call",
        "category": "AI_PROVIDER",
        "category_label": "AI provider",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "c88c79632ab34ce8baf701e65ccaf337",
        "user_id": "75",
        "user_email": "sk@gmail.com",
        "user_email_source": "logged",
        "user_name": "sk",
        "user_key": "75",
        "user": {
          "id": 75,
          "email": "sk@gmail.com",
          "username": "sk",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": "Pro",
          "last_seen_at": "2026-10-08T11:46:44.307Z",
          "last_seen_at_ist": {
            "iso": "2026-10-08T17:16:44+05:30",
            "date": "08 Oct 2026",
            "time": "05:16 PM",
            "time24": "17:16",
            "weekday": "Thu",
            "display": "Thu, 08 Oct 2026, 05:16 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-08T11:46:44.307Z",
            "epoch_ms": 1791460004307
          },
          "registered_at": "2026-05-18T06:12:19.363Z"
        },
        "ip_address": "127.0.0.1",
        "endpoint": "/api/files/Kisan_s_o_Bansi_Salampure_vs_Union_of_India___Others/intelligent-chat
... (truncated)
```
</details>

### Error Logs List (search, no match)

**Purpose:** Free-text search across message, endpoint, user, request id; a nonsense term returns an empty page, not an error.

**Inputs:** Query: search

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?search=zzz-no-such-error-zzz"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `70ms`

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
      "status_code": "all",
      "status_class": null,
      "error_type": null,
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

**Test Result:** ✅ PASS — Status: `400` — Latency: `2ms`

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
  "requestId": "c85eba3e-1332-4d64-9c7b-1a70dd3ec117"
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

**Test Result:** ✅ PASS — Status: `400` — Latency: `2ms`

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
  "requestId": "a3b3d210-7c7f-4565-92fd-ca164c53cb25"
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `100ms`

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
          "last_seen_at": "2026-10-08T11:48:05.703Z",
          "last_seen_at_ist": {
            "iso": "2026-10-08T17:18:05+05:30",
            "date": "08 Oct 2026",
            "time": "05:18 PM",
            "time24": "17:18",
            "weekday": "Thu",
            "display": "Thu, 08 Oct 2026, 05:18 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-08T11:48:05.703Z",
            "epoch_ms": 1791460085703
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "total": 70,
        "unresolved": 70,
        "critical": 0,
        "last_24h": 70,
        "last_7_days": 70,
        "distinct_errors": 16,
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
        "last_error_at": "2026-10-08T11:33:28.739Z",
        "last_error_at_ist": {
          "iso": "2026-10-08T17:03:28+05:30",
          "date": "08 Oct 2026",
          "time": "05:03 PM",
          "time24": "17:03",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:03 PM I
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `35ms`

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
        "endpoint": "/audit",
        "http_method": "POST",
        "status_code": 404,
        "count": 43,
        "unresolved": 43,
        "last_24h": 43,
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
        "last_seen_ago": "1h 8m",
        "latest_id": "bd630875-447e-4cc6-8c56-8d5c484eefa9"
      },
      {
        "fingerprint": "5a59e33be17560dd8e5dac166e63cb4c2cb06309316654c0e3ba1e8d0ece9525",
        "service_name": "payment-service",
        "services": [
          "payment-service"
        ],
        "source": "HTTP",
        "category": "INTERNAL",
        "category_label": "Internal error",
        "severity": "WARNING",
        "error_type": "HttpErrorResponse404",
        "error_message": "No ac
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `140ms`

<details><summary>Response sample</summary>

```json
ID,Occurred (IST),Date (IST),Time (IST),Service,Environment,Source,Category,Severity,HTTP status,Method,Endpoint,Code location,Action,Resource type,Resource id,Error type,Error message,User message,User id,User email,User name,IP address,Request id,External provider,External endpoint,External model,External status,External error code,Latency (ms),Occurrences,Fingerprint,Resolved,Resolved by,Resolved at (IST),Resolution note,Occurred (UTC)
d7e5f33d-5f89-487e-be54-25d548963481,"Thu, 08 Oct 2026, 05:06 PM IST",2026-10-08,17:06,agentic-document-service,development,EXTERNAL_API,AI_PROVIDER,ERROR,2
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
  "requestId": "1a47abad-b80b-4f08-aa3c-7871f260253f"
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

**Test Result:** ✅ PASS — Status: `404` — Latency: `35ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Error log not found"
  },
  "requestId": "dde6777d-113a-4028-b880-97a71a629e94"
}
```
</details>

### Error Log Detail

**Purpose:** Full row incl. stack trace, payload, external API response, issue summary (occurrences), the api_audit_logs row of the request, and related rows (same request id / same fingerprint).

**Inputs:** Path: id (UUID)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/d7e5f33d-5f89-487e-be54-25d548963481"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `133ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "d7e5f33d-5f89-487e-be54-25d548963481",
      "created_at": "2026-10-08T11:36:19.391Z",
      "created_at_ist": {
        "iso": "2026-10-08T17:06:19+05:30",
        "date": "08 Oct 2026",
        "time": "05:06 PM",
        "time24": "17:06",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:06 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:36:19.391Z",
        "epoch_ms": 1791459379391
      },
      "occurred_ago": "23m",
      "service_name": "agentic-document-service",
      "environment": "development",
      "source": "EXTERNAL_API",
      "source_label": "External API call",
      "category": "AI_PROVIDER",
      "category_label": "AI provider",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "c88c79632ab34ce8baf701e65ccaf337",
      "user_id": "75",
      "user_email": "sk@gmail.com",
      "user_email_source": "logged",
      "user_name": "sk",
      "user_key": "75",
      "user": {
        "id": 75,
        "email": "sk@gmail.com",
        "username": "sk",
        "role": "user",
        "account_type": "SOLO",
        "approval_status": "APPROVED",
        "is_blocked": false,
        "is_active": true,
        "active_plan_name": "Pro",
        "last_seen_at": "2026-10-08T11:46:44.307Z",
        "last_seen_at_ist": {
          "iso": "2026-10-08T17:16:44+05:30",
          "date": "08 Oct 2026",
          "time": "05:16 PM",
          "time24": "17:16",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:16 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:46:44.307Z",
          "epoch_ms": 1791460004307
        },
        "registered_at": "2026-05-18T06:12:19.363Z"
      },
      "ip_address": "127.0.0.1",
      "endpoint": "/api/files/Kisan_s_o_Bansi_Salampure_vs_Union_of_India___Others/intelligent-chat/stream",
      "http_method": "POST",
      "method": ".venv.Lib.site-packages.google.genai.errors.APIError.raise_er
... (truncated)
```
</details>

### Error Log Resolve

**Purpose:** Mark a single error resolved with a note; records resolved_by (admin email / admin-token) and resolved_at.

**Inputs:** Body: { resolved: true, note }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/d7e5f33d-5f89-487e-be54-25d548963481/resolve" -H "Content-Type: application/json" -d '{"resolved":true,"note":"automated test: resolved"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `142ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "d7e5f33d-5f89-487e-be54-25d548963481",
      "created_at": "2026-10-08T11:36:19.391Z",
      "created_at_ist": {
        "iso": "2026-10-08T17:06:19+05:30",
        "date": "08 Oct 2026",
        "time": "05:06 PM",
        "time24": "17:06",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:06 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:36:19.391Z",
        "epoch_ms": 1791459379391
      },
      "occurred_ago": "23m",
      "service_name": "agentic-document-service",
      "environment": "development",
      "source": "EXTERNAL_API",
      "source_label": "External API call",
      "category": "AI_PROVIDER",
      "category_label": "AI provider",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "c88c79632ab34ce8baf701e65ccaf337",
      "user_id": "75",
      "user_email": "sk@gmail.com",
      "user_email_source": "logged",
      "user_name": "sk",
      "user_key": "75",
      "user": {
        "id": 75,
        "email": "sk@gmail.com",
        "username": "sk",
        "role": "user",
        "account_type": "SOLO",
        "approval_status": "APPROVED",
        "is_blocked": false,
        "is_active": true,
        "active_plan_name": "Pro",
        "last_seen_at": "2026-10-08T11:46:44.307Z",
        "last_seen_at_ist": {
          "iso": "2026-10-08T17:16:44+05:30",
          "date": "08 Oct 2026",
          "time": "05:16 PM",
          "time24": "17:16",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:16 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:46:44.307Z",
          "epoch_ms": 1791460004307
        },
        "registered_at": "2026-05-18T06:12:19.363Z"
      },
      "ip_address": "127.0.0.1",
      "endpoint": "/api/files/Kisan_s_o_Bansi_Salampure_vs_Union_of_India___Others/intelligent-chat/stream",
      "http_method": "POST",
      "method": ".venv.Lib.site-packages.google.genai.errors.APIError.raise_er
... (truncated)
```
</details>

### Error Log Reopen

**Purpose:** resolved=false reopens the error and clears resolved_by / resolved_at / resolution_note.

**Inputs:** Body: { resolved: false }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/d7e5f33d-5f89-487e-be54-25d548963481/resolve" -H "Content-Type: application/json" -d '{"resolved":false}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `138ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "d7e5f33d-5f89-487e-be54-25d548963481",
      "created_at": "2026-10-08T11:36:19.391Z",
      "created_at_ist": {
        "iso": "2026-10-08T17:06:19+05:30",
        "date": "08 Oct 2026",
        "time": "05:06 PM",
        "time24": "17:06",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:06 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:36:19.391Z",
        "epoch_ms": 1791459379391
      },
      "occurred_ago": "23m",
      "service_name": "agentic-document-service",
      "environment": "development",
      "source": "EXTERNAL_API",
      "source_label": "External API call",
      "category": "AI_PROVIDER",
      "category_label": "AI provider",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "c88c79632ab34ce8baf701e65ccaf337",
      "user_id": "75",
      "user_email": "sk@gmail.com",
      "user_email_source": "logged",
      "user_name": "sk",
      "user_key": "75",
      "user": {
        "id": 75,
        "email": "sk@gmail.com",
        "username": "sk",
        "role": "user",
        "account_type": "SOLO",
        "approval_status": "APPROVED",
        "is_blocked": false,
        "is_active": true,
        "active_plan_name": "Pro",
        "last_seen_at": "2026-10-08T11:46:44.307Z",
        "last_seen_at_ist": {
          "iso": "2026-10-08T17:16:44+05:30",
          "date": "08 Oct 2026",
          "time": "05:16 PM",
          "time24": "17:16",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:16 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:46:44.307Z",
          "epoch_ms": 1791460004307
        },
        "registered_at": "2026-05-18T06:12:19.363Z"
      },
      "ip_address": "127.0.0.1",
      "endpoint": "/api/files/Kisan_s_o_Bansi_Salampure_vs_Union_of_India___Others/intelligent-chat/stream",
      "http_method": "POST",
      "method": ".venv.Lib.site-packages.google.genai.errors.APIError.raise_er
... (truncated)
```
</details>

### Error Logs Bulk Resolve (ids)

**Purpose:** Resolve many rows at once by id list (or by fingerprint to close every occurrence of an issue).

**Inputs:** Body: { ids[] | fingerprint, resolved, note? }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/resolve" -H "Content-Type: application/json" -d '{"ids":["d7e5f33d-5f89-487e-be54-25d548963481"],"resolved":true,"note":"automated test: bulk"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `37ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "resolved": true,
    "changed": 1,
    "ids": [
      "d7e5f33d-5f89-487e-be54-25d548963481"
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
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/resolve" -H "Content-Type: application/json" -d '{"fingerprint":"778433c031956d70a77b86d6ce1fe42e0f9a0fbd1a5c2bada285cdd1bf35347c","resolved":false}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `37ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "resolved": false,
    "changed": 1,
    "ids": [
      "d7e5f33d-5f89-487e-be54-25d548963481"
    ]
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
  "requestId": "355f866d-1213-4a10-a5e4-b0a76db3d7e3"
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

**Test Result:** ✅ PASS — Status: `400` — Latency: `3ms`

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
  "requestId": "e34be424-b4ea-43b9-b057-eb23bfe25069"
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

**Test Result:** ✅ PASS — Status: `404` — Latency: `36ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Error log not found"
  },
  "requestId": "b0aee7a4-b8d8-4d28-97b2-4e5c3b4a94d0"
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `76ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-08T11:59:59.721Z",
    "generated_at_ist": {
      "iso": "2026-10-08T17:29:59+05:30",
      "date": "08 Oct 2026",
      "time": "05:29 PM",
      "time24": "17:29",
      "weekday": "Thu",
      "display": "Thu, 08 Oct 2026, 05:29 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-08T11:59:59.721Z",
      "epoch_ms": 1791460799721
    },
    "period": {
      "from": "2026-10-01T11:59:59.721Z",
      "from_ist": {
        "iso": "2026-10-01T17:29:59+05:30",
        "date": "01 Oct 2026",
        "time": "05:29 PM",
        "time24": "17:29",
        "weekday": "Thu",
        "display": "Thu, 01 Oct 2026, 05:29 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-01T11:59:59.721Z",
        "epoch_ms": 1790855999721
      },
      "to": null,
      "to_ist": null,
      "since_hours": null
    },
    "filters": {
      "from": "2026-10-01T11:59:59.721Z",
      "from_ist": {
        "iso": "2026-10-01T17:29:59+05:30",
        "date": "01 Oct 2026",
        "time": "05:29 PM",
        "time24": "17:29",
        "weekday": "Thu",
        "display": "Thu, 01 Oct 2026, 05:29 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-01T11:59:59.721Z",
        "epoch_ms": 1790855999721
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
      "status_code": "all",
      "status_class": null,
      "q": null,
      "exclude_pings": true,
      "kind": "all",
      "min_duration_ms": null,
      "timezone": "Asia/Kolkata"
    },
    "totals": {
      "calls": 268,
      "succeeded": 218,
      "failed": 50,
      "failure_r
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `35ms`

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
          "count": 166
        },
        {
          "value": "gateway-service",
          "count": 111
        },
        {
          "value": "agentic-document-service",
          "count": 109
        },
        {
          "value": "payment-service",
          "count": 60
        }
      ],
      "environments": [
        {
          "value": "development",
          "count": 446
        }
      ],
      "resource_types": [
        {
          "value": "STORAGE FOLDER",
          "count": 89
        },
        {
          "value": "USER",
          "count": 63
        },
        {
          "value": "CASE",
          "count": 10
        },
        {
          "value": "CHAT",
          "count": 3
        },
        {
          "value": "FILE",
          "count": 2
        },
        {
          "value": "PLAN",
          "count": 2
        }
      ],
      "actions": [
        {
          "value": "CREATE",
          "count": 162
        },
        {
          "value": "VIEW",
          "count": 141
        },
        {
          "value": "UPDATE",
          "count": 4
        }
      ],
      "http_methods": [
        {
          "value": "GET",
          "count": 231
        },
        {
          "value": "POST",
          "count": 207
        },
        {
          "value": "PUT",
          "count": 8
        }
      ],
      "statuses": [
        {
          "value": "SUCCESS",
          "count": 396
        },
        {
          "value": "FAILED",
          "count": 50
        }
      ],
      "error_types": [
   
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `107ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "3fc36724-cda3-4902-9a9f-fe6fbc6b9e21",
        "created_at": "2026-10-08T11:36:31.396Z",
        "created_at_ist": {
          "iso": "2026-10-08T17:06:31+05:30",
          "date": "08 Oct 2026",
          "time": "05:06 PM",
          "time24": "17:06",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:06 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:36:31.396Z",
          "epoch_ms": 1791459391396
        },
        "occurred_ago": "23m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "request_id": "26fb137583f94f5884895cd519e2f406",
        "user_id": "75",
        "user_email": "sk@gmail.com",
        "user_email_source": "logged",
        "user_name": "sk",
        "user_key": "75",
        "user": {
          "id": 75,
          "email": "sk@gmail.com",
          "username": "sk",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": "Pro",
          "last_seen_at": "2026-10-08T11:46:44.307Z",
          "last_seen_at_ist": {
            "iso": "2026-10-08T17:16:44+05:30",
            "date": "08 Oct 2026",
            "time": "05:16 PM",
            "time24": "17:16",
            "weekday": "Thu",
            "display": "Thu, 08 Oct 2026, 05:16 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-08T11:46:44.307Z",
            "epoch_ms": 1791460004307
          },
          "registered_at": "2026-05-18T06:12:19.363Z"
        },
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
        "kind": "request",
        "http_method": "GET",
        "endpoint": "/api/memory/cases/Kisan_s_o_Bansi_Salampure_vs_Union_of_India___Others/turns/10e1c090-8120-43c2-9306-ca17
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `148ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "3d470fdf-9466-490d-b3b5-5e60fdabd870",
        "created_at": "2026-10-08T11:48:22.303Z",
        "created_at_ist": {
          "iso": "2026-10-08T17:18:22+05:30",
          "date": "08 Oct 2026",
          "time": "05:18 PM",
          "time24": "17:18",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:18 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:48:22.303Z",
          "epoch_ms": 1791460102303
        },
        "occurred_ago": "11m",
        "service_name": "gateway-service",
        "environment": "development",
        "request_id": "e6f2f20897103995e9ca27b1deb5ce86",
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
          "last_seen_at": "2026-10-08T11:48:05.703Z",
          "last_seen_at_ist": {
            "iso": "2026-10-08T17:18:05+05:30",
            "date": "08 Oct 2026",
            "time": "05:18 PM",
            "time24": "17:18",
            "weekday": "Thu",
            "display": "Thu, 08 Oct 2026, 05:18 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-08T11:48:05.703Z",
            "epoch_ms": 1791460085703
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "ip_address": "::1",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
        "kind": "request",
        "http_method": "POST",
        "endpoint": "/api/auth/activity/ping",
        "route": null,
        "api": "POST /api/auth/activity/ping",
        "action": "CREAT
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `109ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "04ed84e7-ddf2-4660-88e7-36a379932efc",
        "created_at": "2026-10-08T11:33:28.742Z",
        "created_at_ist": {
          "iso": "2026-10-08T17:03:28+05:30",
          "date": "08 Oct 2026",
          "time": "05:03 PM",
          "time24": "17:03",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:03 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:33:28.742Z",
          "epoch_ms": 1791459208742
        },
        "occurred_ago": "26m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "request_id": "77471cffdda34e239633c4cb6852b423",
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
          "last_seen_at": "2026-10-08T11:48:05.703Z",
          "last_seen_at_ist": {
            "iso": "2026-10-08T17:18:05+05:30",
            "date": "08 Oct 2026",
            "time": "05:18 PM",
            "time24": "17:18",
            "weekday": "Thu",
            "display": "Thu, 08 Oct 2026, 05:18 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-08T11:48:05.703Z",
            "epoch_ms": 1791460085703
          },
          "registered_at": "2026-05-18T06:47:13.500Z"
        },
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
        "kind": "request",
        "http_method": "POST",
        "endpoint": "/api/files/Krishnaji_Atmaram_Anandwade_vs_Onkar_Sakhar_Karkhana_Pvt._Ltd./intelligent-chat/stream",
     
... (truncated)
```
</details>

### Audit Logs List (user filter)

**Purpose:** user=<email or id> narrows to one platform user (ILIKE on email, exact on id, resolved through the Auth DB).

**Inputs:** Query: user=sk@gmail.com

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs?user=sk%40gmail.com&page_size=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `153ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "3fc36724-cda3-4902-9a9f-fe6fbc6b9e21",
        "created_at": "2026-10-08T11:36:31.396Z",
        "created_at_ist": {
          "iso": "2026-10-08T17:06:31+05:30",
          "date": "08 Oct 2026",
          "time": "05:06 PM",
          "time24": "17:06",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:06 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:36:31.396Z",
          "epoch_ms": 1791459391396
        },
        "occurred_ago": "23m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "request_id": "26fb137583f94f5884895cd519e2f406",
        "user_id": "75",
        "user_email": "sk@gmail.com",
        "user_email_source": "logged",
        "user_name": "sk",
        "user_key": "75",
        "user": {
          "id": 75,
          "email": "sk@gmail.com",
          "username": "sk",
          "role": "user",
          "account_type": "SOLO",
          "approval_status": "APPROVED",
          "is_blocked": false,
          "is_active": true,
          "active_plan_name": "Pro",
          "last_seen_at": "2026-10-08T11:46:44.307Z",
          "last_seen_at_ist": {
            "iso": "2026-10-08T17:16:44+05:30",
            "date": "08 Oct 2026",
            "time": "05:16 PM",
            "time24": "17:16",
            "weekday": "Thu",
            "display": "Thu, 08 Oct 2026, 05:16 PM IST",
            "timezone": "Asia/Kolkata",
            "utc": "2026-10-08T11:46:44.307Z",
            "epoch_ms": 1791460004307
          },
          "registered_at": "2026-05-18T06:12:19.363Z"
        },
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
        "kind": "request",
        "http_method": "GET",
        "endpoint": "/api/memory/cases/Kisan_s_o_Bansi_Salampure_vs_Union_of_India___Others/turns/10e1c090-8120-43c2-9306-ca17
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

**Test Result:** ✅ PASS — Status: `400` — Latency: `2ms`

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
  "requestId": "69d2401a-f6c1-4b58-9181-e7f60968fe40"
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `114ms`

<details><summary>Response sample</summary>

```json
ID,Timestamp (IST),Date (IST),Time (IST),User email,User id,User name,Service,Environment,Action,Resource type,Resource id,Method (handler),HTTP method,Endpoint,Route,Kind,Status,Code,Duration (ms),IP address,User agent,Request id,Error type,Error message,User message,Error log id,Timestamp (UTC)
04ed84e7-ddf2-4660-88e7-36a379932efc,"Thu, 08 Oct 2026, 05:03 PM IST",2026-10-08,17:03,pk@gmail.com,76,PK,agentic-document-service,development,CREATE,STORAGE FOLDER,,FolderService.create_stream,POST,/api/files/Krishnaji_Atmaram_Anandwade_vs_Onkar_Sakhar_Karkhana_Pvt._Ltd./intelligent-chat/stream,,req
```
</details>

### Audit Log Detail (INVALID id — expect 400)

**Purpose:** Row ids are UUIDs.

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs/not-a-uuid"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `2ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Audit log id must be a UUID"
  },
  "requestId": "2bc1d8bc-39b6-4876-b82f-f0ef7c79ac3e"
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

**Test Result:** ✅ PASS — Status: `404` — Latency: `38ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Audit log not found"
  },
  "requestId": "55367a34-4a8f-4115-96f7-4bee7db543ee"
}
```
</details>

### Audit Log Detail

**Purpose:** Full row incl. stack_trace and payload, plus the linked error_logs row(s) (error_log_id / payload.error_log_ids) with their stack traces.

**Inputs:** Path: id (UUID)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/audit-logs/04ed84e7-ddf2-4660-88e7-36a379932efc"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `114ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "audit": {
      "id": "04ed84e7-ddf2-4660-88e7-36a379932efc",
      "created_at": "2026-10-08T11:33:28.742Z",
      "created_at_ist": {
        "iso": "2026-10-08T17:03:28+05:30",
        "date": "08 Oct 2026",
        "time": "05:03 PM",
        "time24": "17:03",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 05:03 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T11:33:28.742Z",
        "epoch_ms": 1791459208742
      },
      "occurred_ago": "26m",
      "service_name": "agentic-document-service",
      "environment": "development",
      "request_id": "77471cffdda34e239633c4cb6852b423",
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
        "last_seen_at": "2026-10-08T11:48:05.703Z",
        "last_seen_at_ist": {
          "iso": "2026-10-08T17:18:05+05:30",
          "date": "08 Oct 2026",
          "time": "05:18 PM",
          "time24": "17:18",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 05:18 PM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T11:48:05.703Z",
          "epoch_ms": 1791460085703
        },
        "registered_at": "2026-05-18T06:47:13.500Z"
      },
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
      "kind": "request",
      "http_method": "POST",
      "endpoint": "/api/files/Krishnaji_Atmaram_Anandwade_vs_Onkar_Sakhar_Karkhana_Pvt._Ltd./intelligent-chat/stream",
      "route": null,
      "api": "POST /api/files/Krishnaji_Atmaram_Anandwade_vs_Onkar_Sakhar_Karkhana_Pvt._Ltd./
... (truncated)
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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `1ms`

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
