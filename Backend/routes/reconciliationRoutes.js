const express = require('express');

const paymentPool = require('../config/payment_DB');
const { protect, authorize } = require('../middleware/authMiddleware');
const recon = require('../services/reconciliationService');
const logger = require('../config/logger');
const { logPortalFlow } = require('../utils/portalAdminLog');

/**
 * Razorpay reconciliation — mounted at /api/admin/reconciliation. Finance roles only.
 *
 *   POST  /runs                       { startDate, endDate }  (IST days, inclusive) → 202 + run (executes in background)
 *   GET   /runs?page&pageSize&status
 *   GET   /runs/:runId                run + summary + execution events
 *   GET   /runs/:runId/issues?status&type&severity&search&page&pageSize
 *   GET   /runs/:runId/export         CSV of the run's issues
 *   POST  /runs/:runId/retry          new attempt for a failed / partial run
 *   GET   /issues/:issueId            issue + Razorpay snapshot + history
 *   PATCH /issues/:issueId/resolve    { reason }  (mandatory)
 *   PATCH /issues/:issueId/reopen     { reason? }
 *   GET   /issues/:issueId/history
 */
module.exports = (authPool) => {
  const router = express.Router();
  router.use(protect(authPool), authorize(['super-admin', 'finance-admin', 'account-admin']));

  const admin = (req) => ({ id: req.user?.id ?? null, email: req.user?.email ?? null });
  const intParam = (v) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : null; };
  const fail = (res, req, e, what) => {
    logger.errorWithContext(`Reconciliation ${what} failed`, e, { requestId: req.requestId, layer: 'RECONCILIATION' });
    return res.status(500).json({ success: false, message: e.message });
  };
  const kick = (runId) => setImmediate(() => recon.executeRun(paymentPool, runId).catch((e) =>
    logger.errorWithContext('Reconciliation run execution error', e, { layer: 'RECONCILIATION', summary: { runId } })));

  router.post('/runs', async (req, res) => {
    try {
      const out = await recon.createRun(paymentPool, { body: req.body || {}, admin: admin(req) });
      if (out.error) return res.status(out.status).json({ success: false, message: out.error });
      logPortalFlow(req, 'Reconciliation run created', { layer: 'RECONCILIATION', summary: { runId: out.run.id, range: `${out.run.range_start}→${out.run.range_end}` } });
      kick(out.run.id);
      return res.status(202).json({ success: true, data: recon.serializeRun(out.run) });
    } catch (e) { return fail(res, req, e, 'run create'); }
  });

  router.get('/runs', async (req, res) => {
    try { return res.json({ success: true, data: await recon.listRuns(paymentPool, req.query) }); }
    catch (e) { return fail(res, req, e, 'runs list'); }
  });

  router.get('/runs/:runId', async (req, res) => {
    const id = intParam(req.params.runId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid run id' });
    try {
      const run = await recon.getRun(paymentPool, id);
      if (!run) return res.status(404).json({ success: false, message: 'Run not found' });
      return res.json({ success: true, data: run });
    } catch (e) { return fail(res, req, e, 'run detail'); }
  });

  router.get('/runs/:runId/issues', async (req, res) => {
    const id = intParam(req.params.runId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid run id' });
    try { return res.json({ success: true, data: await recon.listIssues(paymentPool, id, req.query) }); }
    catch (e) { return fail(res, req, e, 'issues list'); }
  });

  router.get('/runs/:runId/export', async (req, res) => {
    const id = intParam(req.params.runId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid run id' });
    try {
      const out = await recon.exportRun(paymentPool, id);
      if (!out) return res.status(404).json({ success: false, message: 'Run not found' });
      logPortalFlow(req, 'Reconciliation run exported', { layer: 'RECONCILIATION', summary: { runId: id } });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${out.filename}"`);
      return res.status(200).send(out.csv);
    } catch (e) { return fail(res, req, e, 'run export'); }
  });

  router.post('/runs/:runId/retry', async (req, res) => {
    const id = intParam(req.params.runId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid run id' });
    try {
      const out = await recon.retryRun(paymentPool, id, admin(req));
      if (out.error) return res.status(out.status).json({ success: false, message: out.error });
      logPortalFlow(req, 'Reconciliation run retried', { layer: 'RECONCILIATION', summary: { runId: out.run.id, retryOf: id } });
      kick(out.run.id);
      return res.status(202).json({ success: true, data: recon.serializeRun(out.run) });
    } catch (e) { return fail(res, req, e, 'run retry'); }
  });

  router.get('/issues/:issueId', async (req, res) => {
    const id = intParam(req.params.issueId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid issue id' });
    try {
      const issue = await recon.getIssue(paymentPool, id);
      if (!issue) return res.status(404).json({ success: false, message: 'Issue not found' });
      return res.json({ success: true, data: issue });
    } catch (e) { return fail(res, req, e, 'issue detail'); }
  });

  router.get('/issues/:issueId/history', async (req, res) => {
    const id = intParam(req.params.issueId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid issue id' });
    try { return res.json({ success: true, data: await recon.issueHistory(paymentPool, id) }); }
    catch (e) { return fail(res, req, e, 'issue history'); }
  });

  const transition = (action) => async (req, res) => {
    const id = intParam(req.params.issueId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid issue id' });
    try {
      const out = await recon.transitionIssue(paymentPool, id, action, { reason: req.body?.reason, admin: admin(req) });
      if (out.error) return res.status(out.status).json({ success: false, message: out.error });
      logPortalFlow(req, `Reconciliation issue ${action}d`, { layer: 'RECONCILIATION', summary: { issueId: id, reason: req.body?.reason } });
      return res.json({ success: true, data: out.issue });
    } catch (e) { return fail(res, req, e, `issue ${action}`); }
  };
  router.patch('/issues/:issueId/resolve', transition('resolve'));
  router.patch('/issues/:issueId/reopen', transition('reopen'));

  return router;
};
