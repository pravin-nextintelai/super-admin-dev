import { useCallback, useEffect, useRef, useState } from 'react';
import { checkReferralCode } from '../services/salesReferrals.api';
import { REFERRAL_CHECK } from '../types/salesReferrals.types';
import { CODE_MIN, normalizeCode } from '../utils/salesReferrals.utils';
import { clearRememberedReferralCode, readRememberedReferralCode, rememberReferralCode } from './referralCodeStorage';

const DEBOUNCE_MS = 400;

/** Reads `?ref=` from the query string (`/register?ref=`), falling back to a hash-router URL. */
export const readReferralFromUrl = () => {
  try {
    const search = new URLSearchParams(window.location.search).get('ref');
    if (search) return normalizeCode(search);
    const hash = window.location.hash || '';
    const q = hash.indexOf('?');
    if (q >= 0) {
      const fromHash = new URLSearchParams(hash.slice(q + 1)).get('ref');
      if (fromHash) return normalizeCode(fromHash);
    }
  } catch { /* ignore */ }
  return '';
};

/**
 * Customer-side referral field state.
 *
 * status: 'idle' | 'checking' | 'valid' | 'invalid' | 'inactive'
 * - a `?ref=CODE` link opens the field pre-filled, remembers the code for 30 days and checks it;
 * - otherwise a remembered (unexpired) code is restored; a link always wins over memory;
 * - typing re-checks 400 ms after the last keystroke (min 6 chars) and on blur;
 * - stale responses are ignored; `remove()` / `clear()` drop the code and the memory;
 * - call `markSignupComplete()` after a successful signup to forget the code.
 *
 * TODO(backend): `payloadValue` is the value to put in RegisterPayload.referralCode once the
 * register endpoint accepts it. Until then do NOT add it to the request body.
 */
export const useReferralCode = ({ readUrl = readReferralFromUrl } = {}) => {
  const [visible, setVisible] = useState(false);
  const [code, setCode] = useState('');
  const [status, setStatus] = useState('idle');
  const [source, setSource] = useState(null); // 'link' | 'remembered' | 'typed'
  const requestId = useRef(0);
  const timer = useRef(null);

  const check = useCallback(async (value) => {
    const clean = normalizeCode(value);
    if (clean.length < CODE_MIN) { setStatus(clean ? 'invalid' : 'idle'); return; }
    const id = (requestId.current += 1);
    setStatus('checking');
    try {
      const result = await checkReferralCode(clean);
      if (id !== requestId.current) return; // stale
      setStatus(result === REFERRAL_CHECK.VALID ? 'valid' : result === REFERRAL_CHECK.INACTIVE ? 'inactive' : 'invalid');
    } catch {
      if (id === requestId.current) setStatus('invalid');
    }
  }, []);

  // Initial value: link beats memory.
  useEffect(() => {
    const fromLink = readUrl();
    const initial = fromLink || readRememberedReferralCode();
    if (!initial) return;
    if (fromLink) rememberReferralCode(fromLink);
    setSource(fromLink ? 'link' : 'remembered');
    setCode(initial);
    setVisible(true);
    check(initial);
  }, [readUrl, check]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onChange = useCallback((value) => {
    const clean = normalizeCode(value);
    clearTimeout(timer.current);
    requestId.current += 1; // invalidate in-flight checks
    setCode(clean);
    setSource('typed');
    setStatus('idle');
    if (clean.length >= CODE_MIN) timer.current = setTimeout(() => check(clean), DEBOUNCE_MS);
  }, [check]);

  const onBlur = useCallback(() => {
    if (!code) return;
    if (status === 'idle') { clearTimeout(timer.current); check(code); }
  }, [code, status, check]);

  const clear = useCallback(() => {
    clearTimeout(timer.current);
    requestId.current += 1;
    setCode(''); setStatus('idle'); setSource(null);
    clearRememberedReferralCode();
  }, []);

  const show = useCallback(() => setVisible(true), []);
  const markSignupComplete = useCallback(() => { clearRememberedReferralCode(); }, []);

  const blocksSubmit = Boolean(code) && status !== 'valid';
  const payloadValue = status === 'valid' ? code : undefined;

  return { visible, show, code, status, source, onChange, onBlur, clear, remove: clear, blocksSubmit, payloadValue, markSignupComplete };
};
