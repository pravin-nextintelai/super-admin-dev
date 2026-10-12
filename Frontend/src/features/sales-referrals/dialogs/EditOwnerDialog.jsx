import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { updateOwner } from '../services/salesReferrals.api';
import { errorText, toast } from '../utils/salesReferrals.utils';
import Dialog from '../components/Dialog';
import { Button, Field, Switch } from '../components/primitives';
import { inputClass } from '../components/formClasses';

const T = SALES_REFERRALS_TEXT.editOwner;
const N = SALES_REFERRALS_TEXT.newOwner;

/** A5 "Edit owner": name, Internal switch, notes. */
const EditOwnerDialog = ({ open, onClose, owner, existingNames = [], onSaved }) => {
  const nameRef = useRef(null);
  const [name, setName] = useState('');
  const [internal, setInternal] = useState(false);
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open || !owner) return;
    setName(owner.name); setInternal(Boolean(owner.internal)); setNotes(owner.notes || '');
    setTouched(false); setError(null); setSubmitting(false);
  }, [open, owner]);

  const nameError = useMemo(() => {
    const clean = name.trim();
    if (!clean) return N.nameRequired;
    const others = existingNames.filter((n) => n.trim().toLowerCase() !== (owner?.name || '').trim().toLowerCase());
    if (others.some((n) => n.trim().toLowerCase() === clean.toLowerCase())) return N.nameTaken;
    return null;
  }, [name, existingNames, owner]);

  const canSubmit = !nameError && !submitting;
  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const saved = await updateOwner(owner.id, { name: name.trim(), internal, notes: notes.trim() || null });
      toast('success', T.saved);
      onSaved?.(saved);
      onClose();
    } catch (err) { setError(errorText(err)); } finally { setSubmitting(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={T.title}
      initialFocusRef={nameRef}
      closeDisabled={submitting}
      footer={(
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={submitting}>{N.cancel}</Button>
          <Button variant="primary" type="submit" form="edit-owner-form" disabled={!canSubmit} loading={submitting}>{submitting ? T.submitting : T.submit}</Button>
        </div>
      )}
    >
      <form id="edit-owner-form" onSubmit={submit} noValidate className="space-y-4">
        <Field id="edit-owner-name" label={N.name} required error={touched ? nameError : null}>
          <input ref={nameRef} id="edit-owner-name" type="text" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)} className={inputClass(touched && nameError)} />
        </Field>
        <Switch id="edit-owner-internal" checked={internal} onChange={setInternal} label={N.internal} description={N.internalHelp} />
        <Field id="edit-owner-notes" label={N.notes} optional>
          <textarea id="edit-owner-notes" rows={3} value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} placeholder={N.notesPlaceholder} className={`${inputClass(false)} resize-y`} />
        </Field>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>
    </Dialog>
  );
};

export default EditOwnerDialog;
