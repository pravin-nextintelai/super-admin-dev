# Databases

| Pool (`src/infrastructure/database/connections/`) | Env var | Contents |
|---|---|---|
| `db.js` (Main / Auth) | `DATABASE_URL` | `users`, `firms`, `firm_users`, `super_admins`, `admin_roles`, `sales_owners`, `referral_codes`, `user_referrals`, `tenant_referrals` (+ history), `contact_enquiries`, `newsletter_subscribers`, `marketing_promos`, `demo_*`, `support_queries`, `templates` (Sequelize) |
| `docDB.js` | `DOCDB_URL` | `secret_manager`, `system_prompts`, `prompt_roles`, `llm_models`, `llm_model_parameters`, `llm_chat_config`, `summarization_chat_config`, `chatbot_config`, `error_logs`, `api_audit_logs` |
| `draftDB.js` | `DRAFT_DB_URL` | `agent_prompts`, template files |
| `payment_DB.js` | `PAYMENT_DB_URL` | `monthly_plans`, `subscription_plans`, `topup_plans`, `addon_plans`, `user_subscriptions`, `payments` (GST in paise), `payment_orders`, `payment_refunds`, `payment_webhook_events`, `app_invoices`, `app_invoice_sequences`, `user_token_topup_purchases`, `user_storage_addon_purchases`, `reconciliation_*` |
| `citationDB.js` / `citationAnalyticsDB.js` | `CITATION_DB_URL` / `CITATION_ANALYTICS_DB_URL` | citation pipeline / `citation_usage_events`, `citation_rate_card` |
| `aiDocumentDB.js` | `AI_DOCUMENT_DB_URL` (fallback `CHATBOT_DATABASE_URL`) | `documents`, `document_chunks`, `chunk_embeddings`, chat sessions/messages |
| `supportSequelize.js` | `SUPPORT_DATABASE_URL` (fallback `SUPPORT_DB_URL`) | support workspace tables (Sequelize) |

## Migrations
- `database/migrations/*.sql` — idempotent DDL (`CREATE … IF NOT EXISTS`, `ADD COLUMN IF NOT EXISTS`).
- `database/migrations/run_*.js` — runners: `npm run migrate:<name>` (see `package.json`).
- Several modules also apply their own SQL at startup (`ensure*Schema()` in marketing, referrals, payments) so a fresh environment boots without manual steps.
- `database/seeders/seed_*.js` — role and plan seeds (`npm run seed:finance-admin-role`, …).
- The user-facing payment service owns `payments`, `payment_orders`, `payment_refunds`, `app_invoices`; this backend only reads them.

## Conventions
- Timestamps are `TIMESTAMPTZ`; IST calendar-day filters convert inclusive `from`/`to` days to `>= start` / `< next-day start` (`shared/utils/time.js`).
- Money columns are `BIGINT` paise; API responses carry exact 2-dp strings.
