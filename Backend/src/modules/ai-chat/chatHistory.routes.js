const express = require('express');
const adminAuth = require('../../shared/middleware/adminAuth');
const { getAllSessions, getSessionMessages } = require('./chatHistory.controller');

const router = (pool) => {
  const r = express.Router();
  const auth = adminAuth(pool);

  r.get('/',           auth, getAllSessions);
  r.get('/:sessionId', auth, getSessionMessages);

  return r;
};

module.exports = router;
