import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Mail, RefreshCw, Search, Download, Eye, X, ChevronLeft, ChevronRight,
  Monitor, Smartphone, Tablet, Globe, Copy, Clock, MapPin,
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faEnvelopeOpenText, faCalendarDay, faCalendarDays, faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import newsletterSubscriberApi from '../../services/newsletterSubscriberApi';
import { createDebugLogger } from '../../utils/debugLogger';

const MySwal = withReactContent(Swal);
const log = createDebugLogger('NewsletterSubscribers');
const PAGE_SIZE = 20;

const DEVICE_CFG = {
  desktop: { label: 'Desktop', icon: Monitor, color: 'bg-slate-100 text-slate-700 border-slate-200' },
  mobile: { label: 'Mobile', icon: Smartphone, color: 'bg-blue-50 text-blue-700 border-blue-200' },
  tablet: { label: 'Tablet', icon: Tablet, color: 'bg-violet-50 text-violet-700 border-violet-200' },
};

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'email_asc', label: 'Email A → Z' },
  { value: 'email_desc', label: 'Email Z → A' },
];

const ist = (obj, key = 'display') => (obj && obj[key]) || '—';
const errorText = (err) => err?.message || 'Something went wrong';

const toast = (icon, title, text) =>
  MySwal.fire({ icon, title, text, timer: 2200, showConfirmButton: false, confirmButtonColor: '#0d9488' });

const DeviceBadge = ({ type }) => {
  const cfg = DEVICE_CFG[String(type || '').toLowerCase()] || {
    label: type || 'Unknown',
    icon: Globe,
    color: 'bg-gray-100 text-gray-600 border-gray-200',
  };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
};

const StatCard = ({ label, value, icon, color }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 shadow-sm">
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
      <FontAwesomeIcon icon={icon} className="text-white text-lg" />
    </div>
    <div>
      <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
      <p className="text-xs text-gray-500 font-medium">{label}</p>
    </div>
  </div>
);

export default function NewsletterSubscribers() {
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [deviceType, setDeviceType] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [sort, setSort] = useState('newest');
  const [exporting, setExporting] = useState(false);
  const [selected, setSelected] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const listParams = useMemo(
    () => ({ page, limit: PAGE_SIZE, search, device_type: deviceType, from, to, sort }),
    [page, search, deviceType, from, to, sort]
  );

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await newsletterSubscriberApi.getStats();
      setStats(data);
      log.flow('stats:loaded', { summary: data.totals });
    } catch (err) {
      log.error('stats:error', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchList = useCallback(async (params) => {
    setListLoading(true);
    setListError(null);
    try {
      const data = await newsletterSubscriberApi.list(params);
      setRows(data.subscribers || []);
      setTotal(data.pagination?.total || 0);
      log.flow('list:loaded', {
        summary: { page: data.pagination?.page, total: data.pagination?.total, returned: data.subscribers?.length },
        table: (data.subscribers || []).slice(0, 8).map((s) => ({
          email: s.email,
          ip: s.ip_address,
          browser: s.browser,
          os: s.os,
          subscribedIST: s.subscribed_at_ist?.display,
        })),
      });
    } catch (err) {
      log.error('list:error', err);
      setListError(errorText(err));
    } finally {
      setListLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchList(listParams); }, [fetchList, listParams]);

  const applySearch = () => { setSearch(searchInput.trim()); setPage(1); };
  const clearFilters = () => {
    setSearchInput('');
    setSearch('');
    setDeviceType('');
    setFrom('');
    setTo('');
    setSort('newest');
    setPage(1);
  };

  const openDetail = async (row) => {
    setSelected(row);
    setDetailLoading(true);
    try {
      const data = await newsletterSubscriberApi.get(row.id);
      setSelected(data);
    } catch (err) {
      toast('error', 'Could not load subscriber', errorText(err));
    } finally {
      setDetailLoading(false);
    }
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const { blob, fileName, totalRows, exportedRows } = await newsletterSubscriberApi.exportCsv({
        ...listParams, page: undefined, limit: undefined,
      });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(a.href);
      log.flow('export:done', { summary: { fileName, totalRows, exportedRows } });
      toast('success', `Exported ${exportedRows} of ${totalRows} subscribers`);
    } catch (err) {
      toast('error', 'Export failed', errorText(err));
    } finally {
      setExporting(false);
    }
  };

  const copy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      toast('success', `${label} copied`);
    } catch { /* ignore */ }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const t = stats?.totals;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Mail className="w-7 h-7 text-teal-600" />
            Newsletter Subscribers
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Website newsletter sign-ups with IP, browser, OS and subscribe time (IST).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => { fetchStats(); fetchList(listParams); }}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
          >
            <RefreshCw className={`w-4 h-4 ${listLoading || statsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total subscribers" value={statsLoading ? '—' : t?.total} icon={faEnvelopeOpenText} color="bg-teal-600" />
        <StatCard label="Today (IST)" value={statsLoading ? '—' : t?.today} icon={faCalendarDay} color="bg-blue-600" />
        <StatCard label="This month (IST)" value={statsLoading ? '—' : t?.this_month} icon={faCalendarDays} color="bg-indigo-600" />
        <StatCard label="Unique IPs" value={statsLoading ? '—' : t?.unique_ips} icon={faNetworkWired} color="bg-slate-700" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="block text-xs font-medium text-gray-500 mb-1">Search</label>
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applySearch()}
                placeholder="Email, IP, browser or OS"
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Device</label>
            <select
              value={deviceType}
              onChange={(e) => { setDeviceType(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              <option value="">All devices</option>
              <option value="desktop">Desktop</option>
              <option value="mobile">Mobile</option>
              <option value="tablet">Tablet</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From (IST)</label>
            <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To (IST)</label>
            <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Sort</label>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
            >
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <button type="button" onClick={applySearch} className="px-4 py-2 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800">
            Search
          </button>
          <button type="button" onClick={clearFilters} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg">
            Clear
          </button>
        </div>

        {listError && (
          <div className="mx-4 mt-4 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{listError}</div>
        )}

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Email', 'IP address', 'Browser', 'OS', 'Device', 'Subscribed (IST)', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 bg-white">
              {listLoading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">Loading subscribers…</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No newsletter subscribers yet.</td></tr>
              ) : rows.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{s.email}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-700">{s.ip_address || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.browser || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{s.os || '—'}</td>
                  <td className="px-4 py-3"><DeviceBadge type={s.device_type} /></td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    <div className="leading-tight">{ist(s.subscribed_at_ist)}</div>
                    {s.subscribed_ago && <div className="text-[11px] text-gray-400 mt-0.5">{s.subscribed_ago} ago</div>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => openDetail(s)}
                      className="p-2 text-teal-700 hover:bg-teal-50 rounded-lg"
                      title="View details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-4 py-3 border-t border-gray-100 flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2">{page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="p-2 rounded-lg border border-gray-200 disabled:opacity-40">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Subscriber details</h2>
              <button type="button" onClick={() => setSelected(null)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            {detailLoading ? (
              <div className="p-8 text-sm text-gray-400">Loading…</div>
            ) : (
              <div className="p-5 space-y-4">
                <DetailRow icon={Mail} label="Email" value={selected.email} onCopy={() => copy(selected.email, 'Email')} />
                <DetailRow icon={MapPin} label="IP address" value={selected.ip_address} onCopy={selected.ip_address ? () => copy(selected.ip_address, 'IP') : undefined} />
                <DetailRow icon={Globe} label="Browser" value={selected.browser} />
                <DetailRow icon={Monitor} label="OS" value={selected.os} />
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">Device</p>
                  <DeviceBadge type={selected.device_type} />
                </div>
                <DetailRow icon={Clock} label="Subscribed (IST)" value={ist(selected.subscribed_at_ist)} />
                <DetailRow label="UTC" value={selected.subscribed_at} />
                <DetailRow label="Source" value={selected.source} />
                {selected.page_url && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-1">Page URL</p>
                    <a href={selected.page_url} target="_blank" rel="noreferrer" className="text-sm text-teal-700 break-all hover:underline">
                      {selected.page_url}
                    </a>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 mb-1">User agent</p>
                  <p className="text-xs text-gray-600 bg-slate-50 border border-slate-100 rounded-lg p-3 break-all leading-relaxed">
                    {selected.user_agent || '—'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ icon: Icon, label, value, onCopy }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
      <div className="flex items-start gap-2">
        {Icon && <Icon className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />}
        <p className="text-sm text-gray-900 break-all flex-1">{value || '—'}</p>
        {onCopy && value && (
          <button type="button" onClick={onCopy} className="p-1 text-gray-400 hover:text-gray-700" title="Copy">
            <Copy className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
