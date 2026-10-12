import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { listCodes, setTenantReferral } from '../services/salesReferrals.api';
import { errorText, REASON_MAX, REASON_MIN, toast } from '../utils/salesReferrals.utils';
import Dialog from '../components/Dialog';
import { Button, Callout, CodeStatusBadge, Field, Spinner, TypeBadge } from '../components/primitives';
import { inputClass } from '../components/formClasses';

const T = SALES_REFERRALS_TEXT.workspaceReferral.dialog;
const C = SALES_REFERRALS_TEXT.common;

/**
 * "Set referral code" (A16): searchable picker (A11) grouped by owner, inactive codes selectable,
 * required reason (5–500 chars). `workspace` is the A17 response `{ tenantId, firmName, referral }`.
 */
const SetWorkspaceReferralDialog = ({ open, onClose, workspace, memberCount, onSaved }) => {
  const searchRef = useRef(null);
  const [search, setSearch] = useState('');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null); // { id, code, ownerName }
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setSearch(''); setSelected(null); setReason(''); setTouched(false); setError(null); setSubmitting(false);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await listCodes(search.trim());
        if (!cancelled) setGroups(res);
      } catch (err) {
        if (!cancelled) setError(errorText(err));
      } finally { if (!cancelled) setLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [open, search]);

  const reasonError = reason.trim().length >= REASON_MIN && reason.trim().length <= REASON_MAX ? null : T.reasonRequired;
  const codeError = selected ? null : T.codeRequired;
  const canSubmit = !reasonError && !codeError && !submitting;

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const saved = await setTenantReferral(workspace.tenantId, { codeId: selected.id, reason: reason.trim() });
      toast('success', T.saved);
      onSaved?.(saved);
      onClose();
    } catch (err) { setError(errorText(err)); } finally { setSubmitting(false); }
  };

  const current = workspace?.referral?.code?.code || SALES_REFERRALS_TEXT.workspaceReferral.direct;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      title={T.title}
      subtitle={workspace ? T.subtitle(workspace.firmName, memberCount ?? null, current) : ''}
      initialFocusRef={searchRef}
      closeDisabled={submitting}
      footer={(
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={submitting}>{C.cancel}</Button>
          <Button variant="primary" type="submit" form="set-referral-form" disabled={touched && !canSubmit} loading={submitting}>{submitting ? T.submitting : T.submit}</Button>
        </div>
      )}
    >
      <form id="set-referral-form" onSubmit={submit} noValidate className="space-y-4">
        <Field id="referral-search" label={T.code} required error={touched ? codeError : null}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input ref={searchRef} id="referral-search" type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={T.searchPlaceholder} className={`${inputClass(false)} pl-9`} autoComplete="off" />
          </div>
          <div role="radiogroup" aria-label={T.code} className="mt-2 max-h-64 overflow-y-auto custom-scrollbar rounded-lg border border-slate-200 divide-y divide-slate-100">
            {loading && groups.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-400"><Spinner />{C.loading}</div>
            ) : groups.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-400">{T.noMatch}</p>
            ) : groups.map((g) => (
              <div key={g.owner.id} className={loading ? 'opacity-60' : ''}>
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-xs font-semibold text-slate-600">
                  {g.owner.name}<TypeBadge internal={g.owner.internal} />
                </div>
                {g.codes.map((c) => {
                  const checked = selected?.id === c.id;
                  return (
                    <label key={c.id} className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-blue-50/50 ${checked ? 'bg-blue-50' : ''}`}>
                      <input type="radio" name="referral-code" value={c.id} checked={checked} onChange={() => setSelected({ id: c.id, code: c.code, ownerName: g.owner.name })} className="accent-blue-600" />
                      <span className={`font-mono text-sm font-semibold ${c.active ? 'text-slate-800' : 'text-slate-400'}`}>{c.code}</span>
                      {c.label && <span className="text-xs text-slate-500 truncate">{c.label}</span>}
                      {!c.active && <span className="ml-auto"><CodeStatusBadge active={false} /></span>}
                    </label>
                  );
                })}
              </div>
            ))}
          </div>
        </Field>

        <Field id="referral-reason" label={T.reason} required error={touched ? reasonError : null}>
          <textarea id="referral-reason" rows={3} value={reason} maxLength={REASON_MAX} onChange={(e) => setReason(e.target.value)} placeholder={T.reasonPlaceholder} className={`${inputClass(touched && reasonError)} resize-y`} />
        </Field>

        <Callout tone="info">{T.info}</Callout>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>
    </Dialog>
  );
};

export default SetWorkspaceReferralDialog;
