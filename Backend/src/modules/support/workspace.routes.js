const express = require('express');

const { protect, authorize } = require('../../shared/middleware/authenticate');
const {
  loadSupportWorkspaceContext,
  requireSupportManager,
} = require('./workspace.middleware');

module.exports = (pool) => {
  const router = express.Router();
  const controller = require('./workspace.controller')(pool);

  router.use(protect(pool), authorize(['super-admin', 'support-admin', 'admin']), loadSupportWorkspaceContext());

  router.get('/workspace', controller.getWorkspace);
  router.get('/team/members', controller.listTeamMembers);
  router.post('/team/members', requireSupportManager(), controller.createTeamMember);
  router.put('/team/members/:adminId', requireSupportManager(), controller.updateTeamMember);
  router.post('/tickets/bulk-assign', requireSupportManager(), controller.bulkAssignTickets);
  router.get('/tickets/:id', controller.getTicketById);
  router.patch('/tickets/:id', controller.updateTicket);

  return router;
};
