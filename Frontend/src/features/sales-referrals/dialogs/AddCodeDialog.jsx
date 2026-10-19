import React, { useEffect, useRef, useState } from 'react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { addCode, suggestCode } from '../referralApi';
import { errorText, normalizeCode, toast } from '../utils/salesReferrals.utils';
import Dialog from '../components/Dialog';
import CodeField from '../components/CodeField';
import { Button, Field } from '../components/primitives';
import { inputClass } from '../components/formClasses';

const T = SALES_REFERRALS_TEXT.addCode;
const N = SALES_REFERRALS_TEXT.newOwner;

/** "Add code" (A4): pre-filled suggestion (A9 by ownerId) with live availability (A10) + optional label. */
const AddCodeDialog = ({ open, onClose, owner, existingCodes = [], onAdded }) => {
  const codeRef = useRef(null);
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const [state, setState] = useState('idle');
  const [suggesting, setSuggesting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const suggest = async () => {
    setSuggesting(true);
    try { setCode(await suggestCode({ ownerId: owner.id }, existingCodes)); } catch (err) { toast('error', errorText(err)); } finally { setSuggesting(false); }
  };

  useEffect(() => {
    if (!open) return;
    setCode(''); setLabel(''); setError(null); setSubmitting(false);
    suggest();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit = state === 'available' && !submitting;
  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      const created = await addCode(owner.id, { code: normalizeCode(code), label: label.trim() || null });
      toast('success', T.added(created.code));
      onAdded?.(created);
      onClose();
    } catch (err) {
      setError(errorText(err));
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={T.title}
      subtitle={T.subtitle(owner?.name || '')}
      initialFocusRef={codeRef}
      closeDisabled={submitting}
      footer={(
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={submitting}>{N.cancel}</Button>
          <Button variant="primary" type="submit" form="add-code-form" disabled={!canSubmit} loading={submitting}>{submitting ? T.submitting : T.submit}</Button>
        </div>
      )}
    >
      <form id="add-code-form" onSubmit={submit} noValidate className="space-y-4">
        <Field id="add-code" label={N.code} required>
          <CodeField id="add-code" inputRef={codeRef} value={code} onChange={setCode} onSuggest={suggest} suggesting={suggesting} onStateChange={setState} />
        </Field>
        <Field id="add-label" label={N.label} optional>
          <input id="add-label" type="text" value={label} maxLength={60} onChange={(e) => setLabel(e.target.value)} placeholder={N.labelPlaceholder} className={inputClass(false)} />
        </Field>
        <p className="text-xs text-slate-500">{N.footerHint}</p>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>
    </Dialog>
  );
};

export default AddCodeDialog;
