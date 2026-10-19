const express = require('express');

const paymentPool = require('../../infrastructure/database/connections/payment_DB');
const { protect, authorize } = require('../../shared/middleware/authenticate');

// Read-only plan-purchase analytics. authPool (Main DB) passed in by server.js.
module.exports = (authPool) => {
  const router = express.Router();
  const pools = { authPool, paymentPool };

  router.use(protect(authPool), authorize(['user-admin', 'super-admin', 'account-admin', 'finance-admin']));

  const load = () => {
    const p = require.resolve('./planAnalytics.controller');
    delete require.cache[p];
    return require(p);
  };

  // Mounted at /api/admin/plan-analytics
  router.get('/summary', (req, res) => load().getSummary(req, res, pools));
  router.get('/subscribers/export', (req, res) => load().exportSubscribers(req, res, pools));
  router.get('/subscribers/filters', (req, res) => load().getSubscriberFilters(req, res, pools));
  router.get('/subscribers/:userId/transactions', (req, res) => load().getSubscriberTransactions(req, res, pools));
  router.get('/subscribers/:userId/payments/:paymentId/:doc', (req, res) => load().downloadSubscriberDocument(req, res, pools));
  router.get('/subscribers/:userId/invoices', (req, res) => load().getSubscriberInvoices(req, res, pools));
  router.get('/subscribers/:userId', (req, res) => load().getSubscriberDetail(req, res, pools));
  router.get('/subscribers', (req, res) => load().getSubscribers(req, res, pools));
  router.get('/monthly/:planId/subscribers', (req, res) => load().getMonthlySubscribers(req, res, pools));
  router.get('/topup/:planId/buyers', (req, res) => load().getTopupBuyers(req, res, pools));
  router.get('/addon/:planId/buyers', (req, res) => load().getAddonBuyers(req, res, pools));

  return router;
};
