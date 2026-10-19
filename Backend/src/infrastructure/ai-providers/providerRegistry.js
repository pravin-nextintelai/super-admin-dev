/**
 * AI provider registry (blueprint: infrastructure/ai-providers/providerRegistry.js).
 * Modules ask for a provider by name instead of importing vendor SDKs directly.
 */
const providers = {
  gemini: require('./gemini'),
};

function getProvider(name = process.env.AI_DEFAULT_PROVIDER || 'gemini') {
  const p = providers[String(name).toLowerCase()];
  if (!p) throw new Error(`Unknown AI provider "${name}" (available: ${Object.keys(providers).join(', ')})`);
  return p;
}

module.exports = { getProvider, listProviders: () => Object.keys(providers) };
