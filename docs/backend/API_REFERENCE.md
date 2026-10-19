# Backend API reference

Generated from the router files on 2026-10-19 — 431 endpoints across 51 mounts.

- Every endpoint is served at its **legacy path** and at the **versioned path** (`/api/v1/…`, recommended for new clients). Paths below are the legacy ones; the v1 path is the same with the prefix shown in each section.
- **Auth**: *JWT* = dashboard login token (`Authorization: Bearer …`, verified by `src/shared/middleware/authMiddleware.js` / `adminAuth.middleware.js`); *API key* = static `ADMIN_TOKEN` / module API key; blank = public. **Roles** are the `authorize([...])` list that guards the route (super-admin always passes).
- Envelopes: `{ success: true, data }` on success; `{ success: false, message }` or `{ success: false, error: { code, message, details? }, requestId }` on failure. Dates are ISO 8601 UTC; IST calendar-day filters are inclusive.
- Source of truth for mounts: `Backend/src/routes/v1/index.js`. Deep-dive docs: [Users & Plans + reconciliation](../finance-users-plans-and-reconciliation.md), [Sales referrals](../sales-referrals-admin-api.md), [Referral data](../REFERRAL_DATA_API.md), [Onboarded users](../ONBOARDED_USERS_API.md), [Error logs](../ERROR_LOGS_API.md), [Jurinex Voice](jurinex-voice/README.md).

## Contents

- [`/api/public/contact`](#api-public-contact) — "Contact Jurinex" form intake (Main DB, rate-limited, own CORS) (2)
- [`/api/public/newsletter`](#api-public-newsletter) — Website newsletter subscribe (Main DB, rate-limited, own CORS) (2)
- [`/api/public/promos`](#api-public-promos) — Website header offers/events (Main DB, own CORS) (4)
- [`/api/admins`](#api-admins) — Admin accounts (Main DB) (4)
- [`/api/system-prompts`](#api-system-prompts) — Using docDB (docPool) for data, Main DB (pool) for auth (6)
- [`/api/prompt-roles`](#api-prompt-roles) — Using docDB (docPool) for data, Main DB (pool) for auth (6)
- [`/api/user-preset-prompts`](#api-user-preset-prompts) — Using docDB (docPool) for prompts, Main DB (pool) for auth + user lookup (7)
- [`/api/app-roles`](#api-app-roles) — Using Main DB (pool) — Jurinex application roles (4)
- [`/api/agent-prompts`](#api-agent-prompts) — Using draftDB for data, Main DB (pool) for auth (5)
- [`/api/auth`](#api-auth) — Using Main DB (pool) (2)
- [`/api/users`](#api-users) — Using Main DB (pool) (15)
- [`/api/admin/templates`](#api-admin-templates) — Using Draft DB (2)
- [`/api/citation-admin`](#api-citation-admin) — Using Citation DB + Auth DB + docDB + Citation Cost DB (29)
- [`/api/admin/plans`](#api-admin-plans) — Using Payment DB (paymentPool) (5)
- [`/api/admin/monthly-plans`](#api-admin-monthly-plans) — Using Payment DB (paymentPool) (5)
- [`/api/admin/topup-plans`](#api-admin-topup-plans) — Using Payment DB (paymentPool) (5)
- [`/api/admin/addon-plans`](#api-admin-addon-plans) — Using Payment DB (paymentPool) (5)
- [`/api/admin/user-analytics`](#api-admin-user-analytics) — Read-only across Auth+Payment+Document+Draft+Citation DBs (5)
- [`/api/admin/plan-analytics`](#api-admin-plan-analytics) — Read-only plan purchase analytics (Auth + Payment DBs) (11)
- [`/api/admin/users-plans`](#api-admin-users-plans) — Finance Admin Users & Plans (GST, invoices, attribution, transactions) (7)
- [`/api/admin/reconciliation`](#api-admin-reconciliation) — Razorpay ↔ Payment DB reconciliation runs, issues, audit history (12)
- [`/api/support-queries`](#api-support-queries) — Using Main DB (pool) (7)
- [`/api/support-priorities`](#api-support-priorities) — Using Support DB (supportSequelize) (5)
- [`/api/support-admin`](#api-support-admin) — Using Support DB + Main DB auth (7)
- [`/api/secrets`](#api-secrets) — Using docDB (docPool) (8)
- [`/api/contents`](#api-contents) — Using docDB (docPool) (30)
- [`/api/llm`](#api-llm) — LLM models (docDB) with Main DB auth (9)
- [`/api/chunking-methods`](#api-chunking-methods) — Using docDB (docPool) (2)
- [`/api/llm-usage`](#api-llm-usage) — Using Payment DB (paymentPool) (3)
- [`/api/token-usage`](#api-token-usage) — Using Payment DB (paymentPool) (9)
- [`/api/file`](#api-file) — Using Main DB (pool) (4)
- [`/api/judgements-admin`](#api-judgements-admin) — Proxying protected admin uploads to judgement-service () (28)
- [`/api/admin/health`](#api-admin-health) — Health check (no auth) (1)
- [`/api/admin/users`](#api-admin-users) — Using Auth DB (pool) (6)
- [`/api/admin/llm-config`](#api-admin-llm-config) — Using docDB (docPool) for config, Main DB (pool) for auth (4)
- [`/api/admin/summarization-chat-config`](#api-admin-summarization-chat-config) — Using docDB (docPool) for config, Main DB (pool) for auth (4)
- [`/api/admin`](#api-admin) — AI Document Processing (GCS + Document AI + Gemini Embeddings) (5)
- [`/api/admin/chatbot-config`](#api-admin-chatbot-config) — Chatbot model & voice configuration (3)
- [`/api/admin/chatbot-token-usage`](#api-admin-chatbot-token-usage) — Chatbot token usage & cost analytics (SSE) (2)
- [`/api/admin/chat-history`](#api-admin-chat-history) — All chatbot sessions & messages (2)
- [`/api/admin/demo`](#api-admin-demo) — Demo booking & slot management (6)
- [`/api/admin/contact-enquiries`](#api-admin-contact-enquiries) — Marketing: "Contact Jurinex" form enquiries (9)
- [`/api/admin/newsletter-subscribers`](#api-admin-newsletter-subscribers) — Marketing: website newsletter list (4)
- [`/api/admin/promos`](#api-admin-promos) — Marketing: header offers & events (7)
- [`/api/admin/error-logs`](#api-admin-error-logs) — Platform error logs (Document_DB error_logs) (12)
- [`/api/admin/audit-logs`](#api-admin-audit-logs) — Activity & Error Logs (Document_DB api_audit_logs) (5)
- [`/api/admin/onboarded-users`](#api-admin-onboarded-users) — Users by onboarding channel + subscription history, CSV (5)
- [`/api/admin/sales-referrals/data`](#api-admin-sales-referrals-data) — All referral data: workspaces + plan purchases + CSV (7)
- [`/api/admin/sales-referrals`](#api-admin-sales-referrals) — Sales owners, referral codes, attribution reports (20)
- [`/admin/jurinex-voice`](#admin-jurinex-voice) — Voice agent management + KB (jurinex-voice-docs bucket) (37)
- [`/api/admin/jurinex-voice`](#api-admin-jurinex-voice) — Voice agent management (standard /api base) (37)

## Liveness

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/healthz` | — | Process liveness (no DB) |

## `/api/public/contact`

"Contact Jurinex" form intake (Main DB, rate-limited, own CORS)  
Versioned prefix: `/api/v1/public/contact` · Router: `Backend/src/modules/marketing/publicContact.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/public/contact/health` | own CORS | — | — |
| POST | `/api/public/contact` | own CORS | — | — |

## `/api/public/newsletter`

Website newsletter subscribe (Main DB, rate-limited, own CORS)  
Versioned prefix: `/api/v1/public/newsletter` · Router: `Backend/src/modules/marketing/publicNewsletter.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/public/newsletter/health` | own CORS | — | — |
| POST | `/api/public/newsletter` | own CORS | — | — |

## `/api/public/promos`

Website header offers/events (Main DB, own CORS)  
Versioned prefix: `/api/v1/public/promos` · Router: `Backend/src/modules/marketing/publicPromo.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/public/promos/health` | own CORS | — | — |
| GET | `/api/public/promos/header` | own CORS | — | — |
| GET | `/api/public/promos` | own CORS | — | — |
| POST | `/api/public/promos/:id/book` | own CORS | — | — |

## `/api/admins`

Admin accounts (Main DB)  
Versioned prefix: `/api/v1/admins` · Router: `Backend/src/modules/admin/admin.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/admins/create` | JWT | super-admin |  // Only super-admin can create other admins |
| GET | `/api/admins` | JWT | super-admin | Fetch all admins - super-admin and admin roles |
| PUT | `/api/admins/:id` | JWT | super-admin | Update an admin by ID - only super-admin |
| DELETE | `/api/admins/:id` | JWT | super-admin | Delete an admin by ID - only super-admin |

## `/api/system-prompts`

Using docDB (docPool) for data, Main DB (pool) for auth  
Versioned prefix: `/api/v1/system-prompts` · Router: `Backend/src/modules/instructions/systemPrompt.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/system-prompts/for-user` | JWT | — | Solo-user / role-based access (must be before /:id to avoid route conflict) GET /api/system-prompts/for-user?role_id=X&user_id=Y |
| POST | `/api/system-prompts` | JWT | super-admin | Admin: CRUD |
| GET | `/api/system-prompts` | JWT | super-admin | — |
| GET | `/api/system-prompts/:id` | JWT | super-admin | — |
| PUT | `/api/system-prompts/:id` | JWT | super-admin | — |
| DELETE | `/api/system-prompts/:id` | JWT | super-admin | — |

## `/api/prompt-roles`

Using docDB (docPool) for data, Main DB (pool) for auth  
Versioned prefix: `/api/v1/prompt-roles` · Router: `Backend/src/modules/instructions/promptRole.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/prompt-roles` | JWT | super-admin | — |
| GET | `/api/prompt-roles/user/:userId/token-limit` | JWT | super-admin | — |
| GET | `/api/prompt-roles/:id/token-limit` | JWT | super-admin | — |
| POST | `/api/prompt-roles` | JWT | super-admin | — |
| PUT | `/api/prompt-roles/:id` | JWT | super-admin | — |
| DELETE | `/api/prompt-roles/:id` | JWT | super-admin | — |

## `/api/user-preset-prompts`

Using docDB (docPool) for prompts, Main DB (pool) for auth + user lookup  
Versioned prefix: `/api/v1/user-preset-prompts` · Router: `Backend/src/modules/instructions/userPresetPrompt.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/user-preset-prompts/directory` | — | — | Static path first so it is not swallowed by /users/:userId. |
| GET | `/api/user-preset-prompts/users` | — | — | — |
| GET | `/api/user-preset-prompts/users/:userId` | — | — | — |
| POST | `/api/user-preset-prompts/users/:userId/groups` | — | — | — |
| POST | `/api/user-preset-prompts/users/:userId/prompts` | — | — | — |
| DELETE | `/api/user-preset-prompts/prompts/:promptId` | — | — | — |
| DELETE | `/api/user-preset-prompts/groups/:groupId` | — | — | — |

## `/api/app-roles`

Using Main DB (pool) — Jurinex application roles  
Versioned prefix: `/api/v1/app-roles` · Router: `Backend/src/modules/roles-permissions/appRoles.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/app-roles` | JWT | — | GET /api/app-roles — all roles (no firm filter, solo users) |
| POST | `/api/app-roles` | JWT | super-admin | POST /api/app-roles — create a new custom role |
| PUT | `/api/app-roles/:id` | JWT | super-admin | PUT /api/app-roles/:id — update name/description for non-system roles |
| DELETE | `/api/app-roles/:id` | JWT | super-admin | DELETE /api/app-roles/:id — permanently remove custom roles |

## `/api/agent-prompts`

Using draftDB for data, Main DB (pool) for auth  
Versioned prefix: `/api/v1/agent-prompts` · Router: `Backend/src/modules/instructions/agentPrompt.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/agent-prompts` | JWT | super-admin | — |
| GET | `/api/agent-prompts` | JWT | super-admin | — |
| GET | `/api/agent-prompts/:id` | JWT | super-admin | — |
| PUT | `/api/agent-prompts/:id` | JWT | super-admin | — |
| DELETE | `/api/agent-prompts/:id` | JWT | super-admin | — |

## `/api/auth`

Using Main DB (pool)  
Versioned prefix: `/api/v1/auth` · Router: `Backend/src/modules/auth/auth.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/auth/login` | — | — | — |
| GET | `/api/auth/dashboard` | JWT | — | — |

## `/api/users`

Using Main DB (pool)  
Versioned prefix: `/api/v1/users` · Router: `Backend/src/modules/users/users.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/users/all` | JWT | user-admin, super-admin | Get all users (basic list) |
| GET | `/api/users/sessions` | JWT | user-admin, super-admin | Get all users with their latest session info (main endpoint for frontend) |
| GET | `/api/users/sessions/:userId` | JWT | user-admin, super-admin | Get specific user sessions |
| GET | `/api/users/:userId` | JWT | user-admin, super-admin | Get user details by ID |
| PUT | `/api/users/block/:userId` | JWT | user-admin, super-admin | Block/unblock user (toggle) |
| PUT | `/api/users/edit/:userId` | JWT | user-admin, super-admin | Update user details |
| PUT | `/api/users/unblock/:userId` | JWT | user-admin, super-admin | Unblock specific user |
| GET | `/api/users/stats/overview` | JWT | user-admin, super-admin | Get user statistics (optional - for dashboard) |
| GET | `/api/users/solo/all` | JWT | user-admin, super-admin | 📌 Solo Users Management |
| GET | `/api/users/firms/all` | JWT | user-admin, super-admin | 📌 Firm Management |
| GET | `/api/users/firms/:firmId` | JWT | user-admin, super-admin | — |
| PUT | `/api/users/firms/:firmId/approval` | JWT | user-admin, super-admin | — |
| POST | `/api/users/firms/:firmId/resend-password-email` | JWT | user-admin, super-admin | — |
| DELETE | `/api/users/firms/:firmId` | JWT | user-admin, super-admin | — |
| GET | `/api/users/firms/:firmId/certificate` | JWT | user-admin, super-admin | — |

## `/api/admin/templates`

Using Draft DB  
Versioned prefix: `/api/v1/admin/templates` · Router: `Backend/src/modules/templates/adminTemplate.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/admin/templates` | — | — | — |
| GET | `/api/admin/templates/:id` | — | — | — |

## `/api/citation-admin`

Using Citation DB + Auth DB + docDB + Citation Cost DB  
Versioned prefix: `/api/v1/citation-admin` · Router: `Backend/src/modules/citations/citations.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/citation-admin/overview` | JWT | — | GET /api/admin/citation/overview |
| GET | `/api/citation-admin/hitl` | JWT | — | GET /api/admin/citation/hitl |
| GET | `/api/citation-admin/hitl/:taskId` | JWT | — | GET /api/admin/citation/hitl/:taskId |
| POST | `/api/citation-admin/hitl/:taskId/action` | JWT | — | POST /api/admin/citation/hitl/:taskId/action |
| GET | `/api/citation-admin/pipeline/summary` | JWT | — | GET /api/admin/citation/pipeline/summary |
| GET | `/api/citation-admin/pipeline/items` | JWT | — | GET /api/admin/citation/pipeline/items |
| GET | `/api/citation-admin/pipeline/errors` | JWT | — | GET /api/admin/citation/pipeline/errors |
| GET | `/api/citation-admin/pipeline/agents` | JWT | — | Routes |
| GET | `/api/citation-admin/pipeline/agents/:agentName/health` | JWT | — | — |
| GET | `/api/citation-admin/pipeline/throughput` | JWT | — | — |
| GET | `/api/citation-admin/pipeline/runs` | JWT | — | — |
| GET | `/api/citation-admin/pipeline/runs/:runId/logs` | JWT | — | — |
| GET | `/api/citation-admin/routesdb/summary` | JWT | — | GET /api/admin/citation/routesdb/summary |
| GET | `/api/citation-admin/routesdb/top-cited` | JWT | — | GET /api/admin/citation/routesdb/top-cited |
| GET | `/api/citation-admin/routesdb/courts-breakdown` | JWT | — | GET /api/admin/citation/routesdb/courts-breakdown |
| GET | `/api/citation-admin/business/summary` | JWT | — | GET /api/admin/citation/business/summary |
| GET | `/api/citation-admin/business/reports-per-day` | JWT | — | GET /api/admin/citation/business/reports-per-day |
| GET | `/api/citation-admin/business/top-users` | JWT | — | GET /api/admin/citation/business/top-users |
| GET | `/api/citation-admin/analytics/heartbeat` | JWT | — | GET /api/citation-admin/analytics/heartbeat - health check |
| GET | `/api/citation-admin/analytics/departments` | JWT | — | GET /api/citation-admin/analytics/departments - dropdown options (Auth_DB firms) |
| GET | `/api/citation-admin/analytics/export` | JWT | — | GET /api/citation-admin/analytics/export - streaming CSV (?scope=users\\|events) |
| GET | `/api/citation-admin/analytics/rate-card` | JWT | — | — |
| POST | `/api/citation-admin/analytics/rate-card` | JWT | — | — |
| PUT | `/api/citation-admin/analytics/rate-card/:id` | JWT | — | — |
| POST | `/api/citation-admin/analytics/rate-card/:id/deactivate` | JWT | — | — |
| GET | `/api/citation-admin/analytics/sessions` | JWT | — | GET /api/citation-admin/analytics/sessions - per-session cost rows |
| GET | `/api/citation-admin/analytics/sessions/:sessionId` | JWT | — | GET /api/citation-admin/analytics/sessions/:sessionId - full session cost breakdown |
| GET | `/api/citation-admin/analytics/user/:userId` | JWT | — | GET /api/citation-admin/analytics/user/:userId - full user analytics |
| GET | `/api/citation-admin/analytics` | JWT | — | GET /api/citation-admin/analytics - full analytics payload |

## `/api/admin/plans`

Using Payment DB (paymentPool)  
Versioned prefix: `/api/v1/admin/plans` · Router: `Backend/src/modules/plans/plan.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/admin/plans` | — | — | Mounted at /api/admin/plans — use / and /:id so paths are /api/admin/plans and /api/admin/plans/:id |
| GET | `/api/admin/plans` | — | — | — |
| GET | `/api/admin/plans/:id` | — | — | — |
| PUT | `/api/admin/plans/:id` | — | — | — |
| DELETE | `/api/admin/plans/:id` | — | — | — |

## `/api/admin/monthly-plans`

Using Payment DB (paymentPool)  
Versioned prefix: `/api/v1/admin/monthly-plans` · Router: `Backend/src/modules/plans/monthlyPlan.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/admin/monthly-plans` | — | — | Mounted at /api/admin/monthly-plans |
| GET | `/api/admin/monthly-plans` | — | — | — |
| GET | `/api/admin/monthly-plans/:id` | — | — | — |
| PUT | `/api/admin/monthly-plans/:id` | — | — | — |
| DELETE | `/api/admin/monthly-plans/:id` | — | — | — |

## `/api/admin/topup-plans`

Using Payment DB (paymentPool)  
Versioned prefix: `/api/v1/admin/topup-plans` · Router: `Backend/src/modules/plans/topupPlan.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/admin/topup-plans` | — | — | Mounted at /api/admin/topup-plans |
| GET | `/api/admin/topup-plans` | — | — | — |
| GET | `/api/admin/topup-plans/:id` | — | — | — |
| PUT | `/api/admin/topup-plans/:id` | — | — | — |
| DELETE | `/api/admin/topup-plans/:id` | — | — | — |

## `/api/admin/addon-plans`

Using Payment DB (paymentPool)  
Versioned prefix: `/api/v1/admin/addon-plans` · Router: `Backend/src/modules/plans/addonPlan.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/admin/addon-plans` | — | — | Mounted at /api/admin/addon-plans |
| GET | `/api/admin/addon-plans` | — | — | — |
| GET | `/api/admin/addon-plans/:id` | — | — | — |
| PUT | `/api/admin/addon-plans/:id` | — | — | — |
| DELETE | `/api/admin/addon-plans/:id` | — | — | — |

## `/api/admin/user-analytics`

Read-only across Auth+Payment+Document+Draft+Citation DBs  
Versioned prefix: `/api/v1/admin/user-analytics` · Router: `Backend/src/modules/users/userAnalytics.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/user-analytics/users/:userId/analytics` | JWT | user-admin, super-admin, account-admin, finance-admin | Mounted at /api/admin/user-analytics |
| GET | `/api/admin/user-analytics/users/:userId/storage` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/user-analytics/users/:userId/token-usage` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/user-analytics/users/:userId/ai-usage` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/user-analytics/firms/:firmId/analytics` | JWT | user-admin, super-admin, account-admin, finance-admin | — |

## `/api/admin/plan-analytics`

Read-only plan purchase analytics (Auth + Payment DBs)  
Versioned prefix: `/api/v1/admin/plan-analytics` · Router: `Backend/src/modules/billing/planAnalytics.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/plan-analytics/summary` | JWT | user-admin, super-admin, account-admin, finance-admin | Mounted at /api/admin/plan-analytics |
| GET | `/api/admin/plan-analytics/subscribers/export` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/plan-analytics/subscribers/filters` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/plan-analytics/subscribers/:userId/transactions` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/plan-analytics/subscribers/:userId/payments/:paymentId/:doc` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/plan-analytics/subscribers/:userId/invoices` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/plan-analytics/subscribers/:userId` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/plan-analytics/subscribers` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/plan-analytics/monthly/:planId/subscribers` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/plan-analytics/topup/:planId/buyers` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/plan-analytics/addon/:planId/buyers` | JWT | user-admin, super-admin, account-admin, finance-admin | — |

## `/api/admin/users-plans`

Finance Admin Users & Plans (GST, invoices, attribution, transactions)  
Versioned prefix: `/api/v1/admin/users-plans` · Router: `Backend/src/modules/billing/usersPlans.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/users-plans/export` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/users-plans/filters` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/users-plans/:userId/transactions` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/users-plans/:userId/invoices` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/users-plans/:userId/payments/:paymentId/:doc` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/users-plans/:userId` | JWT | user-admin, super-admin, account-admin, finance-admin | — |
| GET | `/api/admin/users-plans` | JWT | user-admin, super-admin, account-admin, finance-admin | — |

## `/api/admin/reconciliation`

Razorpay ↔ Payment DB reconciliation runs, issues, audit history  
Versioned prefix: `/api/v1/admin/reconciliation` · Router: `Backend/src/modules/payments/reconciliation.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/admin/reconciliation/runs` | JWT | super-admin, finance-admin, account-admin | — |
| GET | `/api/admin/reconciliation/runs` | JWT | super-admin, finance-admin, account-admin | — |
| GET | `/api/admin/reconciliation/runs/:runId` | JWT | super-admin, finance-admin, account-admin | — |
| GET | `/api/admin/reconciliation/runs/:runId/issues` | JWT | super-admin, finance-admin, account-admin | — |
| GET | `/api/admin/reconciliation/runs/:runId/export` | JWT | super-admin, finance-admin, account-admin | — |
| GET | `/api/admin/reconciliation/runs/:runId/comparison` | JWT | super-admin, finance-admin, account-admin | Side-by-side comparison: every DB row (left) and Razorpay payment (right) of the run, with reasons. |
| GET | `/api/admin/reconciliation/runs/:runId/comparison/export` | JWT | super-admin, finance-admin, account-admin | — |
| POST | `/api/admin/reconciliation/runs/:runId/retry` | JWT | super-admin, finance-admin, account-admin | — |
| GET | `/api/admin/reconciliation/issues/:issueId` | JWT | super-admin, finance-admin, account-admin | — |
| GET | `/api/admin/reconciliation/issues/:issueId/history` | JWT | super-admin, finance-admin, account-admin | — |
| PATCH | `/api/admin/reconciliation/issues/:issueId/resolve` | JWT | super-admin, finance-admin, account-admin | — |
| PATCH | `/api/admin/reconciliation/issues/:issueId/reopen` | JWT | super-admin, finance-admin, account-admin | — |

## `/api/support-queries`

Using Main DB (pool)  
Versioned prefix: `/api/v1/support-queries` · Router: `Backend/src/modules/support/supportQuery.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/support-queries` | JWT | super-admin, support-admin, admin | Create a new support query (admin support team only) |
| GET | `/api/support-queries/all` | JWT | super-admin, support-admin, admin | Get all support queries (Admin only) |
| GET | `/api/support-queries/:id/attachment/preview` | — | — | Stream an attachment preview for a support query inside the admin dashboard |
| GET | `/api/support-queries/:id` | JWT | super-admin, support-admin, admin | Get a single support query by ID (Admin only) |
| GET | `/api/support-queries/user/:userId` | JWT | super-admin, support-admin, admin | Get support queries by user ID (Admin only, or user themselves) |
| PUT | `/api/support-queries/:id` | JWT | super-admin, support-admin, admin | Update a support query by ID (Admin only) |
| DELETE | `/api/support-queries/:id` | JWT | super-admin, support-admin, admin | Delete a support query by ID (Admin only) |

## `/api/support-priorities`

Using Support DB (supportSequelize)  
Versioned prefix: `/api/v1/support-priorities` · Router: `Backend/src/modules/support/supportPriority.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/support-priorities` | JWT | — | GET — anyone authenticated can fetch priorities (used in create/edit forms) |
| POST | `/api/support-priorities` | JWT | super-admin, support-admin, admin | POST — admin only |
| PUT | `/api/support-priorities/:id` | JWT | super-admin, support-admin, admin | PUT — admin only |
| DELETE | `/api/support-priorities/:id` | JWT | super-admin, support-admin, admin | DELETE — admin only |
| PATCH | `/api/support-priorities/:id/toggle` | JWT | super-admin, support-admin, admin | PATCH toggle active — admin only |

## `/api/support-admin`

Using Support DB + Main DB auth  
Versioned prefix: `/api/v1/support-admin` · Router: `Backend/src/modules/support/workspace.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/support-admin/workspace` | JWT | super-admin, support-admin, admin | — |
| GET | `/api/support-admin/team/members` | JWT | super-admin, support-admin, admin | — |
| POST | `/api/support-admin/team/members` | JWT | super-admin, support-admin, admin | — |
| PUT | `/api/support-admin/team/members/:adminId` | JWT | super-admin, support-admin, admin | — |
| POST | `/api/support-admin/tickets/bulk-assign` | JWT | super-admin, support-admin, admin | — |
| GET | `/api/support-admin/tickets/:id` | JWT | super-admin, support-admin, admin | — |
| PATCH | `/api/support-admin/tickets/:id` | JWT | super-admin, support-admin, admin | — |

## `/api/secrets`

Using docDB (docPool)  
Versioned prefix: `/api/v1/secrets` · Router: `Backend/src/modules/admin/secretManager.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/secrets` | — | — |  // 🔍 GET /api/secrets → list all secrets (use ?fetch=true to include secret values) |
| GET | `/api/secrets/:id` | — | — |  // 🔐 GET /api/secrets/:id → fetch secret value by ID |
| POST | `/api/secrets/create` | — | — |  // 📥 POST /api/secrets/create → add new secret to GCP + DB |
| GET | `/api/secrets/plans` | — | — | 📋 GET /api/secrets/plans → subscription plans from payment service (for plan dropdown) |
| GET | `/api/secrets/:id/daily-token-limit` | — | — | 📊 GET /api/secrets/:id/daily-token-limit → per-day token cap from assigned plan |
| POST | `/api/secrets` | — | — | 📥 POST /api/secrets → create new secret in GCP + docDB (multipart) Fields: name, description, secret_value, llm_id, chunking_method_id, temperature, template_t |
| PUT | `/api/secrets/:id` | — | — | ✏️ PUT /api/secrets/:id → update existing secret (metadata or value) |
| DELETE | `/api/secrets/:id` | — | — | 🗑️ DELETE /api/secrets/:id → delete secret from GCP + docDB |

## `/api/contents`

Using docDB (docPool)  
Versioned prefix: `/api/v1/contents` · Router: `Backend/src/modules/admin/content.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/contents/case-types` | — | — |  // ----- Case Types ----- |
| GET | `/api/contents/sub-types/:caseTypeId` | — | — |  // ----- Case Types ----- router.get('/case-types', (req, res) => getCaseTypes(req, res, docPool)); |
| GET | `/api/contents/courts` | — | — |  // ----- Courts ----- |
| GET | `/api/contents/courts/level/:level` | — | — |  // ----- Courts ----- router.get('/courts', (req, res) => getCourts(req, res, docPool)); |
| GET | `/api/contents/courts/:id` | — | — |  // ----- Courts ----- router.get('/courts', (req, res) => getCourts(req, res, docPool)); router.get('/courts/level/:level', (req, res) => getCourtsByLevel(req, |
| GET | `/api/contents/judges` | — | — | // Fetch judges by bench (user) |
| GET | `/api/contents/jurisdictions` | — | — | ----- Jurisdictions ----- |
| GET | `/api/contents/courts/jurisdiction/:jurisdiction_id` | — | — | — |
| GET | `/api/contents/benches/court/:court_id` | — | — | ----- Benches ----- |
| GET | `/api/contents/case-types/:caseTypeId/sub-types` | — | — | — |
| GET | `/api/contents/sub-types/:id` | — | — | Alternative route for sub-types (for frontend compatibility) |
| GET | `/api/contents/judges/bench/:bench_id` | — | — | — |
| POST | `/api/contents/admin/jurisdictions` | — | — | ----- Jurisdictions (Admin) ----- |
| PUT | `/api/contents/admin/jurisdictions/:id` | — | — | — |
| DELETE | `/api/contents/admin/jurisdictions/:id` | — | — | — |
| POST | `/api/contents/admin/courts` | — | — | ----- Courts (Admin) ----- |
| PUT | `/api/contents/admin/courts/:id` | — | — | — |
| DELETE | `/api/contents/admin/courts/:id` | — | — | — |
| POST | `/api/contents/admin/benches` | — | — | ----- Benches (Admin) ----- |
| PUT | `/api/contents/admin/benches/:id` | — | — | — |
| DELETE | `/api/contents/admin/benches/:id` | — | — | — |
| POST | `/api/contents/admin/case-types` | — | — | ----- Case Types (Admin) ----- |
| PUT | `/api/contents/admin/case-types/:id` | — | — | — |
| DELETE | `/api/contents/admin/case-types/:id` | — | — | — |
| POST | `/api/contents/admin/sub-types` | — | — | ----- Sub-Types (Admin) ----- |
| PUT | `/api/contents/admin/sub-types/:id` | — | — | — |
| DELETE | `/api/contents/admin/sub-types/:id` | — | — | — |
| POST | `/api/contents/admin/judges` | — | — | ----- Judges (Admin) ----- |
| PUT | `/api/contents/admin/judges/:id` | — | — | — |
| DELETE | `/api/contents/admin/judges/:id` | — | — | — |

## `/api/llm`

LLM models (docDB) with Main DB auth  
Versioned prefix: `/api/v1/llm` · Router: `Backend/src/modules/ai-analysis/llm.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/llm` | JWT | super-admin | Get all LLM models |
| POST | `/api/llm` | JWT | super-admin | Add a new LLM model |
| POST | `/api/llm/max-tokens` | JWT | super-admin | Create a new LLM max token configuration |
| GET | `/api/llm/max-tokens` | JWT | super-admin | Get all LLM max token configurations |
| PUT | `/api/llm/max-tokens/:id` | JWT | super-admin | Update / delete a specific LLM max token configuration |
| DELETE | `/api/llm/max-tokens/:id` | JWT | super-admin | — |
| DELETE | `/api/llm/:id` | JWT | super-admin | Delete an LLM model |
| GET | `/api/llm/:id/parameters` | JWT | super-admin | Get / update LLM model parameters (temperature, thinking, tools, etc.) |
| PUT | `/api/llm/:id/parameters` | JWT | super-admin | — |

## `/api/chunking-methods`

Using docDB (docPool)  
Versioned prefix: `/api/v1/chunking-methods` · Router: `Backend/src/modules/document-processing/chunkingMethod.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/chunking-methods` | — | — | Get all chunking methods |
| POST | `/api/chunking-methods` | — | — | Add a new chunking method |

## `/api/llm-usage`

Using Payment DB (paymentPool)  
Versioned prefix: `/api/v1/llm-usage` · Router: `Backend/src/modules/usage-metering/llmUsage.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/llm-usage` | — | — | Get all LLM usage logs - only super-admin |
| GET | `/api/llm-usage/stats` | — | — | Get aggregated statistics - only super-admin |
| GET | `/api/llm-usage/user/:userId` | — | — | Get usage by user ID - only super-admin |

## `/api/token-usage`

Using Payment DB (paymentPool)  
Versioned prefix: `/api/v1/token-usage` · Router: `Backend/src/modules/usage-metering/tokenUsage.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/token-usage` | — | — | Get all token usage logs - only super-admin |
| GET | `/api/token-usage/stats` | — | — | Get aggregated statistics - only super-admin |
| GET | `/api/token-usage/user/:userId` | — | — | Get usage by user ID - only super-admin |
| GET | `/api/token-usage/sessions/stats` | — | — | Get session stats summary - only super-admin |
| GET | `/api/token-usage/sessions/active-login` | — | — | Get active login users - only super-admin |
| GET | `/api/token-usage/sessions/live` | — | — | Get live users - only super-admin |
| GET | `/api/token-usage/sessions/all` | — | — | Get all sessions - only super-admin |
| GET | `/api/token-usage/sessions/details` | — | — | Add this route with your other session routes |
| GET | `/api/token-usage/heartbeat` | JWT | super-admin | — |

## `/api/file`

Using Main DB (pool)  
Versioned prefix: `/api/v1/file` · Router: `Backend/src/modules/file-manager/file.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/file/stats/total` | — | — | Get total files count - only super-admin |
| GET | `/api/file/stats/user/:userId` | — | — | Get user-specific files count with details - accessible by user or admin |
| GET | `/api/file/stats/by-user` | — | — | Get files grouped by user - only super-admin |
| GET | `/api/file/heartbeat` | JWT | super-admin | NEW: Heartbeat endpoint |

## `/api/judgements-admin`

Proxying protected admin uploads to judgement-service ()  
Versioned prefix: `/api/v1/judgements-admin` · Router: `Backend/src/modules/legal-research/judgement.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/judgements-admin/library/upload` | JWT | super-admin | --- Library Upload (Elasticsearch-only Indian Kanoon-format records) --- Before the /:documentId routes so "library" is never read as a document id. |
| GET | `/api/judgements-admin/library` | JWT | super-admin | — |
| GET | `/api/judgements-admin/library/:tid/html` | JWT | super-admin | — |
| GET | `/api/judgements-admin/library/:tid` | JWT | super-admin | — |
| PUT | `/api/judgements-admin/library/:tid` | JWT | super-admin | — |
| DELETE | `/api/judgements-admin/library/:tid` | JWT | super-admin | — |
| GET | `/api/judgements-admin/summary` | JWT | super-admin | ... (keeping existing routes but inside this scope) |
| GET | `/api/judgements-admin/pipeline-report/summary` | JWT | super-admin | — |
| GET | `/api/judgements-admin/pipeline-report` | JWT | super-admin | — |
| GET | `/api/judgements-admin/pipeline-report/:judgmentUuid/vectors` | JWT | super-admin | — |
| GET | `/api/judgements-admin/pipeline-report/:judgmentUuid` | JWT | super-admin | — |
| POST | `/api/judgements-admin/search/hybrid` | JWT | super-admin | — |
| POST | `/api/judgements-admin/search/semantic` | JWT | super-admin | — |
| POST | `/api/judgements-admin/search/full-text` | JWT | super-admin | — |
| GET | `/api/judgements-admin/search/analytics` | JWT | super-admin | — |
| GET | `/api/judgements-admin/dependencies/health` | JWT | super-admin | — |
| GET | `/api/judgements-admin` | JWT | super-admin | — |
| POST | `/api/judgements-admin/reprocess-failed` | JWT | super-admin | — |
| POST | `/api/judgements-admin/upload` | JWT | super-admin | — |
| GET | `/api/judgements-admin/:documentId/status` | JWT | super-admin | — |
| GET | `/api/judgements-admin/:documentId/vectors` | JWT | super-admin | — |
| GET | `/api/judgements-admin/:documentId/pages/:pageNumber/ocr-layout` | JWT | super-admin | — |
| GET | `/api/judgements-admin/:documentId/pages/:pageNumber/pdf` | JWT | super-admin | — |
| GET | `/api/judgements-admin/:documentId` | JWT | super-admin | — |
| POST | `/api/judgements-admin/:documentId/reprocess` | JWT | super-admin | — |
| PUT | `/api/judgements-admin/:documentId/metadata` | JWT | super-admin | — |
| PUT | `/api/judgements-admin/:documentId/archive` | JWT | super-admin | — |
| DELETE | `/api/judgements-admin/:documentId` | JWT | super-admin | — |

## `/api/admin/health`

Health check (no auth)  
Versioned prefix: `/api/v1/admin/health` · Router: ``

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/health` | — | — | Auth DB + Citation DB connectivity check |

## `/api/admin/users`

Using Auth DB (pool)  
Versioned prefix: `/api/v1/admin/users` · Router: `Backend/src/modules/users/usersAdmin.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/users` | JWT | — | GET /api/admin/users |
| GET | `/api/admin/users/stats` | JWT | — | GET /api/admin/users/stats |
| GET | `/api/admin/users/pending` | JWT | — | GET /api/admin/users/pending |
| POST | `/api/admin/users/:id/approve` | JWT | — | POST /api/admin/users/:id/approve |
| POST | `/api/admin/users/:id/block` | JWT | — | POST /api/admin/users/:id/block |
| POST | `/api/admin/users/:id/unblock` | JWT | — | POST /api/admin/users/:id/unblock |

## `/api/admin/llm-config`

Using docDB (docPool) for config, Main DB (pool) for auth  
Versioned prefix: `/api/v1/admin/llm-config` · Router: `Backend/src/modules/ai-chat/llmChatConfig.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/llm-config` | JWT | — | GET /api/admin/llm-config — fetch current config (any authenticated admin) |
| POST | `/api/admin/llm-config` | JWT | — | POST /api/admin/llm-config — create singleton config when none exists |
| PUT | `/api/admin/llm-config` | JWT | — | PUT /api/admin/llm-config — partial or full update |
| DELETE | `/api/admin/llm-config` | JWT | — | DELETE /api/admin/llm-config — remove config row |

## `/api/admin/summarization-chat-config`

Using docDB (docPool) for config, Main DB (pool) for auth  
Versioned prefix: `/api/v1/admin/summarization-chat-config` · Router: `Backend/src/modules/ai-chat/summarizationChatConfig.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/summarization-chat-config` | JWT | — | — |
| POST | `/api/admin/summarization-chat-config` | JWT | — | — |
| PUT | `/api/admin/summarization-chat-config` | JWT | — | — |
| DELETE | `/api/admin/summarization-chat-config` | JWT | — | — |

## `/api/admin`

AI Document Processing (GCS + Document AI + Gemini Embeddings)  
Versioned prefix: `/api/v1/admin` · Router: `Backend/src/modules/ai-analysis/aiDocument.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/admin/generate-signed-url` | — | — | — |
| POST | `/api/admin/process-document` | — | — | — |
| GET | `/api/admin/documents` | — | — | — |
| GET | `/api/admin/documents/:id` | — | — | — |
| DELETE | `/api/admin/documents/:id` | — | — | — |

## `/api/admin/chatbot-config`

Chatbot model & voice configuration  
Versioned prefix: `/api/v1/admin/chatbot-config` · Router: `Backend/src/modules/ai-chat/chatbotConfig.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/chatbot-config` | — | — | — |
| PUT | `/api/admin/chatbot-config` | — | — | — |
| GET | `/api/admin/chatbot-config/voice-preview/:voiceName` | — | — | — |

## `/api/admin/chatbot-token-usage`

Chatbot token usage & cost analytics (SSE)  
Versioned prefix: `/api/v1/admin/chatbot-token-usage` · Router: `Backend/src/modules/usage-metering/chatbotTokenUsage.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/chatbot-token-usage/stats` | — | — | Standard REST endpoint — requires Bearer token in Authorization header |
| GET | `/api/admin/chatbot-token-usage/stream` | — | — | SSE stream — token passed as ?token= because EventSource cannot send headers |

## `/api/admin/chat-history`

All chatbot sessions & messages  
Versioned prefix: `/api/v1/admin/chat-history` · Router: `Backend/src/modules/ai-chat/chatHistory.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/chat-history` | — | — | — |
| GET | `/api/admin/chat-history/:sessionId` | — | — | — |

## `/api/admin/demo`

Demo booking & slot management  
Versioned prefix: `/api/v1/admin/demo` · Router: `Backend/src/modules/marketing/demo.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/demo/stats` | — | — | Stats |
| GET | `/api/admin/demo/bookings` | — | — | Bookings |
| GET | `/api/admin/demo/bookings/:id` | — | — | — |
| PATCH | `/api/admin/demo/bookings/:id/status` | — | — | — |
| POST | `/api/admin/demo/bookings/:id/send-invite` | — | — | — |
| DELETE | `/api/admin/demo/bookings/:id` | — | — | — |

## `/api/admin/contact-enquiries`

Marketing: "Contact Jurinex" form enquiries  
Versioned prefix: `/api/v1/admin/contact-enquiries` · Router: `Backend/src/modules/marketing/contactEnquiry.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/contact-enquiries/stats` | — | — | Dashboard widgets |
| GET | `/api/admin/contact-enquiries/meta` | — | — | — |
| GET | `/api/admin/contact-enquiries` | — | — | List + CSV export (same filters) |
| GET | `/api/admin/contact-enquiries/export` | — | — | — |
| GET | `/api/admin/contact-enquiries/:id` | — | — | Single enquiry |
| PATCH | `/api/admin/contact-enquiries/:id` | — | — | — |
| POST | `/api/admin/contact-enquiries/:id/contact-log` | — | — | — |
| POST | `/api/admin/contact-enquiries/:id/notes` | — | — | — |
| DELETE | `/api/admin/contact-enquiries/:id` | — | — | — |

## `/api/admin/newsletter-subscribers`

Marketing: website newsletter list  
Versioned prefix: `/api/v1/admin/newsletter-subscribers` · Router: `Backend/src/modules/marketing/newsletterSubscriber.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/newsletter-subscribers/stats` | — | — | — |
| GET | `/api/admin/newsletter-subscribers` | — | — | — |
| GET | `/api/admin/newsletter-subscribers/export` | — | — | — |
| GET | `/api/admin/newsletter-subscribers/:id` | — | — | — |

## `/api/admin/promos`

Marketing: header offers & events  
Versioned prefix: `/api/v1/admin/promos` · Router: `Backend/src/modules/marketing/marketingPromo.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/promos/stats` | — | — | — |
| GET | `/api/admin/promos` | — | — | — |
| POST | `/api/admin/promos` | — | — | — |
| GET | `/api/admin/promos/:id` | — | — | — |
| PUT | `/api/admin/promos/:id` | — | — | — |
| PATCH | `/api/admin/promos/:id/status` | — | — | — |
| DELETE | `/api/admin/promos/:id` | — | — | — |

## `/api/admin/error-logs`

Platform error logs (Document_DB error_logs)  
Versioned prefix: `/api/v1/admin/error-logs` · Router: `Backend/src/modules/admin/errorLog.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/error-logs/stats` | JWT | super-admin, admin | Dashboard widgets + filter metadata |
| GET | `/api/admin/error-logs/meta` | JWT | super-admin, admin | — |
| GET | `/api/admin/error-logs/users` | JWT | super-admin, admin | Groupings |
| GET | `/api/admin/error-logs/issues` | JWT | super-admin, admin | — |
| GET | `/api/admin/error-logs` | JWT | super-admin, admin | List + CSV export (same filters) |
| GET | `/api/admin/error-logs/export` | JWT | super-admin, admin | — |
| PATCH | `/api/admin/error-logs/resolve` | — | super-admin, admin | Bulk operations (static paths must be registered before /:id) |
| PATCH | `/api/admin/error-logs/resolve-fingerprint` | — | super-admin, admin | — |
| POST | `/api/admin/error-logs/bulk-delete` | — | super-admin, admin | — |
| GET | `/api/admin/error-logs/:id` | JWT | super-admin, admin | Single row |
| PATCH | `/api/admin/error-logs/:id/resolve` | — | super-admin, admin | — |
| DELETE | `/api/admin/error-logs/:id` | — | super-admin, admin | — |

## `/api/admin/audit-logs`

Activity & Error Logs (Document_DB api_audit_logs)  
Versioned prefix: `/api/v1/admin/audit-logs` · Router: `Backend/src/modules/admin/auditLog.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/audit-logs/summary` | JWT | super-admin, admin | — |
| GET | `/api/admin/audit-logs/meta` | JWT | super-admin, admin | — |
| GET | `/api/admin/audit-logs/export` | JWT | super-admin, admin | — |
| GET | `/api/admin/audit-logs` | JWT | super-admin, admin | — |
| GET | `/api/admin/audit-logs/:id` | JWT | super-admin, admin | — |

## `/api/admin/onboarded-users`

Users by onboarding channel + subscription history, CSV  
Versioned prefix: `/api/v1/admin/onboarded-users` · Router: `Backend/src/modules/users/onboardedUsers.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/onboarded-users/summary` | JWT | super-admin, admin, account-admin, finance-admin | — |
| GET | `/api/admin/onboarded-users/meta` | JWT | super-admin, admin, account-admin, finance-admin | — |
| GET | `/api/admin/onboarded-users/export` | JWT | super-admin, admin, account-admin, finance-admin | — |
| GET | `/api/admin/onboarded-users` | JWT | super-admin, admin, account-admin, finance-admin | — |
| GET | `/api/admin/onboarded-users/:userId` | JWT | super-admin, admin, account-admin, finance-admin | — |

## `/api/admin/sales-referrals/data`

All referral data: workspaces + plan purchases + CSV  
Versioned prefix: `/api/v1/admin/sales-referrals/data` · Router: `Backend/src/modules/referrals/referralData.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/sales-referrals/data/summary` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/data/columns` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/data/export` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/data/purchases` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/data/workspaces` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/data/workspaces/:id` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/data` | JWT | super-admin, admin, finance-admin | — |

## `/api/admin/sales-referrals`

Sales owners, referral codes, attribution reports  
Versioned prefix: `/api/v1/admin/sales-referrals` · Router: `Backend/src/modules/referrals/salesReferrals.routes.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| POST | `/api/admin/sales-referrals/owners` | JWT | super-admin, admin, finance-admin | Owners (A1–A4) |
| GET | `/api/admin/sales-referrals/owners/:ownerId` | JWT | super-admin, admin, finance-admin | — |
| PUT | `/api/admin/sales-referrals/owners/:ownerId` | JWT | super-admin, admin, finance-admin | — |
| POST | `/api/admin/sales-referrals/owners/:ownerId/codes` | JWT | super-admin, admin, finance-admin | — |
| POST | `/api/admin/sales-referrals/owners/:ownerId/email` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/codes/suggest` | JWT | super-admin, admin, finance-admin | Codes (A9–A11 static paths before /:codeId) |
| GET | `/api/admin/sales-referrals/codes/availability` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/codes` | JWT | super-admin, admin, finance-admin | — |
| PATCH | `/api/admin/sales-referrals/codes/:codeId` | JWT | super-admin, admin, finance-admin | — |
| POST | `/api/admin/sales-referrals/codes/:codeId/deactivate` | JWT | super-admin, admin, finance-admin | — |
| POST | `/api/admin/sales-referrals/codes/:codeId/activate` | JWT | super-admin, admin, finance-admin | — |
| POST | `/api/admin/sales-referrals/codes/:codeId/refresh` | JWT | super-admin, admin, finance-admin | — |
| POST | `/api/admin/sales-referrals/codes/:codeId/email` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/reports/summary` | JWT | super-admin, admin, finance-admin | Reports (A12–A15) |
| GET | `/api/admin/sales-referrals/reports/owners` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/reports/owners/:ownerId/codes` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/reports/signups` | JWT | super-admin, admin, finance-admin | — |
| PUT | `/api/admin/sales-referrals/tenants/:tenantId/referral` | JWT | super-admin, admin, finance-admin | Workspace referral (A16–A17) |
| GET | `/api/admin/sales-referrals/tenants/:tenantId/referral` | JWT | super-admin, admin, finance-admin | — |
| GET | `/api/admin/sales-referrals/users/:userId/referral` | JWT | super-admin, admin, finance-admin | — |

## `/admin/jurinex-voice`

Voice agent management + KB (jurinex-voice-docs bucket)  
Versioned prefix: `/api/v1/admin/jurinex-voice` · Router: `Backend/src/modules/jurinex-voice/index.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/admin/jurinex-voice/platform-voices` | API key | — | ── Platform Voices ───────────────────────────────────────────── |
| POST | `/admin/jurinex-voice/platform-voices/:voiceKey/preview` | API key | — | — |
| GET | `/admin/jurinex-voice/models/pricing` | API key | — | ── Allowed Voice Models & Pricing ────────────────────────────── |
| GET | `/admin/jurinex-voice/agents` | API key | — | ── Voice Agents ───────────────────────────────────────────────── |
| POST | `/admin/jurinex-voice/agents` | API key | — | — |
| GET | `/admin/jurinex-voice/agents/:agentId/config` | API key | — | — |
| PUT | `/admin/jurinex-voice/agents/:agentId/config` | API key | — | — |
| POST | `/admin/jurinex-voice/agents/:agentId/test-turn` | API key | — | — |
| POST | `/admin/jurinex-voice/agents/:agentId/test-audio-turn` | API key | — | — |
| POST | `/admin/jurinex-voice/agents/:agentId/test-audio-turn-stream` | API key | — | — |
| GET | `/admin/jurinex-voice/agents/:agentId` | API key | — | — |
| PATCH | `/admin/jurinex-voice/agents/:agentId` | API key | — | — |
| DELETE | `/admin/jurinex-voice/agents/:agentId` | API key | — | — |
| POST | `/admin/jurinex-voice/kb/upload` | API key | — | ── Knowledge Base ─────────────────────────────────────────────── |
| POST | `/admin/jurinex-voice/kb/upload-text` | API key | — | — |
| GET | `/admin/jurinex-voice/kb/documents` | API key | — | — |
| GET | `/admin/jurinex-voice/kb/documents/:documentId` | API key | — | — |
| DELETE | `/admin/jurinex-voice/kb/documents/:documentId` | API key | — | — |
| POST | `/admin/jurinex-voice/kb/documents/:documentId/reindex` | API key | — | — |
| POST | `/admin/jurinex-voice/kb/search` | API key | — | — |
| GET | `/admin/jurinex-voice/kb/search-logs` | API key | — | — |
| GET | `/admin/jurinex-voice/calendar/bookings` | API key | — | ── Calendar Bookings ──────────────────────────────────────────── |
| GET | `/admin/jurinex-voice/calendar/slots` | API key | — | — |
| GET | `/admin/jurinex-voice/scheduler/calls` | API key | — | ── Outbound Call Scheduler ───────────────────────────────────── |
| POST | `/admin/jurinex-voice/scheduler/calls` | API key | — | — |
| PATCH | `/admin/jurinex-voice/scheduler/calls/:id` | API key | — | — |
| DELETE | `/admin/jurinex-voice/scheduler/calls/:id` | API key | — | — |
| POST | `/admin/jurinex-voice/scheduler/calls/:id/retry` | API key | — | — |
| POST | `/admin/jurinex-voice/scheduler/calls/reset-stuck` | API key | — | — |
| POST | `/admin/jurinex-voice/scheduler/calls/bulk-import` | API key | — | — |
| GET | `/admin/jurinex-voice/calls/analytics` | API key | — | ── Call Analytics & History ──────────────────────────────────── |
| GET | `/admin/jurinex-voice/calls/history` | API key | — | — |
| GET | `/admin/jurinex-voice/calls/:callId/recording-url` | API key | — | — |
| GET | `/admin/jurinex-voice/calls/:callId` | API key | — | — |
| GET | `/admin/jurinex-voice/debug/events` | API key | — | ── Debug ──────────────────────────────────────────────────────── |
| POST | `/admin/jurinex-voice/debug/events` | API key | — | — |
| GET | `/admin/jurinex-voice/health` | API key | — | ── Health (no auth — used by deployment / status pages) ──────── |

## `/api/admin/jurinex-voice`

Voice agent management (standard /api base)  
Versioned prefix: `/api/v1/admin/jurinex-voice` · Router: `Backend/src/modules/jurinex-voice/index.js`

| Method | Path | Auth | Roles | Description |
|---|---|---|---|---|
| GET | `/api/admin/jurinex-voice/platform-voices` | API key | — | ── Platform Voices ───────────────────────────────────────────── |
| POST | `/api/admin/jurinex-voice/platform-voices/:voiceKey/preview` | API key | — | — |
| GET | `/api/admin/jurinex-voice/models/pricing` | API key | — | ── Allowed Voice Models & Pricing ────────────────────────────── |
| GET | `/api/admin/jurinex-voice/agents` | API key | — | ── Voice Agents ───────────────────────────────────────────────── |
| POST | `/api/admin/jurinex-voice/agents` | API key | — | — |
| GET | `/api/admin/jurinex-voice/agents/:agentId/config` | API key | — | — |
| PUT | `/api/admin/jurinex-voice/agents/:agentId/config` | API key | — | — |
| POST | `/api/admin/jurinex-voice/agents/:agentId/test-turn` | API key | — | — |
| POST | `/api/admin/jurinex-voice/agents/:agentId/test-audio-turn` | API key | — | — |
| POST | `/api/admin/jurinex-voice/agents/:agentId/test-audio-turn-stream` | API key | — | — |
| GET | `/api/admin/jurinex-voice/agents/:agentId` | API key | — | — |
| PATCH | `/api/admin/jurinex-voice/agents/:agentId` | API key | — | — |
| DELETE | `/api/admin/jurinex-voice/agents/:agentId` | API key | — | — |
| POST | `/api/admin/jurinex-voice/kb/upload` | API key | — | ── Knowledge Base ─────────────────────────────────────────────── |
| POST | `/api/admin/jurinex-voice/kb/upload-text` | API key | — | — |
| GET | `/api/admin/jurinex-voice/kb/documents` | API key | — | — |
| GET | `/api/admin/jurinex-voice/kb/documents/:documentId` | API key | — | — |
| DELETE | `/api/admin/jurinex-voice/kb/documents/:documentId` | API key | — | — |
| POST | `/api/admin/jurinex-voice/kb/documents/:documentId/reindex` | API key | — | — |
| POST | `/api/admin/jurinex-voice/kb/search` | API key | — | — |
| GET | `/api/admin/jurinex-voice/kb/search-logs` | API key | — | — |
| GET | `/api/admin/jurinex-voice/calendar/bookings` | API key | — | ── Calendar Bookings ──────────────────────────────────────────── |
| GET | `/api/admin/jurinex-voice/calendar/slots` | API key | — | — |
| GET | `/api/admin/jurinex-voice/scheduler/calls` | API key | — | ── Outbound Call Scheduler ───────────────────────────────────── |
| POST | `/api/admin/jurinex-voice/scheduler/calls` | API key | — | — |
| PATCH | `/api/admin/jurinex-voice/scheduler/calls/:id` | API key | — | — |
| DELETE | `/api/admin/jurinex-voice/scheduler/calls/:id` | API key | — | — |
| POST | `/api/admin/jurinex-voice/scheduler/calls/:id/retry` | API key | — | — |
| POST | `/api/admin/jurinex-voice/scheduler/calls/reset-stuck` | API key | — | — |
| POST | `/api/admin/jurinex-voice/scheduler/calls/bulk-import` | API key | — | — |
| GET | `/api/admin/jurinex-voice/calls/analytics` | API key | — | ── Call Analytics & History ──────────────────────────────────── |
| GET | `/api/admin/jurinex-voice/calls/history` | API key | — | — |
| GET | `/api/admin/jurinex-voice/calls/:callId/recording-url` | API key | — | — |
| GET | `/api/admin/jurinex-voice/calls/:callId` | API key | — | — |
| GET | `/api/admin/jurinex-voice/debug/events` | API key | — | ── Debug ──────────────────────────────────────────────────────── |
| POST | `/api/admin/jurinex-voice/debug/events` | API key | — | — |
| GET | `/api/admin/jurinex-voice/health` | API key | — | ── Health (no auth — used by deployment / status pages) ──────── |

