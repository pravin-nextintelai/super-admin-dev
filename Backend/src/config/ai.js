/**
 * AI provider configuration (read-only view of the environment). Keys are exposed as `configured`
 * booleans so they can be checked without being printed.
 */
const env = process.env;

module.exports = Object.freeze({
  gemini: {
    configured: Boolean(env.GEMINI_API_KEY || env.GOOGLE_API_KEY),
    apiKey: () => env.GEMINI_API_KEY || env.GOOGLE_API_KEY || null,
    embeddingModel: env.EMBEDDING_MODEL || null,
    embeddingDim: env.EMBEDDING_DIM ? Number(env.EMBEDDING_DIM) : null,
  },
  documentAi: {
    projectId: env.GCLOUD_PROJECT_ID || env.GCP_PROJECT_ID || env.GCS_PROJECT_ID || null,
    location: env.DOCUMENT_AI_LOCATION || 'us',
    processorId: env.DOCUMENT_AI_PROCESSOR_ID || null,
    ocrVersion: env.DOCUMENT_AI_OCR_VERSION || null,
    useBatchOcr: String(env.DOCUMENT_AI_USE_BATCH_OCR).toLowerCase() === 'true',
  },
  chunking: {
    tokens: env.KB_CHUNK_TOKENS ? Number(env.KB_CHUNK_TOKENS) : null,
    overlap: env.KB_CHUNK_OVERLAP ? Number(env.KB_CHUNK_OVERLAP) : null,
  },
});
