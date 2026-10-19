import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Mail } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { emailCode, emailOwnerCodes } from '../referralApi';
import { errorText, fmtDate, referralLink, toast } from '../utils/salesReferrals.utils';
import Dialog from '../components/Dialog';
import { Button, CodeStatusBadge, CodeText, Field } from '../components/primitives';
import { inputClass } from '../components/formClasses';

const T = SALES_REFERRALS_TEXT.sendEmail;
const C = SALES_REFERRALS_TEXT.common;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Send to email" (backend A18 / A19, templates/referral-code-email.html).
 *   `code`  → one code (created / refreshed / disabled notice)
 *   `codes` → several codes in ONE email (owner-level send)
 * `owner` supplies the default recipient; `offer` = opened automatically after a create / refresh / disable action.
 */
const SendCodeEmailDialog = ({ open, onClose, owner, code, codes, offer = false, onSent }) => {
  const toRef = useRef(null);
  const [to, setTo] = useState('');
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const list = useMemo(() => (Array.isArray(codes) ? codes : code ? [code] : []), [code, codes]);
  const many = Array.isArray(codes);

  useEffect(() => {
    if (!open) return;
    setTo(owner?.email || '');
    setTouched(false); setError(null); setSubmitting(false);
  }, [open, owner, code, codes]);

  const toError = useMemo(() => (EMAIL_RE.test(to.trim()) ? null : T.toInvalid), [to]);
  const canSubmit = !toError && !submitting && list.length > 0;

  const submit = async (e) => {
    e?.preventDefault?.();
    setTouched(true);
    if (!canSubmit) return;
    setSubmitting(true); setError(null);
    try {
      if (many) {
        const res = await emailOwnerCodes(owner.id, { to: to.trim(), codeIds: list.map((c) => c.id) });
        toast('success', T.sentMany(res?.count ?? list.length, res?.to || to.trim()));
        onSent?.(res);
      } else {
        const res = await emailCode(code.id, { to: to.trim() });
        toast('success', T.sent(code.code, res?.to || to.trim()));
        onSent?.(res);
      }
      onClose();
    } catch (err) { setError(errorText(err)); } finally { setSubmitting(false); }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="md"
      title={offer ? T.offerTitle : T.title}
      subtitle={many ? T.subtitleMany(list.length) : code ? T.subtitle(code.code) : undefined}
      initialFocusRef={toRef}
      closeDisabled={submitting}
      footer={(
        <div className="flex justify-end gap-2">
          <Button onClick={onClose} disabled={submitting}>{C.cancel}</Button>
          <Button variant="primary" type="submit" form="send-code-email-form" icon={Mail} disabled={!canSubmit} loading={submitting}>{submitting ? T.submitting : T.submit}</Button>
        </div>
      )}
    >
      <form id="send-code-email-form" onSubmit={submit} noValidate className="space-y-4">
        {!owner?.email && <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{T.noOwnerEmail}</p>}
        <Field id="send-code-email-to" label={T.to} required hint={owner?.email ? T.toHelp : undefined} error={touched ? toError : null}>
          <input
            ref={toRef}
            id="send-code-email-to"
            type="email"
            value={to}
            maxLength={255}
            onChange={(e) => setTo(e.target.value)}
            onBlur={() => setTouched(true)}
            placeholder={T.toPlaceholder}
            aria-invalid={touched && Boolean(toError)}
            className={inputClass(touched && toError)}
          />
        </Field>

        <section className="rounded-xl border border-slate-200 p-3 space-y-3 text-sm">
          <h3 className="text-xs font-semibold text-slate-600 uppercase tracking-wide">{T.preview}{many ? ` · ${list.length}` : ''}</h3>
          {list.length === 0 && <p className="text-sm text-slate-400">{T.noActiveCodes}</p>}
          {list.map((c) => (
            <div key={c.id || c.code} className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <CodeText code={c.code} struck={!c.active} />
                {c.label && <span className="text-slate-600">{c.label}</span>}
                <CodeStatusBadge active={Boolean(c.active)} />
              </div>
              {!many && <p className="text-xs text-slate-500">{c.active ? T.statusActive : T.statusDisabled}{!c.active && c.replacedByCode ? ` · ${T.replacedBy(c.replacedByCode)}` : ''}</p>}
              <p className="font-mono text-xs text-slate-600 break-all">{referralLink(c.code)}</p>
              {c.lastEmailedAt && <p className="text-xs text-slate-400">{T.lastSent(fmtDate(c.lastEmailedAt), c.lastEmailedTo)}</p>}
            </div>
          ))}
        </section>
        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
      </form>
    </Dialog>
  );
};

export default SendCodeEmailDialog;
