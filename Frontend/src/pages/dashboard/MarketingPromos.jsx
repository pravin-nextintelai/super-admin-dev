import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Plus, RefreshCw, Pencil, Trash2, X, Calendar, ToggleLeft, ToggleRight, Sparkles,
} from 'lucide-react';
import Swal from 'sweetalert2';
import withReactContent from 'sweetalert2-react-content';
import promoApi from '../../services/promoApi';
import { createDebugLogger } from '../../utils/debugLogger';

const MySwal = withReactContent(Swal);
const log = createDebugLogger('MarketingPromos');

const emptySlot = () => ({ starts_at: '', ends_at: '', seat_capacity: '', label: '', seats_booked: 0 });

const emptyForm = () => ({
  kind: 'offer',
  status: 'active',
  badge: 'FREE TRIAL',
  title: 'Try Jurinex free for 7 days',
  subtitle: 'AI powered legal research and drafting',
  cta_label: 'Start free trial',
  cta_url: 'https://jurinex.ai',
  background_color: '#0F766E',
  text_color: '#FFFFFF',
  show_on_header: true,
  priority: 10,
  starts_at: '',
  ends_at: '',
  location: '',
  slots: [],
});

const nowIstInput = () => {
  const p = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).forEach((x) => { if (x.type !== 'literal') p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

const isoToIstInput = (iso) => {
  if (!iso) return '';
  const p = {};
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(iso)).forEach((x) => { if (x.type !== 'literal') p[x.type] = x.value; });
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
};

const istInputToIso = (v) => (v ? new Date(`${v}:00+05:30`).toISOString() : null);

const toast = (icon, title, text) =>
  MySwal.fire({ icon, title, text, timer: 2200, showConfirmButton: false, confirmButtonColor: '#0d9488' });

const errorText = (err) => err?.message || 'Something went wrong';
const ist = (obj) => obj?.display || '—';

function promoToForm(p) {
  return {
    kind: p.kind || 'offer',
    status: p.status || 'draft',
    badge: p.badge || '',
    title: p.title || '',
    subtitle: p.subtitle || '',
    cta_label: p.cta_label || '',
    cta_url: p.cta_url || '',
    background_color: p.background_color || '#0F766E',
    text_color: p.text_color || '#FFFFFF',
    show_on_header: p.show_on_header !== false,
    priority: p.priority ?? 0,
    starts_at: isoToIstInput(p.starts_at),
    ends_at: isoToIstInput(p.ends_at),
    location: p.location || '',
    slots: (p.slots || []).map((s) => ({
      starts_at: isoToIstInput(s.starts_at),
      ends_at: isoToIstInput(s.ends_at),
      seat_capacity: s.seat_capacity ?? '',
      seats_booked: s.seats_booked || 0,
      label: s.label || '',
    })),
  };
}

function formToPayload(form) {
  return {
    kind: form.kind,
    status: form.status,
    badge: form.badge || null,
    title: form.title.trim(),
    subtitle: form.subtitle || null,
    cta_label: form.cta_label || null,
    cta_url: form.cta_url || null,
    background_color: form.background_color || '#0F766E',
    text_color: form.text_color || '#FFFFFF',
    show_on_header: Boolean(form.show_on_header),
    priority: Number(form.priority || 0),
    starts_at: istInputToIso(form.starts_at),
    ends_at: istInputToIso(form.ends_at),
    location: form.location || null,
    slots: (form.slots || [])
      .filter((s) => s.starts_at)
      .map((s) => ({
        label: s.label || null,
        starts_at: istInputToIso(s.starts_at),
        ends_at: istInputToIso(s.ends_at),
        seat_capacity: s.seat_capacity === '' || s.seat_capacity == null ? null : Number(s.seat_capacity),
        seats_booked: Number(s.seats_booked || 0),
      })),
  };
}

function BannerPreview({ form }) {
  const bg = form.background_color || '#0F766E';
  const fg = form.text_color || '#FFFFFF';
  return (
    <div className="rounded-lg overflow-hidden" style={{ backgroundColor: bg }}>
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-2 text-[13px] text-center">
        {form.badge && (
          <span className="inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: fg }}>
            {form.badge}
          </span>
        )}
        <span className="font-medium" style={{ color: fg }}>
          {form.title || 'Offer title'}
          {form.subtitle ? <span className="opacity-90"> · {form.subtitle}</span> : null}
        </span>
        {form.cta_label && <span className="font-semibold underline underline-offset-2" style={{ color: fg }}>{form.cta_label}</span>}
      </div>
    </div>
  );
}

export default function MarketingPromos() {
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [kind, setKind] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const params = useMemo(() => ({ page, limit: 20, kind, status }), [page, kind, status]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, list] = await Promise.all([promoApi.getStats(), promoApi.list(params)]);
      setStats(s);
      setItems(list.items || []);
      setTotal(list.pagination?.total || 0);
      log.flow('list:loaded', { summary: { total: list.pagination?.total, kind, status } });
    } catch (err) {
      log.error('list:error', err);
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  }, [params, kind, status]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const openCreate = (presetKind = 'offer') => {
    const f = emptyForm();
    f.kind = presetKind;
    if (presetKind === 'event') {
      f.badge = 'WEBINAR';
      f.title = 'Live Jurinex walkthrough';
      f.subtitle = 'See research and drafting in action';
      f.cta_label = 'Reserve a seat';
      f.slots = [{ ...emptySlot(), starts_at: nowIstInput(), seat_capacity: 50, label: '' }];
    }
    setEditingId(null);
    setForm(f);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditingId(row.id);
    setForm(promoToForm(row));
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.title.trim()) {
      toast('warning', 'Title is required');
      return;
    }
    if (form.kind === 'event' && !(form.slots || []).some((s) => s.starts_at)) {
      toast('warning', 'Add at least one time slot for an event');
      return;
    }
    setSaving(true);
    try {
      const payload = formToPayload(form);
      const data = editingId ? await promoApi.update(editingId, payload) : await promoApi.create(payload);
      log.flow(editingId ? 'update:done' : 'create:done', { summary: { id: data.id, kind: data.kind, status: data.status } });
      setModalOpen(false);
      toast('success', editingId ? 'Updated' : 'Published to header when Active');
      fetchAll();
    } catch (err) {
      toast('error', 'Save failed', errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (row) => {
    const next = row.status === 'active' ? 'paused' : 'active';
    try {
      await promoApi.setStatus(row.id, next);
      fetchAll();
    } catch (err) {
      toast('error', 'Could not change status', errorText(err));
    }
  };

  const remove = async (row) => {
    const ok = await MySwal.fire({
      title: 'Delete this item?',
      text: row.title,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete',
    });
    if (!ok.isConfirmed) return;
    try {
      await promoApi.remove(row.id);
      toast('success', 'Deleted');
      fetchAll();
    } catch (err) {
      toast('error', 'Delete failed', errorText(err));
    }
  };

  const t = stats?.totals;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="w-7 h-7 text-teal-600" />
            Offers & Events
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Add header-bar offers (with a deadline) and events (time slots + seats). The user site fetches these above the header.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={fetchAll} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium bg-white border border-gray-200 rounded-lg hover:bg-gray-50">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={() => openCreate('offer')} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700">
            <Plus className="w-4 h-4" /> Add offer
          </button>
          <button type="button" onClick={() => openCreate('event')} className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-800 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100">
            <Calendar className="w-4 h-4" /> Add event
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          ['Live on header', t?.live_on_header, 'bg-teal-600'],
          ['Offers', t?.offers, 'bg-blue-600'],
          ['Events', t?.events, 'bg-indigo-600'],
          ['Active', t?.active, 'bg-slate-700'],
        ].map(([label, value, color]) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-10 h-10 rounded-xl ${color} flex items-center justify-center`}>
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{value ?? '—'}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 border-b border-gray-100 flex flex-wrap gap-2">
          <select value={kind} onChange={(e) => { setKind(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">All types</option>
            <option value="offer">Offers</option>
            <option value="event">Events</option>
          </select>
          <select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="draft">Draft</option>
            <option value="paused">Paused</option>
          </select>
        </div>
        {error && <div className="mx-4 mt-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50">
              <tr>
                {['Type', 'Offer / event', 'Deadline (IST)', 'Slots / seats', 'Header', 'Status', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">Loading…</td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-sm text-gray-400">No offers or events yet. Add one to show it above the user header.</td></tr>
              ) : items.map((row) => (
                <tr key={row.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${row.kind === 'event' ? 'bg-indigo-50 text-indigo-700' : 'bg-teal-50 text-teal-700'}`}>
                      {row.kind}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{row.badge ? `${row.badge} · ` : ''}{row.title}</div>
                    {row.subtitle && <div className="text-xs text-gray-500 mt-0.5">{row.subtitle}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {ist(row.ends_at_ist)}
                    {row.ends_in && <div className="text-[11px] text-gray-400">{row.ends_in} left</div>}
                    {row.expired && <div className="text-[11px] text-red-500">Expired</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {row.kind === 'event' ? (
                      <>
                        <div>{row.slots?.length || 0} slot{(row.slots?.length || 0) === 1 ? '' : 's'}</div>
                        {row.seats?.capacity != null && (
                          <div className="text-[11px] text-gray-400">{row.seats.booked}/{row.seats.capacity} booked</div>
                        )}
                      </>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {row.live ? <span className="text-teal-700 font-medium">Live</span> : <span className="text-gray-400">Off</span>}
                  </td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => toggleStatus(row)} className="inline-flex items-center gap-1 text-sm text-gray-700">
                      {row.status === 'active' ? <ToggleRight className="w-5 h-5 text-teal-600" /> : <ToggleLeft className="w-5 h-5 text-gray-400" />}
                      {row.status}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <button type="button" onClick={() => openEdit(row)} className="p-2 text-teal-700 hover:bg-teal-50 rounded-lg"><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => remove(row)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-3 border-t border-gray-100 text-sm text-gray-600 flex justify-between">
          <span>{total} items</span>
          <span>Page {page} / {totalPages}</span>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setModalOpen(false)} />
          <div className="relative ml-auto w-full max-w-xl bg-white h-full overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-semibold">{editingId ? 'Edit' : 'New'} {form.kind}</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <BannerPreview form={form} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <select value={form.kind} onChange={(e) => setForm((f) => ({ ...f, kind: e.target.value }))} className="input">
                    <option value="offer">Offer</option>
                    <option value="event">Event</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="input">
                    <option value="active">Active (show on site)</option>
                    <option value="draft">Draft</option>
                    <option value="paused">Paused</option>
                  </select>
                </Field>
              </div>
              <Field label="Badge"><input className="input" value={form.badge} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} placeholder="FREE TRIAL" /></Field>
              <Field label="Title"><input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} /></Field>
              <Field label="Subtitle"><input className="input" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Button label"><input className="input" value={form.cta_label} onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))} /></Field>
                <Field label="Button URL"><input className="input" value={form.cta_url} onChange={(e) => setForm((f) => ({ ...f, cta_url: e.target.value }))} placeholder="https://jurinex.ai/signup" /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Starts (IST)"><input type="datetime-local" className="input" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} /></Field>
                <Field label="Deadline (IST)"><input type="datetime-local" className="input" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} /></Field>
              </div>
              {form.kind === 'event' && (
                <>
                  <Field label="Location"><input className="input" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="Online / city" /></Field>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-gray-500">Time slots & seats</p>
                      <button type="button" onClick={() => setForm((f) => ({ ...f, slots: [...f.slots, { ...emptySlot(), starts_at: nowIstInput() }] }))} className="text-xs text-teal-700 font-medium">+ Add slot</button>
                    </div>
                    <div className="space-y-2">
                      {form.slots.map((slot, i) => (
                        <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
                          <div className="grid grid-cols-2 gap-2">
                            <input type="datetime-local" className="input" value={slot.starts_at} onChange={(e) => setForm((f) => ({ ...f, slots: f.slots.map((s, j) => j === i ? { ...s, starts_at: e.target.value } : s) }))} />
                            <input type="datetime-local" className="input" value={slot.ends_at} onChange={(e) => setForm((f) => ({ ...f, slots: f.slots.map((s, j) => j === i ? { ...s, ends_at: e.target.value } : s) }))} />
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            <input className="input" placeholder="Label (optional)" value={slot.label} onChange={(e) => setForm((f) => ({ ...f, slots: f.slots.map((s, j) => j === i ? { ...s, label: e.target.value } : s) }))} />
                            <input type="number" min="0" className="input" placeholder="Seat capacity" value={slot.seat_capacity} onChange={(e) => setForm((f) => ({ ...f, slots: f.slots.map((s, j) => j === i ? { ...s, seat_capacity: e.target.value } : s) }))} />
                            <input type="number" min="0" className="input" placeholder="Already booked" value={slot.seats_booked} onChange={(e) => setForm((f) => ({ ...f, slots: f.slots.map((s, j) => j === i ? { ...s, seats_booked: e.target.value } : s) }))} />
                          </div>
                          <button type="button" className="text-xs text-red-600" onClick={() => setForm((f) => ({ ...f, slots: f.slots.filter((_, j) => j !== i) }))}>Remove slot</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <div className="grid grid-cols-3 gap-3">
                <Field label="Bar colour"><input type="color" className="h-10 w-full rounded-lg border border-gray-200" value={form.background_color} onChange={(e) => setForm((f) => ({ ...f, background_color: e.target.value }))} /></Field>
                <Field label="Text colour"><input type="color" className="h-10 w-full rounded-lg border border-gray-200" value={form.text_color} onChange={(e) => setForm((f) => ({ ...f, text_color: e.target.value }))} /></Field>
                <Field label="Priority"><input type="number" min="0" className="input" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} /></Field>
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input type="checkbox" checked={form.show_on_header} onChange={(e) => setForm((f) => ({ ...f, show_on_header: e.target.checked }))} />
                Show above the user-site header
              </label>
              <button type="button" onClick={save} disabled={saving} className="w-full py-2.5 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50">
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
      <style>{`.input{width:100%;padding:0.5rem 0.75rem;border:1px solid #e5e7eb;border-radius:0.5rem;font-size:0.875rem;background:#fff}`}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}
