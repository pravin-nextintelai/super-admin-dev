import React, { useEffect, useState } from 'react';
import { publicPromoApi } from '../services/promoApi';

/**
 * Teal announcement bar above the site header.
 * Fetches GET /api/public/promos/header (active offers/events with remaining window).
 * jurinex.ai can mount the same endpoint.
 */
export default function SitePromoBanner({ className = '' }) {
  const [item, setItem] = useState(null);
  const [index, setIndex] = useState(0);
  const [items, setItems] = useState([]);

  useEffect(() => {
    let alive = true;
    publicPromoApi
      .getHeader()
      .then((data) => {
        if (!alive) return;
        const list = Array.isArray(data?.items) ? data.items : data?.header ? [data.header] : [];
        setItems(list);
        setItem(list[0] || null);
        setIndex(0);
      })
      .catch(() => {
        if (alive) {
          setItems([]);
          setItem(null);
        }
      });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (items.length < 2) return undefined;
    const t = setInterval(() => {
      setIndex((i) => {
        const next = (i + 1) % items.length;
        setItem(items[next]);
        return next;
      });
    }, 8000);
    return () => clearInterval(t);
  }, [items]);

  if (!item) return null;

  const bg = item.background_color || '#0F766E';
  const fg = item.text_color || '#FFFFFF';
  const deadline = item.ends_in ? `Ends in ${item.ends_in}` : item.deadline_label;
  const seats =
    item.kind === 'event' && item.seats?.capacity != null
      ? item.seats.sold_out
        ? 'Sold out'
        : `${item.seats.remaining} seats left`
      : null;
  const slot = item.slots?.[0];
  const slotLabel = slot?.label || slot?.starts_at_ist?.display;

  const inner = (
    <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-3 gap-y-1 px-3 py-2 text-center text-[13px] sm:text-sm">
      {item.badge && (
        <span
          className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(255,255,255,0.18)', color: fg }}
        >
          {item.badge}
        </span>
      )}
      <span className="font-medium" style={{ color: fg }}>
        {item.title}
        {item.subtitle ? <span className="opacity-90"> · {item.subtitle}</span> : null}
      </span>
      {slotLabel && item.kind === 'event' && (
        <span className="opacity-90" style={{ color: fg }}>{slotLabel}</span>
      )}
      {deadline && (
        <span className="opacity-90" style={{ color: fg }}>{deadline}</span>
      )}
      {seats && (
        <span className="opacity-90" style={{ color: fg }}>{seats}</span>
      )}
      {item.cta_label && (
        <span className="inline-flex items-center font-semibold underline underline-offset-2" style={{ color: fg }}>
          {item.cta_label}
        </span>
      )}
    </div>
  );

  return (
    <div className={`w-full ${className}`} style={{ backgroundColor: bg }} role="region" aria-label="Current offer">
      {item.cta_url ? (
        <a href={item.cta_url} className="block hover:brightness-110">
          {inner}
        </a>
      ) : inner}
    </div>
  );
}
