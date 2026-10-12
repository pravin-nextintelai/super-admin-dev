// Route paths for the Sales Referrals module. All of them are super-admin only
// (registered in App.jsx with `RequireRole allow={[]}`).
export const SALES_REFERRALS_BASE = '/dashboard/sales-referrals';

export const SALES_REFERRALS_ROUTES = Object.freeze({
  // Relative segments used by <Route> in App.jsx
  overview: 'sales-referrals',
  owner: 'sales-referrals/:ownerId',
  codeSignups: 'sales-referrals/:ownerId/codes/:codeId',
  ownerSignups: 'sales-referrals/:ownerId/signups',
});

/** Keeps the current `?from=&to=` date filter when moving between pages. */
const withSearch = (path, search) => (search ? `${path}${search.startsWith('?') ? search : `?${search}`}` : path);

export const salesReferralsPath = Object.freeze({
  overview: (search = '') => withSearch(SALES_REFERRALS_BASE, search),
  owner: (ownerId, search = '') => withSearch(`${SALES_REFERRALS_BASE}/${encodeURIComponent(ownerId)}`, search),
  codeSignups: (ownerId, codeId, search = '') =>
    withSearch(`${SALES_REFERRALS_BASE}/${encodeURIComponent(ownerId)}/codes/${encodeURIComponent(codeId)}`, search),
  ownerSignups: (ownerId, search = '') => withSearch(`${SALES_REFERRALS_BASE}/${encodeURIComponent(ownerId)}/signups`, search),
});
