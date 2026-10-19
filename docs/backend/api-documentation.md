# API documentation

Base URLs: legacy paths below are unchanged; every router is also mounted under **`/api/v1`** (recommended for new clients). All admin routes require `Authorization: Bearer <dashboard JWT>` and a role accepted by the router's `authorize([...])`.

Envelopes: `{ success: true, data }` / `{ success: false, message | error: { code, message, details? }, requestId }`.

## Liveness

| Path | Purpose |
|---|---|
| `GET /healthz` | process liveness (no DB) |
| `GET /api/admin/health` · `GET /api/v1/admin/health` | Auth DB + Citation DB checks |

## Public website intake (own CORS + IP rate limit, no auth)

| Legacy path | Versioned path | Router (src/modules) | Notes |
|---|---|---|---|
| `/api/public/contact` | `/api/v1/public/contact` | publicContactRoutes | "Contact Jurinex" form intake (Main DB, rate-limited, own CORS) |
| `/api/public/newsletter` | `/api/v1/public/newsletter` | publicNewsletterRoutes | Website newsletter subscribe (Main DB, rate-limited, own CORS) |
| `/api/public/promos` | `/api/v1/public/promos` | publicPromoRoutes | Website header offers/events (Main DB, own CORS) |

## Admin API (portal CORS allow-list)

Mounted in this order (precedence matters for overlapping prefixes such as `/api/admin`).

| Legacy path | Versioned path | Router (src/modules) | Notes |
|---|---|---|---|
| `/api/admins` | `/api/v1/admins` | adminRoutes | Admin accounts (Main DB) |
| `/api/system-prompts` | `/api/v1/system-prompts` | systemPromptRoutes | Using docDB (docPool) for data, Main DB (pool) for auth |
| `/api/prompt-roles` | `/api/v1/prompt-roles` | promptRoleRoutes | Using docDB (docPool) for data, Main DB (pool) for auth |
| `/api/user-preset-prompts` | `/api/v1/user-preset-prompts` | userPresetPromptRoutes | Using docDB (docPool) for prompts, Main DB (pool) for auth + user lookup |
| `/api/app-roles` | `/api/v1/app-roles` | appRolesRoutes | Using Main DB (pool) — Jurinex application roles |
| `/api/agent-prompts` | `/api/v1/agent-prompts` | agentPromptRoutes | Using draftDB for data, Main DB (pool) for auth |
| `/api/auth` | `/api/v1/auth` | authRoutes | Using Main DB (pool) |
| `/api/users` | `/api/v1/users` | userRoutes | Using Main DB (pool) |
| `/api/admin/templates` | `/api/v1/admin/templates` | adminTemplateRoutes | Using Draft DB |
| `/api/admin/plans` | `/api/v1/admin/plans` | planRoutes | Using Payment DB (paymentPool) |
| `/api/admin/monthly-plans` | `/api/v1/admin/monthly-plans` | monthlyPlanRoutes | Using Payment DB (paymentPool) |
| `/api/admin/topup-plans` | `/api/v1/admin/topup-plans` | topupPlanRoutes | Using Payment DB (paymentPool) |
| `/api/admin/addon-plans` | `/api/v1/admin/addon-plans` | addonPlanRoutes | Using Payment DB (paymentPool) |
| `/api/admin/user-analytics` | `/api/v1/admin/user-analytics` | userAnalyticsRoutes | Read-only across Auth+Payment+Document+Draft+Citation DBs |
| `/api/admin/plan-analytics` | `/api/v1/admin/plan-analytics` | planAnalyticsRoutes | Read-only plan purchase analytics (Auth + Payment DBs) |
| `/api/admin/users-plans` | `/api/v1/admin/users-plans` | usersPlansRoutes | Finance Admin Users & Plans (GST, invoices, attribution, transactions) |
| `/api/admin/reconciliation` | `/api/v1/admin/reconciliation` | reconciliationRoutes | Razorpay ↔ Payment DB reconciliation runs, issues, audit history |
| `/api/support-queries` | `/api/v1/support-queries` | supportQueryRoutes | Using Main DB (pool) |
| `/api/support-priorities` | `/api/v1/support-priorities` | supportPriorityRoutes | Using Support DB (supportSequelize) |
| `/api/support-admin` | `/api/v1/support-admin` | supportWorkspaceRoutes | Using Support DB + Main DB auth |
| `/api/secrets` | `/api/v1/secrets` | secretRoutes | Using docDB (docPool) |
| `/api/contents` | `/api/v1/contents` | contentRoutes | Using docDB (docPool) |
| `/api/llm` | `/api/v1/llm` | llmRoutes | LLM models (docDB) with Main DB auth |
| `/api/chunking-methods` | `/api/v1/chunking-methods` | chunkingMethodRoutes | Using docDB (docPool) |
| `/api/llm-usage` | `/api/v1/llm-usage` | llmUsageRoutes | Using Payment DB (paymentPool) |
| `/api/token-usage` | `/api/v1/token-usage` | tokenUsageRoutes | Using Payment DB (paymentPool) |
| `/api/file` | `/api/v1/file` | fileRoutes | Using Main DB (pool) |
| `/api/judgements-admin` | `/api/v1/judgements-admin` | judgementRoutes | Proxying protected admin uploads to judgement-service (${String(process.env.JUDGEMENT_SERVICE_URL || 'http://localhost:8095').replace(/\/+$/, '')}) |
| `/api/admin/health` | `/api/v1/admin/health` | health | Health check (no auth) |
| `/api/admin/users` | `/api/v1/admin/users` | userAdminRoutes | Using Auth DB (pool) |
| `/api/admin/llm-config` | `/api/v1/admin/llm-config` | llmChatConfigRoutes | Using docDB (docPool) for config, Main DB (pool) for auth |
| `/api/admin/summarization-chat-config` | `/api/v1/admin/summarization-chat-config` | summarizationChatConfigRoutes | Using docDB (docPool) for config, Main DB (pool) for auth |
| `/api/admin` | `/api/v1/admin` | aiDocumentRoutes | AI Document Processing (GCS + Document AI + Gemini Embeddings) |
| `/api/admin/chatbot-config` | `/api/v1/admin/chatbot-config` | chatbotConfigRoutes | Chatbot model & voice configuration |
| `/api/admin/chatbot-token-usage` | `/api/v1/admin/chatbot-token-usage` | chatbotTokenUsageRoutes | Chatbot token usage & cost analytics (SSE) |
| `/api/admin/chat-history` | `/api/v1/admin/chat-history` | chatHistoryRoutes | All chatbot sessions & messages |
| `/api/admin/demo` | `/api/v1/admin/demo` | demoRoutes | Demo booking & slot management |
| `/api/admin/contact-enquiries` | `/api/v1/admin/contact-enquiries` | contactEnquiryRoutes | Marketing: "Contact Jurinex" form enquiries |
| `/api/admin/newsletter-subscribers` | `/api/v1/admin/newsletter-subscribers` | newsletterSubscriberRoutes | Marketing: website newsletter list |
| `/api/admin/promos` | `/api/v1/admin/promos` | marketingPromoRoutes | Marketing: header offers & events |
| `/api/admin/sales-referrals` | `/api/v1/admin/sales-referrals` | salesReferralsRoutes | Sales owners, referral codes, attribution reports |
| `/admin/jurinex-voice` | `/api/v1/admin/jurinex-voice` | voice | Voice agent management + KB (jurinex-voice-docs bucket) |
| `/api/admin/jurinex-voice` | `/api/v1/admin/jurinex-voice` | voice | Voice agent management (standard /api base) |

Per-endpoint details:
- Finance Admin Users & Plans + reconciliation: [finance-users-plans-and-reconciliation.md](../finance-users-plans-and-reconciliation.md)
- Sales referrals: [sales-referrals-admin-api.md](../sales-referrals-admin-api.md)
- Jurinex Voice: [jurinex-voice/README.md](jurinex-voice/README.md)
- Legacy API test report: [api_test_report.md](api_test_report.md) · full route notes: [documentation.md](documentation.md)
