// Tiny CSV helpers for the "All referral data" page. The server builds the big exports
// (GET /api/admin/onboarded-users/export); `buildCsv` is used only for the per-user
// "Download history" file, which is written from the already loaded timeline.

const FORMULA_PREFIX = /^[=+\-@]/;
const NEEDS_QUOTES = /[",\r\n]/;

/**
 * One CSV cell: `'` is prefixed to anything that could be read as a spreadsheet formula
 * (= + - @), then the cell is quoted when it contains a comma, quote or newline.
 */
export const csvCell = (value) => {
  let s = value === null || value === undefined ? '' : String(value);
  if (FORMULA_PREFIX.test(s)) s = `'${s}`;
  return NEEDS_QUOTES.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * @param {{ key: string, header: string, value: (row: any) => unknown }[]} columns
 * @param {any[]} rows
 * @returns {string} CRLF-separated CSV text (no BOM; `csvBlob` adds it)
 */
export const buildCsv = (columns, rows) => {
  const lines = [columns.map((c) => csvCell(c.header)).join(',')];
  rows.forEach((row) => lines.push(columns.map((c) => csvCell(c.value(row))).join(',')));
  return lines.join('\r\n');
};

/** UTF-8 with BOM so Excel opens ₹ and non-ASCII names correctly. */
export const csvBlob = (text) => new Blob([`\uFEFF${text}`], { type: 'text/csv;charset=utf-8' });

export const slug = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** Triggers a browser download for a Blob. */
export const downloadBlob = (blob, fileName) => {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = fileName;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
