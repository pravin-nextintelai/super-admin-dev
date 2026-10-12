import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal } from 'lucide-react';

const MENU_WIDTH = 192; // w-48
const GAP = 4;

/**
 * "…" row menu. Keyboard: Enter/Space/ArrowDown opens, Arrow keys move, Escape closes.
 * The list is rendered through a portal with fixed positioning, so it is never clipped by a
 * scrolling table container, and it flips upward when there is no room below the button.
 * items: [{ id, label, icon?, onSelect, danger?, disabled? }]
 */
const RowMenu = ({ label, items }) => {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState({ top: 0, left: 0, ready: false });
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const itemRefs = useRef([]);
  const enabled = items.filter((i) => !i.disabled);

  // Measure the rendered menu, then place it below the button or above it when there is no room.
  useLayoutEffect(() => {
    if (!open) return;
    const r = buttonRef.current?.getBoundingClientRect();
    const h = menuRef.current?.offsetHeight || 0;
    if (!r) return;
    const up = window.innerHeight - r.bottom < h + GAP && r.top > h + GAP;
    const left = Math.max(8, Math.min(r.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8));
    setPos({ top: up ? r.top - GAP - h : r.bottom + GAP, left, ready: true });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (menuRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener('mousedown', onDoc);
    window.addEventListener('resize', onScrollOrResize);
    document.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      window.removeEventListener('resize', onScrollOrResize);
      document.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open]);

  // Focus only once the menu is positioned and visible (a hidden element cannot take focus).
  useEffect(() => { if (open && pos.ready) itemRefs.current[active]?.focus(); }, [open, pos.ready, active]);

  const openMenu = (index = 0) => { setActive(index); setPos((p) => ({ ...p, ready: false })); setOpen(true); };
  const close = (restoreFocus = true) => { setOpen(false); if (restoreFocus) buttonRef.current?.focus(); };

  const onButtonKey = (e) => {
    if (e.key === 'Escape' && open) { e.preventDefault(); close(); return; }
    if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openMenu(0); }
    if (e.key === 'ArrowUp') { e.preventDefault(); openMenu(enabled.length - 1); }
  };
  const onMenuKey = (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => (a + 1) % enabled.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => (a - 1 + enabled.length) % enabled.length); }
    else if (e.key === 'Home') { e.preventDefault(); setActive(0); }
    else if (e.key === 'End') { e.preventDefault(); setActive(enabled.length - 1); }
    else if (e.key === 'Tab') { close(false); }
  };

  return (
    <div className="relative inline-block text-left" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        title={label}
        onClick={() => (open ? close() : openMenu(0))}
        onKeyDown={onButtonKey}
        className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={onMenuKey}
          onClick={(e) => e.stopPropagation()}
          style={{ position: 'fixed', left: pos.left, top: pos.top, width: MENU_WIDTH, visibility: pos.ready ? 'visible' : 'hidden' }}
          className="z-[60] rounded-lg border border-slate-200 bg-white shadow-lg py-1"
        >
          {enabled.map((item, i) => (
            <button
              key={item.id}
              ref={(el) => { itemRefs.current[i] = el; }}
              role="menuitem"
              type="button"
              tabIndex={i === active ? 0 : -1}
              onMouseEnter={() => setActive(i)}
              onClick={() => { close(); item.onSelect(); }}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left focus:outline-none ${
                item.danger ? 'text-red-600 hover:bg-red-50 focus:bg-red-50' : 'text-slate-700 hover:bg-slate-50 focus:bg-slate-50'
              }`}
            >
              {item.icon && <item.icon className="w-4 h-4 opacity-70" />}
              {item.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
};

export default RowMenu;
