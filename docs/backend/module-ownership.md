# Module ownership

| Module (`src/modules/…`) | What it owns | Legacy mounts (also under `/api/v1`) | DBs |
|---|---|---|---|
| `auth` | Admin login/JWT | `/api/auth` | Main |
| `roles-permissions` | Jurinex application roles | `/api/app-roles` | Main |
| `admin` | Admin accounts, secret manager, contents, error & audit logs | `/api/admins`, `/api/secrets`, `/api/contents`, `/api/admin/error-logs`, `/api/admin/audit-logs` | Main, docDB |
| `users` | Users, user analytics, onboarded users, admin user management | `/api/users`, `/api/admin/users`, `/api/admin/user-analytics`, `/api/admin/onboarded-users` | Main, Payment, … |
| `organizations` | Firm certificates | (used by users) | Main, GCS |
| `instructions` | System / agent / role / user-preset prompts | `/api/system-prompts`, `/api/prompt-roles`, `/api/user-preset-prompts`, `/api/agent-prompts` | docDB, Draft |
| `ai-analysis` | AI document processing, LLM model catalogue | `/api/admin` (documents), `/api/llm` | AI Document DB, docDB |
| `ai-chat` | Chatbot config, chat history, LLM/summarization chat config, voice preview | `/api/admin/chatbot-config`, `/api/admin/chat-history`, `/api/admin/llm-config`, `/api/admin/summarization-chat-config` | docDB |
| `usage-metering` | LLM / token / chatbot token usage | `/api/llm-usage`, `/api/token-usage`, `/api/admin/chatbot-token-usage` | Payment, docDB |
| `document-processing` · `ocr` · `rag` | Chunking, schema mapping · Document AI OCR · embeddings | `/api/chunking-methods` | docDB |
| `citations` | Citation pipeline admin (overview, HITL, pipeline, routes DB, business, analytics, rate card) | `/api/citation-admin` | Citation, Citation analytics |
| `legal-research` | Judgement service proxy | `/api/judgements-admin` | — |
| `file-manager` | File routes | `/api/file` | Main |
| `templates` | Admin templates + Sequelize models | `/api/admin/templates` | Draft |
| `plans` | Plans, monthly/top-up/add-on plans | `/api/admin/plans`, `/api/admin/monthly-plans`, `/api/admin/topup-plans`, `/api/admin/addon-plans` | Payment |
| `billing` | Plan analytics, Finance Admin Users & Plans (GST, invoices PDF) | `/api/admin/plan-analytics`, `/api/admin/users-plans` | Main, Payment |
| `payments` | Razorpay ↔ DB reconciliation runs, issues, audit | `/api/admin/reconciliation` | Payment |
| `invoices` | Invoice / receipt rendering from `templates/invoices` | (used by billing) | — |
| `referrals` | Sales owners, referral codes, attribution, reports, referral emails | `/api/admin/sales-referrals`, `/api/admin/sales-referrals/data` | Main, Payment |
| `marketing` | Contact enquiries, newsletter, promos, demo bookings (+ public intake) | `/api/public/*`, `/api/admin/contact-enquiries`, `/api/admin/newsletter-subscribers`, `/api/admin/promos`, `/api/admin/demo` | Main |
| `support` | Support queries, priorities, workspace | `/api/support-queries`, `/api/support-priorities`, `/api/support-admin` | Main, Support |
| `jurinex-voice` | Voice agents, calls, calendar, KB (self-contained module) | `/admin/jurinex-voice`, `/api/admin/jurinex-voice` | Voice DB, GCS |

Shared code: `src/shared/*` (middleware, utils). Infrastructure: `src/infrastructure/*` (DB pools, email, Razorpay client, GCS).

Modules in the target blueprint that have no code yet (`organizations` beyond certificates, `subscriptions`, `evidence`, `chronology`, `sharing`, `memory`, `agent-orchestration`, `knowledge-base`, `drafting`, `notifications`, `integrations`) are intentionally not created as empty folders — add them when the first file lands.
