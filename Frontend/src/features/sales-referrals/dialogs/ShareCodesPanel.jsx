import React from 'react';
import { Copy, Globe, MonitorSmartphone } from 'lucide-react';
import { SALES_REFERRALS_TEXT } from '../constants/salesReferrals.text';
import { copyText, referralLinks } from '../utils/salesReferrals.utils';
import { Button, CodePill } from '../components/primitives';

const T = SALES_REFERRALS_TEXT.share;
const C = SALES_REFERRALS_TEXT.common;

const LinkLine = ({ label, icon, link, buttonLabel, code }) => {
  const Icon = icon;
  return (
  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
    <div className="min-w-0 flex-1 flex items-start gap-1.5 text-xs text-slate-500">
      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />
      <span className="shrink-0 font-semibold text-slate-600 w-9">{label}</span>
      <span className="font-mono break-all">{link}</span>
    </div>
    <Button size="sm" onClick={() => copyText(link, T.copiedLink)} aria-label={`${C.copyLink} (${label}) ${code}`} className="self-start sm:self-auto shrink-0">{buttonLabel}</Button>
  </div>
  );
};

/**
 * One block per code: code pill + label and the signup link with a copy button. While the admin
 * panel runs on localhost a second, local-app link is shown as well; in production only the live one.
 */
const ShareCodesPanel = ({ codes }) => (
  <ul className="space-y-2">
    {codes.map((c) => {
      const links = referralLinks(c.code);
      return (
        <li key={c.id || c.code} className="rounded-xl border border-slate-200 p-3 space-y-2">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <CodePill code={c.code} />
              {c.label && <span className="text-sm text-slate-600">{c.label}</span>}
            </div>
            <Button size="sm" icon={Copy} onClick={() => copyText(c.code, T.copiedCode)} aria-label={`${C.copyCode} ${c.code}`}>{T.copyCode}</Button>
          </div>
          {links.local ? (
            <>
              <LinkLine label={T.live} icon={Globe} link={links.live} buttonLabel={T.copyLiveLink} code={c.code} />
              <LinkLine label={T.local} icon={MonitorSmartphone} link={links.local} buttonLabel={T.copyLocalLink} code={c.code} />
            </>
          ) : (
            <LinkLine label={T.copyLink} icon={Globe} link={links.live} buttonLabel={T.copyLink} code={c.code} />
          )}
        </li>
      );
    })}
  </ul>
);

export default ShareCodesPanel;
