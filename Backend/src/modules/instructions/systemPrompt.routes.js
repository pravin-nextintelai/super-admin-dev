// routes/systemPromptRoutes.js
const express = require('express');
const router = express.Router();
const { protect, authorize } = require('../../shared/middleware/authenticate');
const systemPromptController = require('./systemPrompt.controller');

module.exports = (pool) => {
  // Solo-user / role-based access (must be before /:id to avoid route conflict)
  // GET /api/system-prompts/for-user?role_id=X&user_id=Y
  router.get('/for-user', protect(pool), systemPromptController.getPromptsForUser);

  // Admin: CRUD
  router.post('/', protect(pool), authorize(['super-admin']), systemPromptController.createSystemPrompt);
  router.get('/', protect(pool), authorize(['super-admin']), systemPromptController.getAllSystemPrompts);
  router.get('/:id', protect(pool), authorize(['super-admin']), systemPromptController.getSystemPromptById);
  router.put('/:id', protect(pool), authorize(['super-admin']), systemPromptController.updateSystemPrompt);
  router.delete('/:id', protect(pool), authorize(['super-admin']), systemPromptController.deleteSystemPrompt);

  return router;
};
