/**
 * Payment-provider configuration (Razorpay). Values come from the environment; secrets are never logged.
 * The admin backend only READS Razorpay (reconciliation) — checkout/webhooks live in the user-facing app.
 */
const { resolveConfig } = require('../infrastructure/payments/razorpayClient');

function razorpayConfig(overrides = {}) {
  const cfg = resolveConfig(overrides);
  return { ...cfg, keySecret: undefined, configured: Boolean(cfg.keyId && cfg.keySecret) };
}

module.exports = {
  razorpayConfig,
  invoiceRequiredSince: process.env.RECON_INVOICE_REQUIRED_SINCE || null,
  fetchOrders: String(process.env.RECON_FETCH_ORDERS).toLowerCase() === 'true',
};
