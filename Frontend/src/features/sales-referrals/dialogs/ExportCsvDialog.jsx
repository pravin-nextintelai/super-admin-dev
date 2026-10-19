import React, { useEffect, useRef, useState } from 'react';
import { Download, FileText, Users } from 'lucide-react';
import { REFERRAL_DATA_TEXT } from '../constants/referralData.text';
import { EXPORT_KIND, EXPORT_SCOPE } from '../types/referralData.types';
import { exportReferralDataCsv, getReferralDataSummary } from '../referralDataApi';
import { errorText, fmtNum, toast } from '../utils/salesReferrals.utils';
import { downloadBlob } from '../utils/csv';
import { Button } from '../components/primitives';
import Dialog from '../components/Dialog';
import { createDebugLogger } from '../../../shared/utils/debugLogger';

const T = REFERRAL_DATA_TEXT.export;
const log = createDebugLogger('ExportCsvDialog');
const NO_FILTERS = { includeDirect: true, ownerType: 'ALL', planStatus: 'ALL', dateRange: { from: null, to: null } };

const OptionCard = ({ name, value, checked, onChange, title, help, meta, inputRef }) => (
  <label className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${checked ? 'border-blue-500 bg-blue-50/40 ring-1 ring-blue-500/30' : 'border-slate-200 hover:border-slate-300'}`}>
    <input ref={inputRef} type="radio" name={name} value={value} checked={checked} onChange={() => onChange(value)} className="mt-1 accent-blue-600" />
    <span className="min-w-0">
      <span className="block text-sm font-semibold text-slate-800">{title}</span>
      <span className="block text-xs text-slate-500 mt-0.5">{help}</span>
      {meta && <span className="block text-xs font-medium text-blue-700 mt-1">{meta}</span>}
    </span>
  </label>
);

/**
 * Export dialog: GET /api/admin/onboarded-users/export?mode=users|history (+ the page filters).
 * The server fixes the columns and the file name. `filteredSummary` is the page's current summary
 * (user count for "Current filters"); the "All data" count is fetched when the dialog opens.
 */
const ExportCsvDialog = ({ open, onClose, filters, filteredSummary, activeFilterCount }) => {
  const [kind, setKind] = useState(EXPORT_KIND.USERS);
  const [scope, setScope] = useState(EXPORT_SCOPE.FILTERED);
  const [allSummary, setAllSummary] = useState(null);
  const [busy, setBusy] = useState(false);
  const firstRadio = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setKind(EXPORT_KIND.USERS); setScope(EXPORT_SCOPE.FILTERED); setBusy(false); setAllSummary(null);
    let cancelled = false;
    getReferralDataSummary(NO_FILTERS)
      .then((s) => { if (!cancelled) setAllSummary(s); })
      .catch((err) => { log.error('all-summary:error', err); if (!cancelled) setAllSummary({ users: 0, error: true }); });
    return () => { cancelled = true; };
  }, [open]);

  const summaryFor = scope === EXPORT_SCOPE.ALL ? allSummary : filteredSummary;
  const userCount = summaryFor ? summaryFor.users : null;
  const countText = (k) => {
    if (userCount === null) return T.countLoading;
    return k === EXPORT_KIND.HISTORY ? T.eventsFor(fmtNum(userCount)) : T.rowsCount(fmtNum(userCount));
  };
  const fileName = `onboarded-users${kind === EXPORT_KIND.HISTORY ? '-history' : ''}-YYYY-MM-DD-HHMM-IST.csv`;

  const download = async () => {
    setBusy(true);
    try {
      const res = await exportReferralDataCsv({ kind, scope, filters });
      downloadBlob(res.blob, res.fileName);
      toast('success', T.downloaded(res.fileName));
      onClose();
    } catch (err) {
      log.error('export:error', err);
      toast('error', T.failed, errorText(err));
    } finally { setBusy(false); }
  };

  const canDownload = !busy && userCount !== null && userCount > 0;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={T.title}
      subtitle={T.subtitle}
      size="lg"
      initialFocusRef={firstRadio}
      closeDisabled={busy}
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
            <Users className="w-3.5 h-3.5" aria-hidden="true" />{T.summary(userCount === null ? '…' : fmtNum(userCount))}
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <Button onClick={onClose} disabled={busy}>{T.cancel}</Button>
            <Button variant="primary" icon={Download} onClick={download} disabled={!canDownload} loading={busy}>{busy ? T.downloading : T.download}</Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <fieldset>
          <legend className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">{T.what}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OptionCard inputRef={firstRadio} name="export-kind" value={EXPORT_KIND.USERS} checked={kind === EXPORT_KIND.USERS} onChange={setKind} title={T.kindUsers} help={T.kindUsersHelp} meta={countText(EXPORT_KIND.USERS)} />
            <OptionCard name="export-kind" value={EXPORT_KIND.HISTORY} checked={kind === EXPORT_KIND.HISTORY} onChange={setKind} title={T.kindHistory} help={T.kindHistoryHelp} meta={countText(EXPORT_KIND.HISTORY)} />
          </div>
        </fieldset>

        <fieldset>
          <legend className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">{T.rows}</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <OptionCard name="export-scope" value={EXPORT_SCOPE.FILTERED} checked={scope === EXPORT_SCOPE.FILTERED} onChange={setScope} title={T.scopeFiltered} help={T.scopeFilteredHelp(activeFilterCount)} />
            <OptionCard name="export-scope" value={EXPORT_SCOPE.ALL} checked={scope === EXPORT_SCOPE.ALL} onChange={setScope} title={T.scopeAll} help={T.scopeAllHelp} />
          </div>
        </fieldset>

        <div className="flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-xs text-slate-600">
          <FileText className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          <span className="sr-only">{T.fileName}: </span>
          <span className="truncate">{T.fileNameHint(fileName)}</span>
        </div>
      </div>
    </Dialog>
  );
};

export default ExportCsvDialog;
