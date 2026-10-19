import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Copy, Mail, Trash2 } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { createOwner, emailOwnerCodes, suggestCode } from '../referralApi';
import { allLinksMessage, copyText, errorText, MAX_CODES_PER_CREATE, normalizeCode, toast } from '../utils/salesReferrals.utils';
import { salesReferralsPath } from '../salesReferrals.routes';
import Dialog from '../components/Dialog';
import CodeField from '../components/CodeField';
import ShareCodesPanel from './ShareCodesPanel';
import { Button, Field, IconButton, Switch } from '../components/primitives';
import { inputClass } from '../components/formClasses';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const T = SALES_REFERRALS_TEXT.newOwner;
const S = SALES_REFERRALS_TEXT.share;

let rowSeq = 0;
const newRow = () => ({ key: `row-${(rowSeq += 1)}`, code: '', label: '', edited: false, touched: false });

/**
 * A2 "New sales owner" + A3 share screen (same dialog).
 * `existingNames` enables the live "already exists" check; the service re-validates on submit.
 */
const NewOwnerDialog = ({ open, onClose, existingNames = [], onCreated }) => {
  const navigate = useNavigate();
  const nameRef = useRef(null);
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [internal, setInternal] = useState(false);
  const [notes, setNotes] = useState('');
  const [email, setEmail] = useState('');
  const [emailing, setEmailing] = useState(false);
  const [rows, setRows] = useState(() => [newRow()]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const [rowStates, setRowStates] = useState({});
  const [suggestingKey, setSuggestingKey] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [created, setCreated] = useState(null); // A1 response (owner with codes) → share step

  // Reset whenever the dialog opens.
  useEffect(() => {
    if (!open) return;
    setName(''); setNameTouched(false); setInternal(false); setNotes(''); setEmail(''); setEmailing(false);
    setRows([newRow()]); setRowStates({}); setSubmitting(false); setSubmitError(null); setCreated(null);
  }, [open]);

  const nameError = useMemo(() => {
    const clean = name.trim();
    if (!clean) return T.nameRequired;
    if (existingNames.some((n) => n.trim().toLowerCase() === clean.toLowerCase())) return T.nameTaken;
    return null;
  }, [name, existingNames]);

  // When the name changes, rows the admin has not edited get new suggestions; edited rows keep their value.
  useEffect(() => {
    if (!open || created) return undefined;
    const clean = name.trim();
    let cancelled = false;
    const timer = setTimeout(async () => {
      const current = rowsRef.current;
      const taken = current.filter((r) => r.edited).map((r) => r.code);
      const fresh = new Map(); // key → new code, only for un-edited rows
      for (const r of current) {
        if (r.edited) continue;
        if (!clean) { fresh.set(r.key, ''); continue; }
        try {
          const code = await suggestCode({ ownerName: clean }, [...taken, ...fresh.values()]);
          if (cancelled) return;
          fresh.set(r.key, code);
        } catch { /* keep the old value */ }
      }
      if (!cancelled) setRows((latest) => latest.map((r) => (!r.edited && fresh.has(r.key) ? { ...r, code: fresh.get(r.key) } : r)));
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [name, open, created]);

  const updateRow = (key, patch) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  const removeRow = (key) => {
    setRows((rs) => rs.filter((r) => r.key !== key));
    setRowStates((s) => { const n = { ...s }; delete n[key]; return n; });
  };
  // New rows start with a suggestion when a name is already typed.
  const addRow = async () => {
    if (rows.length >= MAX_CODES_PER_CREATE) return;
    const row = newRow();
    const clean = name.trim();
    if (clean) {
      try { row.code = await suggestCode({ ownerName: clean }, rows.map((r) => r.code)); } catch { /* leave empty */ }
    }
    setRows((rs) => (rs.length < MAX_CODES_PER_CREATE ? [...rs, row] : rs));
  };

  const suggestFor = async (row) => {
    setSuggestingKey(row.key);
    try {
      const code = await suggestCode({ ownerName: name.trim() || 'Referral' }, rows.filter((r) => r.key !== row.key).map((r) => r.code));
      updateRow(row.key, { code, edited: true, touched: true });
    } catch (err) {
      toast('error', errorText(err));
    } finally { setSuggestingKey(null); }
  };

  const duplicateError = (row, index) => {
    const code = normalizeCode(row.code);
    if (!code) return null;
    const first = rows.findIndex((r) => normalizeCode(r.code) === code);
    return first >= 0 && first < index ? T.sameAs(first + 1) : null;
  };

  const stateSetters = useRef({});
  const stateSetterFor = (key) => {
    if (!stateSetters.current[key]) stateSetters.current[key] = (state) => setRowStates((s) => (s[key] === state ? s : { ...s, [key]: state }));
    return stateSetters.current[key];
  };

  const allRowsAvailable = rows.every((r) => rowStates[r.key] === 'available');
  const emailValid = !email.trim() || EMAIL_RE.test(email.trim());
  const canSubmit = !nameError && emailValid && allRowsAvailable && !submitting;

  const submit = async (e) => {
    e?.preventDefault?.();
    setNameTouched(true);
    setRows((rs) => rs.map((r) => ({ ...r, touched: true })));
    if (!canSubmit) return;
    setSubmitting(true); setSubmitError(null);
    try {
      const owner = await createOwner({
        name: name.trim(), internal, notes: notes.trim(), email: email.trim() || null,
        codes: rows.map((r) => ({ code: normalizeCode(r.code), label: r.label.trim() || null })),
      });
      setCreated(owner);
      onCreated?.(owner);
    } catch (err) {
      // Field-level errors from the backend (doc §2.5) point at `codes[i].code`.
      const field = err?.details?.field;
      const m = typeof field === 'string' ? /codes\[(\d+)\]/.exec(field) : null;
      if (m && rows[Number(m[1])]) setRows((rs) => rs.map((r, i) => (i === Number(m[1]) ? { ...r, touched: true } : r)));
      setSubmitError(errorText(err));
      toast('error', errorText(err));
    } finally { setSubmitting(false); }
  };

  const handleClose = useCallback(() => { if (!submitting) onClose(); }, [onClose, submitting]);

  // ── Share step ───────────────────────────────────────────────────────────────
  if (created) {
    const owner = created;
    const codes = created.codes || [];
    return (
      <Dialog
        open={open}
        onClose={handleClose}
        size="lg"
        title={S.title(owner.name)}
        subtitle={S.subtitle(codes.length)}
        footer={(
          <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
            <div className="flex gap-2 flex-wrap">
              <Button icon={Copy} onClick={() => copyText(allLinksMessage(owner.name, codes), S.copiedAll)}>{S.copyAll}</Button>
              <Button
                icon={Mail}
                loading={emailing}
                disabled={emailing}
                title={owner.email ? `${S.emailAll}: ${owner.email}` : S.emailAllNoAddress}
                onClick={async () => {
                  if (!owner.email) { toast('error', S.emailAllNoAddress); return; }
                  setEmailing(true);
                  try {
                    await emailOwnerCodes(owner.id, { to: owner.email, codeIds: codes.map((c) => c.id) }); // ONE email listing every code + link
                    toast('success', S.emailAllDone(codes.length, owner.email));
                  } catch (err) { toast('error', errorText(err)); } finally { setEmailing(false); }
                }}
              >
                {emailing ? S.emailAllSending : S.emailAll}
              </Button>
            </div>
            <Button variant="primary" icon={ArrowRight} onClick={() => { onClose(); navigate(salesReferralsPath.owner(owner.id)); }}>{S.goTo(owner.name)}</Button>
          </div>
        )}
      >
        <ShareCodesPanel codes={codes} />
      </Dialog>
    );
  }

  // ── Create step ──────────────────────────────────────────────────────────────
  const atMax = rows.length >= MAX_CODES_PER_CREATE;
  return (
    <Dialog
      open={open}
      onClose={handleClose}
      size="lg"
      title={T.title}
      subtitle={T.subtitle}
      initialFocusRef={nameRef}
      closeDisabled={submitting}
      footer={(
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p className="text-xs text-slate-500">{T.footerHint}</p>
          <div className="flex gap-2 justify-end">
            <Button onClick={handleClose} disabled={submitting}>{T.cancel}</Button>
            <Button variant="primary" type="submit" form="new-owner-form" disabled={!canSubmit} loading={submitting}>
              {submitting ? T.creating : rows.length > 1 ? T.createWith(rows.length) : T.create}
            </Button>
          </div>
        </div>
      )}
    >
      <form id="new-owner-form" onSubmit={submit} noValidate className="space-y-5">
        <Field id="owner-name" label={T.name} required error={nameTouched ? nameError : null}>
          <input
            ref={nameRef}
            id="owner-name"
            type="text"
            value={name}
            maxLength={80}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => setNameTouched(true)}
            placeholder={T.namePlaceholder}
            aria-invalid={nameTouched && Boolean(nameError)}
            className={inputClass(nameTouched && nameError)}
          />
        </Field>

        <Switch id="owner-internal" checked={internal} onChange={setInternal} label={T.internal} description={T.internalHelp} />

        <Field id="owner-email" label={T.email} optional hint={T.emailHelp} error={email.trim() && !EMAIL_RE.test(email.trim()) ? T.emailInvalid : null}>
          <input id="owner-email" type="email" value={email} maxLength={255} onChange={(e) => setEmail(e.target.value)} placeholder={T.emailPlaceholder} className={inputClass(Boolean(email.trim() && !EMAIL_RE.test(email.trim())))} />
        </Field>

        <section aria-labelledby="codes-heading">
          <div className="flex items-center gap-2 mb-2">
            <h3 id="codes-heading" className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{T.codesSection}</h3>
            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-[11px] font-semibold text-slate-600">{rows.length}</span>
          </div>
          <ol className="space-y-3">
            {rows.map((row, index) => (
              <li key={row.key} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-col sm:flex-row gap-3 sm:items-start">
                  <span className="w-6 h-6 rounded-full bg-slate-100 text-[11px] font-bold text-slate-600 flex items-center justify-center shrink-0 sm:mt-7" aria-hidden="true">{index + 1}</span>
                  <Field id={`code-${row.key}`} label={T.code} required className="flex-1 min-w-0">
                    <CodeField
                      id={`code-${row.key}`}
                      value={row.code}
                      touched={row.touched}
                      localError={duplicateError(row, index)}
                      onChange={(code) => updateRow(row.key, { code, edited: true, touched: true })}
                      onSuggest={() => suggestFor(row)}
                      suggesting={suggestingKey === row.key}
                      onStateChange={stateSetterFor(row.key)}
                    />
                  </Field>
                  <Field id={`label-${row.key}`} label={T.label} optional className="flex-1 min-w-0">
                    <input
                      id={`label-${row.key}`}
                      type="text"
                      value={row.label}
                      maxLength={60}
                      onChange={(e) => updateRow(row.key, { label: e.target.value })}
                      placeholder={T.labelPlaceholder}
                      className={inputClass(false)}
                    />
                  </Field>
                  <div className="sm:mt-6 self-end sm:self-auto">
                    <IconButton label={T.removeCode(index + 1)} icon={Trash2} onClick={() => removeRow(row.key)} disabled={rows.length === 1} className="hover:text-red-600" />
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-2">
            <Button variant="link" onClick={addRow} disabled={atMax} className="text-sm">{T.addCode}</Button>
            {atMax && <p className="text-xs text-slate-400 mt-1">{T.maxCodes(MAX_CODES_PER_CREATE)}</p>}
          </div>
        </section>

        <Field id="owner-notes" label={T.notes} optional>
          <textarea
            id="owner-notes"
            rows={3}
            value={notes}
            maxLength={500}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={T.notesPlaceholder}
            className={`${inputClass(false)} resize-y`}
          />
        </Field>

        {submitError && <p className="text-sm text-red-600" role="alert">{submitError}</p>}
      </form>
    </Dialog>
  );
};

export default NewOwnerDialog;
