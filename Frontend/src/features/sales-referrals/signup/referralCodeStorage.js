// Remembers a referral code that arrived via a link for 30 days. Every read/write is guarded:
// storage can be unavailable (private mode, blocked site data) and the field must still work.
const KEY = 'jurinex.referralCode';
export const REFERRAL_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** @returns {string | null} the remembered code, or null when missing / expired / unreadable */
export const readRememberedReferralCode = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.code || !parsed?.expiresAt || Date.now() > Number(parsed.expiresAt)) {
      localStorage.removeItem(KEY);
      return null;
    }
    return String(parsed.code);
  } catch {
    return null;
  }
};

export const rememberReferralCode = (code) => {
  try {
    localStorage.setItem(KEY, JSON.stringify({ code, savedAt: Date.now(), expiresAt: Date.now() + REFERRAL_TTL_MS }));
  } catch { /* storage unavailable — the code still works for this page */ }
};

export const clearRememberedReferralCode = () => {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
};
