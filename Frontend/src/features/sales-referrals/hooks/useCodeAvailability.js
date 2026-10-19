import { useEffect, useRef, useState } from 'react';
import { checkCodeAvailable } from '../referralApi';
import { CODE_AVAILABILITY } from '../types/salesReferrals.types';
import { CODE_FORMAT_ERRORS } from '../constants/salesReferrals.text';
import { codeFormatError, errorText, normalizeCode } from '../utils/salesReferrals.utils';

/**
 * Live availability check for one code input (A10, debounced ~300 ms).
 * Format errors are reported synchronously; the remote check is debounced and stale responses
 * are ignored. `localError` (e.g. "Same as code 2") wins over the remote check.
 *
 * @returns {{ state: 'idle'|'error'|'checking'|'available', message: string|null }}
 */
export const useCodeAvailability = (code, { localError = null, enabled = true, delay = 300 } = {}) => {
  const [remote, setRemote] = useState({ code: '', available: false, error: null });
  const requestId = useRef(0);
  const normalized = normalizeCode(code);
  const formatError = codeFormatError(normalized);

  useEffect(() => {
    if (!enabled || formatError || localError) return undefined;
    const id = (requestId.current += 1);
    const timer = setTimeout(async () => {
      try {
        const res = await checkCodeAvailable(normalized);
        if (id !== requestId.current) return;
        const status = res?.status;
        setRemote({
          code: normalized,
          available: status === CODE_AVAILABILITY.AVAILABLE,
          error: status === CODE_AVAILABILITY.TAKEN ? CODE_FORMAT_ERRORS.taken
            : status === CODE_AVAILABILITY.INVALID_FORMAT ? CODE_FORMAT_ERRORS.format
              : status === CODE_AVAILABILITY.AVAILABLE ? null : 'Unexpected availability response.',
        });
      } catch (err) {
        if (id === requestId.current) setRemote({ code: normalized, available: false, error: errorText(err) });
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [normalized, formatError, localError, enabled, delay]);

  if (!enabled || !normalized) return { state: 'idle', message: null };
  if (formatError) return { state: 'error', message: formatError };
  if (localError) return { state: 'error', message: localError };
  if (remote.code !== normalized) return { state: 'checking', message: null };
  return remote.available ? { state: 'available', message: null } : { state: 'error', message: remote.error };
};
