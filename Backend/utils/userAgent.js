/**
 * Lightweight User-Agent parser (no extra dependency).
 * Returns { browser, os, device_type } for newsletter / marketing rows.
 */

function pick(ua, patterns) {
  for (const [label, re] of patterns) {
    if (re.test(ua)) return label;
  }
  return null;
}

function parseUserAgent(raw) {
  const ua = String(raw || '').trim();
  if (!ua) {
    return { browser: null, os: null, device_type: null };
  }

  const device_type = /\b(iPad|Tablet|PlayBook|Silk)\b/i.test(ua)
    ? 'tablet'
    : /\b(Mobi|Android.*Mobile|iPhone|iPod|IEMobile|Opera Mini|webOS|BlackBerry)\b/i.test(ua)
      ? 'mobile'
      : 'desktop';

  const os =
    pick(ua, [
      ['iOS', /\b(iPhone|iPad|iPod)\b/i],
      ['Android', /\bAndroid\b/i],
      ['Windows', /\bWindows NT\b/i],
      ['macOS', /\bMac OS X\b/i],
      ['Chrome OS', /\bCrOS\b/i],
      ['Linux', /\bLinux\b/i],
    ]) || null;

  let browser = null;
  const edg = ua.match(/\bEdg(?:e|A|iOS)?\/(\d+)/i);
  const opr = ua.match(/\b(?:OPR|Opera)\/(\d+)/i);
  const fx = ua.match(/\bFirefox\/(\d+)/i);
  const crios = ua.match(/\bCriOS\/(\d+)/i);
  const chrome = ua.match(/\bChrome\/(\d+)/i);
  const safari = ua.match(/\bVersion\/(\d+).+Safari\b/i);
  const samsung = ua.match(/\bSamsungBrowser\/(\d+)/i);

  if (edg) browser = `Edge ${edg[1]}`;
  else if (opr) browser = `Opera ${opr[1]}`;
  else if (samsung) browser = `Samsung Internet ${samsung[1]}`;
  else if (fx) browser = `Firefox ${fx[1]}`;
  else if (crios) browser = `Chrome ${crios[1]}`;
  else if (chrome && !/\bChromium\b/i.test(ua)) browser = `Chrome ${chrome[1]}`;
  else if (safari) browser = `Safari ${safari[1]}`;
  else if (/\bSafari\b/i.test(ua) && !chrome) browser = 'Safari';
  else browser = ua.slice(0, 64);

  return {
    browser: browser ? String(browser).slice(0, 128) : null,
    os: os ? String(os).slice(0, 128) : null,
    device_type,
  };
}

module.exports = { parseUserAgent };
