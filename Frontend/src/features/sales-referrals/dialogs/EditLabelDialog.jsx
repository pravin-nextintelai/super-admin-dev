import React, { useEffect, useRef, useState } from 'react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { updateCodeLabel } from '../referralApi';
import { errorText, toast } from '../utils/salesReferrals.utils';
import Dialog from '../components/Dialog';
import { Button, CodePill, Field } from '../components/primitives';
import { inputClass } from '../components/formClasses';

const T = SALES_REFERRALS_TEXT.editLabel;
const N = SALES_REFERRALS_TEXT.newOwner;

/** A5 "Edit label": label only — the code itself cannot change. */
const EditLabelDialog = ({ open, onClose, code, onSaved }) => {
  const ref = useRef(null);
  const [label, setLabel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => { if (open && code) { setLabel(code.label || ''); setError(null); setSubmitting(false); } }, [open, code]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true); setError(null);
    try {
      const saved = await updateCodeLabel(code.id, label.trim() || null);
      toast('success', T.saved);
      onSaved?.(saved);
      onClose();
    } catch (err) { setError(errorText(err)); } finally { setSubmitting(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={T.title}
      subtitle={T.subtitle}
      initialFocusRef={ref}
      closeDisabled={submitting}
      footer={(
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={submitting}>{N.cancel}</Button>
          <Button variant="primary" type="submit" form="edit-label-form" loading={submitting}>{submitting ? T.submitting : T.submit}</Button>
        </div>
      )}
    >
      <form id="edit-label-form" onSubmit={submit} noValidate className="space-y-4">
        <div><CodePill code={code?.code || ''} /></div>
        <Field id="edit-label" label={N.label} optional>
          <input ref={ref} id="edit-label" type="text" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder={N.labelPlaceholder} className={inputClass(false)} />
        </Field>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>
    </Dialog>
  );
};

export default EditLabelDialog;
