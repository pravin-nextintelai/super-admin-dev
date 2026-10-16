import { useCallback, useRef, useState } from 'react';

/**
 * Inline toast state (no alert()/confirm()). Render the list with <ToastStack />.
 *   const { toasts, toast, dismiss } = useToasts();
 *   toast('success', 'Exported 80 rows');  toast('error', 'Export failed', err.message);
 */
export default function useToasts({ ttlMs = 4000 } = {}) {
  const [toasts, setToasts] = useState([]);
  const seq = useRef(0);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback((kind, title, text) => {
    const id = ++seq.current;
    setToasts((list) => [...list.slice(-4), { id, kind, title, text }]);
    if (ttlMs > 0) setTimeout(() => dismiss(id), kind === 'error' ? ttlMs * 2 : ttlMs);
    return id;
  }, [dismiss, ttlMs]);

  return { toasts, toast, dismiss };
}
