import React, { useEffect, useState } from 'react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { activateCode, deactivateCode } from '../services/salesReferrals.api';
import { errorText, toast } from '../utils/salesReferrals.utils';
import Dialog from '../components/Dialog';
import { Button, CodeText } from '../components/primitives';

const D = SALES_REFERRALS_TEXT.deactivate;
const A = SALES_REFERRALS_TEXT.activate;
const C = SALES_REFERRALS_TEXT.common;

/** A5 Deactivate (explains consequences) / Activate (simple confirm). `mode`: 'deactivate' | 'activate'. */
const CodeStatusDialog = ({ open, onClose, code, mode, onChanged }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const deactivating = mode === 'deactivate';
  const T = deactivating ? D : A;

  useEffect(() => { if (open) { setError(null); setSubmitting(false); } }, [open]);

  const confirm = async () => {
    setSubmitting(true); setError(null);
    try {
      const saved = deactivating ? await deactivateCode(code.id) : await activateCode(code.id);
      toast('success', T.done(code.code));
      onChanged?.(saved);
      onClose();
    } catch (err) { setError(errorText(err)); } finally { setSubmitting(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="sm"
      title={T.title}
      closeDisabled={submitting}
      footer={(
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={submitting}>{C.cancel}</Button>
          <Button variant={deactivating ? 'danger' : 'primary'} onClick={confirm} loading={submitting}>{submitting ? T.confirming : T.confirm}</Button>
        </div>
      )}
    >
      <div className="space-y-3 text-sm text-slate-700">
        <div><CodeText code={code?.code || ''} /></div>
        <p>{T.body(code?.code || '')}</p>
        {deactivating && (
          <ul className="list-disc pl-5 space-y-1">
            {D.bullets(code?.signups || 0).map((b) => <li key={b}>{b}</li>)}
          </ul>
        )}
        {error && <p className="text-red-600" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
};

export default CodeStatusDialog;
