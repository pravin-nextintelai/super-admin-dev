import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, Download, FileText, History, Loader2, Play, RefreshCw, RotateCcw, Scale,
  Search, X, XCircle,
} from 'lucide-react';
import { fmtDateTimeIST, fmtDuration, fmtIssueType, fmtNum, fmtPaise, fmtRunStatus, fmtYmd } from './userAnalytics/analyticsFormat';
import {
  createReconciliationRun, downloadReconciliationIssuesCsv, fetchReconciliationIssues, fetchReconciliationRun, fetchReconciliationRuns,
  retryReconciliationRun,
} from './userAnalytics/analyticsApi';
import ReconciliationIssueDrawer, { IssueStatusPill, SeverityPill } from './userAnalytics/ReconciliationIssueDrawer';
import ReconciliationComparison from './userAnalytics/ReconciliationComparison';
import ReconciliationLiveCheck from './userAnalytics/ReconciliationLiveCheck';
import ToastStack from './userAnalytics/ToastStack';
import useToasts from './userAnalytics/useToasts';
import { createDebugLogger } from '../../utils/debugLogger';

const log = createDebugLogger('FinanceReconciliation');
const POLL_MS = 2500;
const RUNS_PAGE = 10;
const ISSUES_PAGE_OPTIONS = [25, 50, 100];
const ISSUE_TYPES = ['RAZORPAY_ONLY', 'DB_ONLY', 'DUPLICATE_REFERENCE', 'AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'STATUS_MISMATCH', 'ORDER_MISMATCH', 'REFUND_MISMATCH', 'TAX_BREAKDOWN_MISMATCH', 'MISSING_INVOICE', 'INCOMPLETE_RECORD'];
const SEVERITIES = ['critical', 'high', 'medium', 'low', 'info'];
const ACTIVE = new Set(['queued', 'running']);

const fieldClass = 'h-9 shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/25 focus:border-blue-500 hover:border-slate-300 transition-all';
const activeFieldClass = 'border-blue-400 bg-blue-50 text-blue-800 font-medium';
const btnClass = 'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors disabled:opacity-50';

const pad2 = (n) => String(n).padStart(2, '0');
const isoDay = (d) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => isoDay(new Date());
const shift = (days) => { const d = new Date(); d.setDate(d.getDate() + days); return isoDay(d); };
const PRESETS = [
  { key: 'yesterday', label: 'Yesterday', range: () => [shift(-1), shift(-1)] },
  { key: 'last7', label: 'Last 7 days', range: () => [shift(-6), today()] },
  { key: 'this-month', label: 'This month', range: () => { const n = new Date(); return [isoDay(new Date(n.getFullYear(), n.getMonth(), 1)), today()]; } },
  { key: 'last-month', label: 'Last month', range: () => { const n = new Date(); return [isoDay(new Date(n.getFullYear(), n.getMonth() - 1, 1)), isoDay(new Date(n.getFullYear(), n.getMonth(), 0))]; } },
  // Rolling windows that end today: (today − N months) + 1 day … today. Six months is at most 184 days.
  { key: 'last-3-months', label: 'Last 3 months', range: () => { const n = new Date(); return [isoDay(new Date(n.getFullYear(), n.getMonth() - 3, n.getDate() + 1)), today()]; } },
  { key: 'last-6-months', label: 'Last 6 months', range: () => { const n = new Date(); return [isoDay(new Date(n.getFullYear(), n.getMonth() - 6, n.getDate() + 1)), today()]; } },
];

const RUN_STATUS = {
  queued: { cls: 'bg-slate-100 text-slate-600 border-slate-200', icon: Clock },
  running: { cls: 'bg-blue-50 text-blue-700 border-blue-200', icon: Loader2, spin: true },
  completed: { cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  completed_with_issues: { cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertTriangle },
  partial: { cls: 'bg-orange-50 text-orange-700 border-orange-200', icon: AlertTriangle },
  failed: { cls: 'bg-red-50 text-red-700 border-red-200', icon: XCircle },
};
const RunPill = ({ status }) => {
  const s = RUN_STATUS[status] || RUN_STATUS.queued;
  const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 h-5 px-1.5 rounded border text-[10px] font-semibold uppercase tracking-wide whitespace-nowrap ${s.cls}`}><Icon className={`w-3 h-3 ${s.spin ? 'animate-spin' : ''}`} /> {fmtRunStatus(status)}</span>;
};

const saveBlob = (blob, filename) => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(a.href);
};
const Mono = ({ children }) => (children ? <span className="font-mono text-[11px] text-slate-700">{children}</span> : <span className="text-slate-400">—</span>);

const SummaryCard = ({ label, value, unit, lines = [], tone = 'text-slate-800' }) => (
  <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 min-w-0">
    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
    <p className="mt-0.5 flex items-baseline gap-1.5"><span className={`text-2xl font-bold tabular-nums leading-none ${tone}`}>{value}</span>{unit && <span className="text-xs text-slate-500">{unit}</span>}</p>
    {lines.filter(Boolean).map((l) => <p key={l} className="mt-1 text-xs text-slate-600 leading-snug">{l}</p>)}
  </div>
);

const FinanceReconciliation = () => {
  const { toasts, toast, dismiss } = useToasts();
  // New run form
  const [startDate, setStartDate] = useState(shift(-1));
  const [endDate, setEndDate] = useState(shift(-1));
  const [formErr, setFormErr] = useState(null);
  const [starting, setStarting] = useState(false);
  // Runs list
  const [runs, setRuns] = useState([]);
  const [runsTotal, setRunsTotal] = useState(0);
  const [runsPage, setRunsPage] = useState(1);
  const [runsStatus, setRunsStatus] = useState('');
  const [runsLoading, setRunsLoading] = useState(true);
  const [runsErr, setRunsErr] = useState(null);
  // Selected run
  const [selectedId, setSelectedId] = useState(null);
  const [run, setRun] = useState(null);
  const [runLoading, setRunLoading] = useState(false);
  const [runErr, setRunErr] = useState(null);
  const [panelTab, setPanelTab] = useState('issues'); // issues | comparison | log
  const [liveOpen, setLiveOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(true); // run history panel (right side)    // full-screen line-by-line check after "Run reconciliation"
  const [retrying, setRetrying] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Issues
  const [issueStatus, setIssueStatus] = useState('open');
  const [issueType, setIssueType] = useState('');
  const [issueSeverity, setIssueSeverity] = useState('');
  const [issueSearchInput, setIssueSearchInput] = useState('');
  const [issueSearch, setIssueSearch] = useState('');
  const [issuesPage, setIssuesPage] = useState(1);
  const [issuesPageSize, setIssuesPageSize] = useState(ISSUES_PAGE_OPTIONS[0]);
  const [issues, setIssues] = useState([]);
  const [issuesTotal, setIssuesTotal] = useState(0);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesErr, setIssuesErr] = useState(null);
  const [openIssueId, setOpenIssueId] = useState(null);
  const runsReq = useRef(0);
  const runReq = useRef(0);
  const issuesReq = useRef(0);

  // ── Runs list ──
  const loadRuns = useCallback(async ({ quiet = false } = {}) => {
    const reqId = ++runsReq.current;
    if (!quiet) setRunsLoading(true);
    setRunsErr(null);
    try {
      const r = await fetchReconciliationRuns({ page: runsPage, pageSize: RUNS_PAGE, status: runsStatus || undefined });
      if (reqId !== runsReq.current) return;
      const list = r.data?.rows || [];
      setRuns(list);
      setRunsTotal(Number(r.data?.total) || 0);
      setSelectedId((cur) => (cur == null && list.length ? list[0].id : cur));
    } catch (e) {
      if (reqId !== runsReq.current) return;
      log.error('runs:failed', e);
      setRunsErr(e.message || 'Failed to load runs');
    } finally {
      if (reqId === runsReq.current) setRunsLoading(false);
    }
  }, [runsPage, runsStatus]);
  useEffect(() => { loadRuns(); }, [loadRuns]);

  // ── Selected run detail (+ polling while active) ──
  const loadRun = useCallback(async (id, { quiet = false } = {}) => {
    if (id == null) return null;
    const reqId = ++runReq.current;
    if (!quiet) setRunLoading(true);
    setRunErr(null);
    try {
      const r = await fetchReconciliationRun(id);
      if (reqId !== runReq.current) return null;
      setRun(r.data || null);
      return r.data || null;
    } catch (e) {
      if (reqId !== runReq.current) return null;
      log.error('run:failed', e, { summary: { id } });
      setRunErr(e.message || 'Failed to load run');
      return null;
    } finally {
      if (reqId === runReq.current) setRunLoading(false);
    }
  }, []);
  useEffect(() => { setRun(null); setIssueType(''); setIssueSeverity(''); setIssueSearchInput(''); setIssueSearch(''); setIssuesPage(1); loadRun(selectedId); }, [selectedId, loadRun]);

  const wasActive = useRef(false);
  useEffect(() => {
    const active = run && ACTIVE.has(run.status);
    if (active) wasActive.current = true;
    if (!active) {
      if (wasActive.current && run) {
        // Finished since we started watching: refresh list + issues once.
        wasActive.current = false;
        loadRuns({ quiet: true });
        setIssuesPage(1);
        setIssueStatus('open');
      }
      return undefined;
    }
    const t = setInterval(async () => {
      const next = await loadRun(run.id, { quiet: true });
      if (next && !ACTIVE.has(next.status)) {
        toast(next.status === 'failed' ? 'error' : next.status === 'completed' ? 'success' : 'warning', `Run #${next.id} ${fmtRunStatus(next.status).toLowerCase()}`, next.error || undefined);
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [run, loadRun, loadRuns, toast]);

  // ── Issues ──
  useEffect(() => {
    const t = setTimeout(() => { const v = issueSearchInput.trim(); setIssueSearch((prev) => (prev === v ? prev : (setIssuesPage(1), v))); }, 300);
    return () => clearTimeout(t);
  }, [issueSearchInput]);

  const loadIssues = useCallback(async () => {
    if (selectedId == null) { setIssues([]); setIssuesTotal(0); return; }
    const reqId = ++issuesReq.current;
    setIssuesLoading(true);
    setIssuesErr(null);
    try {
      const r = await fetchReconciliationIssues(selectedId, {
        status: issueStatus === 'all' ? undefined : issueStatus, type: issueType || undefined, severity: issueSeverity || undefined,
        search: issueSearch || undefined, page: issuesPage, pageSize: issuesPageSize,
      });
      if (reqId !== issuesReq.current) return;
      setIssues(r.data?.rows || []);
      setIssuesTotal(Number(r.data?.total) || 0);
    } catch (e) {
      if (reqId !== issuesReq.current) return;
      log.error('issues:failed', e, { summary: { runId: selectedId } });
      setIssuesErr(e.message || 'Failed to load issues');
    } finally {
      if (reqId === issuesReq.current) setIssuesLoading(false);
    }
  }, [selectedId, issueStatus, issueType, issueSeverity, issueSearch, issuesPage, issuesPageSize]);
  useEffect(() => { loadIssues(); }, [loadIssues]);
  useEffect(() => {
    // Issues are written at the end of a run: reload once the run leaves queued/running.
    if (run && !ACTIVE.has(run.status)) loadIssues();
  }, [run?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Actions ──
  const startRun = async () => {
    setFormErr(null);
    if (!startDate || !endDate) { setFormErr('Pick a start and an end date.'); return; }
    if (startDate > endDate) { setFormErr('Start date must be on or before the end date.'); return; }
    if (endDate > today()) { setFormErr('The range cannot be in the future.'); return; }
    setStarting(true);
    try {
      const r = await createReconciliationRun({ startDate, endDate });
      const created = r.data;
      toast('success', `Run #${created.id} started`, `${fmtYmd(created.range_start)} – ${fmtYmd(created.range_end)} (IST)`);
      setRunsPage(1);
      setRunsStatus('');
      await loadRuns({ quiet: true });
      setSelectedId(created.id);
      setLiveOpen(true);
    } catch (e) {
      log.error('run:create:failed', e, { summary: { startDate, endDate } });
      setFormErr(e.message || 'Could not start the run');
      if (e.status === 409) loadRuns({ quiet: true });
    } finally {
      setStarting(false);
    }
  };

  const retry = async () => {
    if (!run) return;
    setRetrying(true);
    try {
      const r = await retryReconciliationRun(run.id);
      toast('success', `Retry started as run #${r.data.id}`, `Attempt ${r.data.attempt}`);
      setRunsPage(1);
      await loadRuns({ quiet: true });
      setSelectedId(r.data.id);
      setLiveOpen(true);
    } catch (e) {
      log.error('run:retry:failed', e, { summary: { runId: run.id } });
      toast('error', 'Retry failed', e.message);
    } finally {
      setRetrying(false);
    }
  };

  const exportIssues = async () => {
    if (!run) return;
    setExporting(true);
    try {
      const { blob, filename } = await downloadReconciliationIssuesCsv(run.id);
      saveBlob(blob, filename);
      toast('success', 'Issues exported', filename);
    } catch (e) {
      log.error('run:export:failed', e, { summary: { runId: run.id } });
      toast('error', 'Export failed', e.message);
    } finally {
      setExporting(false);
    }
  };

  const onIssueChanged = () => { loadIssues(); loadRun(selectedId, { quiet: true }); loadRuns({ quiet: true }); };

  const summary = run?.summary || {};
  const rz = summary.razorpay || {};
  const db = summary.db || {};
  const iss = summary.issues || {};
  const flags = summary.flags || {};
  const typeCounts = useMemo(() => {
    const map = new Map();
    (run?.issue_counts || []).forEach((c) => {
      const cur = map.get(c.issue_type) || { total: 0, open: 0 };
      cur.total += Number(c.count) || 0;
      if (c.status === 'open') cur.open += Number(c.count) || 0;
      map.set(c.issue_type, cur);
    });
    return [...map.entries()].sort((a, b) => b[1].open - a[1].open || b[1].total - a[1].total);
  }, [run]);
  const runsPageCount = Math.max(1, Math.ceil(runsTotal / RUNS_PAGE));
  const issuesPageCount = Math.max(1, Math.ceil(issuesTotal / issuesPageSize));
  const isActive = run && ACTIVE.has(run.status);
  const activePreset = PRESETS.find((p) => { const [a, b] = p.range(); return a === startDate && b === endDate; })?.key;
  const incomplete = run && (run.error || flags.razorpayComplete === false || flags.dbComplete === false || run.razorpay_fetch_complete === false || run.db_load_complete === false);

  const th = 'px-3 py-2 text-left font-semibold text-[10px] uppercase tracking-wider text-slate-500 border-b border-slate-200 whitespace-nowrap bg-slate-50';
  const td = 'px-3 py-2 border-b border-slate-100 align-top';

  return (
    <div className="h-[calc(100vh-5rem)] flex flex-col gap-2.5 min-h-0">
      <div className="flex items-center justify-between gap-3 shrink-0 flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm shrink-0"><Scale className="w-4 h-4 text-white" /></div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-slate-800 leading-tight">Razorpay reconciliation</h1>
            <p className="text-xs text-slate-500 truncate">Compare Razorpay payments with the Payment DB for a date range (IST, end date inclusive). Findings are recorded as issues; payments and Razorpay are never modified.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => setHistoryOpen((v) => !v)} className={`${btnClass} ${historyOpen ? 'border-blue-400 bg-blue-50 text-blue-800' : ''}`} title={historyOpen ? 'Hide run history' : 'Show run history'}>
            <History className="w-3.5 h-3.5" /> History{runsTotal ? ` (${fmtNum(runsTotal)})` : ''}
          </button>
          <button type="button" onClick={() => { loadRuns(); if (selectedId != null) { loadRun(selectedId); loadIssues(); } }} className={btnClass}><RefreshCw className={`w-3.5 h-3.5 ${runsLoading || runLoading ? 'animate-spin' : ''}`} /> Refresh</button>
        </div>
      </div>

      {/* New run bar */}
      <div className="shrink-0 bg-white border border-slate-200 rounded-xl shadow-sm px-3 py-2 flex flex-wrap items-center gap-1.5">
        <span className="text-xs font-semibold text-slate-500 shrink-0">New run</span>
        <input type="date" value={startDate} max={endDate || today()} onChange={(e) => { setStartDate(e.target.value); setFormErr(null); }} className={`${fieldClass} w-[9.5rem]`} aria-label="Start date (IST)" />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" value={endDate} min={startDate || undefined} max={today()} onChange={(e) => { setEndDate(e.target.value); setFormErr(null); }} className={`${fieldClass} w-[9.5rem]`} aria-label="End date (IST, inclusive)" title="Inclusive" />
        <div className="inline-flex shrink-0 rounded-lg border border-slate-200 bg-white p-0.5">
          {PRESETS.map((p) => (
            <button key={p.key} type="button" onClick={() => { const [a, b] = p.range(); setStartDate(a); setEndDate(b); setFormErr(null); }} className={`h-8 px-2.5 rounded-md text-xs font-semibold transition-colors ${activePreset === p.key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{p.label}</button>
          ))}
        </div>
        <button type="button" onClick={startRun} disabled={starting} className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          {starting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />} {starting ? 'Starting…' : 'Run reconciliation'}
        </button>
        <span className="text-[11px] text-slate-400">Up to 6 months (184 days) per run.</span>
        {formErr && <span className="basis-full sm:basis-auto inline-flex items-center gap-1 text-xs text-red-700"><AlertTriangle className="w-3.5 h-3.5" /> {formErr}</span>}
      </div>

      {liveOpen ? (
        <ReconciliationLiveCheck
          run={run && run.id === selectedId ? run : null}
          onClose={() => { setLiveOpen(false); setPanelTab('comparison'); }}
        />
      ) : (
      <div className={`flex-1 min-h-0 grid grid-cols-1 gap-2.5 ${historyOpen ? 'lg:grid-cols-[1fr_22rem]' : ''}`}>
        {/* Run history (right side, collapsible) */}
        {historyOpen && (
        <aside className="min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden lg:order-2">
          <div className="shrink-0 px-3 py-2 border-b border-slate-100 flex items-center gap-2">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-600 inline-flex items-center gap-1.5"><History className="w-3.5 h-3.5 text-slate-400" /> Run history</h2>
            <select value={runsStatus} onChange={(e) => { setRunsStatus(e.target.value); setRunsPage(1); }} className={`${fieldClass} h-8 text-xs ml-auto w-[9.5rem] ${runsStatus ? activeFieldClass : 'text-slate-400'}`} aria-label="Filter runs by status">
              <option value="">All statuses</option>
              {Object.keys(RUN_STATUS).map((s) => <option key={s} value={s} className="text-slate-700">{fmtRunStatus(s)}</option>)}
            </select>
            <button type="button" onClick={() => setHistoryOpen(false)} className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600" aria-label="Close run history" title="Close run history"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
            {runsErr ? (
              <div className="p-4 text-center text-sm text-slate-600"><AlertTriangle className="w-6 h-6 mx-auto mb-1 text-slate-300" />{runsErr}<br /><button type="button" onClick={() => loadRuns()} className="mt-2 text-xs font-semibold text-blue-700 underline">Retry</button></div>
            ) : runsLoading && runs.length === 0 ? (
              <div className="p-3 space-y-2 animate-pulse">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg" />)}</div>
            ) : runs.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-400"><Scale className="w-7 h-7 mx-auto mb-1 opacity-30" />No runs yet. Pick a date range above to start one.</div>
            ) : (
              <ul>
                {runs.map((r) => (
                  <li key={r.id}>
                    <button type="button" onClick={() => setSelectedId(r.id)} className={`w-full text-left px-3 py-2.5 border-b border-slate-100 hover:bg-slate-50 transition-colors ${selectedId === r.id ? 'bg-blue-50/60 border-l-2 border-l-blue-600' : 'border-l-2 border-l-transparent'}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-800">#{r.id} <span className="font-normal text-slate-500">· {fmtYmd(r.range_start)}{r.range_start !== r.range_end ? ` – ${fmtYmd(r.range_end)}` : ''}</span></span>
                        <RunPill status={r.status} />
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                        <span>{fmtDateTimeIST(r.created_at)}{r.attempt > 1 ? ` · attempt ${r.attempt}` : ''}</span>
                        <span className="tabular-nums">RZP {fmtNum(r.razorpay_payments_fetched)} · DB {fmtNum(r.db_rows_loaded)}</span>
                      </div>
                      <div className="mt-0.5 text-[11px] tabular-nums">
                        {r.total_issues > 0
                          ? <span className={r.open_issues > 0 ? 'text-rose-700 font-semibold' : 'text-emerald-700'}>{fmtNum(r.open_issues)} open / {fmtNum(r.total_issues)} issues</span>
                          : <span className="text-slate-400">{ACTIVE.has(r.status) ? 'in progress' : 'no issues'}</span>}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="shrink-0 px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-500">
            <span>{fmtNum(runsTotal)} run{runsTotal !== 1 ? 's' : ''}</span>
            <span className="inline-flex items-center gap-1">
              <button type="button" disabled={runsPage <= 1} onClick={() => setRunsPage((p) => p - 1)} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /></button>
              <span className="tabular-nums px-1">{runsPage} / {runsPageCount}</span>
              <button type="button" disabled={runsPage >= runsPageCount} onClick={() => setRunsPage((p) => p + 1)} className="h-7 w-7 inline-flex items-center justify-center rounded-md border border-slate-200 bg-white disabled:opacity-40"><ChevronRight className="w-3.5 h-3.5" /></button>
            </span>
          </div>
        </aside>
        )}

        {/* Run detail */}
        <section className="min-h-0 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden lg:order-1">
          {selectedId == null ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400 text-sm"><Scale className="w-8 h-8 opacity-30 mb-1" />Select a run to see its summary and issues.</div>
          ) : runErr ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-600 text-sm"><AlertTriangle className="w-8 h-8 text-slate-300" />{runErr}<button type="button" onClick={() => loadRun(selectedId)} className="px-3 py-1.5 bg-blue-600 text-white text-sm font-semibold rounded-lg">Retry</button></div>
          ) : !run ? (
            <div className="p-4 space-y-3 animate-pulse">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-slate-100 rounded-lg" />)}</div>
          ) : (
            <>
              <header className="shrink-0 px-4 py-3 border-b border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h2 className="text-base font-bold text-slate-800 flex items-center gap-2">Run #{run.id} <RunPill status={run.status} /></h2>
                <span className="text-sm text-slate-600">{fmtYmd(run.range_start)} – {fmtYmd(run.range_end)} <span className="text-slate-400">IST, inclusive</span></span>
                <div className="ml-auto flex items-center gap-1.5">
                  {['failed', 'partial'].includes(run.status) && (
                    <button type="button" onClick={retry} disabled={retrying} className={btnClass}>{retrying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />} Retry</button>
                  )}
                  <button type="button" onClick={exportIssues} disabled={exporting || isActive} className={btnClass} title="Download this run's issues as CSV"><Download className={`w-3.5 h-3.5 ${exporting ? 'animate-pulse' : ''}`} /> Export issues</button>
                  <button type="button" onClick={() => setLiveOpen(true)} className={btnClass} title="Replay the line-by-line check of this run"><Play className="w-3.5 h-3.5" /> Live check</button>
                </div>
                <p className="basis-full text-xs text-slate-500">
                  {run.requested_by_email || '—'} · {fmtDateTimeIST(run.created_at)}
                  {run.finished_at ? ` · took ${fmtDuration(run.started_at, run.finished_at)}` : isActive ? ` · running ${fmtDuration(run.started_at || run.created_at)}` : ''}
                  {run.attempt > 1 ? ` · attempt ${run.attempt}${run.retry_of_run_id ? ` (retry of #${run.retry_of_run_id})` : ''}` : ''}
                  {` · ${fmtNum(run.api_calls)} API call${run.api_calls === 1 ? '' : 's'}${run.api_retries ? `, ${fmtNum(run.api_retries)} retries` : ''}`}
                </p>
              </header>

              <div className="flex-1 min-h-0 overflow-auto custom-scrollbar">
                {incomplete && (
                  <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                    <p className="flex items-center gap-1.5 font-semibold"><AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {run.error || 'This run did not load both sides completely.'}</p>
                    <p className="mt-1 text-red-700">
                      Razorpay fetch {run.razorpay_fetch_complete === false || flags.razorpayComplete === false ? 'incomplete' : 'complete'} ({fmtNum(run.razorpay_payments_fetched)} payments, {fmtNum(run.razorpay_pages_fetched)} pages) ·
                      DB load {run.db_load_complete === false || flags.dbComplete === false ? 'incomplete' : 'complete'} ({fmtNum(run.db_rows_loaded)} rows)
                      {flags.missingReported === false ? ' · Razorpay-only / DB-only checks were skipped because one side is incomplete.' : ''}
                    </p>
                  </div>
                )}
                {isActive && (
                  <div className="mx-4 mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> {run.status === 'queued' ? 'Queued, waiting to start…' : `Running: ${fmtNum(run.razorpay_payments_fetched)} Razorpay payments fetched over ${fmtNum(run.razorpay_pages_fetched)} pages, ${fmtNum(run.db_rows_loaded)} DB rows loaded.`} Updating every few seconds.</div>
                )}

                {/* Summary */}
                <div className="px-4 pt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                  <SummaryCard
                    label="Razorpay"
                    value={fmtNum(rz.total)}
                    unit="payments"
                    lines={[
                      `${fmtNum(rz.paid)} paid · ${fmtNum(rz.pending)} pending · ${fmtNum(rz.failed)} failed`,
                      `${fmtPaise(rz.amount_paid_paise)} paid · ${fmtPaise(rz.amount_refunded_paise)} refunded`,
                      rz.refunded_full || rz.refunded_partial ? `${fmtNum(rz.refunded_full)} full · ${fmtNum(rz.refunded_partial)} partial refunds` : null,
                    ]}
                  />
                  <SummaryCard
                    label="Database"
                    value={fmtNum(db.total)}
                    unit="rows in window"
                    lines={[
                      `${fmtNum(db.paid)} paid · ${fmtNum(db.pending)} pending · ${fmtNum(db.failed)} failed${db.padded ? ` · +${fmtNum(db.padded)} outside (±1 day)` : ''}`,
                      `${fmtPaise(db.amount_paid_paise)} paid`,
                      db.by_table ? Object.entries(db.by_table).map(([k, v]) => `${v} ${k.replace(/^user_|_purchases$/g, '').replace('_', ' ')}`).join(' · ') : null,
                    ]}
                  />
                  <SummaryCard label="Matched" value={fmtNum(summary.matched)} unit="payments" tone="text-emerald-700" lines={['Same payment on both sides inside the window']} />
                  <SummaryCard
                    label="Issues"
                    value={fmtNum(iss.open ?? run.open_issues)}
                    unit={`open of ${fmtNum(iss.total ?? run.total_issues)}`}
                    tone={(iss.open ?? run.open_issues) > 0 ? 'text-rose-700' : 'text-emerald-700'}
                    lines={[
                      iss.by_severity ? SEVERITIES.filter((s) => iss.by_severity[s]).map((s) => `${fmtNum(iss.by_severity[s])} ${s}`).join(' · ') || 'none' : null,
                      summary.invoice_required_since ? `Invoices required since ${fmtYmd(summary.invoice_required_since)}` : null,
                    ]}
                  />
                </div>

                {/* Tabs */}
                <div className="px-4 pt-3 flex items-center gap-2 border-b border-slate-100">
                  {[['issues', `Issues (${fmtNum(iss.total ?? run.total_issues ?? 0)})`], ['comparison', 'Comparison'], ['log', `Log (${run.events?.length || 0})`]].map(([k, l]) => (
                    <button key={k} type="button" role="tab" aria-selected={panelTab === k} onClick={() => setPanelTab(k)}
                      className={`h-9 px-3 -mb-px text-sm font-semibold border-b-2 transition-colors ${panelTab === k ? 'border-blue-600 text-blue-700' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                      {l}
                    </button>
                  ))}
                </div>

                {panelTab === 'comparison' && <ReconciliationComparison runId={run.id} ready={!isActive} onToast={toast} />}

                {panelTab === 'log' && (
                  <div className="px-4 py-3">
                    {!run.events?.length ? <p className="text-xs text-slate-400">No events yet.</p> : (
                      <ol className="rounded-lg border border-slate-200 divide-y divide-slate-100 bg-white">
                        {run.events.map((e, i) => (
                          <li key={e.id || i} className="px-3 py-1.5 text-xs flex gap-3">
                            <span className="w-32 shrink-0 text-slate-500 tabular-nums">{fmtDateTimeIST(e.created_at)}</span>
                            <span className={`w-12 shrink-0 font-semibold uppercase text-[10px] ${e.level === 'error' ? 'text-red-700' : e.level === 'warn' ? 'text-amber-700' : 'text-slate-500'}`}>{e.level}</span>
                            <span className="w-24 shrink-0 text-slate-500">{e.phase}</span>
                            <span className="text-slate-800 min-w-0 break-words">{e.message}</span>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}

                {panelTab === 'issues' && (<>
                <div className="px-4 pt-3 pb-2 flex flex-wrap items-center gap-1.5">
                  <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
                    {[['open', 'Open'], ['resolved', 'Resolved'], ['all', 'All']].map(([k, l]) => (
                      <button key={k} type="button" onClick={() => { setIssueStatus(k); setIssuesPage(1); }} className={`h-8 px-2.5 rounded-md text-xs font-semibold transition-colors ${issueStatus === k ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>{l}</button>
                    ))}
                  </div>
                  <select value={issueType} onChange={(e) => { setIssueType(e.target.value); setIssuesPage(1); }} className={`${fieldClass} w-[13rem] ${issueType ? activeFieldClass : 'text-slate-400'}`} aria-label="Issue type">
                    <option value="">All types</option>
                    {ISSUE_TYPES.map((t) => { const c = typeCounts.find(([k]) => k === t)?.[1]; return <option key={t} value={t} className="text-slate-700">{fmtIssueType(t)}{c ? ` (${c.open}/${c.total})` : ''}</option>; })}
                  </select>
                  <select value={issueSeverity} onChange={(e) => { setIssueSeverity(e.target.value); setIssuesPage(1); }} className={`${fieldClass} w-[8.5rem] ${issueSeverity ? activeFieldClass : 'text-slate-400'}`} aria-label="Severity">
                    <option value="">All severities</option>
                    {SEVERITIES.map((s) => <option key={s} value={s} className="text-slate-700">{s[0].toUpperCase() + s.slice(1)}</option>)}
                  </select>
                  <div className="relative w-56">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input type="search" value={issueSearchInput} onChange={(e) => setIssueSearchInput(e.target.value)} placeholder="pay_…, order_…, user id, text" className={`${fieldClass} w-full pl-8`} aria-label="Search issues" />
                  </div>
                  {(issueType || issueSeverity || issueSearch || issueStatus !== 'open') && (
                    <button type="button" onClick={() => { setIssueType(''); setIssueSeverity(''); setIssueSearchInput(''); setIssueSearch(''); setIssueStatus('open'); setIssuesPage(1); }} className="inline-flex items-center gap-1 h-9 px-2.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50"><X className="w-3 h-3" /> Reset</button>
                  )}
                  <span className="ml-auto text-xs text-slate-400">{issuesLoading ? 'Loading…' : `${fmtNum(issuesTotal)} issue${issuesTotal !== 1 ? 's' : ''}`}</span>
                </div>
                {typeCounts.length > 1 && (
                  <div className="px-4 pb-2 flex flex-wrap items-center gap-1.5">
                    {typeCounts.map(([t, c]) => (
                      <button key={t} type="button" onClick={() => { setIssueType(t === issueType ? '' : t); setIssuesPage(1); }}
                        className={`h-6 px-2 rounded-md text-[11px] font-semibold border tabular-nums ${issueType === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
                        {fmtIssueType(t)} <span className={issueType === t ? 'opacity-80' : c.open > 0 ? 'text-rose-700' : 'text-slate-400'}>{c.open}/{c.total}</span>
                      </button>
                    ))}
                  </div>
                )}
                <div className="border-t border-slate-100">
                  {issuesErr ? (
                    <div className="p-6 text-center text-sm text-slate-600">{issuesErr} <button type="button" onClick={loadIssues} className="ml-2 text-xs font-semibold text-blue-700 underline">Retry</button></div>
                  ) : issuesLoading && issues.length === 0 ? (
                    <div className="p-3 space-y-2 animate-pulse">{[...Array(5)].map((_, i) => <div key={i} className="h-9 bg-slate-100 rounded-md" />)}</div>
                  ) : issues.length === 0 ? (
                    <div className="p-8 text-center text-sm text-slate-400">
                      {isActive ? 'Issues appear once the run finishes.' : issueStatus === 'open' && !issueType && !issueSeverity && !issueSearch ? <span className="inline-flex items-center gap-1.5 text-emerald-700"><CheckCircle2 className="w-4 h-4" /> No open issues for this run.</span> : 'No issues match these filters.'}
                    </div>
                  ) : (
                    <div className="overflow-auto">
                      <table className="w-full min-w-[64rem] text-xs border-separate border-spacing-0">
                        <thead><tr>{['Severity', 'Type', 'Status', 'Message', 'Razorpay payment', 'Order', 'Source', 'User', 'Created'].map((h) => <th key={h} className={th}>{h}</th>)}</tr></thead>
                        <tbody>
                          {issues.map((it) => (
                            <tr key={it.id} onClick={() => setOpenIssueId(it.id)} className="hover:bg-blue-50/40 cursor-pointer" title="Open issue">
                              <td className={td}><SeverityPill value={it.severity} /></td>
                              <td className={`${td} whitespace-nowrap font-medium text-slate-700`}>{fmtIssueType(it.issue_type)}</td>
                              <td className={td}><IssueStatusPill value={it.status} /></td>
                              <td className={`${td} text-slate-800 max-w-[28rem]`}><span className="line-clamp-2">{it.message}</span></td>
                              <td className={`${td} whitespace-nowrap`}><Mono>{it.razorpay_payment_id}</Mono></td>
                              <td className={`${td} whitespace-nowrap`}><Mono>{it.razorpay_order_id}</Mono></td>
                              <td className={`${td} whitespace-nowrap text-slate-600`}>{it.source_table ? `${it.source_table.replace(/^user_|_purchases$/g, '')} #${it.source_id ?? '—'}` : '—'}</td>
                              <td className={`${td} whitespace-nowrap text-slate-600`}>{it.user_id != null ? `#${it.user_id}` : '—'}</td>
                              <td className={`${td} whitespace-nowrap text-slate-500`}>{fmtDateTimeIST(it.created_at)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                </>)}
              </div>

              {panelTab === 'issues' && (
              <div className="shrink-0 px-3 py-2 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 flex-wrap text-xs text-slate-500">
                <label className="flex items-center gap-1.5">Rows per page
                  <select value={issuesPageSize} onChange={(e) => { setIssuesPageSize(Number(e.target.value)); setIssuesPage(1); }} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700" aria-label="Issues per page">
                    {ISSUES_PAGE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
                <span className="inline-flex items-center gap-1">
                  <button type="button" disabled={issuesPage <= 1 || issuesLoading} onClick={() => setIssuesPage((p) => p - 1)} className="inline-flex items-center gap-0.5 h-8 px-2 rounded-md border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40"><ChevronLeft className="w-3.5 h-3.5" /> Prev</button>
                  <span className="tabular-nums px-1">Page {issuesPage} of {issuesPageCount}</span>
                  <button type="button" disabled={issuesPage >= issuesPageCount || issuesLoading} onClick={() => setIssuesPage((p) => p + 1)} className="inline-flex items-center gap-0.5 h-8 px-2 rounded-md border border-slate-200 bg-white font-semibold text-slate-600 disabled:opacity-40">Next <ChevronRight className="w-3.5 h-3.5" /></button>
                </span>
              </div>
              )}
            </>
          )}
        </section>
      </div>
      )}

      {openIssueId != null && <ReconciliationIssueDrawer issueId={openIssueId} onClose={() => setOpenIssueId(null)} onChanged={onIssueChanged} onToast={toast} />}
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
};

export default FinanceReconciliation;
