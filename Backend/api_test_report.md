# Admin Dashboard API — Test Report

**Generated:** 2026-10-08T07:45:29.261Z  
**Base URL:** `http://localhost:4010`  
**Admin Token:** `[REDACTED]`  

---

## Summary

| Metric | Value |
|--------|-------|
| Total Tests | 51 |
| ✅ Passed | 37 |
| ❌ Failed | 14 |
| Avg Latency | 49ms |

### All Tests

| # | Method | Endpoint | Expected | Actual | Result | Latency |
|---|--------|----------|----------|--------|--------|--------|
| 1 | GET | `/api/admin/overview` | 200 + { success: true, data: { total_judgments, ... } } | 404 | ❌ FAIL | 3ms |
| 2 | GET | `/api/admin/hitl` | 200 + data.tasks array | 404 | ❌ FAIL | 3ms |
| 3 | GET | `/api/admin/hitl/00000000-0000-0000-0000-000000000000` | 404 | 404 | ✅ PASS | 1ms |
| 4 | POST | `/api/admin/hitl/1/action` | 400 | 404 | ❌ FAIL | 3ms |
| 5 | GET | `/api/admin/pipeline/summary` | 200 + object | 404 | ❌ FAIL | 2ms |
| 6 | GET | `/api/admin/pipeline/items` | 200 + paginated list | 404 | ❌ FAIL | 5ms |
| 7 | GET | `/api/admin/pipeline/errors` | 200 | 404 | ❌ FAIL | 3ms |
| 8 | GET | `/api/admin/routesdb/summary` | 200 | 404 | ❌ FAIL | 2ms |
| 9 | GET | `/api/admin/routesdb/top-cited` | 200 + array | 404 | ❌ FAIL | 2ms |
| 10 | GET | `/api/admin/routesdb/courts-breakdown` | 200 | 404 | ❌ FAIL | 2ms |
| 11 | GET | `/api/admin/business/summary` | 200 | 404 | ❌ FAIL | 1ms |
| 12 | GET | `/api/admin/business/reports-per-day` | 200 + array | 404 | ❌ FAIL | 1ms |
| 13 | GET | `/api/admin/business/top-users` | 200 + array | 404 | ❌ FAIL | 1ms |
| 14 | GET | `/api/admin/users` | 200 + data.users array | 200 | ✅ PASS | 68ms |
| 15 | GET | `/api/admin/users/pending` | 200 | 200 | ✅ PASS | 34ms |
| 16 | GET | `/api/admin/users/stats` | 200 | 200 | ✅ PASS | 35ms |
| 17 | POST | `/api/admin/users/65/approve` | 200 | 200 | ✅ PASS | 39ms |
| 18 | POST | `/api/admin/users/65/block` | 200 | 200 | ✅ PASS | 36ms |
| 19 | POST | `/api/admin/users/65/unblock` | 200 | 200 | ✅ PASS | 36ms |
| 20 | POST | `/api/public/contact` | 201 + data.reference_no + data.submitted_at_ist | 201 | ✅ PASS | 231ms |
| 21 | GET | `/api/admin/contact-enquiries/stats` | 200 + data.totals | 200 | ✅ PASS | 180ms |
| 22 | GET | `/api/admin/contact-enquiries/meta` | 200 + data.statuses | 200 | ✅ PASS | 38ms |
| 23 | GET | `/api/admin/contact-enquiries` | 200 + data.enquiries[] | 200 | ✅ PASS | 72ms |
| 24 | GET | `/api/admin/contact-enquiries/17` | 200 + data.enquiry + data.activities | 200 | ✅ PASS | 68ms |
| 25 | POST | `/api/admin/contact-enquiries/17/contact-log` | 200 + enquiry.first_contacted_at_ist | 200 | ✅ PASS | 214ms |
| 26 | PATCH | `/api/admin/contact-enquiries/17` | 200 + enquiry.status = closed | 200 | ✅ PASS | 237ms |
| 27 | GET | `/api/admin/contact-enquiries/export` | 200 text/csv | 200 | ✅ PASS | 71ms |
| 28 | DELETE | `/api/admin/contact-enquiries/17` | 200 | 200 | ✅ PASS | 35ms |
| 29 | GET | `/api/admin/error-logs/stats` | 200 + data.totals, daily_trend[], by_service[], top_issues[], top_users[] | 200 | ✅ PASS | 95ms |
| 30 | GET | `/api/admin/error-logs/meta` | 200 + data.vocab, data.used.services[], data.permissions | 200 | ✅ PASS | 50ms |
| 31 | GET | `/api/admin/error-logs` | 200 + data.logs[], data.pagination | 200 | ✅ PASS | 77ms |
| 32 | GET | `/api/admin/error-logs` | 200 + only rows for that service | 200 | ✅ PASS | 68ms |
| 33 | GET | `/api/admin/error-logs` | 200 + every row is_resolved=false | 200 | ✅ PASS | 72ms |
| 34 | GET | `/api/admin/error-logs` | 200 + logs=[] total=0 | 200 | ✅ PASS | 67ms |
| 35 | GET | `/api/admin/error-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 2ms |
| 36 | GET | `/api/admin/error-logs` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 3ms |
| 37 | GET | `/api/admin/error-logs/users` | 200 + data.users[], data.pagination | 200 | ✅ PASS | 66ms |
| 38 | GET | `/api/admin/error-logs/issues` | 200 + data.issues[] | 200 | ✅ PASS | 38ms |
| 39 | GET | `/api/admin/error-logs/export` | 200 text/csv with header row | 200 | ✅ PASS | 68ms |
| 40 | GET | `/api/admin/error-logs/not-a-uuid` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 3ms |
| 41 | GET | `/api/admin/error-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 34ms |
| 42 | GET | `/api/admin/error-logs/1c6bc360-42c0-4b39-b1ad-f65f83085067` | 200 + data.log (with stack_trace, payload), data.issue, data.related | 200 | ✅ PASS | 67ms |
| 43 | PATCH | `/api/admin/error-logs/1c6bc360-42c0-4b39-b1ad-f65f83085067/resolve` | 200 + data.log.is_resolved=true | 200 | ✅ PASS | 106ms |
| 44 | PATCH | `/api/admin/error-logs/1c6bc360-42c0-4b39-b1ad-f65f83085067/resolve` | 200 + data.log.is_resolved=false | 200 | ✅ PASS | 104ms |
| 45 | PATCH | `/api/admin/error-logs/resolve` | 200 + data.changed=1 | 200 | ✅ PASS | 36ms |
| 46 | PATCH | `/api/admin/error-logs/resolve` | 200 + data.changed>=1 | 200 | ✅ PASS | 34ms |
| 47 | PATCH | `/api/admin/error-logs/resolve` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 3ms |
| 48 | POST | `/api/admin/error-logs/bulk-delete` | 400 VALIDATION_ERROR | 400 | ✅ PASS | 2ms |
| 49 | DELETE | `/api/admin/error-logs/00000000-0000-4000-8000-000000000000` | 404 NOT_FOUND | 404 | ✅ PASS | 58ms |
| 50 | GET | `/api/admin/overview` | 401 | 404 | ❌ FAIL | 3ms |
| 51 | GET | `/api/admin/overview` | 403 | 404 | ❌ FAIL | 3ms |

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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `3ms`

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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `3ms`

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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `2ms`

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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `5ms`

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

**Test Result:** ✅ PASS — Status: `200` — Latency: `68ms`

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

**Test Result:** ✅ PASS — Status: `200` — Latency: `34ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": 65,
        "email": "ll.rua.n.7.6.1@gmail.com",
        "username": "new advocate",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": true,
        "created_at": "2026-04-02T04:22:37.786Z",
        "phone": "+911471472558",
        "location": "New , soon"
      },
      {
        "id": 63,
        "email": "gwfirmtest@test.com",
        "username": "Test Advocate GW",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-04-02T04:17:41.039Z",
        "phone": "9876543213",
        "location": "Delhi, Delhi"
      },
      {
        "id": 60,
        "email": "test3@firmtest.com",
        "username": "Test Advocate 3",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-04-02T04:10:16.899Z",
        "phone": "9876543210",
        "location": "Mumbai, Maharashtra"
      },
      {
        "id": 59,
        "email": "test1@firm.com",
        "username": "Test Advocate",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-04-02T04:05:01.992Z",
        "phone": "1234567890",
        "location": "City, State"
      },
      {
        "id": 58,
        "email": "test@firm.com",
        "username": "Test Advocate",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": "PENDING",
        "is_active": false,
        "created_at": "2026-04-02T04:03:56.239Z",
        "phone": "1234567890",
        "location": "City, State"
      },
      {
        "id": 57,
        "email": "sm.d.ngm.s.bf.dndng.n@gmail.com",
        "username": "Demo Advocate Firms pvt ltd",
        "role": "user",
        "account_type": "FIRM_ADMIN",
        "approval_status": 
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `35ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "total_users": 67,
    "active_users": 52,
    "blocked_users": 1,
    "pending_approvals": 14,
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/65/approve"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `39ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 65,
      "email": "ll.rua.n.7.6.1@gmail.com",
      "username": "new advocate",
      "password": "$2b$10$5jKVrKppRDTOrU3neXcN8uEYVK91G/nqzjUKYGY7Hp4lKP6HQIGiu",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": false,
      "created_at": "2026-04-02T04:22:37.786Z",
      "updated_at": "2026-10-07T02:28:56.192Z",
      "razorpay_customer_id": null,
      "phone": "+911471472558",
      "location": "New , soon",
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "FIRM_ADMIN",
      "approval_status": "APPROVED",
      "first_login": false,
      "is_active": true,
      "last_login_at": "2026-10-07T07:58:56.004Z",
      "last_seen_at": "2026-10-07T07:58:56.192Z",
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/65/block"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `36ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 65,
      "email": "ll.rua.n.7.6.1@gmail.com",
      "username": "new advocate",
      "password": "$2b$10$5jKVrKppRDTOrU3neXcN8uEYVK91G/nqzjUKYGY7Hp4lKP6HQIGiu",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": true,
      "created_at": "2026-04-02T04:22:37.786Z",
      "updated_at": "2026-10-07T02:28:56.192Z",
      "razorpay_customer_id": null,
      "phone": "+911471472558",
      "location": "New , soon",
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "FIRM_ADMIN",
      "approval_status": "APPROVED",
      "first_login": false,
      "is_active": false,
      "last_login_at": "2026-10-07T07:58:56.004Z",
      "last_seen_at": "2026-10-07T07:58:56.192Z",
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/users/65/unblock"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `36ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 65,
      "email": "ll.rua.n.7.6.1@gmail.com",
      "username": "new advocate",
      "password": "$2b$10$5jKVrKppRDTOrU3neXcN8uEYVK91G/nqzjUKYGY7Hp4lKP6HQIGiu",
      "google_uid": null,
      "auth_type": "manual",
      "profile_image": null,
      "firebase_uid": null,
      "role": "user",
      "is_blocked": false,
      "created_at": "2026-04-02T04:22:37.786Z",
      "updated_at": "2026-10-07T02:28:56.192Z",
      "razorpay_customer_id": null,
      "phone": "+911471472558",
      "location": "New , soon",
      "google_drive_refresh_token": null,
      "google_drive_token_expiry": null,
      "account_type": "FIRM_ADMIN",
      "approval_status": "APPROVED",
      "first_login": false,
      "is_active": true,
      "last_login_at": "2026-10-07T07:58:56.004Z",
      "last_seen_at": "2026-10-07T07:58:56.192Z",
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
curl -s -X POST -H "Content-Type: application/json" -d '{"name":"API","surname":"Test","email":"api.test+1791445527048@example.com","mobile":"+91 90000 00000","organisationName":"Automated Test","whatIsThisAbout":"Pricing & plans","additionalDetails":"automated test 1791445527048","consent":true,"pageUrl":"https://jurinex.ai/contact"}' "http://localhost:4010/api/public/contact"
```

**Test Result:** ✅ PASS — Status: `201` — Latency: `231ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "id": 17,
    "reference_no": "CE-20261008-00017",
    "duplicate": false,
    "submitted_at": "2026-10-08T07:45:10.914Z",
    "submitted_at_ist": {
      "iso": "2026-10-08T13:15:10+05:30",
      "date": "08 Oct 2026",
      "time": "01:15 PM",
      "time24": "13:15",
      "weekday": "Thu",
      "display": "Thu, 08 Oct 2026, 01:15 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-08T07:45:10.914Z",
      "epoch_ms": 1791445510914
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `180ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-08T07:45:27.280Z",
    "generated_at_ist": {
      "iso": "2026-10-08T13:15:27+05:30",
      "date": "08 Oct 2026",
      "time": "01:15 PM",
      "time24": "13:15",
      "weekday": "Thu",
      "display": "Thu, 08 Oct 2026, 01:15 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-08T07:45:27.280Z",
      "epoch_ms": 1791445527280
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `38ms`

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

**Test Result:** ✅ PASS — Status: `200` — Latency: `72ms`

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
        "submitted_ago": "27d",
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
        "awaiting_for": "27d",
        "status_changed_at": "2026-09-11T06:45:54.004Z",
        "s
... (truncated)
```
</details>

### Contact Enquiry Detail

**Purpose:** Single enquiry + activity timeline.

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/17"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `68ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 17,
      "reference_no": "CE-20261008-00017",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791445527048@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791445527048",
      "marketing_consent": true,
      "consent_given_at": "2026-10-08T07:45:10.914Z",
      "consent_given_at_ist": {
        "iso": "2026-10-08T13:15:10+05:30",
        "date": "08 Oct 2026",
        "time": "01:15 PM",
        "time24": "13:15",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 01:15 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T07:45:10.914Z",
        "epoch_ms": 1791445510914
      },
      "submitted_at": "2026-10-08T07:45:10.914Z",
      "submitted_at_ist": {
        "iso": "2026-10-08T13:15:10+05:30",
        "date": "08 Oct 2026",
        "time": "01:15 PM",
        "time24": "13:15",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 01:15 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T07:45:10.914Z",
        "epoch_ms": 1791445510914
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
curl -s -X POST -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/17/contact-log" -H "Content-Type: application/json" -d '{"channel":"call","outcome":"connected","note":"automated test call"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `214ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 17,
      "reference_no": "CE-20261008-00017",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791445527048@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791445527048",
      "marketing_consent": true,
      "consent_given_at": "2026-10-08T07:45:10.914Z",
      "consent_given_at_ist": {
        "iso": "2026-10-08T13:15:10+05:30",
        "date": "08 Oct 2026",
        "time": "01:15 PM",
        "time24": "13:15",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 01:15 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T07:45:10.914Z",
        "epoch_ms": 1791445510914
      },
      "submitted_at": "2026-10-08T07:45:10.914Z",
      "submitted_at_ist": {
        "iso": "2026-10-08T13:15:10+05:30",
        "date": "08 Oct 2026",
        "time": "01:15 PM",
        "time24": "13:15",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 01:15 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T07:45:10.914Z",
        "epoch_ms": 1791445510914
      },
      "submitted_ago": "just now",
      "status": "contacted",
      "status_label": "Contacted",
      "priority": "normal",
      "priority_label": "Normal",
      "assigned_to": null,
      "first_contacted_at": "2026-10-08T07:45:27.706Z",
      "first_contacted_at_ist": {
        "iso": "2026-10-08T13:15:27+05:30",
        "date": "08 Oct 2026",
        "time": "01:15 PM",
        "time24": "13:15",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 01:15 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T07:45:27.706Z",
        "epoch_ms": 1791445527706
      },
      "first_contacted_by": null,
      "last_contacted_at": "2026-10-08T07:45:27.706Z",
      "last_contacted_at_ist": {
        "iso": "2026-10-08T13:15:27+05:30
... (truncated)
```
</details>

### Contact Enquiry Update

**Purpose:** Change status / priority / assignee with timeline entries.

**Inputs:** Body: { status?, priority?, assigned_to?, note? }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/17" -H "Content-Type: application/json" -d '{"status":"closed","priority":"low","note":"automated test close"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `237ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "enquiry": {
      "id": 17,
      "reference_no": "CE-20261008-00017",
      "first_name": "API",
      "last_name": "Test",
      "full_name": "API Test",
      "email": "api.test+1791445527048@example.com",
      "mobile_number": "+91 90000 00000",
      "organisation_name": "Automated Test",
      "topic": "Pricing & plans",
      "message": "automated test 1791445527048",
      "marketing_consent": true,
      "consent_given_at": "2026-10-08T07:45:10.914Z",
      "consent_given_at_ist": {
        "iso": "2026-10-08T13:15:10+05:30",
        "date": "08 Oct 2026",
        "time": "01:15 PM",
        "time24": "13:15",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 01:15 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T07:45:10.914Z",
        "epoch_ms": 1791445510914
      },
      "submitted_at": "2026-10-08T07:45:10.914Z",
      "submitted_at_ist": {
        "iso": "2026-10-08T13:15:10+05:30",
        "date": "08 Oct 2026",
        "time": "01:15 PM",
        "time24": "13:15",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 01:15 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T07:45:10.914Z",
        "epoch_ms": 1791445510914
      },
      "submitted_ago": "just now",
      "status": "closed",
      "status_label": "Closed",
      "priority": "low",
      "priority_label": "Low",
      "assigned_to": null,
      "first_contacted_at": "2026-10-08T07:45:27.706Z",
      "first_contacted_at_ist": {
        "iso": "2026-10-08T13:15:27+05:30",
        "date": "08 Oct 2026",
        "time": "01:15 PM",
        "time24": "13:15",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 01:15 PM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T07:45:27.706Z",
        "epoch_ms": 1791445527706
      },
      "first_contacted_by": null,
      "last_contacted_at": "2026-10-08T07:45:27.706Z",
      "last_contacted_at_ist": {
        "iso": "2026-10-08T13:15:27+05:30",
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `71ms`

<details><summary>Response sample</summary>

```json
Reference,Submitted (IST),Submitted date (IST),Submitted time (IST),Name,Surname,Email,Mobile,Organisation,What is this about,Additional details,Marketing consent,Status,Priority,Assigned to,First contacted (IST),First contacted by,First response time,Last contacted (IST),Last channel,Contact attempts,Closed (IST),Source,Page URL,Submitted (UTC)
CE-20261008-00017,"Thu, 08 Oct 2026, 01:15 PM IST",2026-10-08,13:15,API,Test,api.test+1791445527048@example.com,'+91 90000 00000,Automated Test,Pricing & plans,automated test 1791445527048,Yes,Closed,Low,,"Thu, 08 Oct 2026, 01:15 PM IST",,just now,"Th
```
</details>

### Contact Enquiry Delete (cleanup)

**Purpose:** Remove the test enquiry (super-admin / static token only).

**Inputs:** Params: id

**Example curl:**
```bash
curl -s -X DELETE -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/contact-enquiries/17"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `35ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "id": 17,
    "reference_no": "CE-20261008-00017",
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `95ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-08T07:45:28.196Z",
    "generated_at_ist": {
      "iso": "2026-10-08T13:15:28+05:30",
      "date": "08 Oct 2026",
      "time": "01:15 PM",
      "time24": "13:15",
      "weekday": "Thu",
      "display": "Thu, 08 Oct 2026, 01:15 PM IST",
      "timezone": "Asia/Kolkata",
      "utc": "2026-10-08T07:45:28.196Z",
      "epoch_ms": 1791445528196
    },
    "totals": {
      "total": 8,
      "unresolved": 8,
      "resolved": 0,
      "critical": 0,
      "error": 8,
      "warning": 0,
      "critical_unresolved": 0,
      "last_hour": 0,
      "last_24h": 8,
      "today": 8,
      "yesterday": 0,
      "last_7_days": 8,
      "last_30_days": 8,
      "this_month": 8,
      "with_user": 0,
      "affected_users": 0,
      "affected_users_24h": 0,
      "affected_users_unresolved": 0,
      "distinct_issues": 8,
      "distinct_issues_unresolved": 8,
      "services": 2,
      "external_api": 1,
      "http_5xx": 6,
      "http_4xx": 0,
      "avg_latency_ms": 1001,
      "resolved_rate_pct": 0,
      "last_error_at": "2026-10-08T05:27:19.146Z",
      "last_error_at_ist": {
        "iso": "2026-10-08T10:57:19+05:30",
        "date": "08 Oct 2026",
        "time": "10:57 AM",
        "time24": "10:57",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 10:57 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T05:27:19.146Z",
        "epoch_ms": 1791437239146
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
        "date": "2026-09-27",
        "label": "27 Sep",
        "total": 0,
        "c
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `50ms`

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
          "count": 6
        },
        {
          "value": "payment-service",
          "count": 2
        }
      ],
      "environments": [
        {
          "value": "development",
          
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `77ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "1c6bc360-42c0-4b39-b1ad-f65f83085067",
        "created_at": "2026-10-08T05:27:19.146Z",
        "created_at_ist": {
          "iso": "2026-10-08T10:57:19+05:30",
          "date": "08 Oct 2026",
          "time": "10:57 AM",
          "time24": "10:57",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 10:57 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T05:27:19.146Z",
          "epoch_ms": 1791437239146
        },
        "occurred_ago": "2h 18m",
        "service_name": "payment-service",
        "environment": "development",
        "source": "LOGGER",
        "source_label": "Logged error",
        "category": "INTERNAL",
        "category_label": "Internal error",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "9d57da3de05c3254154752b5781b2019",
        "user_id": null,
        "user_email": null,
        "user_key": null,
        "user": null,
        "ip_address": "127.0.0.1",
        "endpoint": "/__demo/self-500",
        "http_method": "GET",
        "method": "[stdin].<anonymous>",
        "action": null,
        "resource_type": null,
        "resource_id": null,
        "status_code": 500,
        "status_class": "5xx",
        "user_message": "Failed to create payment order",
        "error_type": "SyntaxError",
        "error_message": "demo: handled it | Expected property name or '}' in JSON at position 1 (line 1 column 2)",
        "has_stack_trace": true,
        "external": null,
        "latency_ms": null,
        "latency_display": null,
        "fingerprint": "aad64902b5b93f3b9a5670cd45c5260e6887e449b20346e46ab500c2a22ec082",
        "occurrence_count": 1,
        "unresolved_occurrences": 1,
        "has_payload": true,
        "is_resolved": false,
        "resolved_by": null,
        "resolved_at": null,
        "resolved_at_ist": null,
        "resolution_note": null,
        "timezone": "Asia/Kolkata"
      },
      {
        "id":
... (truncated)
```
</details>

### Error Logs List (service filter)

**Purpose:** Filter by service_name; every returned row must belong to that service.

**Inputs:** Query: service=payment-service

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs?service=payment-service&limit=50"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `68ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "1c6bc360-42c0-4b39-b1ad-f65f83085067",
        "created_at": "2026-10-08T05:27:19.146Z",
        "created_at_ist": {
          "iso": "2026-10-08T10:57:19+05:30",
          "date": "08 Oct 2026",
          "time": "10:57 AM",
          "time24": "10:57",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 10:57 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T05:27:19.146Z",
          "epoch_ms": 1791437239146
        },
        "occurred_ago": "2h 18m",
        "service_name": "payment-service",
        "environment": "development",
        "source": "LOGGER",
        "source_label": "Logged error",
        "category": "INTERNAL",
        "category_label": "Internal error",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "9d57da3de05c3254154752b5781b2019",
        "user_id": null,
        "user_email": null,
        "user_key": null,
        "user": null,
        "ip_address": "127.0.0.1",
        "endpoint": "/__demo/self-500",
        "http_method": "GET",
        "method": "[stdin].<anonymous>",
        "action": null,
        "resource_type": null,
        "resource_id": null,
        "status_code": 500,
        "status_class": "5xx",
        "user_message": "Failed to create payment order",
        "error_type": "SyntaxError",
        "error_message": "demo: handled it | Expected property name or '}' in JSON at position 1 (line 1 column 2)",
        "has_stack_trace": true,
        "external": null,
        "latency_ms": null,
        "latency_display": null,
        "fingerprint": "aad64902b5b93f3b9a5670cd45c5260e6887e449b20346e46ab500c2a22ec082",
        "occurrence_count": 1,
        "unresolved_occurrences": 1,
        "has_payload": true,
        "is_resolved": false,
        "resolved_by": null,
        "resolved_at": null,
        "resolved_at_ist": null,
        "resolution_note": null,
        "timezone": "Asia/Kolkata"
      },
      {
        "id":
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `72ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "1c6bc360-42c0-4b39-b1ad-f65f83085067",
        "created_at": "2026-10-08T05:27:19.146Z",
        "created_at_ist": {
          "iso": "2026-10-08T10:57:19+05:30",
          "date": "08 Oct 2026",
          "time": "10:57 AM",
          "time24": "10:57",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 10:57 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T05:27:19.146Z",
          "epoch_ms": 1791437239146
        },
        "occurred_ago": "2h 18m",
        "service_name": "payment-service",
        "environment": "development",
        "source": "LOGGER",
        "source_label": "Logged error",
        "category": "INTERNAL",
        "category_label": "Internal error",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "9d57da3de05c3254154752b5781b2019",
        "user_id": null,
        "user_email": null,
        "user_key": null,
        "user": null,
        "ip_address": "127.0.0.1",
        "endpoint": "/__demo/self-500",
        "http_method": "GET",
        "method": "[stdin].<anonymous>",
        "action": null,
        "resource_type": null,
        "resource_id": null,
        "status_code": 500,
        "status_class": "5xx",
        "user_message": "Failed to create payment order",
        "error_type": "SyntaxError",
        "error_message": "demo: handled it | Expected property name or '}' in JSON at position 1 (line 1 column 2)",
        "has_stack_trace": true,
        "external": null,
        "latency_ms": null,
        "latency_display": null,
        "fingerprint": "aad64902b5b93f3b9a5670cd45c5260e6887e449b20346e46ab500c2a22ec082",
        "occurrence_count": 1,
        "unresolved_occurrences": 1,
        "has_payload": true,
        "is_resolved": false,
        "resolved_by": null,
        "resolved_at": null,
        "resolved_at_ist": null,
        "resolution_note": null,
        "timezone": "Asia/Kolkata"
      },
      {
        "id":
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `67ms`

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
      "method": null,
      "resolved": "all",
      "has_user": null,
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
  "requestId": "8893ef1c-418b-4e72-9baa-f04a9fb6a89c"
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
  "requestId": "39c1855c-79bb-4938-8c40-5e098c3ce661"
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `66ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "users": [],
    "pagination": {
      "page": 1,
      "limit": 10,
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
      "method": null,
      "resolved": "all",
      "has_user": null,
      "search": null,
      "from": null,
      "to": null,
      "since_hours": null,
      "timezone": "Asia/Kolkata",
      "sort": "most_errors"
    },
    "timezone": "Asia/Kolkata"
  }
}
```
</details>

### Error Logs Issues (by fingerprint)

**Purpose:** Distinct issues: rows grouped by fingerprint with count, unresolved, affected users, first/last seen.

**Inputs:** Query: limit, service, severity, category, resolved, user, search, from, to

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/issues?limit=10"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `38ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "fingerprint": "aad64902b5b93f3b9a5670cd45c5260e6887e449b20346e46ab500c2a22ec082",
        "service_name": "payment-service",
        "services": [
          "payment-service"
        ],
        "source": "LOGGER",
        "category": "INTERNAL",
        "category_label": "Internal error",
        "severity": "ERROR",
        "error_type": "SyntaxError",
        "error_message": "demo: handled it | Expected property name or '}' in JSON at position 1 (line 1 column 2)",
        "endpoint": "/__demo/self-500",
        "http_method": "GET",
        "status_code": 500,
        "count": 1,
        "unresolved": 1,
        "last_24h": 1,
        "affected_users": 0,
        "first_seen": "2026-10-08T05:27:19.146Z",
        "first_seen_ist": {
          "iso": "2026-10-08T10:57:19+05:30",
          "date": "08 Oct 2026",
          "time": "10:57 AM",
          "time24": "10:57",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 10:57 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T05:27:19.146Z",
          "epoch_ms": 1791437239146
        },
        "last_seen": "2026-10-08T05:27:19.146Z",
        "last_seen_ist": {
          "iso": "2026-10-08T10:57:19+05:30",
          "date": "08 Oct 2026",
          "time": "10:57 AM",
          "time24": "10:57",
          "weekday": "Thu",
          "display": "Thu, 08 Oct 2026, 10:57 AM IST",
          "timezone": "Asia/Kolkata",
          "utc": "2026-10-08T05:27:19.146Z",
          "epoch_ms": 1791437239146
        },
        "last_seen_ago": "2h 18m",
        "latest_id": "1c6bc360-42c0-4b39-b1ad-f65f83085067"
      },
      {
        "fingerprint": "3947a9e6662e22d3388142de3fb579d80082e4bfe2a485e5ebc1d83811ce86c8",
        "service_name": "payment-service",
        "services": [
          "payment-service"
        ],
        "source": "HTTP",
        "category": "INTERNAL",
        "category_label": "Internal error",
        "severity": "ERROR",
        "error_type"
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

**Test Result:** ✅ PASS — Status: `200` — Latency: `68ms`

<details><summary>Response sample</summary>

```json
ID,Occurred (IST),Date (IST),Time (IST),Service,Environment,Source,Category,Severity,HTTP status,Method,Endpoint,Code location,Action,Resource type,Resource id,Error type,Error message,User message,User id,User email,User name,IP address,Request id,External provider,External endpoint,External model,External status,External error code,Latency (ms),Occurrences,Fingerprint,Resolved,Resolved by,Resolved at (IST),Resolution note,Occurred (UTC)
1c6bc360-42c0-4b39-b1ad-f65f83085067,"Thu, 08 Oct 2026, 10:57 AM IST",2026-10-08,10:57,payment-service,development,LOGGER,INTERNAL,ERROR,500,GET,/__demo/sel
```
</details>

### Error Log Detail (INVALID id — expect 400)

**Purpose:** Row ids are UUIDs; anything else is rejected before touching the DB.

**Inputs:** Path: id

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/not-a-uuid"
```

**Test Result:** ✅ PASS — Status: `400` — Latency: `3ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error log id must be a UUID"
  },
  "requestId": "81591f18-a29b-43f6-af9c-dc1e225632d3"
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

**Test Result:** ✅ PASS — Status: `404` — Latency: `34ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Error log not found"
  },
  "requestId": "52f5179a-1b18-4c08-a05e-6d004fe91995"
}
```
</details>

### Error Log Detail

**Purpose:** Full row incl. stack trace, payload, external API response, issue summary (occurrences) and related rows (same request id / same fingerprint).

**Inputs:** Path: id (UUID)

**Example curl:**
```bash
curl -s -X GET -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/1c6bc360-42c0-4b39-b1ad-f65f83085067"
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `67ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "1c6bc360-42c0-4b39-b1ad-f65f83085067",
      "created_at": "2026-10-08T05:27:19.146Z",
      "created_at_ist": {
        "iso": "2026-10-08T10:57:19+05:30",
        "date": "08 Oct 2026",
        "time": "10:57 AM",
        "time24": "10:57",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 10:57 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T05:27:19.146Z",
        "epoch_ms": 1791437239146
      },
      "occurred_ago": "2h 18m",
      "service_name": "payment-service",
      "environment": "development",
      "source": "LOGGER",
      "source_label": "Logged error",
      "category": "INTERNAL",
      "category_label": "Internal error",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "9d57da3de05c3254154752b5781b2019",
      "user_id": null,
      "user_email": null,
      "user_key": null,
      "user": null,
      "ip_address": "127.0.0.1",
      "endpoint": "/__demo/self-500",
      "http_method": "GET",
      "method": "[stdin].<anonymous>",
      "action": null,
      "resource_type": null,
      "resource_id": null,
      "status_code": 500,
      "status_class": "5xx",
      "user_message": "Failed to create payment order",
      "error_type": "SyntaxError",
      "error_message": "demo: handled it | Expected property name or '}' in JSON at position 1 (line 1 column 2)",
      "has_stack_trace": true,
      "external": null,
      "latency_ms": null,
      "latency_display": null,
      "fingerprint": "aad64902b5b93f3b9a5670cd45c5260e6887e449b20346e46ab500c2a22ec082",
      "occurrence_count": 1,
      "unresolved_occurrences": 1,
      "has_payload": true,
      "is_resolved": false,
      "resolved_by": null,
      "resolved_at": null,
      "resolved_at_ist": null,
      "resolution_note": null,
      "timezone": "Asia/Kolkata",
      "stack_trace": "SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)\n    at JSON.parse (<anonymous>)\n    a
... (truncated)
```
</details>

### Error Log Resolve

**Purpose:** Mark a single error resolved with a note; records resolved_by (admin email / admin-token) and resolved_at.

**Inputs:** Body: { resolved: true, note }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/1c6bc360-42c0-4b39-b1ad-f65f83085067/resolve" -H "Content-Type: application/json" -d '{"resolved":true,"note":"automated test: resolved"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `106ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "1c6bc360-42c0-4b39-b1ad-f65f83085067",
      "created_at": "2026-10-08T05:27:19.146Z",
      "created_at_ist": {
        "iso": "2026-10-08T10:57:19+05:30",
        "date": "08 Oct 2026",
        "time": "10:57 AM",
        "time24": "10:57",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 10:57 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T05:27:19.146Z",
        "epoch_ms": 1791437239146
      },
      "occurred_ago": "2h 18m",
      "service_name": "payment-service",
      "environment": "development",
      "source": "LOGGER",
      "source_label": "Logged error",
      "category": "INTERNAL",
      "category_label": "Internal error",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "9d57da3de05c3254154752b5781b2019",
      "user_id": null,
      "user_email": null,
      "user_key": null,
      "user": null,
      "ip_address": "127.0.0.1",
      "endpoint": "/__demo/self-500",
      "http_method": "GET",
      "method": "[stdin].<anonymous>",
      "action": null,
      "resource_type": null,
      "resource_id": null,
      "status_code": 500,
      "status_class": "5xx",
      "user_message": "Failed to create payment order",
      "error_type": "SyntaxError",
      "error_message": "demo: handled it | Expected property name or '}' in JSON at position 1 (line 1 column 2)",
      "has_stack_trace": true,
      "external": null,
      "latency_ms": null,
      "latency_display": null,
      "fingerprint": "aad64902b5b93f3b9a5670cd45c5260e6887e449b20346e46ab500c2a22ec082",
      "occurrence_count": 1,
      "unresolved_occurrences": 0,
      "has_payload": true,
      "is_resolved": true,
      "resolved_by": "admin-token",
      "resolved_at": "2026-10-08T07:45:12.773Z",
      "resolved_at_ist": {
        "iso": "2026-10-08T13:15:12+05:30",
        "date": "08 Oct 2026",
        "time": "01:15 PM",
        "time24": "13:15",
        "weekday": "Thu",
        "display": "Thu, 08
... (truncated)
```
</details>

### Error Log Reopen

**Purpose:** resolved=false reopens the error and clears resolved_by / resolved_at / resolution_note.

**Inputs:** Body: { resolved: false }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/1c6bc360-42c0-4b39-b1ad-f65f83085067/resolve" -H "Content-Type: application/json" -d '{"resolved":false}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `104ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "1c6bc360-42c0-4b39-b1ad-f65f83085067",
      "created_at": "2026-10-08T05:27:19.146Z",
      "created_at_ist": {
        "iso": "2026-10-08T10:57:19+05:30",
        "date": "08 Oct 2026",
        "time": "10:57 AM",
        "time24": "10:57",
        "weekday": "Thu",
        "display": "Thu, 08 Oct 2026, 10:57 AM IST",
        "timezone": "Asia/Kolkata",
        "utc": "2026-10-08T05:27:19.146Z",
        "epoch_ms": 1791437239146
      },
      "occurred_ago": "2h 18m",
      "service_name": "payment-service",
      "environment": "development",
      "source": "LOGGER",
      "source_label": "Logged error",
      "category": "INTERNAL",
      "category_label": "Internal error",
      "severity": "ERROR",
      "severity_label": "Error",
      "request_id": "9d57da3de05c3254154752b5781b2019",
      "user_id": null,
      "user_email": null,
      "user_key": null,
      "user": null,
      "ip_address": "127.0.0.1",
      "endpoint": "/__demo/self-500",
      "http_method": "GET",
      "method": "[stdin].<anonymous>",
      "action": null,
      "resource_type": null,
      "resource_id": null,
      "status_code": 500,
      "status_class": "5xx",
      "user_message": "Failed to create payment order",
      "error_type": "SyntaxError",
      "error_message": "demo: handled it | Expected property name or '}' in JSON at position 1 (line 1 column 2)",
      "has_stack_trace": true,
      "external": null,
      "latency_ms": null,
      "latency_display": null,
      "fingerprint": "aad64902b5b93f3b9a5670cd45c5260e6887e449b20346e46ab500c2a22ec082",
      "occurrence_count": 1,
      "unresolved_occurrences": 1,
      "has_payload": true,
      "is_resolved": false,
      "resolved_by": null,
      "resolved_at": null,
      "resolved_at_ist": null,
      "resolution_note": null,
      "timezone": "Asia/Kolkata",
      "stack_trace": "SyntaxError: Expected property name or '}' in JSON at position 1 (line 1 column 2)\n    at JSON.parse (<anonymous>)\n    a
... (truncated)
```
</details>

### Error Logs Bulk Resolve (ids)

**Purpose:** Resolve many rows at once by id list (or by fingerprint to close every occurrence of an issue).

**Inputs:** Body: { ids[] | fingerprint, resolved, note? }

**Example curl:**
```bash
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/resolve" -H "Content-Type: application/json" -d '{"ids":["1c6bc360-42c0-4b39-b1ad-f65f83085067"],"resolved":true,"note":"automated test: bulk"}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `36ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "resolved": true,
    "changed": 1,
    "ids": [
      "1c6bc360-42c0-4b39-b1ad-f65f83085067"
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
curl -s -X PATCH -H "Authorization: Bearer <ADMIN_TOKEN>" "http://localhost:4010/api/admin/error-logs/resolve" -H "Content-Type: application/json" -d '{"fingerprint":"aad64902b5b93f3b9a5670cd45c5260e6887e449b20346e46ab500c2a22ec082","resolved":false}'
```

**Test Result:** ✅ PASS — Status: `200` — Latency: `34ms`

<details><summary>Response sample</summary>

```json
{
  "success": true,
  "data": {
    "resolved": false,
    "changed": 1,
    "ids": [
      "1c6bc360-42c0-4b39-b1ad-f65f83085067"
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

**Test Result:** ✅ PASS — Status: `400` — Latency: `3ms`

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
  "requestId": "163d725d-4d6a-480b-ab90-eba0f0f33668"
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
  "requestId": "1df1f60b-5f0c-4e86-90c7-0a24b554976b"
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

**Test Result:** ✅ PASS — Status: `404` — Latency: `58ms`

<details><summary>Response sample</summary>

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "Error log not found"
  },
  "requestId": "f9d812d5-0179-4f69-9629-3ef23540266c"
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

**Test Result:** ❌ FAIL — Status: `404` — Latency: `3ms`

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
