# Error Logs API — `/api/admin/error-logs` and `/api/admin/audit-logs`

Admin API for the platform-wide error log: every error a user hit in any backend service
(Python or Node), stored in **one shared table** and viewable, filterable, resolvable and
exportable from the super-admin backend.

All examples below were captured from a live run of the backend on 2026-10-08.

Two tables, two APIs: **`error_logs`** (sections 1–6, one row per error, resolvable) and
**`api_audit_logs`** (section 7, one row per API call with the error on the same row when it failed).

- Code: [Backend/routes/errorLogRoutes.js](../Backend/routes/errorLogRoutes.js),
  [Backend/controllers/errorLogController.js](../Backend/controllers/errorLogController.js),
  [Backend/services/errorLogService.js](../Backend/services/errorLogService.js)
- Audit logs: [Backend/routes/auditLogRoutes.js](../Backend/routes/auditLogRoutes.js),
  [Backend/controllers/auditLogController.js](../Backend/controllers/auditLogController.js),
  [Backend/services/auditLogService.js](../Backend/services/auditLogService.js)
- Tests: `npm run test:admin-api` → groups **I) Error Logs** (23 cases) and **J) Activity & Error Logs** (11 cases) in
  [Backend/tests/run_admin_api_tests.js](../Backend/tests/run_admin_api_tests.js)

---

## 1. Overview

### 1.1 Where the data lives

| | |
|---|---|
| Database | **Document_DB** on the shared PostgreSQL host — the same DB `DOCDB_URL` points at |
| Table | `public.error_logs` |
| Owner | **agentic-document-service** (its migration `183_error_logs.sql` creates the table). Other services write into it directly (`ERROR_LOG_DATABASE_URL`) or through that service's `POST /internal/error-logs`. |
| This backend | **Reads, resolves, deletes only.** It never creates or alters the table. If the table is missing every endpoint answers `503 ERROR_LOGS_TABLE_MISSING`. |
| User lookup | `user_id` / `user_email` on a row are enriched from the **Auth DB** `users` table (second query — the two databases cannot be joined). |
| What a row is | By default (`ERROR_LOG_CAPTURE_ALL=false` in the services) only genuine failures the user got: 5xx / unhandled exceptions. With capture-all on, every 4xx becomes a `WARNING` row (`HttpErrorResponse4xx`) and failures the request recovered from are kept with `payload.recovered = true`. Browser-side errors (uncaught exceptions, failed fetches, render crashes, Razorpay cancellations) are reported by the frontend and land here too (`origin = browser`). |
| Retention | Resolved rows are purged by the owner after `ERROR_LOG_RETENTION_DAYS` (90 by default). Unresolved rows stay. |
| Provider names | `external_provider` is upper-case as written by the services: `GEMINI`, `CITATION`, `ANTHROPIC`, `RAZORPAY`, `PAYMENT_SERVICE`, `API_GATEWAY`, … The `provider` filter is case-insensitive. |

### 1.2 Base URL and authentication

| Environment | Base URL |
|---|---|
| Local | `http://localhost:4000/api/admin/error-logs` |
| Cloud Run | `https://super-admin-backend-120280829617.asia-south1.run.app/api/admin/error-logs` |

Every request needs:

```
Authorization: Bearer <token>
```

`<token>` is either the static `ADMIN_TOKEN` from `Backend/.env` (Postman / scripts) or the JWT
returned by the dashboard login (`POST /api/auth/login`).

| Role | Read (`GET`) | Resolve (`PATCH`) | Delete (`DELETE`, `POST /bulk-delete`) |
|---|---|---|---|
| `super-admin` | ✅ | ✅ | ✅ |
| `admin` (legacy generic role) | ✅ | ✅ | ✅ |
| static `ADMIN_TOKEN` | ✅ | ✅ (`resolved_by` = `admin-token`) | ✅ |
| any other portal role | ❌ `403 FORBIDDEN` | ❌ | ❌ |

### 1.3 Response envelope

Success:

```json
{ "success": true, "data": { "...": "..." } }
```

Error:

```json
{
  "success": false,
  "error": { "code": "VALIDATION_ERROR", "message": "Invalid query parameters", "details": ["\"sort\" must be one of [newest, oldest, severity, service, status_code, latency, user]"] },
  "requestId": "c7cfa3fa-28e1-4fbf-81f7-1da9e943d6cc"
}
```

| HTTP | `error.code` | When |
|---|---|---|
| 400 | `VALIDATION_ERROR` | Bad query param, path id not a UUID, bad body. `details[]` lists each problem. |
| 401 | `UNAUTHORIZED` | `Authorization` header missing / not `Bearer …` / JWT expired |
| 403 | `FORBIDDEN` | Token invalid, or the JWT's role is not allowed |
| 404 | `NOT_FOUND` | Row id does not exist (detail, resolve-one, delete-one) |
| 503 | `ERROR_LOGS_TABLE_MISSING` | `error_logs` table not present in Document_DB yet |
| 500 | `INTERNAL_ERROR` | Unexpected failure; look the `requestId` up in the backend logs |

### 1.4 Timestamps — every one is returned twice

Each timestamp field comes as a UTC ISO string **and** an `*_ist` object rendered in Asia/Kolkata:

```json
{
"created_at": "2026-10-08T07:38:24.477Z",
"created_at_ist": {
  "iso": "2026-10-08T13:08:24+05:30",
  "date": "08 Oct 2026",
  "time": "01:08 PM",
  "time24": "13:08",
  "weekday": "Thu",
  "display": "Thu, 08 Oct 2026, 01:08 PM IST",
  "timezone": "Asia/Kolkata",
  "utc": "2026-10-08T07:38:24.477Z",
  "epoch_ms": 1791445104477
}
}
```

Applies to `created_at`, `resolved_at`, `first_seen`, `last_seen`, `first_error_at`, `last_error_at`,
`last_critical_at`, `generated_at`, `user.last_seen_at`. A `null` timestamp gives `null` for both.
Date filters (`from`, `to`) and the stats' `today` / `yesterday` / `this_month` are **IST calendar days**.

### 1.5 Fingerprint = issue

Rows that share a `fingerprint` are the same error happening repeatedly
(`sha256(service_name | error_type | method | first own-code frame file:line | external_provider | external_error_code)`, computed by the services). Every list row carries
`occurrence_count` and `unresolved_occurrences`; `GET /issues` groups by fingerprint; and
`PATCH /resolve { "fingerprint": … }` / `POST /bulk-delete { "fingerprint": … }` act on every occurrence at once.

### 1.6 Endpoint index

| Method | Path | Purpose |
|---|---|---|
| GET | `/stats` | KPIs, 14-day trend, breakdowns, top issues / endpoints / users, latest unresolved |
| GET | `/meta` | Filter vocabulary + the values actually present + permissions |
| GET | `/` | Paginated list of errors (all filters) |
| GET | `/export` | CSV of the same list (max 5000 rows) |
| GET | `/users` | Errors grouped per user |
| GET | `/issues` | Errors grouped per fingerprint |
| GET | `/:id` | One row in full (stack trace, payload, external response, related rows) |
| PATCH | `/:id/resolve` | Resolve / reopen one row |
| PATCH | `/resolve` | Resolve / reopen many rows (ids or fingerprint) |
| DELETE | `/:id` | Delete one row |
| POST | `/bulk-delete` | Delete many rows (ids or fingerprint) |

---

## 2. The log row object

Returned by `GET /`, `GET /export` (as CSV columns), `GET /:id`, `PATCH /:id/resolve`, and inside
`stats.recent_unresolved` and `related.*`. Fields marked **detail only** appear only on `GET /:id`
and `PATCH /:id/resolve`.

| Field | Type | Meaning |
|---|---|---|
| `id` | uuid | Row id |
| `created_at`, `created_at_ist` | timestamp | When the error happened |
| `occurred_ago` | string | Humanised age, e.g. `"2h 11m"`, `"just now"` |
| `service_name` | string | Service that logged it, e.g. `agentic-document-service`, `payment-service` |
| `environment` | string\|null | `production`, `development`, … |
| `source`, `source_label` | string | `HTTP` · `EXTERNAL_API` · `JOB` · `LOGGER` · `PROCESS` (+ human label) |
| `category`, `category_label` | string | `INTERNAL` · `DATABASE` · `TIMEOUT` · `AI_PROVIDER` · `AI_SAFETY_BLOCK` · `AI_EMPTY_RESPONSE` · `AI_INVALID_OUTPUT` · `CITATION_PROVIDER` · `EXTERNAL_API` |
| `severity`, `severity_label` | string | `CRITICAL` · `ERROR` · `WARNING` |
| `request_id` | string\|null | Correlation id of the request that failed |
| `user_id` | string\|null | Platform user id as the service recorded it (text). Filled from the Auth DB when the row only recorded an email that resolves to a user. |
| `user_email` | string\|null | Platform user email as recorded. **If the row only recorded `user_id`, the email is looked up in the Auth DB and returned here.** |
| `user_email_source` | string\|null | `logged` = the service recorded the email · `auth_db` = filled from the Auth DB by user id · `null` = no email known |
| `user_name` | string\|null | `username` from the Auth DB (shortcut for `user.username`) |
| `user_key` | string\|null | Grouping key: `user_id`, else lower-cased `user_email` |
| `user` | object\|null | Auth-DB user (see §2.1), `null` if the row has no user or the user no longer exists |
| `ip_address` | string\|null | Client IP |
| `endpoint`, `http_method` | string\|null | Route that failed |
| `method` | string\|null | Code location (`module.Class.function`) |
| `action` | string\|null | Business action, e.g. `CHAT_COMPLETE` |
| `resource_type`, `resource_id` | string\|null | Entity involved, e.g. `chat_session` / `sess_77d019` |
| `status_code`, `status_class` | int\|null | HTTP status the user got, and `2xx` / `4xx` / `5xx` |
| `user_message` | string\|null | The message shown to the user |
| `error_type` | string\|null | Exception class, e.g. `ProviderUnavailableError` |
| `error_message` | string\|null | Internal error message |
| `has_stack_trace` | bool | Whether `stack_trace` is present |
| `stack_trace` | string\|null | **detail only** |
| `external` | object\|null | Outbound-call details when `source = EXTERNAL_API` (see §2.2), else `null` |
| `latency_ms`, `latency_display` | int\|null | Request latency, e.g. `30377` / `"30,377 ms"` |
| `fingerprint` | string\|null | Issue hash (§1.5) |
| `occurrence_count` | int | Rows sharing this fingerprint (including this one) |
| `unresolved_occurrences` | int | …of which still unresolved |
| `has_payload` | bool | Whether `payload` is present |
| `payload` | object\|null | **detail only** — sanitized metadata the service attached: `route`, `user_agent`, `duration_ms`, `attempts`, `tokens`, `finish_reasons`, `related`, `internal_error` / `internal_stack`, `http_detail`, `logger`, `cause`; browser reports add `client_report`, `kind`, `flow`, `page`, `details` |
| `origin` | string | `server` or `browser` (reported by the frontend: endpoint `client:<flow>` / `payload.client_report`) |
| `route` | string\|null | Route template from `payload.route` (`/api/files/{file_id}`), while `endpoint` is the actual path with ids |
| `recovered` | bool | The request recovered from this failure and answered 2xx/3xx (`payload.recovered`) |
| `attempts` | int\|null | Same failure retried N times within one request (`payload.attempts`) |
| `after_response_start` | bool | Failed after the response had started (dying SSE stream, background task); `status_code` is what was already sent |
| `related_count` | int | Other distinct errors merged into this row (`payload.related[]`, visible in the detail view) |
| `http_detail` | string\|null | For `HTTPException(5xx, detail=…)` rows: the detail the user saw while the row carries the underlying cause |
| `client` | object\|null | Browser reports only: `{ kind, flow, page }` — `kind` is `unhandled` / `network` / `error` / `render` / `cancelled` / `failed` / `verify-failed`, `page` the SPA route |
| `is_debug` | bool | Produced by the errorlog `_debug` routes / demo triggers rather than real traffic (filter them out with `exclude_debug=true`) |
| `is_resolved` | bool | Resolution state |
| `resolved_by` | string\|null | Admin email, or `admin-token` |
| `resolved_at`, `resolved_at_ist` | timestamp\|null | |
| `resolution_note` | string\|null | |
| `timezone` | string | Always `Asia/Kolkata` |

### 2.1 `user` (Auth-DB enrichment)

```json
{
"user": {
  "id": 3,
  "email": "pravin.sarule@nexintelai.com",
  "username": "Pravin",
  "role": "user",
  "account_type": null,
  "approval_status": "APPROVED",
  "is_blocked": false,
  "is_active": true,
  "active_plan_name": null,
  "last_seen_at": "2026-09-17T10:18:29.478Z",
  "last_seen_at_ist": { "iso": "2026-09-17T15:48:29+05:30", "date": "17 Sep 2026", "time": "03:48 PM", "time24": "15:48", "weekday": "Thu", "display": "Thu, 17 Sep 2026, 03:48 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-09-17T10:18:29.478Z", "epoch_ms": 1789640309478 },
  "registered_at": "2025-12-03T04:45:35.002Z"
}
}
```

Matched by numeric `user_id` first, then by `user_email` (case-insensitive). If the Auth DB lookup
fails the request still succeeds with `user: null` (and `user_email` stays whatever the service recorded).

Services often log only the user id. The API fills the gap: a row with `user_id = "3"` and no email comes back
with `"user_email": "pravin.sarule@nexintelai.com", "user_email_source": "auth_db", "user_name": "Pravin"`.

### 2.2 `external` (outbound API call that failed)

```json
{
"external": {
  "provider": "gemini",
  "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
  "model": "gemini-2.5-flash",
  "status_code": 502,
  "error_code": "UNAVAILABLE",
  "has_response": true,
  "response": "{\"error\":{\"code\":502,\"status\":\"UNAVAILABLE\",\"message\":\"The service is currently unavailable.\"}}"
}
}
```

`response` (the raw provider body) is **detail only**; list rows carry `has_response` instead.

---

## 3. Shared list filters

Used by `GET /` and `GET /export` (all of them), and by `GET /users` and `GET /issues` (the subset
listed on each). Unknown params are ignored; invalid values return `400 VALIDATION_ERROR`.

| Param | Type | Default | Notes |
|---|---|---|---|
| `page` | int ≥ 1 | `1` | |
| `limit` (alias `pageSize`) | int 1–200 | `20` | |
| `service` | csv | all | `service_name` values, e.g. `payment-service,agentic-document-service` |
| `environment` | csv | all | e.g. `production,development` |
| `source` | csv | all | upper-cased automatically, e.g. `http,external_api` |
| `category` | csv | all | upper-cased, e.g. `TIMEOUT,AI_PROVIDER` |
| `severity` | csv | all | upper-cased, e.g. `CRITICAL,ERROR` |
| `status_code` | csv int | all | each 100–599, e.g. `500,502` |
| `status_class` | string | — | `2xx` · `3xx` · `4xx` · `5xx` |
| `error_type` | string | — | exact, case-insensitive, e.g. `ValueError` |
| `provider` | string | — | `external_provider`, exact, case-insensitive, e.g. `gemini` |
| `user` | string | — | numeric id **or** email. Resolved through the Auth DB first, so an email also finds rows that only recorded the user id and an id also finds rows that only recorded the email. The matched account is echoed as `filters.user_resolved` (`null` when the value is not a known user — plain column matching is still applied). |
| `user_id` | string | — | exact match on `user_id` only |
| `user_email` | string | — | exact (case-insensitive) match on `user_email` only |
| `request_id` | string | — | exact |
| `fingerprint` | string | — | exact — every occurrence of one issue |
| `endpoint` | string | — | contains, case-insensitive, on the actual path |
| `route` | string | — | contains, case-insensitive, on the route template (`payload.route`, falling back to `endpoint`) |
| `method` | string | — | contains, case-insensitive (code location) |
| `resolved` | `all` · `true` · `false` | `all` | `1`/`0`/`yes`/`no` also accepted |
| `has_user` | bool | — | `true` = only rows attributed to a user; `false` = only anonymous rows |
| `origin` | `browser` · `server` · `all` | `all` | browser-reported rows vs. server-side rows |
| `exclude_debug` | bool | `false` | `true` drops rows from the errorlog `_debug` routes / demo triggers |
| `search` | string ≤ 200 | — | contains, case-insensitive, across `error_message`, `user_message`, `error_type`, `endpoint`, `method`, `user_email`, `user_id`, `request_id`, `resource_id`, `ip_address`, `service_name`, `external_endpoint`, `external_error_code` |
| `from` | `YYYY-MM-DD` | — | IST calendar day, inclusive |
| `to` | `YYYY-MM-DD` | — | IST calendar day, inclusive; must be ≥ `from` |
| `since_hours` | int 1–8784 | — | rolling window, e.g. `24` |
| `sort` | string | `newest` | `newest` · `oldest` · `severity` · `service` · `status_code` · `latency` · `user` |

Every list response echoes what was applied under `data.filters` (`"all"` / `null` for untouched filters).
When `user` is given, `data.filters.user_resolved` is `{ "id", "email", "username" }` of the matched Auth-DB account, or `null`.

---

## 4. Endpoints

### 4.1 `GET /api/admin/error-logs/stats`

Dashboard numbers. No parameters.

**Request**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/error-logs/stats"
```

**Response `200`** (arrays trimmed to the first entries; `daily_trend` always has 14 entries, oldest first)

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-08T07:38:40.722Z",
    "generated_at_ist": { "iso": "2026-10-08T13:08:40+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:40.722Z", "epoch_ms": 1791445120722 },
    "totals": {
      "total": 11,
      "unresolved": 11,
      "resolved": 0,
      "critical": 2,
      "error": 9,
      "warning": 0,
      "critical_unresolved": 2,
      "last_hour": 3,
      "last_24h": 11,
      "today": 11,
      "yesterday": 0,
      "last_7_days": 11,
      "last_30_days": 11,
      "this_month": 11,
      "with_user": 3,
      "affected_users": 1,
      "affected_users_24h": 1,
      "affected_users_unresolved": 1,
      "distinct_issues": 10,
      "distinct_issues_unresolved": 10,
      "services": 2,
      "external_api": 3,
      "http_5xx": 9,
      "http_4xx": 0,
      "browser": 0,
      "recovered": 0,
      "debug": 8,
      "avg_latency_ms": 15452,
      "resolved_rate_pct": 0,
      "last_error_at": "2026-10-08T07:38:24.508Z",
      "last_error_at_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.508Z", "epoch_ms": 1791445104508 },
      "last_critical_at": "2026-10-08T07:38:24.477Z",
      "last_critical_at_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.477Z", "epoch_ms": 1791445104477 }
    },
    "daily_trend": [
      { "date": "2026-10-06", "label": "06 Oct", "total": 0, "critical": 0, "unresolved": 0, "affected_users": 0 },
      { "date": "2026-10-07", "label": "07 Oct", "total": 0, "critical": 0, "unresolved": 0, "affected_users": 0 },
      { "date": "2026-10-08", "label": "08 Oct", "total": 11, "critical": 2, "unresolved": 11, "affected_users": 1 }
    ],
    "by_service": [
      { "value": "agentic-document-service", "total": 9, "unresolved": 9, "critical": 2, "last_24h": 9, "affected_users": 1, "last_error_at": "2026-10-08T07:38:24.508Z", "last_error_at_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.508Z", "epoch_ms": 1791445104508 } },
      { "value": "payment-service", "total": 2, "unresolved": 2, "critical": 0, "last_24h": 2, "affected_users": 0, "last_error_at": "2026-10-08T05:27:19.146Z", "last_error_at_ist": { "iso": "2026-10-08T10:57:19+05:30", "date": "08 Oct 2026", "time": "10:57 AM", "time24": "10:57", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 10:57 AM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T05:27:19.146Z", "epoch_ms": 1791437239146 } }
    ],
    "by_category": [
      { "value": "INTERNAL", "label": "Internal error", "total": 8, "unresolved": 8, "last_24h": 8 },
      { "value": "AI_PROVIDER", "label": "AI provider", "total": 2, "unresolved": 2, "last_24h": 2 },
      { "value": "TIMEOUT", "label": "Timeout", "total": 1, "unresolved": 1, "last_24h": 1 }
    ],
    "by_source": [
      { "value": "HTTP", "label": "HTTP request", "total": 6, "unresolved": 6, "last_24h": 6 },
      { "value": "EXTERNAL_API", "label": "External API call", "total": 3, "unresolved": 3, "last_24h": 3 },
      { "value": "LOGGER", "label": "Logged error", "total": 2, "unresolved": 2, "last_24h": 2 }
    ],
    "by_severity": [
      { "value": "CRITICAL", "label": "Critical", "total": 2, "unresolved": 2, "last_24h": 2 },
      { "value": "ERROR", "label": "Error", "total": 9, "unresolved": 9, "last_24h": 9 }
    ],
    "by_status_code": [
      { "value": 500, "total": 7, "unresolved": 7 },
      { "value": 502, "total": 2, "unresolved": 2 },
      { "value": 200, "total": 2, "unresolved": 2 }
    ],
    "by_environment": [
      { "value": "development", "total": 8, "unresolved": 8 },
      { "value": "production", "total": 3, "unresolved": 3 }
    ],
    "top_endpoints": [
      { "service_name": "agentic-document-service", "http_method": "POST", "route": "/api/chat/completions", "endpoint": "/api/chat/completions", "total": 3, "unresolved": 3, "affected_users": 1, "last_error_at": "2026-10-08T07:38:24.508Z", "last_error_at_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.508Z", "epoch_ms": 1791445104508 } }
    ],
    "top_issues": [
      {
        "fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "service_name": "agentic-document-service",
        "services": ["agentic-document-service"],
        "source": "EXTERNAL_API",
        "category": "AI_PROVIDER",
        "category_label": "AI provider",
        "severity": "CRITICAL",
        "error_type": "ProviderUnavailableError",
        "error_message": "Gemini returned 502 UNAVAILABLE after 3 retries",
        "endpoint": "/api/chat/completions",
        "http_method": "POST",
        "status_code": 502,
        "count": 2,
        "unresolved": 2,
        "last_24h": 2,
        "affected_users": 1,
        "first_seen": "2026-10-08T07:38:23.234Z",
        "first_seen_ist": { "iso": "2026-10-08T13:08:23+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:23.234Z", "epoch_ms": 1791445103234 },
        "last_seen": "2026-10-08T07:38:24.477Z",
        "last_seen_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.477Z", "epoch_ms": 1791445104477 },
        "last_seen_ago": "just now",
        "latest_id": "5544eb3d-6236-449e-bb2d-62d51969aac4"
      }
    ],
    "top_users": [
      {
        "user_key": "3",
        "user_id": "3",
        "user_email": "pravin.sarule@nexintelai.com",
        "user_email_source": "logged",
        "user_name": "Pravin",
        "user": { "id": 3, "email": "pravin.sarule@nexintelai.com", "username": "Pravin", "role": "user", "account_type": null, "approval_status": "APPROVED", "is_blocked": false, "is_active": true, "active_plan_name": null, "last_seen_at": "2026-09-17T10:18:29.478Z", "last_seen_at_ist": { "iso": "2026-09-17T15:48:29+05:30", "date": "17 Sep 2026", "time": "03:48 PM", "time24": "15:48", "weekday": "Thu", "display": "Thu, 17 Sep 2026, 03:48 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-09-17T10:18:29.478Z", "epoch_ms": 1789640309478 }, "registered_at": "2025-12-03T04:45:35.002Z" },
        "total": 3,
        "unresolved": 3,
        "critical": 2,
        "last_24h": 3,
        "last_7_days": 3,
        "distinct_errors": 2,
        "services": ["agentic-document-service"],
        "first_error_at": "2026-10-08T07:38:23.234Z",
        "first_error_at_ist": { "iso": "2026-10-08T13:08:23+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:23.234Z", "epoch_ms": 1791445103234 },
        "last_error_at": "2026-10-08T07:38:24.508Z",
        "last_error_at_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.508Z", "epoch_ms": 1791445104508 },
        "last_error_ago": "just now",
        "last_error_type": "RuntimeError",
        "last_error_message": "failed to persist assistant message after provider error",
        "last_endpoint": "/api/chat/completions",
        "last_service": "agentic-document-service"
      }
    ],
    "recent_unresolved": [
      { "comment": "up to 5 newest unresolved rows, each a full log row object (see §2)" }
    ]
  }
}
```

`totals` fields:

| Field | Meaning |
|---|---|
| `total`, `unresolved`, `resolved`, `resolved_rate_pct` | Whole table |
| `critical`, `error`, `warning`, `critical_unresolved` | By severity |
| `last_hour`, `last_24h` | Rolling windows |
| `today`, `yesterday`, `last_7_days`, `last_30_days`, `this_month` | IST calendar days |
| `with_user` | Rows attributed to a user |
| `affected_users`, `affected_users_24h`, `affected_users_unresolved` | Distinct users (by `user_key`) |
| `distinct_issues`, `distinct_issues_unresolved` | Distinct fingerprints |
| `services` | Distinct `service_name` |
| `external_api`, `http_5xx`, `http_4xx` | Rows with `source = EXTERNAL_API` / status ≥ 500 / status 4xx |
| `browser`, `recovered`, `debug` | Browser-reported rows / failures the request recovered from / rows from the `_debug` routes |
| `avg_latency_ms` | Average of non-null `latency_ms` |
| `last_error_at`, `last_critical_at` (+ `_ist`) | Most recent row / most recent CRITICAL row |

`top_issues` has the shape of `GET /issues` rows (max 10), `top_users` the shape of `GET /users` rows (max 10),
`top_endpoints` groups by service + method + **route template** (`payload.route`, else the path) so `/api/files/123` and `/api/files/456` count together; `endpoint` on each entry is one sample path (max 10). `recent_unresolved` is up to 5 full log rows.

---

### 4.2 `GET /api/admin/error-logs/meta`

Vocabulary for dropdowns plus what actually exists in the table. No parameters.

**Request**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/error-logs/meta"
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "vocab": {
      "sources": [
        { "value": "HTTP", "label": "HTTP request" },
        { "value": "EXTERNAL_API", "label": "External API call" },
        { "value": "JOB", "label": "Background job" },
        { "value": "LOGGER", "label": "Logged error" },
        { "value": "PROCESS", "label": "Process crash" }
      ],
      "categories": [
        { "value": "INTERNAL", "label": "Internal error" },
        { "value": "DATABASE", "label": "Database" },
        { "value": "TIMEOUT", "label": "Timeout" },
        { "value": "AI_PROVIDER", "label": "AI provider" },
        { "value": "AI_SAFETY_BLOCK", "label": "AI safety block" },
        { "value": "AI_EMPTY_RESPONSE", "label": "AI empty response" },
        { "value": "AI_INVALID_OUTPUT", "label": "AI invalid output" },
        { "value": "CITATION_PROVIDER", "label": "Citation provider" },
        { "value": "EXTERNAL_API", "label": "External API" }
      ],
      "severities": [
        { "value": "CRITICAL", "label": "Critical" },
        { "value": "ERROR", "label": "Error" },
        { "value": "WARNING", "label": "Warning" }
      ],
      "status_classes": ["2xx", "3xx", "4xx", "5xx"]
    },
    "used": {
      "services": [
        { "value": "agentic-document-service", "count": 9 },
        { "value": "payment-service", "count": 2 }
      ],
      "environments": [
        { "value": "development", "count": 8 },
        { "value": "production", "count": 3 }
      ],
      "sources": [
        { "value": "HTTP", "count": 6 },
        { "value": "EXTERNAL_API", "count": 3 },
        { "value": "LOGGER", "count": 2 }
      ],
      "categories": [
        { "value": "INTERNAL", "count": 8 },
        { "value": "AI_PROVIDER", "count": 2 },
        { "value": "TIMEOUT", "count": 1 }
      ],
      "severities": [
        { "value": "ERROR", "count": 9 },
        { "value": "CRITICAL", "count": 2 }
      ],
      "error_types": [
        { "value": "RuntimeError", "count": 3 },
        { "value": "ProviderUnavailableError", "count": 2 },
        { "value": "ValueError", "count": 2 },
        { "value": "ConnectTimeout", "count": 1 },
        { "value": "KeyError", "count": 1 },
        { "value": "SyntaxError", "count": 1 },
        { "value": "TypeError", "count": 1 }
      ],
      "providers": [
        { "value": "gemini", "count": 2 }
      ],
      "status_codes": [
        { "value": 500, "count": 7 },
        { "value": 200, "count": 2 },
        { "value": 502, "count": 2 }
      ],
      "models": [
        { "value": "gemini-2.5-flash", "count": 2 }
      ]
    },
    "sort_options": ["newest", "oldest", "severity", "service", "status_code", "latency", "user"],
    "user_sort_options": ["most_errors", "recent", "unresolved", "critical"],
    "limits": { "max_page_size": 200, "max_export_rows": 5000, "max_bulk_ids": 500 },
    "permissions": { "can_resolve": true, "can_delete": true }
  }
}
```

`used.*` lists are ordered by count (max 100 entries; `error_types` 60, `status_codes` 40).
`permissions.can_delete` is `false` for a JWT whose role is not `super-admin` / `admin`.

---

### 4.3 `GET /api/admin/error-logs` — list

Paginated list. Accepts every filter in §3. Heavy columns (`stack_trace`, `payload`,
`external.response`) are left out — use `GET /:id` for those.

**Request — everything one user hit, unresolved, newest first**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/error-logs?user=pravin.sarule@nexintelai.com&resolved=false&sort=newest&limit=20"
```

**Response `200`** (one of the three matching rows shown)

```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "639e8980-48dc-465f-8803-ae4706df66db",
        "created_at": "2026-10-08T07:38:24.508Z",
        "created_at_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.508Z", "epoch_ms": 1791445104508 },
        "occurred_ago": "just now",
        "service_name": "agentic-document-service",
        "environment": "production",
        "source": "HTTP",
        "source_label": "HTTP request",
        "category": "INTERNAL",
        "category_label": "Internal error",
        "severity": "ERROR",
        "severity_label": "Error",
        "request_id": "a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4",
        "user_id": "3",
        "user_email": "pravin.sarule@nexintelai.com",
        "user_email_source": "logged",
        "user_name": "Pravin",
        "user_key": "3",
        "user": { "id": 3, "email": "pravin.sarule@nexintelai.com", "username": "Pravin", "role": "user", "account_type": null, "approval_status": "APPROVED", "is_blocked": false, "is_active": true, "active_plan_name": null, "last_seen_at": "2026-09-17T10:18:29.478Z", "last_seen_at_ist": { "iso": "2026-09-17T15:48:29+05:30", "date": "17 Sep 2026", "time": "03:48 PM", "time24": "15:48", "weekday": "Thu", "display": "Thu, 17 Sep 2026, 03:48 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-09-17T10:18:29.478Z", "epoch_ms": 1789640309478 }, "registered_at": "2025-12-03T04:45:35.002Z" },
        "ip_address": "103.21.58.14",
        "endpoint": "/api/chat/completions",
        "http_method": "POST",
        "method": "chat.service.ChatService.persist",
        "action": "CHAT_COMPLETE",
        "resource_type": "chat_session",
        "resource_id": "sess_77d019",
        "status_code": 500,
        "status_class": "5xx",
        "user_message": "Internal server error",
        "error_type": "RuntimeError",
        "error_message": "failed to persist assistant message after provider error",
        "has_stack_trace": true,
        "external": null,
        "latency_ms": 18,
        "latency_display": "18 ms",
        "fingerprint": "9b74c9897bac770ffc029102a200c5de1a5f1a5f1e5d1f1b1c1d1e1f1a1b1c1d",
        "occurrence_count": 1,
        "unresolved_occurrences": 1,
        "has_payload": true,
        "origin": "server",
        "route": "/api/chat/completions",
        "recovered": false,
        "attempts": null,
        "after_response_start": false,
        "related_count": 0,
        "http_detail": null,
        "client": null,
        "is_debug": false,
        "is_resolved": false,
        "resolved_by": null,
        "resolved_at": null,
        "resolved_at_ist": null,
        "resolution_note": null,
        "timezone": "Asia/Kolkata"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 3, "totalPages": 1 },
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
      "user": "pravin.sarule@nexintelai.com",
      "user_resolved": { "id": 3, "email": "pravin.sarule@nexintelai.com", "username": "Pravin" },
      "user_id": null,
      "user_email": null,
      "request_id": null,
      "fingerprint": null,
      "endpoint": null,
      "method": null,
      "resolved": false,
      "has_user": null,
      "search": null,
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

**Request — combined filters**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/error-logs?service=payment-service&severity=ERROR&status_class=5xx&since_hours=48&limit=1"
```

**Response `200`** — same shape; the echoed filters become:

```json
{
"pagination": { "page": 1, "limit": 1, "total": 2, "totalPages": 2 },
"filters": {
  "service": ["payment-service"],
  "severity": ["ERROR"],
  "status_class": "5xx",
  "since_hours": 48,
  "resolved": "all",
  "sort": "newest",
  "timezone": "Asia/Kolkata",
  "environment": "all", "source": "all", "category": "all", "status_code": "all",
  "error_type": null, "provider": null, "user": null, "user_id": null, "user_email": null,
  "request_id": null, "fingerprint": null, "endpoint": null, "method": null, "has_user": null,
  "search": null, "from": null, "to": null
}
}
```

More useful queries:

| Need | Query |
|---|---|
| Everything one user hit | `?user=3` or `?user=someone@example.com` |
| Open production 5xx in the last day | `?resolved=false&status_class=5xx&environment=production&since_hours=24` |
| All occurrences of one issue, oldest first | `?fingerprint=<fp>&sort=oldest` |
| Everything that happened in one request | `?request_id=<id>&sort=oldest` |
| AI failures | `?category=AI_PROVIDER,AI_SAFETY_BLOCK,AI_EMPTY_RESPONSE,AI_INVALID_OUTPUT` |
| Gemini calls only | `?provider=gemini` |
| Errors between two IST dates | `?from=2026-10-01&to=2026-10-08` |
| Slowest failures | `?sort=latency` |
| Text search | `?search=timeout` |
| Only what the browser reported (failed fetches, crashes, Razorpay) | `?origin=browser` |
| Real traffic only, no debug-route noise | `?exclude_debug=true` |
| One route template regardless of ids | `?route=/api/files/{file_id}` |

**Error `400`** — invalid query (e.g. `?sort=random`)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": ["\"sort\" must be one of [newest, oldest, severity, service, status_code, latency, user]"]
  },
  "requestId": "c7cfa3fa-28e1-4fbf-81f7-1da9e943d6cc"
}
```

Other `details` messages you can get: `Unknown status_code "abc" (expected 100–599)`,
`"from" must be on or before "to"`, `"from" must be YYYY-MM-DD (IST calendar date)`, `"limit" must be less than or equal to 200`.

---

### 4.4 `GET /api/admin/error-logs/export` — CSV

Same filters as §4.3 (`page` / `limit` are ignored). Returns at most **5000** rows, newest first unless
`sort` says otherwise. Narrow the filter if `X-Total-Rows` is larger than `X-Exported-Rows`.

**Request**

```bash
curl -s -D - -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/error-logs/export?user=3" -o error-logs.csv
```

**Response `200`**

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="error-logs-2026-10-08-1308-IST.csv"
X-Total-Rows: 3
X-Exported-Rows: 3
```

```
ID,Occurred (IST),Date (IST),Time (IST),Service,Environment,Source,Category,Severity,HTTP status,Method,Endpoint,Code location,Action,Resource type,Resource id,Error type,Error message,User message,User id,User email,User name,IP address,Request id,External provider,External endpoint,External model,External status,External error code,Latency (ms),Occurrences,Fingerprint,Resolved,Resolved by,Resolved at (IST),Resolution note,Occurred (UTC)
639e8980-48dc-465f-8803-ae4706df66db,"Thu, 08 Oct 2026, 01:08 PM IST",2026-10-08,13:08,agentic-document-service,production,HTTP,INTERNAL,ERROR,500,POST,/api/chat/completions,chat.service.ChatService.persist,CHAT_COMPLETE,chat_session,sess_77d019,RuntimeError,failed to persist assistant message after provider error,Internal server error,3,pravin.sarule@nexintelai.com,Pravin,103.21.58.14,a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4,,,,,,18,1,9b74c9897bac770ffc029102a200c5de1a5f1a5f1e5d1f1b1c1d1e1f1a1b1c1d,No,,,,2026-10-08T07:38:24.508Z
```

The file starts with a UTF-8 BOM and uses CRLF line endings so Excel opens it cleanly. Values starting
with `=`, `+`, `-`, `@` are prefixed with `'` (formula-injection guard).

---

### 4.5 `GET /api/admin/error-logs/users` — errors per user

Rows grouped by user (`user_id`, else lower-cased `user_email`). Only rows attributed to a user are counted.

| Param | Type | Default | Notes |
|---|---|---|---|
| `page`, `limit` | int | `1` / `20` | max 200 |
| `sort` | string | `most_errors` | `most_errors` · `recent` · `unresolved` · `critical` |
| `service`, `severity`, `category`, `resolved`, `search`, `from`, `to`, `since_hours` | | | as in §3 |

**Request**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/error-logs/users?page=1&limit=20&sort=most_errors"
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "users": [
      {
        "user_key": "3",
        "user_id": "3",
        "user_email": "pravin.sarule@nexintelai.com",
        "user_email_source": "logged",
        "user_name": "Pravin",
        "user": { "id": 3, "email": "pravin.sarule@nexintelai.com", "username": "Pravin", "role": "user", "account_type": null, "approval_status": "APPROVED", "is_blocked": false, "is_active": true, "active_plan_name": null, "last_seen_at": "2026-09-17T10:18:29.478Z", "last_seen_at_ist": { "iso": "2026-09-17T15:48:29+05:30", "date": "17 Sep 2026", "time": "03:48 PM", "time24": "15:48", "weekday": "Thu", "display": "Thu, 17 Sep 2026, 03:48 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-09-17T10:18:29.478Z", "epoch_ms": 1789640309478 }, "registered_at": "2025-12-03T04:45:35.002Z" },
        "total": 3,
        "unresolved": 3,
        "critical": 2,
        "last_24h": 3,
        "last_7_days": 3,
        "distinct_errors": 2,
        "services": ["agentic-document-service"],
        "first_error_at": "2026-10-08T07:38:23.234Z",
        "first_error_at_ist": { "iso": "2026-10-08T13:08:23+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:23.234Z", "epoch_ms": 1791445103234 },
        "last_error_at": "2026-10-08T07:38:24.508Z",
        "last_error_at_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.508Z", "epoch_ms": 1791445104508 },
        "last_error_ago": "just now",
        "last_error_type": "RuntimeError",
        "last_error_message": "failed to persist assistant message after provider error",
        "last_endpoint": "/api/chat/completions",
        "last_service": "agentic-document-service"
      }
    ],
    "pagination": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
    "filters": {
      "service": "all", "environment": "all", "source": "all", "category": "all", "severity": "all",
      "status_code": "all", "status_class": null, "error_type": null, "provider": null,
      "user": null, "user_id": null, "user_email": null, "request_id": null, "fingerprint": null,
      "endpoint": null, "method": null, "resolved": "all", "has_user": null, "search": null,
      "from": null, "to": null, "since_hours": null, "timezone": "Asia/Kolkata",
      "sort": "most_errors"
    },
    "timezone": "Asia/Kolkata"
  }
}
```

Grouping uses what the services recorded: rows that logged only the id and rows that logged only the email
of the same person form two groups (`user_key` `"3"` and `"pravin.sarule@nexintelai.com"`); both are enriched with the same Auth-DB account.

| Field | Meaning |
|---|---|
| `user_key` | Pass it to `GET /?user=<user_key>` to list that user's rows |
| `user_id`, `user_email`, `user_email_source`, `user_name` | As on log rows: whatever the services recorded, with the email / name filled from the Auth DB when only the id was logged |
| `total`, `unresolved`, `critical`, `last_24h`, `last_7_days` | Counts for this user |
| `distinct_errors` | Distinct fingerprints |
| `services` | Every service this user hit an error in |
| `first_error_at`, `last_error_at`, `last_error_ago` | First / most recent error |
| `last_error_type`, `last_error_message`, `last_endpoint`, `last_service` | The most recent row |

---

### 4.6 `GET /api/admin/error-logs/issues` — distinct issues

Rows grouped by `fingerprint`, most frequent first. Rows with a `null` fingerprint are skipped.

| Param | Type | Default | Notes |
|---|---|---|---|
| `limit` | int 1–100 | `20` | |
| `service`, `severity`, `category`, `resolved`, `user`, `search`, `from`, `to`, `since_hours` | | | as in §3 |

**Request**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/error-logs/issues?limit=10&user=3"
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "issues": [
      {
        "fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "service_name": "agentic-document-service",
        "services": ["agentic-document-service"],
        "source": "EXTERNAL_API",
        "category": "AI_PROVIDER",
        "category_label": "AI provider",
        "severity": "CRITICAL",
        "error_type": "ProviderUnavailableError",
        "error_message": "Gemini returned 502 UNAVAILABLE after 3 retries",
        "endpoint": "/api/chat/completions",
        "http_method": "POST",
        "status_code": 502,
        "count": 2,
        "unresolved": 2,
        "last_24h": 2,
        "affected_users": 1,
        "first_seen": "2026-10-08T07:38:23.234Z",
        "first_seen_ist": { "iso": "2026-10-08T13:08:23+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:23.234Z", "epoch_ms": 1791445103234 },
        "last_seen": "2026-10-08T07:38:24.477Z",
        "last_seen_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.477Z", "epoch_ms": 1791445104477 },
        "last_seen_ago": "just now",
        "latest_id": "5544eb3d-6236-449e-bb2d-62d51969aac4"
      },
      {
        "fingerprint": "9b74c9897bac770ffc029102a200c5de1a5f1a5f1e5d1f1b1c1d1e1f1a1b1c1d",
        "service_name": "agentic-document-service",
        "services": ["agentic-document-service"],
        "source": "HTTP",
        "category": "INTERNAL",
        "category_label": "Internal error",
        "severity": "ERROR",
        "error_type": "RuntimeError",
        "error_message": "failed to persist assistant message after provider error",
        "endpoint": "/api/chat/completions",
        "http_method": "POST",
        "status_code": 500,
        "count": 1,
        "unresolved": 1,
        "last_24h": 1,
        "affected_users": 1,
        "first_seen": "2026-10-08T07:38:24.508Z",
        "first_seen_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.508Z", "epoch_ms": 1791445104508 },
        "last_seen": "2026-10-08T07:38:24.508Z",
        "last_seen_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.508Z", "epoch_ms": 1791445104508 },
        "last_seen_ago": "just now",
        "latest_id": "639e8980-48dc-465f-8803-ae4706df66db"
      }
    ],
    "filters": {
      "service": "all", "environment": "all", "source": "all", "category": "all", "severity": "all",
      "status_code": "all", "status_class": null, "error_type": null, "provider": null,
      "user": "3", "user_resolved": { "id": 3, "email": "pravin.sarule@nexintelai.com", "username": "Pravin" },
      "user_id": null, "user_email": null, "request_id": null, "fingerprint": null,
      "endpoint": null, "method": null, "resolved": "all", "has_user": null, "search": null,
      "from": null, "to": null, "since_hours": null, "timezone": "Asia/Kolkata"
    },
    "timezone": "Asia/Kolkata"
  }
}
```

| Field | Meaning |
|---|---|
| `service_name`, `source`, `category`, `severity`, `error_type`, `error_message`, `endpoint`, `http_method`, `status_code` | Taken from the **newest** row of the group |
| `services` | Every service that produced this fingerprint |
| `count`, `unresolved`, `last_24h` | Occurrences |
| `affected_users` | Distinct users (by `user_key`) |
| `first_seen`, `last_seen`, `last_seen_ago` | Time span |
| `latest_id` | Id of the newest row — open it with `GET /:id` |

---

### 4.7 `GET /api/admin/error-logs/:id` — detail

The full row plus everything needed to triage it.

| Path param | |
|---|---|
| `id` | Row UUID (`400` if malformed, `404` if unknown) |

**Request**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/error-logs/5544eb3d-6236-449e-bb2d-62d51969aac4"
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "5544eb3d-6236-449e-bb2d-62d51969aac4",
      "created_at": "2026-10-08T07:38:24.477Z",
      "created_at_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.477Z", "epoch_ms": 1791445104477 },
      "occurred_ago": "just now",
      "service_name": "agentic-document-service",
      "environment": "production",
      "source": "EXTERNAL_API",
      "source_label": "External API call",
      "category": "AI_PROVIDER",
      "category_label": "AI provider",
      "severity": "CRITICAL",
      "severity_label": "Critical",
      "request_id": "a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4",
      "user_id": "3",
      "user_email": "pravin.sarule@nexintelai.com",
      "user_email_source": "logged",
      "user_name": "Pravin",
      "user_key": "3",
      "user": { "id": 3, "email": "pravin.sarule@nexintelai.com", "username": "Pravin", "role": "user", "account_type": null, "approval_status": "APPROVED", "is_blocked": false, "is_active": true, "active_plan_name": null, "last_seen_at": "2026-09-17T10:18:29.478Z", "last_seen_at_ist": { "iso": "2026-09-17T15:48:29+05:30", "date": "17 Sep 2026", "time": "03:48 PM", "time24": "15:48", "weekday": "Thu", "display": "Thu, 17 Sep 2026, 03:48 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-09-17T10:18:29.478Z", "epoch_ms": 1789640309478 }, "registered_at": "2025-12-03T04:45:35.002Z" },
      "ip_address": "103.21.58.14",
      "endpoint": "/api/chat/completions",
      "http_method": "POST",
      "method": "chat.service.ChatService.complete",
      "action": "CHAT_COMPLETE",
      "resource_type": "chat_session",
      "resource_id": "sess_77d019",
      "status_code": 502,
      "status_class": "5xx",
      "user_message": "The AI service is temporarily unavailable. Please try again.",
      "error_type": "ProviderUnavailableError",
      "error_message": "Gemini returned 502 UNAVAILABLE after 3 retries",
      "has_stack_trace": true,
      "external": {
        "provider": "gemini",
        "endpoint": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
        "model": "gemini-2.5-flash",
        "status_code": 502,
        "error_code": "UNAVAILABLE",
        "has_response": true,
        "response": "{\"error\":{\"code\":502,\"status\":\"UNAVAILABLE\",\"message\":\"The service is currently unavailable.\"}}"
      },
      "latency_ms": 30377,
      "latency_display": "30,377 ms",
      "fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "occurrence_count": 2,
      "unresolved_occurrences": 2,
      "has_payload": true,
      "origin": "server",
      "route": "/api/chat/completions",
      "recovered": false,
      "attempts": null,
      "after_response_start": false,
      "related_count": 0,
      "http_detail": null,
      "client": null,
      "is_debug": false,
      "is_resolved": false,
      "resolved_by": null,
      "resolved_at": null,
      "resolved_at_ist": null,
      "resolution_note": null,
      "timezone": "Asia/Kolkata",
      "stack_trace": "Traceback (most recent call last):\n  File \"/app/chat/service.py\", line 142, in complete\n    resp = await self._client.generate(prompt)\n  File \"/app/providers/gemini.py\", line 88, in generate\n    raise ProviderUnavailableError(resp.status, resp.text)\nProviderUnavailableError: 502 UNAVAILABLE",
      "payload": {
        "route": "/api/chat/completions",
        "retries": 3,
        "session_id": "sess_77d019",
        "prompt_tokens": 912
      }
    },
    "issue": {
      "fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "count": 2,
      "unresolved": 2,
      "last_24h": 2,
      "affected_users": 1,
      "first_seen": "2026-10-08T07:38:23.234Z",
      "first_seen_ist": { "iso": "2026-10-08T13:08:23+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:23.234Z", "epoch_ms": 1791445103234 },
      "last_seen": "2026-10-08T07:38:24.477Z",
      "last_seen_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.477Z", "epoch_ms": 1791445104477 }
    },
    "audit": {
      "id": "8261391f-fb7b-48fc-9dc0-34686994c688",
      "created_at": "2026-10-08T07:38:24.600Z",
      "created_at_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.600Z", "epoch_ms": 1791445104600 },
      "service_name": "agentic-document-service",
      "environment": "production",
      "request_id": "a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4",
      "user_id": "3",
      "user_email": "pravin.sarule@nexintelai.com",
      "ip_address": "103.21.58.14",
      "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
      "http_method": "POST",
      "endpoint": "/api/chat/completions",
      "route": "/api/chat/completions",
      "status_code": 502,
      "status": "FAILED",
      "duration_ms": 30412,
      "error_log_id": "5544eb3d-6236-449e-bb2d-62d51969aac4",
      "error_type": "ProviderUnavailableError",
      "error_message": "Gemini returned 502 UNAVAILABLE after 3 retries",
      "user_message": "The AI service is temporarily unavailable. Please try again.",
      "action": "CREATE",
      "method": "ChatService.complete",
      "resource_type": "CHAT SESSION",
      "resource_id": "sess_77d019",
      "payload": { "method": "ChatService.complete" },
      "matched_by": "error_log_id"
    },
    "related": {
      "same_request": [
        {
          "id": "639e8980-48dc-465f-8803-ae4706df66db",
          "created_at": "2026-10-08T07:38:24.508Z",
          "created_at_ist": { "iso": "2026-10-08T13:08:24+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:24.508Z", "epoch_ms": 1791445104508 },
          "occurred_ago": "just now",
          "service_name": "agentic-document-service",
          "environment": "production",
          "source": "HTTP",
          "source_label": "HTTP request",
          "category": "INTERNAL",
          "category_label": "Internal error",
          "severity": "ERROR",
          "severity_label": "Error",
          "request_id": "a9b8c7d6e5f4a3b2c1d0e9f8a7b6c5d4",
          "user_id": "3",
          "user_email": "pravin.sarule@nexintelai.com",
          "user_email_source": "logged",
          "user_name": "Pravin",
          "user_key": "3",
          "user": { "id": 3, "email": "pravin.sarule@nexintelai.com", "username": "Pravin", "role": "user", "account_type": null, "approval_status": "APPROVED", "is_blocked": false, "is_active": true, "active_plan_name": null, "last_seen_at": "2026-09-17T10:18:29.478Z", "last_seen_at_ist": { "iso": "2026-09-17T15:48:29+05:30", "date": "17 Sep 2026", "time": "03:48 PM", "time24": "15:48", "weekday": "Thu", "display": "Thu, 17 Sep 2026, 03:48 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-09-17T10:18:29.478Z", "epoch_ms": 1789640309478 }, "registered_at": "2025-12-03T04:45:35.002Z" },
          "ip_address": "103.21.58.14",
          "endpoint": "/api/chat/completions",
          "http_method": "POST",
          "method": "chat.service.ChatService.persist",
          "action": "CHAT_COMPLETE",
          "resource_type": "chat_session",
          "resource_id": "sess_77d019",
          "status_code": 500,
          "status_class": "5xx",
          "user_message": "Internal server error",
          "error_type": "RuntimeError",
          "error_message": "failed to persist assistant message after provider error",
          "has_stack_trace": true,
          "external": null,
          "latency_ms": 18,
          "latency_display": "18 ms",
          "fingerprint": "9b74c9897bac770ffc029102a200c5de1a5f1a5f1e5d1f1b1c1d1e1f1a1b1c1d",
          "occurrence_count": 1,
          "unresolved_occurrences": 1,
          "has_payload": true,
          "origin": "server",
          "route": "/api/chat/completions",
          "recovered": false,
          "attempts": null,
          "after_response_start": false,
          "related_count": 0,
          "http_detail": null,
          "client": null,
          "is_debug": false,
          "is_resolved": false,
          "resolved_by": null,
          "resolved_at": null,
          "resolved_at_ist": null,
          "resolution_note": null,
          "timezone": "Asia/Kolkata"
        }
      ],
      "same_issue": [
        { "comment": "other rows with the same fingerprint, newest first, max 10 — same list-row shape as above" }
      ]
    },
    "timezone": "Asia/Kolkata"
  }
}
```

| Part | Meaning |
|---|---|
| `log` | The row with every column (§2), including `stack_trace`, `payload`, `external.response` |
| `issue` | Summary of all rows sharing this fingerprint (`null` when the row has no fingerprint) |
| `audit` | The `api_audit_logs` row of the request that produced this error (one audit row per request; a failed one stores `error_log_id`). Matched by `error_log_id`, else by `request_id` + service (`matched_by` says which). Carries what the admin Audit Logs table shows: `action` (VIEW/CREATE/UPDATE/DELETE), `method` (handler, e.g. `FolderService.list_folders`), `resource_type`, `resource_id`, `status` (`SUCCESS`/`FAILED`), `duration_ms`, `user_agent`, plus a copy of `error_type` / `error_message` / `user_message`. `null` for browser reports, jobs, and when the audit table is absent. |
| `related.same_request` | Other rows with the same `request_id`, oldest first, max 10 — what else failed in that request |
| `related.same_issue` | Other rows with the same `fingerprint`, newest first, max 10 |

**Error `400`** — `GET /api/admin/error-logs/not-a-uuid`

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Error log id must be a UUID" }, "requestId": "0ae3a426-1a60-4c25-8044-f62d090d7e88" }
```

**Error `404`** — `GET /api/admin/error-logs/00000000-0000-4000-8000-000000000000`

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Error log not found" }, "requestId": "d235a93e-e797-4b43-8cef-f3468004fff3" }
```

---

### 4.8 `PATCH /api/admin/error-logs/:id/resolve` — resolve / reopen one row

| Path param | |
|---|---|
| `id` | Row UUID |

**Request body** (`Content-Type: application/json`)

| Field | Type | Required | Notes |
|---|---|---|---|
| `resolved` | boolean | no, default `true` | `true` = resolve, `false` = reopen. `"true"`/`"false"`/`1`/`0`/`"yes"`/`"no"` accepted. |
| `note` | string ≤ 5000 | no | Stored as `resolution_note` when resolving; ignored when reopening |

**Request — resolve**

```bash
curl -s -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"resolved": true, "note": "Gemini outage 08 Oct 10:50-11:20 IST; retries raised to 5 in v1.4.2"}' \
  "http://localhost:4000/api/admin/error-logs/5544eb3d-6236-449e-bb2d-62d51969aac4/resolve"
```

**Response `200`** — `data.log` is the full detail row (§4.7); the fields that changed:

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "5544eb3d-6236-449e-bb2d-62d51969aac4",
      "service_name": "agentic-document-service",
      "error_type": "ProviderUnavailableError",
      "is_resolved": true,
      "resolved_by": "admin-token",
      "resolved_at": "2026-10-08T07:38:25.640Z",
      "resolved_at_ist": { "iso": "2026-10-08T13:08:25+05:30", "date": "08 Oct 2026", "time": "01:08 PM", "time24": "13:08", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 01:08 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T07:38:25.640Z", "epoch_ms": 1791445105640 },
      "resolution_note": "Gemini outage 08 Oct 10:50-11:20 IST; retries raised to 5 in v1.4.2",
      "stack_trace": "Traceback (most recent call last): ...",
      "payload": { "route": "/api/chat/completions", "retries": 3, "session_id": "sess_77d019", "prompt_tokens": 912 }
    },
    "changed": true
  }
}
```

`resolved_by` is the admin's email when the request carries a dashboard JWT, or `admin-token` for the
static token. Calling it again with `resolved: true` returns the same row with `"changed": false`
(the earlier note is kept).

**Request — reopen**

```bash
curl -s -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"resolved": false}' \
  "http://localhost:4000/api/admin/error-logs/5544eb3d-6236-449e-bb2d-62d51969aac4/resolve"
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "log": {
      "id": "5544eb3d-6236-449e-bb2d-62d51969aac4",
      "is_resolved": false,
      "resolved_by": null,
      "resolved_at": null,
      "resolved_at_ist": null,
      "resolution_note": null
    },
    "changed": true
  }
}
```

**Error `400`** — body `{"resolved": "maybe"}`

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid payload", "details": ["\"resolved\" must be a boolean"] }, "requestId": "23da184f-9565-4ee9-a5b2-c441909141e0" }
```

**Error `404`** — unknown id: `{ "success": false, "error": { "code": "NOT_FOUND", "message": "Error log not found" }, "requestId": "…" }`

---

### 4.9 `PATCH /api/admin/error-logs/resolve` — resolve / reopen many rows

**Request body** — exactly **one** of `ids` or `fingerprint`:

| Field | Type | Required | Notes |
|---|---|---|---|
| `ids` | string[] of UUIDs | one of | 1–500 ids |
| `fingerprint` | string | one of | every row with this fingerprint |
| `resolved` | boolean | no, default `true` | |
| `note` | string ≤ 5000 | no | applied to every row resolved by this call |

**Request — close every occurrence of an issue**

```bash
curl -s -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", "resolved": true, "note": "Root cause: Gemini regional outage. Retries raised to 5."}' \
  "http://localhost:4000/api/admin/error-logs/resolve"
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "resolved": true,
    "changed": 2,
    "ids": ["5544eb3d-6236-449e-bb2d-62d51969aac4", "889e5ad0-7082-47cc-9295-fc4195c5b63c"]
  }
}
```

**Request — reopen by ids**

```bash
curl -s -X PATCH -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"ids": ["5544eb3d-6236-449e-bb2d-62d51969aac4", "889e5ad0-7082-47cc-9295-fc4195c5b63c"], "resolved": false}' \
  "http://localhost:4000/api/admin/error-logs/resolve"
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "resolved": false,
    "changed": 2,
    "ids": ["889e5ad0-7082-47cc-9295-fc4195c5b63c", "5544eb3d-6236-449e-bb2d-62d51969aac4"]
  }
}
```

`changed` counts only rows whose state actually flipped; `ids` lists them. Ids that do not exist or are
already in the requested state are silently skipped (`changed` can be `0`).

**Error `400`** — body `{"resolved": true, "note": "no target"}`

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid payload", "details": ["\"value\" must contain at least one of [ids, fingerprint]"] }, "requestId": "5cf41c80-2dad-442a-9931-090b9be06ead" }
```

Sending both `ids` and `fingerprint` also fails with `400` (`"value" contains a conflict between exclusive peers [ids, fingerprint]`).

---

### 4.10 `DELETE /api/admin/error-logs/:id` — delete one row

`super-admin` / `admin` only. Resolving is the normal workflow; delete is for test noise.

**Request**

```bash
curl -s -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/error-logs/639e8980-48dc-465f-8803-ae4706df66db"
```

**Response `200`**

```json
{ "success": true, "data": { "deleted": 1, "ids": ["639e8980-48dc-465f-8803-ae4706df66db"] } }
```

**Error `404`** — same call again

```json
{ "success": false, "error": { "code": "NOT_FOUND", "message": "Error log not found" }, "requestId": "60080cb3-5bca-42fe-9cad-e6847656f351" }
```

---

### 4.11 `POST /api/admin/error-logs/bulk-delete` — delete many rows

`super-admin` / `admin` only.

**Request body** — exactly **one** of:

| Field | Type | Notes |
|---|---|---|
| `ids` | string[] of UUIDs | 1–500 ids |
| `fingerprint` | string | every row with this fingerprint |

**Request**

```bash
curl -s -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"fingerprint": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"}' \
  "http://localhost:4000/api/admin/error-logs/bulk-delete"
```

**Response `200`**

```json
{
  "success": true,
  "data": {
    "deleted": 2,
    "ids": ["5544eb3d-6236-449e-bb2d-62d51969aac4", "889e5ad0-7082-47cc-9295-fc4195c5b63c"]
  }
}
```

Unknown ids are skipped; `deleted` can be `0`.

**Error `400`** — body `{"ids": ["not-a-uuid"]}`

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid payload", "details": ["each id must be a UUID"] }, "requestId": "8c1c81ba-0f1a-4723-9d5a-de659d475b1f" }
```

---

### 4.12 Authentication errors (any endpoint)

**No `Authorization` header → `401`**

```json
{ "success": false, "error": { "code": "UNAUTHORIZED", "message": "Authorization header required: Bearer <token>" }, "requestId": "2fb80090-7cb2-41b4-ae65-4ce55aa8499e" }
```

**Wrong token → `403`**

```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Invalid admin token" }, "requestId": "1f422368-d6f1-4574-b4a6-92d55ad389a4" }
```

**Valid JWT, role not allowed (e.g. `marketing-admin`) → `403`**

```json
{ "success": false, "error": { "code": "FORBIDDEN", "message": "Access denied: requires one of super-admin, admin" }, "requestId": "…" }
```

**Expired JWT → `401`** with `"message": "Token expired"`.

---

## 5. Workflows

**"What errors did this user get?"**

1. `GET /?user=<email or id>` — the id/email is resolved through the Auth DB, so this finds the rows
   whichever identifier the service logged. Each row shows `user_message` (what they saw),
   `error_message` (what actually happened) and the user's `user_email` / `user_name`.
2. Open a row with `GET /:id` for the stack trace and `related.same_request` (everything else that failed
   in that request).

**Triage an issue**

1. `GET /issues?resolved=false` — most frequent open issues, with `affected_users`.
2. `GET /:latest_id` — stack trace, payload, provider response.
3. `GET /?fingerprint=<fp>&sort=oldest` — when it started, who it hit.
4. Fix, then `PATCH /resolve { "fingerprint": "<fp>", "note": "…" }`.

**Browser-side failures** (what the user actually saw in the app): `GET /?origin=browser&user=<email>` — rows with
`client.kind` (`network`, `unhandled`, `render`, `cancelled`, …), `client.page` (the SPA route) and, for Razorpay,
`external.provider = RAZORPAY` with `order_id` / `payment_id` / plan in `payload`.

**Daily check**: `GET /stats` → `totals.unresolved`, `totals.last_24h`, `totals.affected_users_24h`,
`totals.critical_unresolved`, `daily_trend`.

**Clean up test rows**: `GET /?search=errorlog%20debug` → `POST /bulk-delete { "ids": [...] }`.

---

## 6. Postman / testing

1. Environment: `baseUrl = http://localhost:4000`, `adminToken = <ADMIN_TOKEN from Backend/.env>`.
2. Collection auth: Bearer `{{adminToken}}`.
3. Automated suite (needs a running backend):

```bash
cd Backend
ADMIN_TOKEN=<token> BASE_URL=http://localhost:4000 npm run test:admin-api
```

Group **I) Error Logs** runs 21 cases (stats, meta, list + filters + validation, users, issues, export,
detail + 400/404, resolve, reopen, bulk resolve by ids and by fingerprint, bulk-validation, delete 404) and
restores any row it touched. The report is written to `Backend/api_test_report.md`.

---

## 7. Activity & Error Logs — `/api/admin/audit-logs` (`api_audit_logs`)

One row per API call across every backend service, plus one row per error that happened outside a
request (background jobs, process crashes, browser-side errors, cancelled / failed payments).
Successful calls have empty error columns; failed ones carry the error on the same row and link to
`error_logs` through `error_log_id` (several ids in `payload.error_log_ids` when one request stored
more than one error).

| | |
|---|---|
| Database / table | **Document_DB** → `public.api_audit_logs` (same docPool as `error_logs`) |
| Owner | agentic-document-service (migrations 184, 185, 186). This backend **only reads** the table. Missing table → `503 AUDIT_LOGS_TABLE_MISSING`. |
| Auth / roles | Same as error logs: `Authorization: Bearer <ADMIN_TOKEN or dashboard JWT>`; `super-admin`, `admin`. Read-only — there is no resolve or delete. |
| Default window | When neither `from` nor `since_hours` is given, the **last 7 days**. |
| Pings | `/api/auth/activity/ping` rows are hidden by default (`exclude_pings=true`); pass `exclude_pings=false` to see them. |
| Retention | Rows older than `ERROR_LOG_AUDIT_RETENTION_DAYS` (90) are deleted daily by the owner. |
| `stack_trace` | Returned **only** by `GET /:id`. The list and the CSV never include it. |

### 7.1 Endpoint index

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/audit-logs/summary` | Per-service calls / failed / failure rate / avg + p50 + p95 duration, top 20 APIs, top 20 users, breakdowns, daily trend |
| GET | `/api/admin/audit-logs/meta` | Distinct services, resource types, actions, HTTP methods, error types + defaults / limits |
| GET | `/api/admin/audit-logs` | Paginated list, newest first |
| GET | `/api/admin/audit-logs/export` | CSV of the same list, max 50 000 rows |
| GET | `/api/admin/audit-logs/:id` | Full row incl. `stack_trace` + the linked `error_logs` row(s) |

### 7.2 The audit row object

| Field | Type | Meaning |
|---|---|---|
| `id` | uuid | Row id |
| `created_at`, `created_at_ist`, `occurred_ago` | timestamp | When the request finished |
| `service_name`, `environment` | string | Which service answered |
| `request_id` | string\|null | The `x-request-id` the client received — same id on that request's `error_logs` rows |
| `user_id`, `user_email`, `user_email_source`, `user_name`, `user_key`, `user` | | Who, as in error logs: recorded values, with email / name filled from the Auth DB when only the id was logged; `user` is the enriched Auth-DB account or `null` (unauthenticated / service-to-service calls) |
| `ip_address`, `user_agent` | string\|null | Client |
| `kind` | string | `request` (normal API call) · `browser` (frontend report, endpoint `client:<flow>`) · `job` (`job:` / `cron:` / `process:` endpoints or no HTTP method) |
| `http_method`, `endpoint`, `route`, `api` | | The API: verb, actual path, route template (`/api/files/{folder_name}/upload`), and `"<verb> <path>"` for display |
| `action` | string\|null | `VIEW` / `CREATE` / `UPDATE` / `DELETE` (from the verb) |
| `resource_type`, `resource_id` | string\|null | `STORAGE FOLDER`, `CASE`, `FILE`, `USER`, `CHAT`, `PLAN`, … and the id when a `*_id` / `*_name` path param exists |
| `method` | string\|null | Handler shown in the admin console, e.g. `FolderService.list_folders` (not the HTTP verb) |
| `status`, `failed` | string, bool | `SUCCESS` or `FAILED` (4xx / 5xx, or an error row was written) |
| `status_code`, `status_class` | int\|null | HTTP status and `2xx` / `4xx` / `5xx` |
| `duration_ms`, `duration_display` | int\|null | How long the call took |
| `streaming` | bool | `payload.streaming` — the response was a stream |
| `error_log_id`, `error_log_ids` | uuid\|null, uuid[] | Link(s) to `error_logs` for a failed call (`[]` on success) |
| `error_type`, `error_message`, `user_message` | string\|null | The failure (exact internal error, and what the user saw); all `null` on success |
| `has_stack_trace` | bool | Whether `stack_trace` exists; the text itself is **detail only** |
| `stack_trace` | string\|null | **detail only** |
| `source`, `category`, `severity`, `external_provider` | string\|null | Classification the services may put in `payload` (`HTTP` / `JOB` / `PROCESS` / `EXTERNAL_API`, …); `null` when absent |
| `payload` | object\|null | Raw metadata: `method`, `streaming`, `error_log_ids`, … |
| `timezone` | string | `Asia/Kolkata` |

### 7.3 Filters (list, export, summary)

| Param | Type | Default | Notes |
|---|---|---|---|
| `from`, `to` | `YYYY-MM-DD` or ISO date-time | last 7 days · now | A plain date is an **IST calendar day** (`to` inclusive: the bound becomes the next day's start, echoed as `to_bound: "exclusive"`); an ISO date-time is used as-is (`to` inclusive) |
| `since_hours` | int 1–8784 | — | Rolling window; overrides `from` |
| `user` | string | — | email (contains, case-insensitive) or user id (exact); also resolved through the Auth DB, so an id finds rows that logged only the email and vice versa; echoed as `user_resolved` |
| `service` | csv | all | `service_name` values |
| `environment` | csv | all | |
| `status` | `SUCCESS` · `FAILED` · `ALL` | all | |
| `method` | csv | all | HTTP verbs, e.g. `POST,PUT` |
| `endpoint` | string | — | **prefix** match, case-insensitive (`/api/files`) |
| `route` | string | — | contains match on the route template (falls back to the path) |
| `resource_type` | csv | all | e.g. `STORAGE FOLDER,CASE` (case-insensitive) |
| `action` | csv | all | `VIEW,CREATE,UPDATE,DELETE` |
| `request_id` | string | — | exact — every row of one request across services |
| `error_log_id` | uuid | — | the audit row(s) that produced one error |
| `error_type` | string | — | exact, case-insensitive |
| `status_code` | csv int | all | `401,404` |
| `status_class` | `2xx` · `3xx` · `4xx` · `5xx` | — | |
| `q` | string ≤ 200 | — | contains, case-insensitive, across endpoint, route, method, error_type, error_message, user_message, user_email, request_id, resource_id |
| `exclude_pings` | bool | `true` | hide `/api/auth/activity/ping` |
| `kind` | `request` · `browser` · `job` · `all` | all | |
| `min_duration_ms` | int | — | slow calls only |
| `page`, `page_size` (alias `limit`) | int | `1`, `50` | max 200 (list / export only) |
| `sort` | string | `newest` | `newest` · `oldest` · `slowest` · `status` (failed first) · `service` · `user` (list / export only) |

Every response echoes the applied filters under `data.filters` (including the resolved `from` / `to` in UTC and IST).

### 7.4 `GET /api/admin/audit-logs/summary`

**Request**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/audit-logs/summary?from=2026-10-08&to=2026-10-08"
```

**Response `200`** (shape captured from a live run; arrays trimmed, counts illustrative)

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "generated_at": "2026-10-08T11:56:40.000Z",
    "generated_at_ist": { "iso": "2026-10-08T17:26:40+05:30", "date": "08 Oct 2026", "time": "05:26 PM", "time24": "17:26", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 05:26 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T11:56:40.000Z", "epoch_ms": 1791460600000 },
    "period": {
      "from": "2026-10-07T18:30:00.000Z",
      "from_ist": { "iso": "2026-10-08T00:00:00+05:30", "date": "08 Oct 2026", "time": "12:00 AM", "time24": "00:00", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 12:00 AM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-07T18:30:00.000Z", "epoch_ms": 1791397800000 },
      "to": "2026-10-08T18:30:00.000Z",
      "to_ist": { "iso": "2026-10-09T00:00:00+05:30", "date": "09 Oct 2026", "time": "12:00 AM", "time24": "00:00", "weekday": "Fri", "display": "Fri, 09 Oct 2026, 12:00 AM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T18:30:00.000Z", "epoch_ms": 1791484200000 },
      "since_hours": null
    },
    "filters": { "from": "2026-10-07T18:30:00.000Z", "to": "2026-10-08T18:30:00.000Z", "to_bound": "exclusive", "user": null, "user_resolved": null, "service": "all", "status": "all", "exclude_pings": true, "kind": "all", "q": null, "timezone": "Asia/Kolkata" },
    "totals": {
      "calls": 268,
      "succeeded": 218,
      "failed": 50,
      "failure_rate_pct": 18.7,
      "http_4xx": 48,
      "http_5xx": 2,
      "distinct_users": 2,
      "users_with_failures": 2,
      "services": 4,
      "distinct_apis": 31,
      "browser": 0,
      "jobs": 0,
      "avg_ms": 1240,
      "p50_ms": 224,
      "p95_ms": 2613,
      "max_ms": 9120,
      "first_call_at": "2026-10-08T10:17:38.427Z",
      "first_call_at_ist": { "iso": "2026-10-08T15:47:38+05:30", "date": "08 Oct 2026", "time": "03:47 PM", "time24": "15:47", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 03:47 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T10:17:38.427Z", "epoch_ms": 1791454658427 },
      "last_call_at": "2026-10-08T11:36:31.396Z",
      "last_call_at_ist": { "iso": "2026-10-08T17:06:31+05:30", "date": "08 Oct 2026", "time": "05:06 PM", "time24": "17:06", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 05:06 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T11:36:31.396Z", "epoch_ms": 1791459391396 },
      "most_used_api": { "service_name": "agentic-document-service", "http_method": "GET", "route": "/api/files/folders", "endpoint": "/api/files/folders", "calls": 20, "failed": 0 }
    },
    "per_service": [
      { "service_name": "agentic-document-service", "calls": 109, "failed": 15, "avg_ms": 2729, "p50_ms": 1549, "p95_ms": 3685, "max_ms": 9120, "users": 2, "apis": 18, "last_call_at": "2026-10-08T11:36:31.396Z", "last_call_at_ist": { "iso": "2026-10-08T17:06:31+05:30", "date": "08 Oct 2026", "time": "05:06 PM", "time24": "17:06", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 05:06 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T11:36:31.396Z", "epoch_ms": 1791459391396 }, "failure_rate_pct": 13.8 },
      { "service_name": "payment-service", "calls": 60, "failed": 17, "avg_ms": 248, "p50_ms": 192, "p95_ms": 369, "max_ms": 1180, "users": 2, "apis": 6, "last_call_at": "2026-10-08T11:33:28.733Z", "last_call_at_ist": { "iso": "2026-10-08T17:03:28+05:30", "date": "08 Oct 2026", "time": "05:03 PM", "time24": "17:03", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 05:03 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T11:33:28.733Z", "epoch_ms": 1791459208733 }, "failure_rate_pct": 28.3 }
    ],
    "top_endpoints": [
      { "service_name": "agentic-document-service", "http_method": "GET", "route": "/api/files/folders", "endpoint": "/api/files/folders", "method": "FolderService.list_folders", "action": "VIEW", "resource_type": "STORAGE FOLDER", "calls": 20, "failed": 0, "avg_ms": 2214, "p50_ms": 2074, "users": 2, "last_call_at": "2026-10-08T11:31:49.233Z", "last_call_at_ist": { "iso": "2026-10-08T17:01:49+05:30", "date": "08 Oct 2026", "time": "05:01 PM", "time24": "17:01", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 05:01 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T11:31:49.233Z", "epoch_ms": 1791459109233 }, "failure_rate_pct": 0 }
    ],
    "top_users": [
      { "user_key": "76", "user_id": "76", "user_email": "pk@gmail.com", "user_name": "PK", "user": { "id": 76, "email": "pk@gmail.com", "username": "PK", "role": "user", "account_type": "SOLO", "approval_status": "APPROVED", "is_blocked": false, "is_active": true, "active_plan_name": "Pro", "last_seen_at": "2026-10-08T11:46:44.307Z", "last_seen_at_ist": { "iso": "2026-10-08T17:16:44+05:30", "date": "08 Oct 2026", "time": "05:16 PM", "time24": "17:16", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 05:16 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T11:46:44.307Z", "epoch_ms": 1791460004307 }, "registered_at": "2026-05-18T06:12:19.363Z" }, "calls": 144, "failed": 36, "services": ["agentic-document-service", "authservice", "gateway-service", "payment-service"], "apis": 27, "avg_ms": 1310, "first_call_at": "2026-10-08T10:17:38.427Z", "first_call_at_ist": { "iso": "2026-10-08T15:47:38+05:30", "date": "08 Oct 2026", "time": "03:47 PM", "time24": "15:47", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 03:47 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T10:17:38.427Z", "epoch_ms": 1791454658427 }, "last_call_at": "2026-10-08T11:33:28.742Z", "last_call_at_ist": { "iso": "2026-10-08T17:03:28+05:30", "date": "08 Oct 2026", "time": "05:03 PM", "time24": "17:03", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 05:03 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T11:33:28.742Z", "epoch_ms": 1791459208742 }, "last_endpoint": "/api/files/Krishnaji_Atmaram_Anandwade_vs_Onkar_Sakhar_Karkhana_Pvt._Ltd./intelligent-chat/stream", "last_http_method": "POST", "failure_rate_pct": 25 }
    ],
    "by_action": [ { "value": "CREATE", "calls": 95, "failed": 20 }, { "value": "VIEW", "calls": 86, "failed": 14 }, { "value": "UNKNOWN", "calls": 83, "failed": 16 }, { "value": "UPDATE", "calls": 4, "failed": 0 } ],
    "by_resource_type": [ { "value": "UNKNOWN", "calls": 147, "failed": 33 }, { "value": "STORAGE FOLDER", "calls": 89, "failed": 15 }, { "value": "USER", "calls": 18, "failed": 2 } ],
    "by_status_code": [ { "value": 200, "calls": 210 }, { "value": 404, "calls": 31 }, { "value": 429, "calls": 12 }, { "value": 401, "calls": 5 } ],
    "by_environment": [ { "value": "development", "calls": 268, "failed": 50 } ],
    "daily_trend": [ { "date": "2026-10-08", "label": "08 Oct", "calls": 268, "failed": 50, "users": 2, "avg_ms": 1240 } ],
    "slowest": [ { "comment": "up to 5 slowest calls in the period, each a full audit row object (7.2), no stack_trace" } ]
  }
}
```

`UNKNOWN` in `by_action` / `by_resource_type` means the service did not classify the call (`null` in the row).

### 7.5 `GET /api/admin/audit-logs/meta`

```json
{
  "success": true,
  "data": {
    "timezone": "Asia/Kolkata",
    "vocab": { "statuses": ["SUCCESS", "FAILED"], "actions": ["VIEW", "CREATE", "UPDATE", "DELETE"], "kinds": ["request", "job", "browser"], "status_classes": ["2xx", "3xx", "4xx", "5xx"] },
    "used": {
      "services": [ { "value": "agentic-document-service", "count": 186 }, { "value": "authservice", "count": 149 }, { "value": "payment-service", "count": 70 }, { "value": "gateway-service", "count": 41 } ],
      "environments": [ { "value": "development", "count": 446 } ],
      "resource_types": [ { "value": "STORAGE FOLDER", "count": 89 }, { "value": "USER", "count": 63 }, { "value": "CASE", "count": 10 }, { "value": "CHAT", "count": 3 }, { "value": "FILE", "count": 1 }, { "value": "PLAN", "count": 2 } ],
      "actions": [ { "value": "CREATE", "count": 162 }, { "value": "VIEW", "count": 139 }, { "value": "UPDATE", "count": 4 } ],
      "http_methods": [ { "value": "POST", "count": 250 }, { "value": "GET", "count": 192 }, { "value": "PUT", "count": 4 } ],
      "statuses": [ { "value": "SUCCESS", "count": 396 }, { "value": "FAILED", "count": 50 } ],
      "error_types": [ { "value": "HttpErrorResponse405", "count": 1 } ],
      "methods": [ { "value": "FolderService.list_folders", "count": 20 } ]
    },
    "sort_options": ["newest", "oldest", "slowest", "status", "service", "user"],
    "defaults": { "page_size": 50, "window_hours": 168, "exclude_pings": true, "ping_endpoint": "/api/auth/activity/ping" },
    "limits": { "max_page_size": 200, "max_export_rows": 50000 }
  }
}
```

### 7.6 `GET /api/admin/audit-logs` — list

**Request — one user's failed calls today**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/audit-logs?user=pk@gmail.com&status=FAILED&from=2026-10-08&to=2026-10-08&page_size=20"
```

**Response `200`** (shape captured from a live run; one row shown)

```json
{
  "success": true,
  "data": {
    "rows": [
      {
        "id": "04ed84e7-ddf2-4660-88e7-36a379932efc",
        "created_at": "2026-10-08T11:33:28.742Z",
        "created_at_ist": { "iso": "2026-10-08T17:03:28+05:30", "date": "08 Oct 2026", "time": "05:03 PM", "time24": "17:03", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 05:03 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T11:33:28.742Z", "epoch_ms": 1791459208742 },
        "occurred_ago": "23m",
        "service_name": "agentic-document-service",
        "environment": "development",
        "request_id": "3a2fd3c6c9ab4b0aa0a7a1c5b7f2e9d1",
        "user_id": "76",
        "user_email": "pk@gmail.com",
        "user_email_source": "logged",
        "user_name": "PK",
        "user_key": "76",
        "user": { "id": 76, "email": "pk@gmail.com", "username": "PK", "role": "user", "account_type": "SOLO", "approval_status": "APPROVED", "is_blocked": false, "is_active": true, "active_plan_name": "Pro", "last_seen_at": "2026-10-08T11:46:44.307Z", "last_seen_at_ist": { "iso": "2026-10-08T17:16:44+05:30", "date": "08 Oct 2026", "time": "05:16 PM", "time24": "17:16", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 05:16 PM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T11:46:44.307Z", "epoch_ms": 1791460004307 }, "registered_at": "2026-05-18T06:12:19.363Z" },
        "ip_address": "127.0.0.1",
        "user_agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36",
        "kind": "request",
        "http_method": "POST",
        "endpoint": "/api/files/Krishnaji_Atmaram_Anandwade_vs_Onkar_Sakhar_Karkhana_Pvt._Ltd./intelligent-chat/stream",
        "route": null,
        "api": "POST /api/files/Krishnaji_Atmaram_Anandwade_vs_Onkar_Sakhar_Karkhana_Pvt._Ltd./intelligent-chat/stream",
        "action": "CREATE",
        "resource_type": "STORAGE FOLDER",
        "resource_id": null,
        "method": "FolderService.create_stream",
        "status": "FAILED",
        "failed": true,
        "status_code": 429,
        "status_class": "4xx",
        "duration_ms": 2573,
        "duration_display": "2,573 ms",
        "streaming": false,
        "error_log_id": "fa64507e-65c3-466f-bcc9-84ac39745fc3",
        "error_log_ids": ["fa64507e-65c3-466f-bcc9-84ac39745fc3", "ca0ba4b7-523a-4579-9e3a-49d5425da5ce"],
        "error_type": null,
        "error_message": null,
        "user_message": null,
        "has_stack_trace": false,
        "source": null,
        "category": null,
        "severity": null,
        "external_provider": null,
        "payload": { "method": "FolderService.create_stream", "error_log_ids": ["fa64507e-65c3-466f-bcc9-84ac39745fc3", "ca0ba4b7-523a-4579-9e3a-49d5425da5ce"] },
        "timezone": "Asia/Kolkata"
      }
    ],
    "total": 36,
    "page": 1,
    "page_size": 20,
    "total_pages": 2,
    "filters": {
      "from": "2026-10-07T18:30:00.000Z",
      "from_ist": { "iso": "2026-10-08T00:00:00+05:30", "date": "08 Oct 2026", "time": "12:00 AM", "time24": "00:00", "weekday": "Thu", "display": "Thu, 08 Oct 2026, 12:00 AM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-07T18:30:00.000Z", "epoch_ms": 1791397800000 },
      "to": "2026-10-08T18:30:00.000Z",
      "to_ist": { "iso": "2026-10-09T00:00:00+05:30", "date": "09 Oct 2026", "time": "12:00 AM", "time24": "00:00", "weekday": "Fri", "display": "Fri, 09 Oct 2026, 12:00 AM IST", "timezone": "Asia/Kolkata", "utc": "2026-10-08T18:30:00.000Z", "epoch_ms": 1791484200000 },
      "to_bound": "exclusive",
      "since_hours": null,
      "user": "pk@gmail.com",
      "user_resolved": { "id": 76, "email": "pk@gmail.com", "username": "PK" },
      "service": "all", "environment": "all", "status": "FAILED", "method": "all",
      "endpoint": null, "route": null, "resource_type": "all", "action": "all",
      "request_id": null, "error_log_id": null, "error_type": null, "status_code": "all", "status_class": null,
      "q": null, "exclude_pings": true, "kind": "all", "min_duration_ms": null,
      "timezone": "Asia/Kolkata",
      "sort": "newest"
    },
    "timezone": "Asia/Kolkata"
  }
}
```

A row can be `FAILED` with empty `error_type` / `error_message` when the service recorded the failure only in
`error_logs` (follow `error_log_id`, or open the detail which returns the linked error). Useful queries:

| Need | Query |
|---|---|
| What one user did today | `?user=<email or id>&from=<today>&to=<today>` |
| Only failures, slowest first | `?status=FAILED&sort=slowest` |
| Everything in one request across services | `?request_id=<id>&sort=oldest` |
| One API's calls | `?endpoint=/api/files/folders` (prefix) or `?route=/api/files/{folder_name}` |
| Activity pings included | `?exclude_pings=false` |
| Browser-reported errors only | `?kind=browser` |
| Calls slower than 2 s | `?min_duration_ms=2000&sort=slowest` |

**Error `400`** — e.g. `?status=NOPE&from=yesterday`

```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "Invalid query parameters", "details": ["\"status\" must be one of [SUCCESS, FAILED, ALL, ]"] }, "requestId": "…" }
```

(`from` is checked after the Joi pass; alone it yields `"from" must be YYYY-MM-DD (IST day) or an ISO date-time`.)

### 7.7 `GET /api/admin/audit-logs/export`

Same filters as the list (`page` / `page_size` ignored). At most **50 000** rows; `X-Total-Rows` / `X-Exported-Rows` say
whether it was truncated. `Content-Disposition: attachment; filename="audit-logs-YYYY-MM-DD-HHMM-IST.csv"`.

```
ID,Timestamp (IST),Date (IST),Time (IST),User email,User id,User name,Service,Environment,Action,Resource type,Resource id,Method (handler),HTTP method,Endpoint,Route,Kind,Status,Code,Duration (ms),IP address,User agent,Request id,Error type,Error message,User message,Error log id,Timestamp (UTC)
```

### 7.8 `GET /api/admin/audit-logs/:id` — detail

Full row (adds `stack_trace`) plus the linked `error_logs` row(s), each in the error-log detail shape (§2, with
`stack_trace`, `payload`, `external.response`).

**Request**

```bash
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:4000/api/admin/audit-logs/04ed84e7-ddf2-4660-88e7-36a379932efc"
```

**Response `200`** (shape captured from a live run; nested rows trimmed to key fields)

```json
{
  "success": true,
  "data": {
    "audit": {
      "id": "04ed84e7-ddf2-4660-88e7-36a379932efc",
      "status": "FAILED",
      "status_code": 429,
      "service_name": "agentic-document-service",
      "api": "POST /api/files/Krishnaji_Atmaram_Anandwade_vs_Onkar_Sakhar_Karkhana_Pvt._Ltd./intelligent-chat/stream",
      "method": "FolderService.create_stream",
      "action": "CREATE",
      "resource_type": "STORAGE FOLDER",
      "user_email": "pk@gmail.com",
      "user_name": "PK",
      "duration_ms": 2573,
      "error_log_id": "fa64507e-65c3-466f-bcc9-84ac39745fc3",
      "error_log_ids": ["fa64507e-65c3-466f-bcc9-84ac39745fc3", "ca0ba4b7-523a-4579-9e3a-49d5425da5ce"],
      "error_type": null,
      "error_message": null,
      "user_message": null,
      "has_stack_trace": false,
      "stack_trace": null,
      "payload": { "method": "FolderService.create_stream", "error_log_ids": ["fa64507e-65c3-466f-bcc9-84ac39745fc3", "ca0ba4b7-523a-4579-9e3a-49d5425da5ce"] },
      "comment": "…plus every other field of the row object (7.2)"
    },
    "error": {
      "id": "fa64507e-65c3-466f-bcc9-84ac39745fc3",
      "service_name": "agentic-document-service",
      "source": "EXTERNAL_API",
      "category": "EXTERNAL_API",
      "severity": "WARNING",
      "error_type": "HttpStatus401",
      "error_message": "PAYMENT call failed (HTTP 401)",
      "external": { "provider": "PAYMENT", "endpoint": "http://localhost:5002/api/user-resources/internal/token-check", "model": null, "status_code": 401, "error_code": null, "has_response": true, "response": "{\"error\":\"Authentication token required\"}" },
      "stack_trace": null,
      "comment": "…the linked error_logs row in the error-log detail shape (§2)"
    },
    "errors": [
      { "id": "fa64507e-65c3-466f-bcc9-84ac39745fc3", "comment": "same as `error`" },
      { "id": "ca0ba4b7-523a-4579-9e3a-49d5425da5ce", "error_type": "HttpErrorResponse429", "comment": "second error stored for the same request" }
    ],
    "timezone": "Asia/Kolkata"
  }
}
```

| Part | Meaning |
|---|---|
| `audit` | The row with every column, including `stack_trace` |
| `error` | The `error_logs` row `error_log_id` points at (or the first linked one); `null` on success |
| `errors` | Every linked error row (`error_log_id` ∪ `payload.error_log_ids`), oldest first |

`400` if `:id` is not a UUID, `404` if unknown.

### 7.9 Testing

`npm run test:admin-api` → group **J) Activity & Error Logs** (11 cases: summary, meta, list, pings included,
FAILED only, user filter, validation, CSV export, detail 400 / 404, detail with linked error). Read-only — the
run changes nothing in the table.
