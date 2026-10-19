import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ticket } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { getTenantReferral, getUserReferral } from '../services/salesReferrals.api';
import { errorText, fmtDateTime } from '../utils/salesReferrals.utils';
import { salesReferralsPath } from '../salesReferrals.routes';
import SetWorkspaceReferralDialog from '../dialogs/SetWorkspaceReferralDialog';
import { Button, CodeStatusBadge, CodeText, SkeletonBlock, TypeBadge } from './primitives';

const T = SALES_REFERRALS_TEXT.workspaceReferral;

/**
 * "Referral" card for the admin user / firm detail page (A17 + A16).
 * `kind` = 'tenant' (firm/workspace id) or 'user' (resolves the user's workspace server-side).
 */
const WorkspaceReferralCard = ({ kind = 'tenant', id, memberCount, className = '' }) => {
  const [data, setData] = useState(null); // { tenantId, firmName, referral }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setData(kind === 'user' ? await getUserReferral(id) : await getTenantReferral(id)); }
    catch (err) { setError(errorText(err)); }
    finally { setLoading(false); }
  }, [kind, id]);

  useEffect(() => { load(); }, [load]);

  const ref = data?.referral;
  const viaCode = ref?.referredBy === 'CODE' && ref.code;

  return (
    <section className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm ${className}`} aria-label={T.title}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-7 h-7 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center"><Ticket className="w-4 h-4" /></span>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{T.title}</span>
          </div>
          {loading ? (
            <div className="space-y-2"><SkeletonBlock className="h-5 w-48" /><SkeletonBlock className="h-3 w-32" /></div>
          ) : error ? (
            <div className="text-sm text-red-600 flex items-center gap-2 flex-wrap">{T.error}: {error}<Button size="sm" onClick={load}>{SALES_REFERRALS_TEXT.common.retry}</Button></div>
          ) : (
            <dl className="text-sm space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <dt className="text-slate-500">{T.referredBy}</dt>
                <dd className="flex items-center gap-2 flex-wrap">
                  {viaCode ? (
                    <>
                      <CodeText code={ref.code.code} struck={!ref.code.active} />
                      {ref.owner && (
                        <>
                          <span className="text-slate-400">·</span>
                          <Link to={salesReferralsPath.owner(ref.owner.id)} className="font-medium text-slate-800 hover:text-blue-700 hover:underline">{ref.owner.name}</Link>
                          <TypeBadge internal={ref.owner.internal} />
                        </>
                      )}
                      {!ref.code.active && <CodeStatusBadge active={false} />}
                    </>
                  ) : (
                    <span className="font-semibold text-slate-800">{T.direct}</span>
                  )}
                  {ref && !ref.tracked && <span className="text-xs text-slate-400">· {T.notTracked}</span>}
                </dd>
              </div>
              {ref?.source === 'ADMIN' && (
                <>
                  <div className="flex gap-2"><dt className="text-slate-500">{T.setBy}</dt><dd className="text-slate-700">{ref.setBy?.name || '—'} · {fmtDateTime(ref.setAt)}</dd></div>
                  {ref.reason && <div className="flex gap-2"><dt className="text-slate-500">{T.reason}</dt><dd className="text-slate-700">{ref.reason}</dd></div>}
                </>
              )}
            </dl>
          )}
        </div>
        {!loading && !error && data?.tenantId && (viaCode
          ? <span className="text-xs text-slate-400" title={T.locked}>{T.locked}</span>
          : <Button size="sm" onClick={() => setOpen(true)}>{T.set}</Button>)}
        {!loading && !error && data && !data.tenantId && (
          <span className="text-xs text-slate-400">{T.noWorkspace}</span>
        )}
      </div>
      <SetWorkspaceReferralDialog
        open={open}
        onClose={() => setOpen(false)}
        workspace={data}
        memberCount={memberCount}
        onSaved={(referral) => setData((d) => ({ ...d, referral }))}
      />
    </section>
  );
};

export default WorkspaceReferralCard;
