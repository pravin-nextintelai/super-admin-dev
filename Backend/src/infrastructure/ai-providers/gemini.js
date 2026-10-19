/**
 * Gemini provider adapter (blueprint: infrastructure/ai-providers/gemini.js).
 * One place to build a `@google/genai` client from the environment so modules don't read API keys themselves.
 */
const ai = require('../../config/ai');

let client = null;

/** Lazily constructed, process-wide GoogleGenAI client. Throws a clear error when no key is configured. */
function getGeminiClient() {
  if (client) return client;
  const apiKey = ai.gemini.apiKey();
  if (!apiKey) throw new Error('Gemini is not configured: set GEMINI_API_KEY (or GOOGLE_API_KEY)');
  const { GoogleGenAI } = require('@google/genai');
  client = new GoogleGenAI({ apiKey });
  return client;
}

module.exports = {
  name: 'gemini',
  configured: () => ai.gemini.configured,
  getClient: getGeminiClient,
  defaults: { embeddingModel: ai.gemini.embeddingModel, embeddingDim: ai.gemini.embeddingDim },
};
