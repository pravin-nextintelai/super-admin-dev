const express = require('express');
const adminAuth = require('../../shared/middleware/adminAuth');
const { getConfig, updateConfig } = require('./chatbotConfig.controller');
const { voicePreview } = require('./voicePreview.controller');

const router = (pool) => {
  const r = express.Router();
  const auth = adminAuth(pool);
  r.get('/', auth, getConfig);
  r.put('/', auth, updateConfig);
  r.get('/voice-preview/:voiceName', auth, voicePreview);
  return r;
};

module.exports = router;
