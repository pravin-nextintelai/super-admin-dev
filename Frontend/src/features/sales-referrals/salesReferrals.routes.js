// Route paths for the Sales Referrals module. Super-admin and finance-admin only
// (registered in App.jsx with `RequireRole allow={['finance-admin']}`).
export const SALES_REFERRALS_BASE = '/dashboard/sales-referrals';

export const SALES_REFERRALS_ROUTES = Object.freeze({
  // Relative segments used by <Route> in App.jsx
  overview: 'sales-referrals',
  data: 'sales-referrals/data',
  owner: 'sales-referrals/:ownerId',
  codeSignups: 'sales-referrals/:ownerId/codes/:codeId',
  ownerSignups: 'sales-referrals/:ownerId/signups',
});

/** Keeps the current `?from=&to=` date filter when moving between pages. */
const withSearch = (path, search) => (search ? `${path}${search.startsWith('?') ? search : `?${search}`}` : path);

export const salesReferralsPath = Object.freeze({
  overview: (search = '') => withSearch(SALES_REFERRALS_BASE, search),
  data: (search = '') => withSearch(`${SALES_REFERRALS_BASE}/data`, search),
  owner: (ownerId, search = '') => withSearch(`${SALES_REFERRALS_BASE}/${encodeURIComponent(ownerId)}`, search),
  codeSignups: (ownerId, codeId, search = '') =>
    withSearch(`${SALES_REFERRALS_BASE}/${encodeURIComponent(ownerId)}/codes/${encodeURIComponent(codeId)}`, search),
  ownerSignups: (ownerId, search = '') => withSearch(`${SALES_REFERRALS_BASE}/${encodeURIComponent(ownerId)}/signups`, search),
});
