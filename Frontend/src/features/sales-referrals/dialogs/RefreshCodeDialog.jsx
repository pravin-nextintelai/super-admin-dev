import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { refreshCode } from '../services/salesReferrals.api';
import { errorText, toast } from '../utils/salesReferrals.utils';
import Dialog from '../components/Dialog';
import ShareCodesPanel from './ShareCodesPanel';
import { Button, Callout, CodeText } from '../components/primitives';

const T = SALES_REFERRALS_TEXT.refresh;
const C = SALES_REFERRALS_TEXT.common;

/** A5 "Refresh code": warning + bullets → on confirm the old code goes inactive and the new one is shown with copy buttons. */
const RefreshCodeDialog = ({ open, onClose, code, onRefreshed }) => {
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => { if (open) { setResult(null); setError(null); setSubmitting(false); } }, [open]);

  const confirm = async () => {
    setSubmitting(true); setError(null);
    try {
      const res = await refreshCode(code.id);
      setResult(res);
      toast('success', T.refreshed(res.newCode.code));
      onRefreshed?.(res);
    } catch (err) { setError(errorText(err)); } finally { setSubmitting(false); }
  };

  if (result) {
    return (
      <Dialog open={open} onClose={onClose} size="lg" title={T.doneTitle} subtitle={T.doneBody(result.oldCode.code)} footer={<div className="flex justify-end"><Button variant="primary" onClick={onClose}>{T.done}</Button></div>}>
        <ShareCodesPanel codes={[result.newCode]} />
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={T.title}
      closeDisabled={submitting}
      footer={(
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={submitting}>{C.cancel}</Button>
          <Button variant="primary" icon={RefreshCw} onClick={confirm} loading={submitting}>{submitting ? T.confirming : T.confirm}</Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-2"><CodeText code={code?.code || ''} />{code?.label && <span className="text-sm text-slate-500">· {code.label}</span>}</div>
        <Callout tone="warning"><strong>{T.warning}</strong></Callout>
        <ul className="list-disc pl-5 space-y-1 text-sm text-slate-700">
          {T.bullets(code?.code || '', code?.signups || 0).map((b) => <li key={b}>{b}</li>)}
        </ul>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
};

export default RefreshCodeDialog;
