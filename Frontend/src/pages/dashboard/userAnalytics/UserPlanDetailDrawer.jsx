import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, Building2, CreditCard, Download, FileText, Lock, Package, ReceiptText, RefreshCw, RotateCcw, Tag, UserCheck, X,
} from 'lucide-react';
import { fmtDateIST, fmtDateTimeIST, fmtMoneyStr, fmtNum, fmtPaise } from './analyticsFormat';
import { downloadUsersPlanDocument, fetchUsersPlanDetail } from './analyticsApi';
import { createDebugLogger } from '../../../utils/debugLogger';

const log = createDebugLogger('UserPlanDetailDrawer');

const PILL = {
  new: 'bg-blue-50 text-blue-700 border-blue-200',
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  blocked: 'bg-red-50 text-red-700 border-red-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  INTERNAL: 'bg-blue-50 text-blue-700 border-blue-200',
  OUTSOURCED: 'bg-amber-50 text-amber-700 border-amber-200',
  DIRECT: 'bg-slate-100 text-slate-600 border-slate-200',
};
const PAY_PILL = (status, isPaid) => (isPaid ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
  : /fail|cancel/i.test(status || '') ? 'bg-red-50 text-red-700 border-red-200'
    : /refund/i.test(status || '') ? 'bg-violet-50 text-violet-700 border-violet-200'
      : 'bg-amber-50 text-amber-700 border-amber-200');

export const Pill = ({ value, label, className = '' }) => (
  <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${PILL[value] || 'bg-slate-100 text-slate-600 border-slate-200'} ${className}`}>
    {label || value || '—'}
  </span>
);

const Section = ({ icon, title, children, aside }) => (
  <section className="rounded-xl border border-slate-200 bg-white">
    <header className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-slate-100">
      <h3 className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-600">{React.createElement(icon, { className: 'w-3.5 h-3.5 text-slate-400' })} {title}</h3>
      {aside}
    </header>
    <div className="px-4 py-3">{children}</div>
  </section>
);

const KV = ({ items }) => (
  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
    {items.filter(Boolean).map(([k, v]) => (
      <div key={k} className="flex items-baseline justify-between gap-3 min-w-0">
        <dt className="text-xs text-slate-500 shrink-0">{k}</dt>
        <dd className="text-slate-800 text-right truncate font-medium" title={typeof v === 'string' ? v : undefined}>{v ?? '—'}</dd>
      </div>
    ))}
  </dl>
);

const Mono = ({ children }) => (children ? <span className="font-mono text-[11px] text-slate-700">{children}</span> : <span className="text-slate-400">—</span>);
const money = (v) => fmtMoneyStr(v);
const th = 'px-2 py-1.5 text-left font-semibold text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 whitespace-nowrap';
const td = 'px-2 py-1.5 border-b border-slate-100 align-top whitespace-nowrap';
const num = 'text-right tabular-nums';

/** Right-side drawer: full billing history for one user (GET /api/admin/users-plans/:userId). */
const UserPlanDetailDrawer = ({ userId, onClose, onToast }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [busyKey, setBusyKey] = useState(null);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!userId) return undefined;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    fetchUsersPlanDetail(userId)
      .then((r) => { if (!cancelled) setData(r.data || null); })
      .catch((e) => { if (!cancelled) { setErr(e.message || 'Failed to load user'); log.error('detail:failed', e, { summary: { userId } }); } })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, reload]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const download = async (pay, doc) => {
    const key = `${pay.payment_id}-${doc}`;
    setBusyKey(key);
    try {
      const { blob, filename } = await downloadUsersPlanDocument(userId, pay.payment_id, doc);
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      onToast?.(e.code === 'NO_INVOICE' ? 'info' : 'error', e.code === 'NO_INVOICE' ? 'No invoice for this payment' : `Could not download ${doc}`, e.message);
    } finally {
      setBusyKey(null);
    }
  };

  const u = data?.user || {};
  const payments = data?.payments || [];
  const packs = [...(data?.topups || []), ...(data?.addons || [])];
  const name = u.username || `User #${userId}`;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-labelledby="user-detail-title">
      <div className="absolute inset-0 bg-slate-900/40" onMouseDown={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-4xl bg-slate-50 shadow-2xl flex flex-col">
        <header className="shrink-0 flex items-start justify-between gap-3 px-5 py-4 bg-white border-b border-slate-200">
          <div className="min-w-0">
            <h2 id="user-detail-title" className="text-lg font-bold text-slate-800 leading-tight flex items-center gap-2 truncate">
              {name}
              {u.is_blocked && <Lock className="w-4 h-4 text-red-500" />}
              {u.user_status && <Pill value={u.user_status} />}
            </h2>
            <p className="text-xs text-slate-500 truncate">{u.email || ''}{u.phone ? ` · ${u.phone}` : ''}{u.location ? ` · ${u.location}` : ''} · User #{userId}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" onClick={() => setReload((n) => n + 1)} className="p-2 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" title="Reload"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /></button>
            <button type="button" onClick={onClose} className="p-2 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close (Esc)"><X className="w-4 h-4" /></button>
          </div>
        </header>

        <div className="flex-1 min-h-0 overflow-auto custom-scrollbar px-5 py-4 space-y-4">
          {err ? (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 shrink-0" /> {err}
              <button type="button" onClick={() => setReload((n) => n + 1)} className="ml-auto text-xs font-semibold underline">Retry</button>
            </div>
          ) : loading && !data ? (
            <div className="space-y-3 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-slate-200/60 rounded-xl" />)}</div>
          ) : data && (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section icon={UserCheck} title="Attribution">
                  <KV items={[
                    ['Sales owner', u.sales_owner?.name || <span className="text-slate-400">Direct (no referral)</span>],
                    ['Owner type', <Pill value={u.owner_type || 'DIRECT'} />],
                    ['Referral code', u.referral_code ? <Mono>{u.referral_code}</Mono> : '—'],
                    u.referral?.label && ['Code label', u.referral.label],
                    u.referral?.level && ['Attributed via', u.referral.level === 'workspace' ? 'Workspace code' : 'Own code'],
                    u.referral?.source && ['Source', u.referral.source],
                    ['Joined', fmtDateTimeIST(u.joined_at || u.created_at)],
                  ]} />
                </Section>
                <Section icon={Building2} title="Workspace / firm">
                  {data.firm ? (
                    <KV items={[
                      ['Firm', data.firm.firm_name || data.firm.name],
                      ['Type', data.firm.firm_type],
                      ['GSTIN', data.firm.gst_number || data.firm.gstin || '—'],
                      ['City / state', [data.firm.city, data.firm.state].filter(Boolean).join(', ') || '—'],
                      ['Approval', data.firm.approval_status],
                      ['Role', u.firm_role || (data.firm.admin_user_id === u.user_id ? 'Admin' : 'Member')],
                    ]} />
                  ) : <p className="text-sm text-slate-400">Solo user, no workspace.</p>}
                </Section>
                <Section icon={CreditCard} title="Billing totals">
                  <KV items={[
                    ['Current plan', u.plan_name || 'Free'],
                    ['Paid plan payments', fmtNum(data.totals?.paid_plan_payments)],
                    ['Plan paid total', money(data.totals?.plan_paid_total)],
                    ['Refunded', money(data.totals?.refunded_total)],
                    ['Top-ups / add-ons', fmtNum(packs.length)],
                  ]} />
                </Section>
                <Section icon={Package} title="Current subscription">
                  {data.current_subscription ? (
                    <KV items={[
                      ['Plan', data.current_subscription.plan_name],
                      ['Status', data.current_subscription.status],
                      ['Start', fmtDateIST(data.current_subscription.start_date)],
                      ['End', fmtDateIST(data.current_subscription.end_date)],
                      data.current_subscription.current_token_balance != null && ['Token balance', fmtNum(data.current_subscription.current_token_balance)],
                      data.current_subscription.topup_token_balance != null && ['Top-up balance', fmtNum(data.current_subscription.topup_token_balance)],
                    ]} />
                  ) : <p className="text-sm text-slate-400">No subscription on record.</p>}
                </Section>
              </div>

              <Section icon={FileText} title={`Plan payments (${fmtNum(payments.length)})`}>
                {payments.length === 0 ? <p className="text-sm text-slate-400">No plan payments.</p> : (
                  <div className="overflow-auto -mx-4">
                    <table className="min-w-[72rem] w-full text-xs border-separate border-spacing-0">
                      <thead>
                        <tr>
                          {['Date (IST)', 'Plan', 'Status', 'Basic', 'CGST', 'SGST', 'IGST', 'Total', 'Invoice no.', 'Payment ID', 'Order ID', 'Receipt', 'Refund', ''].map((h, i) => (
                            <th key={h || i} className={`${th} ${[3, 4, 5, 6, 7].includes(i) ? 'text-right' : ''}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {payments.map((p) => (
                          <tr key={p.payment_id} className="hover:bg-slate-50/80">
                            <td className={td}>{fmtDateTimeIST(p.purchase_date || p.created_at)}</td>
                            <td className={td}>{p.plan_name || '—'}</td>
                            <td className={td}><span className={`inline-flex h-5 px-1.5 rounded border text-[10px] font-semibold uppercase ${PAY_PILL(p.status, p.is_paid)}`}>{p.status || '—'}</span></td>
                            <td className={`${td} ${num}`}>{money(p.basic_amount)}</td>
                            <td className={`${td} ${num}`}>{money(p.cgst_amount)}</td>
                            <td className={`${td} ${num}`}>{money(p.sgst_amount)}</td>
                            <td className={`${td} ${num}`}>{money(p.igst_amount)}</td>
                            <td className={`${td} ${num} font-semibold`}>{money(p.total_amount)}</td>
                            <td className={td}>{p.invoice_number ? <Mono>{p.invoice_number}</Mono> : <span className="text-slate-400" title="No application invoice">—</span>}</td>
                            <td className={td}><Mono>{p.razorpay_payment_id}</Mono></td>
                            <td className={td}><Mono>{p.razorpay_order_id}</Mono></td>
                            <td className={td}><Mono>{p.razorpay_receipt}</Mono></td>
                            <td className={td}>{p.amount_refunded && p.amount_refunded !== '0.00' ? <span className="text-violet-700">{money(p.amount_refunded)}{p.refund_status ? ` · ${p.refund_status}` : ''}</span> : <span className="text-slate-400">—</span>}</td>
                            <td className={td}>
                              {p.is_paid && (
                                <div className="flex items-center gap-1">
                                  <button type="button" disabled={!p.invoice_number || busyKey === `${p.payment_id}-invoice`} onClick={() => download(p, 'invoice')}
                                    title={p.invoice_number ? 'Download tax invoice (PDF)' : 'No application invoice exists for this payment'}
                                    className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-40 disabled:cursor-not-allowed">
                                    {busyKey === `${p.payment_id}-invoice` ? <Download className="w-3 h-3 animate-pulse" /> : <FileText className="w-3 h-3" />} Invoice
                                  </button>
                                  <button type="button" disabled={busyKey === `${p.payment_id}-receipt`} onClick={() => download(p, 'receipt')} title="Download payment receipt (PDF)"
                                    className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-60">
                                    {busyKey === `${p.payment_id}-receipt` ? <Download className="w-3 h-3 animate-pulse" /> : <ReceiptText className="w-3 h-3" />} Receipt
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Section icon={Package} title={`Top-ups & add-ons (${fmtNum(packs.length)})`}>
                  {packs.length === 0 ? <p className="text-sm text-slate-400">None.</p> : (
                    <table className="w-full text-xs border-separate border-spacing-0">
                      <thead><tr>{['Date', 'Kind', 'Pack', 'Status', 'Amount', 'Payment ID'].map((h, i) => <th key={h} className={`${th} ${i === 4 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
                      <tbody>
                        {packs.map((p) => (
                          <tr key={`${p.kind}-${p.id}`}>
                            <td className={td}>{fmtDateIST(p.purchase_date)}</td>
                            <td className={td}>{p.kind === 'topup' ? 'Top-up' : 'Add-on'}</td>
                            <td className={td}>{p.plan_name || '—'}</td>
                            <td className={td}><span className={`inline-flex h-5 px-1.5 rounded border text-[10px] font-semibold uppercase ${PAY_PILL(p.status, p.is_paid)}`}>{p.status || '—'}</span></td>
                            <td className={`${td} ${num}`}>{money(p.amount)}</td>
                            <td className={td}><Mono>{p.razorpay_payment_id}</Mono></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Section>
                <Section icon={RotateCcw} title={`Refunds (${fmtNum((data.refunds || []).length)})`}>
                  {!data.refunds?.length ? <p className="text-sm text-slate-400">No refunds.</p> : (
                    <table className="w-full text-xs border-separate border-spacing-0">
                      <thead><tr>{['Date', 'Refund ID', 'Payment ID', 'Amount', 'Status', 'Speed'].map((h, i) => <th key={h} className={`${th} ${i === 3 ? 'text-right' : ''}`}>{h}</th>)}</tr></thead>
                      <tbody>
                        {data.refunds.map((r) => (
                          <tr key={r.id}>
                            <td className={td}>{fmtDateTimeIST(r.razorpay_created_at)}</td>
                            <td className={td}><Mono>{r.razorpay_refund_id}</Mono></td>
                            <td className={td}><Mono>{r.razorpay_payment_id}</Mono></td>
                            <td className={`${td} ${num}`}>{r.amount_paise != null ? fmtPaise(r.amount_paise) : typeof r.amount === 'number' ? fmtPaise(r.amount) : money(r.amount)}</td>
                            <td className={td}>{r.status || '—'}</td>
                            <td className={td}>{r.speed || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </Section>
              </div>

              <Section icon={Tag} title={`Subscription history (${fmtNum((data.subscriptions || []).length)})`}>
                {!data.subscriptions?.length ? <p className="text-sm text-slate-400">No subscription rows.</p> : (
                  <table className="w-full text-xs border-separate border-spacing-0">
                    <thead><tr>{['Plan', 'Status', 'Start', 'End', 'Created'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                    <tbody>
                      {data.subscriptions.map((s, i) => (
                        <tr key={s.id || i}>
                          <td className={td}>{s.plan_name || '—'}</td>
                          <td className={td}>{s.status || '—'}</td>
                          <td className={td}>{fmtDateIST(s.start_date)}</td>
                          <td className={td}>{fmtDateIST(s.end_date)}</td>
                          <td className={td}>{fmtDateTimeIST(s.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </Section>
            </>
          )}
        </div>
      </aside>
    </div>
  );
};

export default UserPlanDetailDrawer;
