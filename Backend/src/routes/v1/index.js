/**
 * Route registry — single source of truth for every HTTP mount.
 *
 * Every router is mounted twice, in the SAME order as the original server.js so overlapping prefixes
 * (e.g. `/api/admin` vs `/api/admin/plans`) keep their precedence:
 *   1. its legacy path   (unchanged — nothing that exists today moves or breaks)
 *   2. its versioned path  /api/v1/<path without the /api prefix>   (`/admin/jurinex-voice` → `/api/v1/admin/jurinex-voice`)
 *
 * `pools` = { pool (Auth/Main DB), docPool, draftPool, paymentPool, citationPool, citationAnalyticsPool }.
 */
const express = require('express');

// modules
const authRoutes = require('../../modules/auth/auth.routes');
const adminRoutes = require('../../modules/admin/admin.routes');
const userRoutes = require('../../modules/users/users.routes');
const adminTemplateRoutes = require('../../modules/templates/adminTemplate.routes');
const planRoutes = require('../../modules/plans/plan.routes');
const monthlyPlanRoutes = require('../../modules/plans/monthlyPlan.routes');
const topupPlanRoutes = require('../../modules/plans/topupPlan.routes');
const addonPlanRoutes = require('../../modules/plans/addonPlan.routes');
const userAnalyticsRoutes = require('../../modules/users/userAnalytics.routes');
const planAnalyticsRoutes = require('../../modules/billing/planAnalytics.routes');
const usersPlansRoutes = require('../../modules/billing/usersPlans.routes');
const reconciliationRoutes = require('../../modules/payments/reconciliation.routes');
const supportQueryRoutes = require('../../modules/support/supportQuery.routes');
const supportPriorityRoutes = require('../../modules/support/supportPriority.routes');
const supportWorkspaceRoutes = require('../../modules/support/workspace.routes');
const secretRoutes = require('../../modules/admin/secretManager.routes');
const contentRoutes = require('../../modules/admin/content.routes');
const llmRoutes = require('../../modules/ai-analysis/llm.routes');
const chunkingMethodRoutes = require('../../modules/document-processing/chunkingMethod.routes');
const systemPromptRoutes = require('../../modules/instructions/systemPrompt.routes');
const promptRoleRoutes = require('../../modules/instructions/promptRole.routes');
const userPresetPromptRoutes = require('../../modules/instructions/userPresetPrompt.routes');
const appRolesRoutes = require('../../modules/roles-permissions/appRoles.routes');
const agentPromptRoutes = require('../../modules/instructions/agentPrompt.routes');
const llmUsageRoutes = require('../../modules/usage-metering/llmUsage.routes');
const tokenUsageRoutes = require('../../modules/usage-metering/tokenUsage.routes');
const fileRoutes = require('../../modules/file-manager/file.routes');
const judgementRoutes = require('../../modules/legal-research/judgement.routes');
const citationAdminRoutes = require('../../modules/citations/citations.routes');
const userAdminRoutes = require('../../modules/users/usersAdmin.routes');
const llmChatConfigRoutes = require('../../modules/ai-chat/llmChatConfig.routes');
const summarizationChatConfigRoutes = require('../../modules/ai-chat/summarizationChatConfig.routes');
const aiDocumentRoutes = require('../../modules/ai-analysis/aiDocument.routes');
const chatbotConfigRoutes = require('../../modules/ai-chat/chatbotConfig.routes');
const chatbotTokenUsageRoutes = require('../../modules/usage-metering/chatbotTokenUsage.routes');
const chatHistoryRoutes = require('../../modules/ai-chat/chatHistory.routes');
const demoRoutes = require('../../modules/marketing/demo.routes');
const contactEnquiryRoutes = require('../../modules/marketing/contactEnquiry.routes');
const publicContactRoutes = require('../../modules/marketing/publicContact.routes');
const newsletterSubscriberRoutes = require('../../modules/marketing/newsletterSubscriber.routes');
const publicNewsletterRoutes = require('../../modules/marketing/publicNewsletter.routes');
const marketingPromoRoutes = require('../../modules/marketing/marketingPromo.routes');
const publicPromoRoutes = require('../../modules/marketing/publicPromo.routes');
const errorLogRoutes = require('../../modules/admin/errorLog.routes');
const auditLogRoutes = require('../../modules/admin/auditLog.routes');
const onboardedUsersRoutes = require('../../modules/users/onboardedUsers.routes');
const referralDataRoutes = require('../../modules/referrals/referralData.routes');
const salesReferralsRoutes = require('../../modules/referrals/salesReferrals.routes');
const jurinexVoiceRoutes = require('../../modules/jurinex-voice');

const V1_PREFIX = '/api/v1';

/** `/api/foo` → `/api/v1/foo`; `/admin/foo` → `/api/v1/admin/foo`; already-versioned paths map to themselves. */
function toV1(path) {
  if (path.startsWith(`${V1_PREFIX}/`) || path === V1_PREFIX) return path;
  if (path.startsWith('/api/')) return `${V1_PREFIX}${path.slice(4)}`;
  return `${V1_PREFIX}${path}`;
}

/** Public website intake — mounted BEFORE the portal CORS allow-list (each carries its own CORS + rate limit). */
function publicRoutes({ pool }) {
  return [
    { path: '/api/public/contact', router: publicContactRoutes(pool), log: '"Contact Jurinex" form intake (Main DB, rate-limited, own CORS)' },
    { path: '/api/public/newsletter', router: publicNewsletterRoutes(pool), log: 'Website newsletter subscribe (Main DB, rate-limited, own CORS)' },
    { path: '/api/public/promos', router: publicPromoRoutes(pool), log: 'Website header offers/events (Main DB, own CORS)' },
  ];
}

/** Everything behind the portal CORS allow-list + JSON body parser + request logging. Order matters. */
function apiRoutes({ pool, docPool, draftPool, paymentPool, citationPool, citationAnalyticsPool }) {
  const health = express.Router();
  health.get('/', async (req, res) => {
    const checks = {};
    try { await pool.query('SELECT 1'); checks.authDB = 'ok'; } catch (e) { checks.authDB = `error: ${e.message}`; }
    try { await citationPool.query('SELECT 1'); checks.citationDB = 'ok'; } catch (e) { checks.citationDB = `error: ${e.message}`; }
    const allOk = checks.authDB === 'ok' && checks.citationDB === 'ok';
    res.status(allOk ? 200 : 503).json({ success: allOk, databases: checks });
  });
  const voice = jurinexVoiceRoutes(pool);

  return [
    { path: '/api/admins', router: adminRoutes(pool), log: 'Admin accounts (Main DB)' },
    { path: '/api/system-prompts', router: systemPromptRoutes(pool), log: 'Using docDB (docPool) for data, Main DB (pool) for auth' },
    { path: '/api/prompt-roles', router: promptRoleRoutes(pool), log: 'Using docDB (docPool) for data, Main DB (pool) for auth' },
    { path: '/api/user-preset-prompts', router: userPresetPromptRoutes(pool), log: 'Using docDB (docPool) for prompts, Main DB (pool) for auth + user lookup' },
    { path: '/api/app-roles', router: appRolesRoutes(pool), log: 'Using Main DB (pool) — Jurinex application roles' },
    { path: '/api/agent-prompts', router: agentPromptRoutes(pool), log: 'Using draftDB for data, Main DB (pool) for auth' },
    { path: '/api/auth', router: authRoutes(pool), log: 'Using Main DB (pool)' },
    { path: '/api/users', router: userRoutes(pool), log: 'Using Main DB (pool)' },
    { path: '/api/admin/templates', router: adminTemplateRoutes(draftPool), log: 'Using Draft DB' },
    { path: '/api/citation-admin', router: citationAdminRoutes(citationPool, pool, docPool, citationAnalyticsPool), log: 'Using Citation DB + Auth DB + docDB + Citation Cost DB' },
    { path: '/api/admin/plans', router: planRoutes(paymentPool), log: 'Using Payment DB (paymentPool)' },
    { path: '/api/admin/monthly-plans', router: monthlyPlanRoutes(paymentPool), log: 'Using Payment DB (paymentPool)' },
    { path: '/api/admin/topup-plans', router: topupPlanRoutes(paymentPool), log: 'Using Payment DB (paymentPool)' },
    { path: '/api/admin/addon-plans', router: addonPlanRoutes(paymentPool), log: 'Using Payment DB (paymentPool)' },
    { path: '/api/admin/user-analytics', router: userAnalyticsRoutes(pool), log: 'Read-only across Auth+Payment+Document+Draft+Citation DBs' },
    { path: '/api/admin/plan-analytics', router: planAnalyticsRoutes(pool), log: 'Read-only plan purchase analytics (Auth + Payment DBs)' },
    { path: '/api/admin/users-plans', router: usersPlansRoutes(pool), log: 'Finance Admin Users & Plans (GST, invoices, attribution, transactions)' },
    { path: '/api/admin/reconciliation', router: reconciliationRoutes(pool), log: 'Razorpay ↔ Payment DB reconciliation runs, issues, audit history' },
    { path: '/api/support-queries', router: supportQueryRoutes(pool), log: 'Using Main DB (pool)' },
    { path: '/api/support-priorities', router: supportPriorityRoutes(pool), log: 'Using Support DB (supportSequelize)' },
    { path: '/api/support-admin', router: supportWorkspaceRoutes(pool), log: 'Using Support DB + Main DB auth' },
    { path: '/api/secrets', router: secretRoutes(docPool), log: 'Using docDB (docPool)' },
    { path: '/api/contents', router: contentRoutes(docPool), log: 'Using docDB (docPool)' },
    { path: '/api/llm', router: llmRoutes(pool), log: 'LLM models (docDB) with Main DB auth' },
    { path: '/api/chunking-methods', router: chunkingMethodRoutes, log: 'Using docDB (docPool)' },
    { path: '/api/llm-usage', router: llmUsageRoutes(pool), log: 'Using Payment DB (paymentPool)' },
    { path: '/api/token-usage', router: tokenUsageRoutes(pool), log: 'Using Payment DB (paymentPool)' },
    { path: '/api/file', router: fileRoutes(pool), log: 'Using Main DB (pool)' },
    { path: '/api/judgements-admin', router: judgementRoutes(pool), log: `Proxying protected admin uploads to judgement-service (${String(process.env.JUDGEMENT_SERVICE_URL || 'http://localhost:8095').replace(/\/+$/, '')})` },
    { path: '/api/admin/health', router: health, log: 'Health check (no auth)' },
    { path: '/api/admin/users', router: userAdminRoutes(pool), log: 'Using Auth DB (pool)' },
    { path: '/api/admin/llm-config', router: llmChatConfigRoutes(pool), log: 'Using docDB (docPool) for config, Main DB (pool) for auth' },
    { path: '/api/admin/summarization-chat-config', router: summarizationChatConfigRoutes(pool), log: 'Using docDB (docPool) for config, Main DB (pool) for auth' },
    { path: '/api/admin', router: aiDocumentRoutes(pool), log: 'AI Document Processing (GCS + Document AI + Gemini Embeddings)' },
    { path: '/api/admin/chatbot-config', router: chatbotConfigRoutes(pool), log: 'Chatbot model & voice configuration' },
    { path: '/api/admin/chatbot-token-usage', router: chatbotTokenUsageRoutes(pool), log: 'Chatbot token usage & cost analytics (SSE)' },
    { path: '/api/admin/chat-history', router: chatHistoryRoutes(pool), log: 'All chatbot sessions & messages' },
    { path: '/api/admin/demo', router: demoRoutes(pool), log: 'Demo booking & slot management' },
    { path: '/api/admin/contact-enquiries', router: contactEnquiryRoutes(pool), log: 'Marketing: "Contact Jurinex" form enquiries' },
    { path: '/api/admin/newsletter-subscribers', router: newsletterSubscriberRoutes(pool), log: 'Marketing: website newsletter list' },
    { path: '/api/admin/promos', router: marketingPromoRoutes(pool), log: 'Marketing: header offers & events' },
    { path: '/api/admin/error-logs', router: errorLogRoutes(pool, docPool), log: 'Platform error logs (Document_DB error_logs)' },
    { path: '/api/admin/audit-logs', router: auditLogRoutes(pool, docPool), log: 'Activity & Error Logs (Document_DB api_audit_logs)' },
    { path: '/api/admin/onboarded-users', router: onboardedUsersRoutes(pool, paymentPool), log: 'Users by onboarding channel + subscription history, CSV' },
    { path: '/api/admin/sales-referrals/data', router: referralDataRoutes(pool, paymentPool), log: 'All referral data: workspaces + plan purchases + CSV' },
    { path: '/api/admin/sales-referrals', router: salesReferralsRoutes(pool), log: 'Sales owners, referral codes, attribution reports' },
    { path: '/admin/jurinex-voice', router: voice, log: 'Voice agent management + KB (jurinex-voice-docs bucket)' },
    { path: '/api/admin/jurinex-voice', router: voice, log: 'Voice agent management (standard /api base)' },
  ];
}

/** Mount each entry at its legacy path and its /api/v1 path (deduplicated), preserving order. */
function mountAll(app, entries, { log = () => {} } = {}) {
  const mounted = new Set();
  for (const { path, router, log: note } of entries) {
    for (const p of [path, toV1(path)]) {
      if (mounted.has(p)) continue;
      mounted.add(p);
      app.use(p, router);
    }
    log(`📌 ${path}  (+ ${toV1(path)}) → ${note}`);
  }
  return [...mounted];
}

module.exports = { publicRoutes, apiRoutes, mountAll, toV1, V1_PREFIX };
