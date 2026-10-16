import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Download, Loader2, Search, X } from 'lucide-react';
import { fmtDateTimeIST, fmtIssueType, fmtMoneyStr, fmtNum } from './analyticsFormat';
import { downloadReconciliationComparisonCsv, fetchReconciliationComparison } from './analyticsApi';
import { createDebugLogger } from '../../../utils/debugLogger';

const log = createDebugLogger('ReconciliationComparison');
const PAGE_OPTIONS = [25, 50, 100];
const STATUS = {
  matched: { label: 'Matched', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', help: 'Both sides agree on id, amount, currency, status, order and refunds.' },
  mismatch: { label: 'Mismatch', cls: 'bg-amber-50 text-amber-700 border-amber-200', help: 'Both sides exist but at least one field differs or an issue is open.' },
  db_only: { label: 'DB only', cls: 'bg-rose-50 text-rose-700 border-rose-200', help: 'The database references a Razorpay payment id that Razorpay did not return for this window.' },
  razorpay_only: { label: 'Razorpay only', cls: 'bg-red-50 text-red-700 border-red-200', help: 'Razorpay has this payment but no database row references it.' },
  no_reference: { label: 'No Razorpay ref', cls: 'bg-slate-100 text-slate-600 border-slate-200', help: 'Database row has no razorpay_payment_id (checkout not completed or record incomplete).' },
  outside_window: { label: 'Outside window', cls: 'bg-violet-50 text-violet-700 border-violet-200', help: 'Loaded from the ±1-day pad for boundary matching; not compared.' },
};
const ORDER = ['mismatch', 'db_only', 'razorpay_only', 'no_reference', 'matched', 'outside_window'];

const Pill = ({ status }) => {
  const s = STATUS[status] || STATUS.no_reference;
  return <span className={`inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${s.cls}`} title={s.help}>{s.label}</span>;
};
const payTone = (s) => (/captured|completed|paid|success/i.test(s || '') ? 'text-emerald-700' : /fail|cancel/i.test(s || '') ? 'text-red-700' : /refund/i.test(s || '') ? 'text-violet-700' : 'text-amber-700');
const tableLabel = (t) => ({ payments: 'Plan payment', user_token_topup_purchases: 'Top-up', user_storage_addon_purchases: 'Add-on' }[t] || t);
const saveBlob = (blob, filename) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
};
const hl = (on) => (on ? 'text-amber-800 font-semibold bg-amber-100/70 rounded px-0.5' : '');

/** One side of a comparison row, two compact lines (plus an optional third for GST / refund / invoice). */
const DbSide = ({ d, diff }) => (
  <div className="min-w-0 text-xs">
    <p className="flex items-center gap-2 min-w-0">
      <span className="font-semibold text-slate-800 truncate">{tableLabel(d.source_table)} #{d.source_id}{d.plan_name ? <span className="font-normal text-slate-500"> · {d.plan_name}</span> : null}{d.user_id != null ? <span className="font-normal text-slate-500"> · user #{d.user_id}</span> : null}</span>
      <span className={`ml-auto shrink-0 font-semibold tabular-nums ${hl(diff.has('amount') || diff.has('currency'))}`}>{fmtMoneyStr(d.amount)}{d.currency && d.currency !== 'INR' ? ` ${d.currency}` : ''}</span>
    </p>
    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 min-w-0">
      <span className={`font-semibold ${payTone(d.status)} ${hl(diff.has('status'))}`}>{d.status || '—'}</span>
      <span className="font-mono truncate">{d.razorpay_payment_id || <span className="italic">no payment id</span>}</span>
      <span className={`font-mono truncate ${hl(diff.has('order_id'))}`}>{d.razorpay_order_id || ''}</span>
      <span className="ml-auto shrink-0 whitespace-nowrap">{fmtDateTimeIST(d.purchased_at)}</span>
    </p>
    {(d.tax || d.amount_refunded_paise > 0 || diff.has('refunded') || d.kind === 'plan') && (
      <p className={`mt-0.5 text-[11px] text-slate-500 truncate ${hl(diff.has('gst_breakdown') || diff.has('refunded'))}`}>
        {d.tax ? `GST ${fmtMoneyStr((d.tax.basic || 0) / 100)} + ${fmtMoneyStr((d.tax.cgst || 0) / 100)} + ${fmtMoneyStr((d.tax.sgst || 0) / 100)} + ${fmtMoneyStr((d.tax.igst || 0) / 100)}` : ''}
        {d.amount_refunded_paise > 0 || diff.has('refunded') ? `${d.tax ? ' · ' : ''}refunded ${fmtMoneyStr(d.amount_refunded)}${d.refund_status ? ` (${d.refund_status})` : ''}` : ''}
        {d.kind === 'plan' ? `${d.tax || d.amount_refunded_paise > 0 ? ' · ' : ''}${d.has_invoice ? 'invoice issued' : 'no invoice'}` : ''}
      </p>
    )}
  </div>
);
const RzSide = ({ z, diff }) => (
  <div className="min-w-0 text-xs">
    <p className="flex items-center gap-2 min-w-0">
      <span className="font-mono font-semibold text-slate-800 truncate">{z.razorpay_payment_id}</span>
      {z.method && <span className="text-slate-500 shrink-0">{z.method}</span>}
      <span className={`ml-auto shrink-0 font-semibold tabular-nums ${hl(diff.has('amount') || diff.has('currency'))}`}>{fmtMoneyStr(z.amount)}{z.currency && z.currency !== 'INR' ? ` ${z.currency}` : ''}</span>
    </p>
    <p className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-500 min-w-0">
      <span className={`font-semibold ${payTone(z.status)} ${hl(diff.has('status'))}`}>{z.status || '—'}</span>
      <span className={`font-mono truncate ${hl(diff.has('order_id'))}`}>{z.razorpay_order_id || ''}</span>
      <span className="truncate">{z.email || z.contact || ''}</span>
      <span className="ml-auto shrink-0 whitespace-nowrap">{fmtDateTimeIST(z.razorpay_created_at)}</span>
    </p>
    {(z.amount_refunded_paise > 0 || diff.has('refunded') || z.error_description) && (
      <p className={`mt-0.5 text-[11px] text-slate-500 truncate ${hl(diff.has('refunded'))}`}>
        {z.amount_refunded_paise > 0 || diff.has('refunded') ? `refunded ${fmtMoneyStr(z.amount_refunded)}${z.refund_status ? ` (${z.refund_status})` : ''}` : ''}
        {z.error_description ? `${z.amount_refunded_paise > 0 ? ' · ' : ''}${z.error_description}` : ''}
      </p>
    )}
  </div>
);
const Empty = ({ text }) => <p className="text-xs text-slate-400 italic">{text}</p>;

/**
 * Side-by-side comparison for one run: database rows on the left, Razorpay payments on the right,
 * matched or not, with the reason for every difference and every unpaired row.
 */
const ReconciliationComparison = ({ runId, ready, onToast }) => {
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_OPTIONS[1]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [exporting, setExporting] = useState(false);
  const req = useRef(0);

  useEffect(() => { setStatus(''); setSearchInput(''); setSearch(''); setPage(1); setData(null); }, [runId]);
  useEffect(() => {
    const t = setTimeout(() => { const v = searchInput.trim(); setSearch((p) => (p === v ? p : (setPage(1), v))); }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const load = useCallback(async () => {
    if (!runId || !ready) return;
    const id = ++req.current;
    setLoading(true);
    setErr(null);
    try {
      const r = await fetchReconciliationComparison(runId, { status: status || undefined, search: search || undefined, page, pageSize });
      if (id !== req.current) return;
      setData(r.data);
    } catch (e) {
      if (id !== req.current) return;
      log.error('comparison:failed', e, { summary: { runId } });
      setErr(e.message || 'Failed to load comparison');
    } finally {
      if (id === req.current) setLoading(false);
    }
  }, [runId, ready, status, search, page, pageSize]);
  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, filename } = await downloadReconciliationComparisonCsv(runId);
      saveBlob(blob, filename);
      onToast?.('success', 'Comparison exported', filename);
    } catch (e) {
      onToast?.('error', 'Export failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  const counts = data?.counts || {};
  const rows = useMemo(() => data?.rows || [], [data]);
  const total = Number(data?.total) || 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const diffFields = useMemo(() => new Map(rows.map((r) => [r.key, new Set(r.differences.map((d) => d.field))])), [rows]);
  const th = 'px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 whitespace-nowrap bg-slate-50';
  const td = 'px-3 py-2 border-b border-slate-100 align-top';

  if (!ready) return <div className="p-8 text-center text-sm text-slate-400">The comparison is available once the run finishes.</div>;

  return (
    <div className="flex flex-col min-h-0">
      <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-1.5">
        <button type="button" onClick={() => { setStatus(''); setPage(1); }} className={`h-8 px-2.5 rounded-md text-xs font-semibold border tabular-nums ${!status ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
          All {fmtNum(counts.all)}
        </button>
        {ORDER.map((k) => (
          <button key={k} type="button" disabled={!counts[k]} onClick={() => { setStatus(k === status ? '' : k); setPage(1); }} title={STATUS[k].help}
            className={`h-8 px-2.5 rounded-md text-xs font-semibold border tabular-nums disabled:opacity-40 ${status === k ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
            {STATUS[k].label} <span className={status === k ? 'opacity-80' : ['mismatch', 'db_only', 'razorpay_only'].includes(k) && counts[k] ? 'text-rose-700' : 'text-slate-400'}>{fmtNum(counts[k])}</span>
          </button>
        ))}
        <div className="relative w-52">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input type="search" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="pay_…, order_…, user, plan" className="h-8 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500" aria-label="Search comparison" />
        </div>
        {(status || search) && (
          <button type="button" onClick={() => { setStatus(''); setSearchInput(''); setSearch(''); setPage(1); }} className="inline-flex items-center gap-1 h-8 px-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"><X className="w-3 h-3" /> Reset</button>
        )}
        <button type="button" onClick={exportCsv} disabled={exporting || !data} className="ml-auto inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:border-blue-300 hover:text-blue-700 disabled:opacity-50">
          <Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} /> Download CSV
        </button>
      </div>

      <div className="border-t border-slate-100">
        {err ? (
          <div className="p-6 text-center text-sm text-slate-600"><AlertTriangle className="w-6 h-6 mx-auto mb-1 text-slate-300" />{err} <button type="button" onClick={load} className="ml-2 text-xs font-semibold text-blue-700 underline">Retry</button></div>
        ) : loading && !data ? (
          <div className="p-3 space-y-2 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-slate-100 rounded-md" />)}</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">{status || search ? 'No rows match these filters.' : 'Nothing on either side for this run.'}</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[82rem] text-xs border-separate border-spacing-0 table-fixed">
              <colgroup><col className="w-28" /><col /><col /><col className="w-[26rem]" /></colgroup>
              <thead>
                <tr>
                  <th className={th}>Result</th>
                  <th className={th}>Database (Payment DB)</th>
                  <th className={th}>Razorpay</th>
                  <th className={th}>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const diff = diffFields.get(r.key) || new Set();
                  const bad = ['mismatch', 'db_only', 'razorpay_only'].includes(r.status);
                  return (
                    <tr key={r.key} className={bad ? 'bg-amber-50/30' : 'hover:bg-slate-50/60'}>
                      <td className={td}><Pill status={r.status} /></td>
                      <td className={td}>{r.db ? <DbSide d={r.db} diff={diff} /> : <Empty text="No database row" />}</td>
                      <td className={td}>{r.razorpay ? <RzSide z={r.razorpay} diff={diff} /> : <Empty text={r.status === 'outside_window' ? 'Not queried for this date' : 'No Razorpay payment'} />}</td>
                      <td className={td}>
                        <ul className="space-y-0.5">
                          {r.reasons.map((t, i) => (
                            <li key={i} className={`flex gap-1.5 text-[11px] leading-snug ${r.status === 'matched' ? 'text-emerald-800' : 'text-slate-700'}`}>
                              {r.status === 'matched' ? <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-600" />}
                              <span>{t}</span>
                            </li>
                          ))}
                        </ul>
                        {r.issues.length > 0 && (
                          <p className="mt-1 flex flex-wrap gap-1">
                            {r.issues.map((i) => (
                              <span key={i.id} className={`inline-flex items-center h-5 px-1.5 rounded border text-[10px] font-semibold ${i.status === 'resolved' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'}`} title={i.message}>
                                #{i.id} {fmtIssueType(i.issue_type)} · {i.severity}{i.status === 'resolved' ? ' · resolved' : ''}
                              </span>
                            ))}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-500">
        <span className="flex items-center gap-3">
          <label className="flex items-center gap-1.5">Rows per page
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700" aria-label="Rows per page">
              {PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <span>{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : `${fmtNum(total)} row${total !== 1 ? 's' : ''}`}</span>
          {data && <span className="text-slate-400" title="Database rows are read live; Razorpay rows come from the run's snapshot">{fmtNum(counts.db_rows)} DB rows (±1 day) · {fmtNum(counts.razorpay_payments)} Razorpay payments</span>}
        </span>
        <span className="inline-flex items-center gap-1">
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((p) => p - 1)} className="inline-flex items-center gap-0.5 h-8 px-2 rounded-md border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /> Prev</button>
          <span className="tabular-nums px-1">Page {page} of {pageCount}</span>
          <button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((p) => p + 1)} className="inline-flex items-center gap-0.5 h-8 px-2 rounded-md border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40">Next <ChevronRight className="w-3.5 h-3.5" /></button>
        </span>
      </div>
    </div>
  );
};

export default ReconciliationComparison;
