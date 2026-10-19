import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, Cloud, Database, FastForward, Loader2, Pause, Play, RotateCcw, X, XCircle } from 'lucide-react';
import { fmtDateTimeIST, fmtMoneyStr, fmtNum, fmtRunStatus, fmtYmd } from './analyticsFormat';
import { fetchReconciliationComparison } from './analyticsApi';
import { createDebugLogger } from '../../../shared/utils/debugLogger';

const log = createDebugLogger('ReconciliationLiveCheck');
const TERMINAL = new Set(['completed', 'completed_with_issues', 'partial', 'failed']);
const PAGE = 200;
const SPEEDS = [['1x', 170], ['2x', 85], ['4x', 40]];
const OK = new Set(['matched']);
const WARN = new Set(['outside_window', 'no_reference']);

const tableShort = (t) => ({ payments: 'payment', user_token_topup_purchases: 'top-up', user_storage_addon_purchases: 'add-on' }[t] || t);
const payTone = (s) => (/captured|completed|paid|success/i.test(s || '') ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
  : /fail|cancel/i.test(s || '') ? 'bg-red-50 text-red-700 border-red-200'
    : /refund/i.test(s || '') ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-amber-50 text-amber-700 border-amber-200');

/** Verdict of a comparison row for the live view: ok | warn | error, plus one-line text. */
const verdictOf = (r) => {
  if (OK.has(r.status)) return { kind: 'ok', text: 'Matched' };
  if (WARN.has(r.status)) return { kind: 'warn', text: r.status === 'outside_window' ? 'Outside window, not compared' : 'No Razorpay reference' };
  const first = r.differences[0];
  const text = r.status === 'db_only' ? 'Not found in Razorpay'
    : r.status === 'razorpay_only' ? 'Not found in database'
      : first ? `${first.field.replace(/_/g, ' ')} differs: DB ${first.db ?? '—'} vs Razorpay ${first.razorpay ?? '—'}`
        : r.issues[0]?.message || 'Mismatch';
  return { kind: 'error', text };
};

async function loadAll(runId) {
  const first = await fetchReconciliationComparison(runId, { page: 1, pageSize: PAGE });
  let rows = first.data?.rows || [];
  const total = Number(first.data?.total) || rows.length;
  for (let p = 2; rows.length < total && p <= 50; p += 1) {
    const r = await fetchReconciliationComparison(runId, { page: p, pageSize: PAGE });
    rows = rows.concat(r.data?.rows || []);
  }
  return { rows, counts: first.data?.counts || {} };
}

const TONE = {
  idle: 'text-slate-600',
  current: 'bg-blue-50 ring-1 ring-inset ring-blue-300',
  ok: 'bg-emerald-50/70',
  warn: 'bg-amber-50/80',
  error: 'bg-red-50 ring-1 ring-inset ring-red-200',
};
const Mark = ({ s }) => (s === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
  : s === 'error' ? <XCircle className="w-3.5 h-3.5 text-red-600" />
    : s === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
      : s === 'current' ? <Loader2 className="w-3.5 h-3.5 text-blue-600 animate-spin" /> : <span className="block w-3.5 h-3.5 rounded-full border border-slate-200" />);
const Mono = ({ children, className = '' }) => <span className={`font-mono text-[11px] truncate ${className}`}>{children || <span className="text-slate-300">—</span>}</span>;

const Panel = ({ title, subtitle, icon, lines, cols, header, state, verdicts, currentKey, emptyText }) => {
  const ref = useRef(null);
  useEffect(() => {
    if (!currentKey || !ref.current) return;
    const el = ref.current.querySelector(`[data-key="${CSS.escape(currentKey)}"]`);
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [currentKey]);
  return (
    <div className="min-h-0 flex flex-col rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="shrink-0 px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
        <span className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center">{React.createElement(icon, { className: 'w-3.5 h-3.5 text-slate-600' })}</span>
        <div className="min-w-0"><p className="text-xs font-semibold text-slate-800 leading-tight">{title}</p><p className="text-[10px] text-slate-500 truncate">{subtitle}</p></div>
        <span className="ml-auto text-[11px] text-slate-500 tabular-nums shrink-0">{fmtNum(lines.length)} line{lines.length !== 1 ? 's' : ''}</span>
      </div>
      <div className={`shrink-0 grid ${cols} gap-2 px-2 py-1 border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-400`}>
        <span />{header.map((h) => <span key={h} className={h === 'Amount' ? 'text-right' : ''}>{h}</span>)}<span />
      </div>
      <div ref={ref} className="flex-1 min-h-0 overflow-auto custom-scrollbar">
        {lines.length === 0 ? <p className="p-4 text-xs text-slate-400 italic">{emptyText}</p> : lines.map((l, i) => {
          const s = state.get(l.key) || 'idle';
          const v = verdicts.get(l.key);
          return (
            <div key={l.key} data-key={l.key} className={`grid ${cols} gap-2 items-center px-2 py-1.5 border-b border-slate-100 text-xs transition-colors ${TONE[s]}`} title={s !== 'idle' && s !== 'current' && v ? v.text : l.title || ''}>
              <span className="text-right text-[10px] text-slate-400 tabular-nums select-none">{i + 1}</span>
              {l.cells}
              <Mark s={s} />
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Inline "live check": database rows (left file) and the Razorpay payments of the run (right file)
 * are stepped through line by line once the backend has finished; matched lines turn green,
 * problems red, informational ones amber. Works for a run in progress or a finished one (replay).
 */
const ReconciliationLiveCheck = ({ run, onClose }) => {
  const [data, setData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [cursor, setCursor] = useState(-1);
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [finished, setFinished] = useState(false);
  const started = useRef(false);
  const terminal = run && TERMINAL.has(run.status);

  useEffect(() => {
    if (!run?.id || preview) return;
    loadAll(run.id).then((d) => setPreview(d)).catch((e) => log.error('preview:failed', e));
  }, [run?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!run?.id || !terminal || data) return;
    loadAll(run.id).then((d) => { setData(d); setCursor(-1); }).catch((e) => { setLoadErr(e.message); log.error('final:failed', e); });
  }, [run?.id, terminal, data]);

  const rows = useMemo(() => {
    const src = (data || preview)?.rows || [];
    const when = (r) => new Date(r.db?.purchased_at || r.razorpay?.razorpay_created_at || 0).getTime();
    return [...src].sort((a, b) => when(a) - when(b));
  }, [data, preview]);
  const verdicts = useMemo(() => new Map(rows.map((r) => [r.key, verdictOf(r)])), [rows]);

  const dbLines = useMemo(() => rows.filter((r) => r.db).map((r) => {
    const d = r.db;
    return {
      key: r.key,
      title: `user #${d.user_id ?? '—'} · ${d.plan_name || ''}`,
      cells: (
        <>
          <span className="font-semibold text-slate-800 truncate">{tableShort(d.source_table)} #{d.source_id}</span>
          <span><span className={`inline-flex h-5 px-1.5 rounded border text-[10px] font-semibold uppercase ${payTone(d.status)}`}>{d.status || '—'}</span></span>
          <span className="text-right font-semibold tabular-nums whitespace-nowrap">{fmtMoneyStr(d.amount)}</span>
          <Mono className={d.razorpay_payment_id ? 'text-slate-700' : 'text-slate-400 italic'}>{d.razorpay_payment_id || 'no payment id'}</Mono>
          <Mono className="text-slate-500">{d.razorpay_order_id}</Mono>
          <span className="text-[11px] text-slate-500 whitespace-nowrap">{fmtDateTimeIST(d.purchased_at)}</span>
        </>
      ),
    };
  }), [rows]);
  const rzLines = useMemo(() => rows.filter((r) => r.razorpay).map((r) => {
    const z = r.razorpay;
    return {
      key: r.key,
      title: z.email || z.contact || '',
      cells: (
        <>
          <Mono className="font-semibold text-slate-800">{z.razorpay_payment_id}</Mono>
          <span><span className={`inline-flex h-5 px-1.5 rounded border text-[10px] font-semibold uppercase ${payTone(z.status)}`}>{z.status || '—'}</span></span>
          <span className="text-right font-semibold tabular-nums whitespace-nowrap">{fmtMoneyStr(z.amount)}</span>
          <Mono className="text-slate-500">{z.razorpay_order_id}</Mono>
          <span className="text-[11px] text-slate-500 truncate">{z.method || '—'}</span>
          <span className="text-[11px] text-slate-500 whitespace-nowrap">{fmtDateTimeIST(z.razorpay_created_at)}</span>
        </>
      ),
    };
  }), [rows]);

  useEffect(() => {
    if (!data || paused || finished) return undefined;
    if (cursor >= rows.length - 1) { if (rows.length) setFinished(true); return undefined; }
    const t = setTimeout(() => setCursor((c) => c + 1), started.current ? SPEEDS[speed][1] : 500);
    started.current = true;
    return () => clearTimeout(t);
  }, [data, paused, finished, cursor, rows.length, speed]);

  const state = useMemo(() => {
    const m = new Map();
    if (!data) return m;
    rows.forEach((r, i) => {
      if (i < cursor) m.set(r.key, verdicts.get(r.key).kind);
      else if (i === cursor) m.set(r.key, finished ? verdicts.get(r.key).kind : 'current');
    });
    return m;
  }, [rows, cursor, data, finished, verdicts]);
  const logLines = useMemo(() => rows.slice(0, Math.min(cursor + 1, rows.length)).map((r) => ({ r, v: verdicts.get(r.key) })).reverse(), [rows, cursor, verdicts]);
  const tally = useMemo(() => {
    const t = { ok: 0, warn: 0, error: 0 };
    rows.slice(0, finished ? rows.length : Math.max(cursor, 0)).forEach((r) => { t[verdicts.get(r.key).kind] += 1; });
    return t;
  }, [rows, cursor, finished, verdicts]);
  const done = finished ? rows.length : Math.max(cursor, 0);
  const pct = rows.length ? Math.round((done / rows.length) * 100) : 0;
  const currentKey = cursor >= 0 && cursor < rows.length ? rows[cursor].key : null;
  const skip = useCallback(() => { setCursor(rows.length - 1); setFinished(true); setPaused(false); }, [rows.length]);
  const replay = useCallback(() => { started.current = false; setCursor(-1); setFinished(false); setPaused(false); }, []);

  const phase = !run ? 'Creating run…'
    : run.status === 'queued' ? 'Queued, waiting to start…'
      : run.status === 'running' ? `Fetching from Razorpay (${fmtNum(run.razorpay_payments_fetched)} payments, ${fmtNum(run.razorpay_pages_fetched)} pages) and loading the database…`
        : !data && !loadErr ? 'Loading both sides…'
          : finished ? `Check complete · ${fmtRunStatus(run.status)}`
            : paused ? 'Paused' : `Checking line ${fmtNum(done + 1)} of ${fmtNum(rows.length)}…`;
  const busy = !terminal || (!data && !loadErr);
  const ctl = 'inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50';
  const dbCols = 'grid-cols-[1.75rem_7.5rem_6rem_6rem_minmax(8rem,1fr)_minmax(8rem,1fr)_9.5rem_1.25rem]';
  const rzCols = 'grid-cols-[1.75rem_minmax(8rem,1fr)_6rem_6rem_minmax(8rem,1fr)_6rem_9.5rem_1.25rem]';

  return (
    <section className="flex-1 min-h-0 flex flex-col gap-2.5" aria-labelledby="live-title">
      {/* Status bar */}
      <div className="shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm px-4 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${finished ? (tally.error ? 'bg-red-100' : 'bg-emerald-100') : 'bg-blue-100'}`}>
            {busy ? <Loader2 className="w-4 h-4 text-blue-600 animate-spin" /> : finished ? (tally.error ? <XCircle className="w-4 h-4 text-red-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />) : <ArrowLeftRight className="w-4 h-4 text-blue-600" />}
          </div>
          <div className="min-w-0">
            <h2 id="live-title" className="text-base font-bold text-slate-800 leading-tight">
              Live reconciliation check{run ? ` · Run #${run.id}` : ''}
              {run && <span className="ml-2 text-sm font-medium text-slate-500">{fmtYmd(run.range_start)} – {fmtYmd(run.range_end)} (IST)</span>}
            </h2>
            <p className="text-xs text-slate-500">{phase}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            {data && !finished && (
              <>
                <button type="button" onClick={() => setPaused((p) => !p)} className={ctl}>{paused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />} {paused ? 'Resume' : 'Pause'}</button>
                <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                  {SPEEDS.map(([l], i) => <button key={l} type="button" onClick={() => setSpeed(i)} className={`h-7 px-2 rounded-md text-xs font-semibold ${speed === i ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{l}</button>)}
                </div>
                <button type="button" onClick={skip} className={ctl}><FastForward className="w-3.5 h-3.5" /> Skip to end</button>
              </>
            )}
            {finished && <button type="button" onClick={replay} className={ctl}><RotateCcw className="w-3.5 h-3.5" /> Replay</button>}
            <button type="button" onClick={onClose} className="inline-flex items-center gap-1 h-8 px-3 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700">{finished ? 'View results' : 'Back to runs'} <X className="w-3.5 h-3.5" /></button>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full transition-all ${tally.error ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${pct}%` }} />
          </div>
          <span className="text-xs text-slate-500 tabular-nums w-28 text-right">{fmtNum(done)} / {fmtNum(rows.length)} checked</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 tabular-nums"><CheckCircle2 className="w-3.5 h-3.5" /> {fmtNum(tally.ok)}</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 tabular-nums"><XCircle className="w-3.5 h-3.5" /> {fmtNum(tally.error)}</span>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 tabular-nums"><AlertTriangle className="w-3.5 h-3.5" /> {fmtNum(tally.warn)}</span>
        </div>
        {run?.error && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800 flex items-center gap-2"><XCircle className="w-4 h-4 shrink-0" /> {run.error}</p>}
        {loadErr && <p className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-800 flex items-center gap-2"><AlertTriangle className="w-4 h-4 shrink-0" /> Could not load the comparison: {loadErr}</p>}
      </div>

      {/* Two files */}
      <div className="flex-1 min-h-0 grid grid-cols-1 xl:grid-cols-2 gap-2.5">
        <Panel title="Database" subtitle="Payment DB rows in the window (±1 day pad included)" icon={Database} lines={dbLines} cols={dbCols}
          header={['Row', 'Status', 'Amount', 'Payment id', 'Order id', 'Date (IST)']} state={state} verdicts={verdicts} currentKey={currentKey}
          emptyText={preview || data ? 'No database rows in this window.' : 'Loading database rows…'} />
        <Panel title="Razorpay" subtitle="Payments returned by the API (snapshot taken during the run)" icon={Cloud} lines={rzLines} cols={rzCols}
          header={['Payment id', 'Status', 'Amount', 'Order id', 'Method', 'Created (IST)']} state={state} verdicts={verdicts} currentKey={currentKey}
          emptyText={run?.error ? 'Razorpay fetch failed; nothing to compare on this side.' : terminal ? 'Razorpay returned no payments for this window.' : 'Waiting for the Razorpay fetch to finish…'} />
      </div>

      {/* Check log */}
      <div className="shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="px-3 py-1.5 border-b border-slate-100 bg-slate-50 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Check log</div>
        <div className="max-h-32 overflow-auto custom-scrollbar">
          {logLines.length === 0 ? <p className="px-3 py-2 text-xs text-slate-400 italic">Each checked line is listed here with its result.</p> : logLines.map(({ r, v }) => (
            <p key={r.key} className={`px-3 py-1 text-xs flex items-center gap-2 border-b border-slate-50 ${v.kind === 'error' ? 'text-red-700 bg-red-50/40' : v.kind === 'warn' ? 'text-amber-700' : 'text-emerald-700'}`}>
              {v.kind === 'error' ? <XCircle className="w-3.5 h-3.5 shrink-0" /> : v.kind === 'warn' ? <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> : <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />}
              <span className="font-mono text-[11px] text-slate-600 w-40 shrink-0 truncate">{r.db ? `${tableShort(r.db.source_table)} #${r.db.source_id}` : '—'}</span>
              <ArrowLeftRight className="w-3 h-3 text-slate-400 shrink-0" />
              <span className="font-mono text-[11px] text-slate-600 w-44 shrink-0 truncate">{r.razorpay?.razorpay_payment_id || '—'}</span>
              <span className="truncate">{v.text}</span>
            </p>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ReconciliationLiveCheck;
