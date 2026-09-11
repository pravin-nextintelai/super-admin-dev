import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Inbox, RefreshCw, Search, Download, Eye, X, ChevronLeft, ChevronRight, ChevronDown,
  Phone, Mail, MessageCircle, Smartphone, Users, MessageSquare, PhoneCall, Clock,
  CheckCircle2, XCircle, AlertCircle, Ban, Sparkles, Building2, Timer,
  ShieldCheck, ShieldOff, StickyNote, Trash2, ExternalLink, History, UserCheck, Flag, Send, Copy,
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faInbox, faEnvelopeOpenText, faHourglassHalf, faCalendarDay, faCalendarDays, faStopwatch,
} from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import contactEnquiryApi from '../../services/contactEnquiryApi';
import { createDebugLogger } from '../../utils/debugLogger';

const MySwal = withReactContent(Swal);
const log = createDebugLogger('ContactEnquiries');

const PAGE_SIZE = 20;

// ── Display config ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  new:         { label: 'New',         color: 'bg-purple-100 text-purple-800 border-purple-200',    icon: Sparkles },
  contacted:   { label: 'Contacted',   color: 'bg-blue-100 text-blue-800 border-blue-200',          icon: PhoneCall },
  in_progress: { label: 'In progress', color: 'bg-amber-100 text-amber-800 border-amber-200',       icon: Clock },
  converted:   { label: 'Converted',   color: 'bg-emerald-100 text-emerald-800 border-emerald-200', icon: CheckCircle2 },
  closed:      { label: 'Closed',      color: 'bg-gray-100 text-gray-700 border-gray-200',          icon: XCircle },
  spam:        { label: 'Spam',        color: 'bg-red-100 text-red-800 border-red-200',             icon: Ban },
};
const STATUS_ORDER = ['new', 'contacted', 'in_progress', 'converted', 'closed', 'spam'];

const PRIORITY_CFG = {
  high:   { label: 'High',   color: 'bg-red-50 text-red-700 border-red-200' },
  normal: { label: 'Normal', color: 'bg-gray-50 text-gray-600 border-gray-200' },
  low:    { label: 'Low',    color: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const CHANNEL_ICON = {
  call: PhoneCall, email: Mail, whatsapp: MessageCircle, sms: Smartphone, meeting: Users, other: MessageSquare,
};

const ACTIVITY_CFG = {
  submitted:        { label: 'Submitted from website', icon: Inbox,      color: 'bg-purple-100 text-purple-700' },
  status_changed:   { label: 'Status changed',         icon: Flag,       color: 'bg-blue-100 text-blue-700' },
  priority_changed: { label: 'Priority changed',       icon: Flag,       color: 'bg-amber-100 text-amber-700' },
  assigned:         { label: 'Assigned',               icon: UserCheck,  color: 'bg-indigo-100 text-indigo-700' },
  contact_logged:   { label: 'Contact logged',         icon: PhoneCall,  color: 'bg-emerald-100 text-emerald-700' },
  note_added:       { label: 'Note added',             icon: StickyNote, color: 'bg-gray-100 text-gray-700' },
};

const SORT_OPTIONS = [
  { value: 'newest',           label: 'Newest first' },
  { value: 'oldest',           label: 'Oldest first' },
  { value: 'awaiting_longest', label: 'Awaiting contact longest' },
  { value: 'last_contacted',   label: 'Recently contacted' },
  { value: 'priority',         label: 'Priority' },
  { value: 'status',           label: 'Status' },
  { value: 'name_asc',         label: 'Name A → Z' },
  { value: 'name_desc',        label: 'Name Z → A' },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
const ist = (obj, key = 'display') => (obj && obj[key]) || '—';
const digitsOnly = (s) => String(s || '').replace(/[^\d]/g, '');
const waLink = (mobile) => {
  const d = digitsOnly(mobile);
  if (!d) return null;
  return `https://wa.me/${d.length === 10 ? `91${d}` : d}`;
};

/** Current time in IST as a value for <input type="datetime-local"> (YYYY-MM-DDTHH:mm). */
const nowIstInput = () => {
  const p = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).forEach((x) => { if (x.type !== 'literal') p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};
/** datetime-local value (entered as IST) → ISO with +05:30 offset. */
const istInputToIso = (v) => (v ? `${v}:00+05:30` : undefined);

const errorText = (err) => {
  if (!err) return 'Something went wrong';
  if (err.details?.length) return err.details.join(' · ');
  return err.message || 'Something went wrong';
};
const toast = (icon, title, text) =>
  MySwal.fire({ icon, title, text, timer: icon === 'success' ? 2200 : undefined, showConfirmButton: icon !== 'success', toast: true, position: 'top-end' });

// ── Small components ───────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS_CFG[status] || { label: status, color: 'bg-gray-100 text-gray-600 border-gray-200', icon: AlertCircle };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const PriorityBadge = ({ priority }) => {
  if (!priority || priority === 'normal') return null;
  const cfg = PRIORITY_CFG[priority] || PRIORITY_CFG.normal;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold border ${cfg.color}`}>
      <Flag className="w-3 h-3" /> {cfg.label}
    </span>
  );
};

const ConsentBadge = ({ consent, compact = false }) =>
  consent ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200" title="Agreed to promotional calls, SMS, WhatsApp and email">
      <ShieldCheck className="w-3 h-3" /> {compact ? 'Consent' : 'Marketing consent'}
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-gray-50 text-gray-500 border border-gray-200" title="Did not opt in to promotional messages">
      <ShieldOff className="w-3 h-3" /> {compact ? 'No consent' : 'No marketing consent'}
    </span>
  );

// KPI cards use Font Awesome (solid) icons; the rest of the page keeps lucide icons.
const StatCard = ({ label, value, icon, color, sub }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <FontAwesomeIcon icon={icon} className="text-white text-lg" fixedWidth />
    </div>
    <div className="min-w-0">
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value ?? '—'}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      {sub && <p className="text-[11px] text-gray-400 truncate">{sub}</p>}
    </div>
  </div>
);

const Field = ({ label, children, className = '' }) => (
  <div className={className}>
    <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
    <div className="text-sm text-gray-800">{children}</div>
  </div>
);

const SelectBox = ({ value, onChange, children, disabled, className = '' }) => (
  <div className={`relative ${className}`}>
    <select
      value={value}
      onChange={onChange}
      disabled={disabled}
      className="w-full pl-3 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm appearance-none bg-white focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 cursor-pointer"
    >
      {children}
    </select>
    <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
  </div>
);

// ══════════════════════════════════════════════════════════════════════════════
const ContactEnquiries = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Stats / meta ─────────────────────────────────────────────────────────────
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [meta, setMeta] = useState(null);

  // ── List ─────────────────────────────────────────────────────────────────────
  const [enquiries, setEnquiries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);

  // ── Filters ──────────────────────────────────────────────────────────────────
  const [status, setStatus] = useState('all');
  const [searchInput, setSearchInput] = useState(searchParams.get('ref') || '');
  const [search, setSearch] = useState(searchParams.get('ref') || '');
  const [topic, setTopic] = useState('');
  const [consent, setConsent] = useState('');
  const [assigned, setAssigned] = useState('');
  const [priority, setPriority] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [showFilters, setShowFilters] = useState(false);

  // ── Detail drawer ────────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(null); // 'status' | 'priority' | 'assign' | 'contact' | 'note' | 'delete'
  const [rowBusy, setRowBusy] = useState(null);
  const [exporting, setExporting] = useState(false);

  // Log-contact form
  const [logForm, setLogForm] = useState({ channel: 'call', outcome: 'connected', contacted_at: nowIstInput(), set_status: '', note: '' });
  const [noteText, setNoteText] = useState('');

  const canDelete = meta?.permissions?.can_delete === true;

  const listParams = useMemo(() => ({
    page, limit: PAGE_SIZE, status, search, topic, consent, assigned, priority, from, to, sort,
  }), [page, status, search, topic, consent, assigned, priority, from, to, sort]);

  // ── Loaders ──────────────────────────────────────────────────────────────────
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await contactEnquiryApi.getStats();
      setStats(data);
      log.flow('stats:loaded', { summary: { ...data.totals, avgFirstResponse: data.response_time?.avg_first_response_display, generatedIST: data.generated_at_ist?.display } });
    } catch (err) {
      log.error('stats:error', err);
    } finally { setStatsLoading(false); }
  }, []);

  const fetchMeta = useCallback(async () => {
    try {
      const data = await contactEnquiryApi.getMeta();
      setMeta(data);
      log.flow('meta:loaded', { summary: { topics: data.topics?.used?.length, admins: data.assignable_admins?.length, canDelete: data.permissions?.can_delete } });
    } catch (err) {
      log.error('meta:error', err);
    }
  }, []);

  const fetchList = useCallback(async (params) => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await contactEnquiryApi.list(params);
      setEnquiries(data.enquiries || []);
      setTotal(data.pagination?.total || 0);
      log.flow('list:loaded', {
        summary: { ...data.filters, page: data.pagination?.page, total: data.pagination?.total, returned: data.enquiries?.length },
        table: (data.enquiries || []).slice(0, 8).map((e) => ({ ref: e.reference_no, name: e.full_name, topic: e.topic, status: e.status, submittedIST: e.submitted_at_ist?.display })),
      });
    } catch (err) {
      log.error('list:error', err);
      setListError(errorText(err));
    } finally { setListLoading(false); }
  }, []);

  const fetchDetail = useCallback(async (id) => {
    if (!id) return;
    setDetailLoading(true);
    try {
      const data = await contactEnquiryApi.get(id);
      setDetail(data);
      log.flow('detail:loaded', { summary: { id, ref: data.enquiry?.reference_no, status: data.enquiry?.status, activities: data.activities?.length, submittedIST: data.enquiry?.submitted_at_ist?.display } });
    } catch (err) {
      log.error('detail:error', err);
      toast('error', 'Could not load enquiry', errorText(err));
      setSelectedId(null);
    } finally { setDetailLoading(false); }
  }, []);

  useEffect(() => { fetchStats(); fetchMeta(); }, [fetchStats, fetchMeta]);
  useEffect(() => { fetchList(listParams); }, [fetchList, listParams]);
  useEffect(() => { if (selectedId) fetchDetail(selectedId); else setDetail(null); }, [selectedId, fetchDetail]);

  // Reset page when any filter changes (not when page itself changes)
  const resetToFirstPage = () => setPage(1);

  const refreshAll = () => { fetchStats(); fetchList(listParams); if (selectedId) fetchDetail(selectedId); };

  const applySearch = () => { setSearch(searchInput.trim()); resetToFirstPage(); };
  const clearFilters = () => {
    setStatus('all'); setSearchInput(''); setSearch(''); setTopic(''); setConsent(''); setAssigned(''); setPriority('');
    setFrom(''); setTo(''); setSort('newest'); setPage(1);
    if (searchParams.get('ref')) setSearchParams({});
  };
  const activeFilterCount = [topic, consent, assigned, priority, from, to].filter(Boolean).length + (sort !== 'newest' ? 1 : 0);

  // ── Mutations ────────────────────────────────────────────────────────────────
  const afterMutation = (data, message) => {
    if (data?.enquiry) {
      setEnquiries((prev) => prev.map((e) => (e.id === data.enquiry.id ? data.enquiry : e)));
      setDetail((prev) => (prev && prev.enquiry?.id === data.enquiry.id
        ? { ...prev, enquiry: data.enquiry, activities: data.activities || prev.activities }
        : prev));
    }
    if (message) toast('success', message);
    fetchStats();
  };

  const patchEnquiry = async (id, body, kind) => {
    setSaving(kind);
    setRowBusy(id);
    try {
      const data = await contactEnquiryApi.update(id, body);
      log.flow('update:done', { summary: { id, ...body, changes: data.changes?.length } });
      afterMutation(data, data.changes?.length ? 'Enquiry updated' : null);
      if (selectedId === id) fetchDetail(id); // refresh timeline
    } catch (err) {
      log.error('update:error', err, { summary: { id, ...body } });
      toast('error', 'Update failed', errorText(err));
    } finally { setSaving(null); setRowBusy(null); }
  };

  const submitContactLog = async (e) => {
    e.preventDefault();
    if (!detail?.enquiry) return;
    const id = detail.enquiry.id;
    setSaving('contact');
    try {
      const body = {
        channel: logForm.channel,
        outcome: logForm.outcome,
        contacted_at: istInputToIso(logForm.contacted_at),
        ...(logForm.set_status ? { set_status: logForm.set_status } : {}),
        ...(logForm.note.trim() ? { note: logForm.note.trim() } : {}),
      };
      const data = await contactEnquiryApi.logContact(id, body);
      log.flow('contact-log:done', { summary: { id, ...body, firstContactedIST: data.enquiry?.first_contacted_at_ist?.display, responseTime: data.enquiry?.first_response_time } });
      afterMutation(data, data.message || 'Contact logged');
      setLogForm({ channel: 'call', outcome: 'connected', contacted_at: nowIstInput(), set_status: '', note: '' });
      fetchDetail(id);
    } catch (err) {
      log.error('contact-log:error', err);
      toast('error', 'Could not log contact', errorText(err));
    } finally { setSaving(null); }
  };

  const submitNote = async () => {
    if (!detail?.enquiry || !noteText.trim()) return;
    const id = detail.enquiry.id;
    setSaving('note');
    try {
      const data = await contactEnquiryApi.addNote(id, noteText.trim());
      afterMutation(data, 'Note added');
      setNoteText('');
    } catch (err) {
      toast('error', 'Could not add note', errorText(err));
    } finally { setSaving(null); }
  };

  const deleteEnquiry = async (enq) => {
    const result = await MySwal.fire({
      title: 'Delete enquiry?',
      html: `<strong>${enq.reference_no}</strong> · ${enq.full_name}<br/><span class="text-sm text-gray-500">This permanently removes the enquiry and its timeline.</span>`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete',
    });
    if (!result.isConfirmed) return;
    setSaving('delete');
    try {
      await contactEnquiryApi.remove(enq.id);
      log.flow('delete:done', { level: 'warn', summary: { id: enq.id, ref: enq.reference_no } });
      setSelectedId(null);
      setEnquiries((prev) => prev.filter((e) => e.id !== enq.id));
      setTotal((t) => Math.max(0, t - 1));
      fetchStats();
      toast('success', 'Enquiry deleted');
    } catch (err) {
      toast('error', 'Delete failed', errorText(err));
    } finally { setSaving(null); }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, fileName, totalRows, exportedRows } = await contactEnquiryApi.exportCsv({ ...listParams, page: undefined, limit: undefined });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      log.flow('export:done', { summary: { fileName, totalRows, exportedRows } });
      toast('success', `Exported ${exportedRows} of ${totalRows} enquiries`);
    } catch (err) {
      toast('error', 'Export failed', errorText(err));
    } finally { setExporting(false); }
  };

  const copy = async (text, label) => {
    try { await navigator.clipboard.writeText(text); toast('success', `${label} copied`); } catch { /* ignore */ }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const t = stats?.totals;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Inbox className="w-7 h-7 text-teal-600" />
            Contact Enquiries
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Messages from the “Contact Jurinex” form on jurinex.ai · all times in IST
            {stats?.generated_at_ist && <span className="text-gray-400"> · updated {stats.generated_at_ist.time}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportCsv}
            disabled={exporting || total === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold border border-emerald-300 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 transition disabled:opacity-40"
            title="Download the current filter as CSV (IST columns)"
          >
            <Download className={`w-4 h-4 ${exporting ? 'animate-bounce' : ''}`} /> Export CSV
          </button>
          <button
            onClick={refreshAll}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition"
          >
            <RefreshCw className={`w-4 h-4 ${statsLoading || listLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      {t && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard label="Total enquiries" value={t.total} icon={faInbox} color="bg-teal-600" sub={`${t.with_marketing_consent} with consent`} />
          <StatCard label="New (awaiting contact)" value={t.new} icon={faEnvelopeOpenText} color="bg-purple-500" sub={t.new_older_than_24h ? `${t.new_older_than_24h} older than 24h` : 'all within 24h'} />
          <StatCard label="Open" value={t.open} icon={faHourglassHalf} color="bg-amber-500" sub={`${t.open_unassigned} unassigned`} />
          <StatCard label="Today (IST)" value={t.today} icon={faCalendarDay} color="bg-blue-500" sub={`${t.yesterday} yesterday · ${t.last_7_days} this week`} />
          <StatCard label="This month (IST)" value={t.this_month} icon={faCalendarDays} color="bg-indigo-500" sub={`${t.last_30_days} in last 30 days`} />
          <StatCard label="Avg first response" value={stats.response_time?.avg_first_response_display || '—'} icon={faStopwatch} color="bg-emerald-500" sub={`target ${stats.response_time?.target_display} · ${t.conversion_rate_pct}% converted`} />
        </div>
      )}

      {/* Toolbar */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {[{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_CFG[s].label }))].map((b) => {
              const count = b.value === 'all' ? t?.total : b.value === 'open' ? t?.open : t?.[b.value];
              return (
                <button
                  key={b.value}
                  onClick={() => { setStatus(b.value); resetToFirstPage(); }}
                  className={`px-3.5 py-1.5 rounded-lg text-sm font-semibold border transition-all ${status === b.value ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-gray-600 border-gray-300 hover:border-teal-400'}`}
                >
                  {b.label}{count !== undefined && <span className={`ml-1.5 text-xs ${status === b.value ? 'text-teal-100' : 'text-gray-400'}`}>{count}</span>}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search name, email, mobile, organisation, reference…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                className="pl-9 pr-8 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 w-72"
              />
              {searchInput && (
                <button onClick={() => { setSearchInput(''); setSearch(''); resetToFirstPage(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <button onClick={applySearch} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">Search</button>
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition ${showFilters || activeFilterCount ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-white border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              Filters{activeFilterCount > 0 && <span className="px-1.5 rounded-full bg-teal-600 text-white text-[11px]">{activeFilterCount}</span>}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 shadow-sm">
            <Field label="Topic">
              <SelectBox value={topic} onChange={(e) => { setTopic(e.target.value); resetToFirstPage(); }}>
                <option value="">All topics</option>
                {(meta?.topics?.used || []).map((x) => <option key={x.topic} value={x.topic === 'Not specified' ? '' : x.topic}>{x.topic} ({x.count})</option>)}
              </SelectBox>
            </Field>
            <Field label="Consent">
              <SelectBox value={consent} onChange={(e) => { setConsent(e.target.value); resetToFirstPage(); }}>
                <option value="">Any</option>
                <option value="true">Marketing consent given</option>
                <option value="false">No consent</option>
              </SelectBox>
            </Field>
            <Field label="Assigned">
              <SelectBox value={assigned} onChange={(e) => { setAssigned(e.target.value); resetToFirstPage(); }}>
                <option value="">Anyone</option>
                <option value="me">Assigned to me</option>
                <option value="unassigned">Unassigned</option>
                {(meta?.assignable_admins || []).map((a) => <option key={a.id} value={a.id}>{a.name || a.email}</option>)}
              </SelectBox>
            </Field>
            <Field label="Priority">
              <SelectBox value={priority} onChange={(e) => { setPriority(e.target.value); resetToFirstPage(); }}>
                <option value="">Any</option>
                {['high', 'normal', 'low'].map((p) => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
              </SelectBox>
            </Field>
            <Field label="From (IST)">
              <input type="date" value={from} max={to || undefined} onChange={(e) => { setFrom(e.target.value); resetToFirstPage(); }} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500" />
            </Field>
            <Field label="To (IST)">
              <input type="date" value={to} min={from || undefined} onChange={(e) => { setTo(e.target.value); resetToFirstPage(); }} className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500" />
            </Field>
            <Field label="Sort">
              <div className="flex gap-2">
                <SelectBox className="flex-1" value={sort} onChange={(e) => { setSort(e.target.value); resetToFirstPage(); }}>
                  {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </SelectBox>
                <button onClick={clearFilters} className="px-2.5 border border-gray-300 rounded-lg text-gray-500 hover:bg-gray-50" title="Clear all filters"><X className="w-4 h-4" /></button>
              </div>
            </Field>
          </div>
        )}
      </div>

      {listError && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center gap-2 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {listError}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {listLoading && enquiries.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-teal-600" />
          </div>
        ) : enquiries.length === 0 ? (
          <div className="py-16 text-center">
            <Inbox className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">No contact enquiries match this view</p>
            {(search || activeFilterCount > 0 || status !== 'all') && (
              <button onClick={clearFilters} className="mt-3 text-sm text-teal-700 font-medium hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className={`overflow-x-auto ${listLoading ? 'opacity-60' : ''}`}>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Submitted (IST)', 'Contact', 'Enquiry', 'Status', 'Assigned', 'Contacted (IST)', 'Actions'].map((h) => (
                    <th key={h} className="px-4 py-3.5 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {enquiries.map((e) => (
                  <tr
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`hover:bg-teal-50/40 transition-colors cursor-pointer ${selectedId === e.id ? 'bg-teal-50/60' : ''} ${rowBusy === e.id ? 'opacity-60' : ''}`}
                  >
                    <td className="px-4 py-3.5 whitespace-nowrap align-top">
                      <p className="font-semibold text-gray-900">{ist(e.submitted_at_ist, 'date')}</p>
                      <p className="text-gray-600">{ist(e.submitted_at_ist, 'time')} <span className="text-gray-400 text-xs">IST</span></p>
                      <p className="text-[11px] text-gray-400 font-mono mt-0.5">{e.reference_no}</p>
                    </td>
                    <td className="px-4 py-3.5 align-top min-w-[200px]">
                      <p className="font-semibold text-gray-900 flex items-center gap-1.5">{e.full_name}<PriorityBadge priority={e.priority} /></p>
                      {e.organisation_name && <p className="text-xs text-gray-500 flex items-center gap-1"><Building2 className="w-3 h-3" />{e.organisation_name}</p>}
                      <p className="text-xs text-gray-600 flex items-center gap-1 mt-0.5"><Mail className="w-3 h-3 text-gray-400" />{e.email}</p>
                      <p className="text-xs text-gray-600 flex items-center gap-1"><Phone className="w-3 h-3 text-gray-400" />{e.mobile_number}</p>
                      <div className="mt-1"><ConsentBadge consent={e.marketing_consent} compact /></div>
                    </td>
                    <td className="px-4 py-3.5 align-top max-w-xs">
                      <p className="text-xs font-semibold text-teal-700">{e.topic || <span className="text-gray-400 font-normal italic">No topic</span>}</p>
                      <p className="text-sm text-gray-600 line-clamp-2 mt-0.5" title={e.message || ''}>{e.message || <span className="text-gray-300 italic">No additional details</span>}</p>
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap" onClick={(ev) => ev.stopPropagation()}>
                      <StatusBadge status={e.status} />
                      <div className="mt-1.5 w-36">
                        <SelectBox value={e.status} disabled={rowBusy === e.id} onChange={(ev) => patchEnquiry(e.id, { status: ev.target.value }, 'status')}>
                          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                        </SelectBox>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap text-sm">
                      {e.assigned_to ? (
                        <span className="inline-flex items-center gap-1.5 text-gray-800"><UserCheck className="w-3.5 h-3.5 text-indigo-500" />{e.assigned_to.name || e.assigned_to.email}</span>
                      ) : <span className="text-gray-400 italic">Unassigned</span>}
                    </td>
                    <td className="px-4 py-3.5 align-top whitespace-nowrap">
                      {e.first_contacted_at_ist ? (
                        <>
                          <p className="text-sm text-gray-800">{e.first_contacted_at_ist.date}, {e.first_contacted_at_ist.time}</p>
                          <p className="text-xs text-emerald-700 flex items-center gap-1"><Timer className="w-3 h-3" />responded in {e.first_response_time}</p>
                          {e.contact_attempts > 1 && <p className="text-[11px] text-gray-400">{e.contact_attempts} attempts · last {ist(e.last_contacted_at_ist, 'time')}</p>}
                        </>
                      ) : e.awaiting_first_contact ? (
                        <p className="text-xs font-semibold text-amber-700 flex items-center gap-1"><Clock className="w-3 h-3" />Awaiting · {e.awaiting_for}</p>
                      ) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 align-top" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setSelectedId(e.id)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-teal-700 transition" title="Open enquiry"><Eye className="w-4 h-4" /></button>
                        <a href={`tel:${e.mobile_number}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-emerald-50 hover:text-emerald-700 transition" title="Call"><PhoneCall className="w-4 h-4" /></a>
                        <a href={`mailto:${e.email}`} className="p-1.5 rounded-lg text-gray-500 hover:bg-blue-50 hover:text-blue-700 transition" title="Email"><Mail className="w-4 h-4" /></a>
                        {waLink(e.mobile_number) && <a href={waLink(e.mobile_number)} target="_blank" rel="noreferrer" className="p-1.5 rounded-lg text-gray-500 hover:bg-green-50 hover:text-green-700 transition" title="WhatsApp"><MessageCircle className="w-4 h-4" /></a>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 0 && (
          <div className="px-5 py-3.5 flex items-center justify-between border-t border-gray-100 bg-gray-50">
            <p className="text-sm text-gray-500">{(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}</p>
            <div className="flex gap-1.5">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1 || listLoading} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-40"><ChevronLeft className="w-4 h-4" /> Prev</button>
              <span className="px-3 py-1.5 text-sm text-gray-500">{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages || listLoading} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-white disabled:opacity-40">Next <ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* ══════════════════════════ DETAIL DRAWER ═══════════════════════════════ */}
      {selectedId && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setSelectedId(null)} />
          <aside className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col animate-fadeIn">
            {detailLoading && !detail ? (
              <div className="flex-1 flex items-center justify-center"><div className="animate-spin rounded-full h-9 w-9 border-b-2 border-teal-600" /></div>
            ) : detail?.enquiry ? (() => {
              const e = detail.enquiry;
              return (
                <>
                  {/* Drawer header */}
                  <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between gap-3 bg-gray-50">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg font-bold text-gray-900 truncate">{e.full_name}</h2>
                        <StatusBadge status={e.status} />
                        <PriorityBadge priority={e.priority} />
                      </div>
                      <p className="text-xs text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                        <button onClick={() => copy(e.reference_no, 'Reference')} className="font-mono text-gray-700 hover:text-teal-700 inline-flex items-center gap-1" title="Copy reference">{e.reference_no}<Copy className="w-3 h-3" /></button>
                        <span>·</span>
                        <span>Submitted <strong className="text-gray-700">{ist(e.submitted_at_ist)}</strong></span>
                        <span className="text-gray-400">({e.submitted_ago} ago)</span>
                      </p>
                    </div>
                    <button onClick={() => setSelectedId(null)} className="p-2 rounded-lg text-gray-400 hover:bg-gray-200 hover:text-gray-700"><X className="w-5 h-5" /></button>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-6">

                    {/* Contact details */}
                    <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Email">
                        <a href={`mailto:${e.email}`} className="text-teal-700 hover:underline inline-flex items-center gap-1.5 break-all"><Mail className="w-3.5 h-3.5" />{e.email}</a>
                      </Field>
                      <Field label="Mobile">
                        <div className="flex items-center gap-2 flex-wrap">
                          <a href={`tel:${e.mobile_number}`} className="text-teal-700 hover:underline inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" />{e.mobile_number}</a>
                          {waLink(e.mobile_number) && <a href={waLink(e.mobile_number)} target="_blank" rel="noreferrer" className="text-xs px-2 py-0.5 rounded-md bg-green-50 text-green-700 border border-green-200 inline-flex items-center gap-1"><MessageCircle className="w-3 h-3" />WhatsApp</a>}
                        </div>
                      </Field>
                      <Field label="Organisation">{e.organisation_name || <span className="text-gray-400">—</span>}</Field>
                      <Field label="What is this about">{e.topic || <span className="text-gray-400">Not specified</span>}</Field>
                      <Field label="Additional details" className="sm:col-span-2">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 whitespace-pre-wrap text-gray-800 min-h-[44px]">{e.message || <span className="text-gray-400 italic">No additional details</span>}</div>
                      </Field>
                      <Field label="Marketing consent">
                        <ConsentBadge consent={e.marketing_consent} />
                        {e.consent_given_at_ist && <p className="text-[11px] text-gray-400 mt-1">given {e.consent_given_at_ist.display}</p>}
                      </Field>
                      <Field label="Source">
                        <p className="text-gray-700">{e.source}</p>
                        {e.page_url && <a href={e.page_url} target="_blank" rel="noreferrer" className="text-[11px] text-teal-700 hover:underline inline-flex items-center gap-1 break-all"><ExternalLink className="w-3 h-3" />{e.page_url}</a>}
                      </Field>
                    </section>

                    {/* Contact tracking */}
                    <section className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2"><Timer className="w-3.5 h-3.5" />Contact tracking (IST)</div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 text-sm">
                        <Field label="First contacted">
                          {e.first_contacted_at_ist ? <><p className="font-semibold text-gray-900">{e.first_contacted_at_ist.date}</p><p className="text-gray-600">{e.first_contacted_at_ist.time}</p>{e.first_contacted_by?.name && <p className="text-[11px] text-gray-400">by {e.first_contacted_by.name}</p>}</> : <span className="text-amber-700 font-semibold">Not yet · waiting {e.awaiting_for || e.submitted_ago}</span>}
                        </Field>
                        <Field label="First response time">
                          {e.first_response_time ? <span className="font-semibold text-emerald-700">{e.first_response_time}</span> : <span className="text-gray-400">—</span>}
                        </Field>
                        <Field label="Last contacted">
                          {e.last_contacted_at_ist ? <><p className="font-semibold text-gray-900">{e.last_contacted_at_ist.date}</p><p className="text-gray-600">{e.last_contacted_at_ist.time}{e.last_contact_channel_label ? ` · ${e.last_contact_channel_label}` : ''}</p>{e.last_contacted_by?.name && <p className="text-[11px] text-gray-400">by {e.last_contacted_by.name}</p>}</> : <span className="text-gray-400">—</span>}
                        </Field>
                        <Field label="Attempts">
                          <span className="font-semibold text-gray-900">{e.contact_attempts}</span>
                          {e.closed_at_ist && <p className="text-[11px] text-gray-400">closed {e.closed_at_ist.display}</p>}
                        </Field>
                      </div>
                    </section>

                    {/* Log a contact */}
                    <section className="rounded-xl border border-teal-200 bg-teal-50/40 overflow-hidden">
                      <div className="px-4 py-2.5 bg-teal-50 border-b border-teal-200 text-xs font-semibold text-teal-800 uppercase tracking-wide flex items-center gap-2"><PhoneCall className="w-3.5 h-3.5" />Log a contact — “we reached out”</div>
                      <form onSubmit={submitContactLog} className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <Field label="Channel">
                          <SelectBox value={logForm.channel} onChange={(ev) => setLogForm((f) => ({ ...f, channel: ev.target.value }))}>
                            {(meta?.contact_channels || [{ value: 'call', label: 'Phone call' }]).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </SelectBox>
                        </Field>
                        <Field label="Outcome">
                          <SelectBox value={logForm.outcome} onChange={(ev) => setLogForm((f) => ({ ...f, outcome: ev.target.value }))}>
                            {(meta?.contact_outcomes || [{ value: 'connected', label: 'Connected' }]).map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </SelectBox>
                        </Field>
                        <Field label="Contacted at (IST)">
                          <input type="datetime-local" value={logForm.contacted_at} max={nowIstInput()} onChange={(ev) => setLogForm((f) => ({ ...f, contacted_at: ev.target.value }))} className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500" />
                        </Field>
                        <Field label="Then set status">
                          <SelectBox value={logForm.set_status} onChange={(ev) => setLogForm((f) => ({ ...f, set_status: ev.target.value }))}>
                            <option value="">{e.status === 'new' ? 'Contacted (auto)' : 'Keep current'}</option>
                            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                          </SelectBox>
                        </Field>
                        <Field label="Note" className="col-span-2 sm:col-span-3">
                          <input type="text" value={logForm.note} onChange={(ev) => setLogForm((f) => ({ ...f, note: ev.target.value }))} placeholder="e.g. Spoke to Asha, sending pricing deck" className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-teal-500" />
                        </Field>
                        <div className="flex items-end">
                          <button type="submit" disabled={saving === 'contact'} className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-teal-600 text-white hover:bg-teal-700 transition disabled:opacity-50">
                            {saving === 'contact' ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Log contact
                          </button>
                        </div>
                      </form>
                    </section>

                    {/* Workflow controls */}
                    <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Field label="Status">
                        <SelectBox value={e.status} disabled={saving === 'status'} onChange={(ev) => patchEnquiry(e.id, { status: ev.target.value }, 'status')}>
                          {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_CFG[s].label}</option>)}
                        </SelectBox>
                      </Field>
                      <Field label="Priority">
                        <SelectBox value={e.priority} disabled={saving === 'priority'} onChange={(ev) => patchEnquiry(e.id, { priority: ev.target.value }, 'priority')}>
                          {['high', 'normal', 'low'].map((p) => <option key={p} value={p}>{PRIORITY_CFG[p].label}</option>)}
                        </SelectBox>
                      </Field>
                      <Field label="Assigned to">
                        <SelectBox value={e.assigned_to?.id ?? ''} disabled={saving === 'assign'} onChange={(ev) => patchEnquiry(e.id, { assigned_to: ev.target.value ? Number(ev.target.value) : null }, 'assign')}>
                          <option value="">Unassigned</option>
                          {(meta?.assignable_admins || []).map((a) => <option key={a.id} value={a.id}>{a.name || a.email}{a.role === 'super-admin' ? ' (super)' : ''}</option>)}
                        </SelectBox>
                      </Field>
                    </section>

                    {/* Add note */}
                    <section className="flex gap-2">
                      <input type="text" value={noteText} onChange={(ev) => setNoteText(ev.target.value)} onKeyDown={(ev) => ev.key === 'Enter' && submitNote()} placeholder="Add an internal note…" className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-teal-500" />
                      <button onClick={submitNote} disabled={saving === 'note' || !noteText.trim()} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40"><StickyNote className="w-4 h-4" />Add note</button>
                    </section>

                    {/* Timeline */}
                    <section>
                      <h3 className="text-xs font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-2 mb-3"><History className="w-3.5 h-3.5" />Timeline <span className="text-gray-400 normal-case font-normal">({detail.activities?.length || 0})</span></h3>
                      <ol className="relative border-l-2 border-gray-200 ml-3 space-y-4">
                        {(detail.activities || []).map((a) => {
                          const cfg = ACTIVITY_CFG[a.activity_type] || { label: a.activity_type, icon: History, color: 'bg-gray-100 text-gray-600' };
                          const Icon = a.activity_type === 'contact_logged' && CHANNEL_ICON[a.channel] ? CHANNEL_ICON[a.channel] : cfg.icon;
                          let title = cfg.label;
                          if (a.activity_type === 'status_changed') title = `Status: ${STATUS_CFG[a.from_value]?.label || a.from_value} → ${STATUS_CFG[a.to_value]?.label || a.to_value}`;
                          if (a.activity_type === 'priority_changed') title = `Priority: ${a.from_value} → ${a.to_value}`;
                          if (a.activity_type === 'assigned') title = `Assigned: ${a.from_value} → ${a.to_value}`;
                          if (a.activity_type === 'contact_logged') title = `${a.channel_label || 'Contact'}${a.outcome_label ? ` · ${a.outcome_label}` : ''}${a.from_value !== a.to_value ? ` · ${STATUS_CFG[a.from_value]?.label} → ${STATUS_CFG[a.to_value]?.label}` : ''}`;
                          return (
                            <li key={a.id} className="ml-5">
                              <span className={`absolute -left-[13px] w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-white ${cfg.color}`}><Icon className="w-3 h-3" /></span>
                              <p className="text-sm font-semibold text-gray-900">{title}</p>
                              <p className="text-xs text-gray-500">{ist(a.occurred_at_ist)}{a.actor?.name || a.actor?.email ? ` · ${a.actor.name || a.actor.email}` : a.actor?.role === 'website' ? ' · website visitor' : ''}</p>
                              {a.note && <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 mt-1 whitespace-pre-wrap">{a.note}</p>}
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  </div>

                  {/* Drawer footer */}
                  <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
                    <p className="text-[11px] text-gray-400">Updated {ist(e.updated_at_ist)} · IP {e.ip_address || '—'}</p>
                    <div className="flex items-center gap-2">
                      {canDelete && (
                        <button onClick={() => deleteEnquiry(e)} disabled={saving === 'delete'} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"><Trash2 className="w-4 h-4" />Delete</button>
                      )}
                      <button onClick={() => setSelectedId(null)} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-medium border border-gray-300 text-gray-600 hover:bg-white transition"><X className="w-4 h-4" />Close</button>
                    </div>
                  </div>
                </>
              );
            })() : null}
          </aside>
        </>
      )}
    </div>
  );
};

export default ContactEnquiries;
