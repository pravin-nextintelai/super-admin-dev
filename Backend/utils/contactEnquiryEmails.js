/**
 * Email content for contact-form enquiries.
 *   - internal notification to the marketing inbox (CONTACT_NOTIFY_EMAIL)
 *   - acknowledgement to the visitor (CONTACT_ACK_EMAIL_ENABLED=true)
 *
 * All values are HTML-escaped: they come straight from a public form.
 * Times are rendered in IST.
 */
const { formatIST } = require('./time');

const BRAND = '#0f766e';
const BRAND_DARK = '#115e59';

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(value) {
  return escapeHtml(value).replace(/\r?\n/g, '<br/>');
}

function row(label, value, { html = false } = {}) {
  const v = value === null || value === undefined || value === '' ? '—' : html ? value : escapeHtml(value);
  return `
    <tr>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.4px;width:180px;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:10px 14px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;vertical-align:top;">${v}</td>
    </tr>`;
}

function shell({ title, preheader, bodyHtml }) {
  const year = new Date().getFullYear();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1.0"/>
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Roboto,Arial,sans-serif;">
  <span style="display:none;max-height:0;overflow:hidden;">${escapeHtml(preheader || '')}</span>
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="620" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;max-width:620px;box-shadow:0 2px 16px rgba(0,0,0,.06);">
        <tr>
          <td style="background:${BRAND};padding:24px 32px;">
            <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-.3px;">Jurinex</div>
            <div style="color:#ccfbf1;font-size:12px;margin-top:4px;letter-spacing:1px;text-transform:uppercase;">Nexintel AI Pvt. Ltd.</div>
          </td>
        </tr>
        <tr><td style="padding:28px 32px;">${bodyHtml}</td></tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 32px;text-align:center;">
            <p style="color:#6b7280;font-size:12px;margin:0;">© ${year} Nexintel AI Pvt. Ltd. · B1, Near Railway Station Road, MIDC, Chhatrapati Sambhajinagar, Maharashtra 431010</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Internal "new enquiry" notification for the marketing team.
 * @param {object} e  serialized enquiry (services/contactEnquiryService.serializeEnquiry)
 * @param {string} [portalUrl]  link to the portal tab, if known
 */
function buildInternalNotificationEmail(e, portalUrl) {
  const submitted = e.submitted_at_ist || formatIST(e.submitted_at);
  const subject = `[Contact] ${e.full_name}${e.organisation_name ? ` · ${e.organisation_name}` : ''}${e.topic ? ` · ${e.topic}` : ''} (${e.reference_no})`;

  const bodyHtml = `
    <h1 style="font-size:20px;color:#111827;margin:0 0 6px;">New contact enquiry</h1>
    <p style="color:#6b7280;font-size:14px;margin:0 0 20px;">
      Submitted <strong style="color:#111827;">${escapeHtml(submitted?.display || '')}</strong>
      · Reference <strong style="color:${BRAND_DARK};">${escapeHtml(e.reference_no)}</strong>
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
      ${row('Name', e.full_name)}
      ${row('Email', `<a href="mailto:${escapeHtml(e.email)}" style="color:${BRAND_DARK};">${escapeHtml(e.email)}</a>`, { html: true })}
      ${row('Mobile', `<a href="tel:${escapeHtml(e.mobile_number)}" style="color:${BRAND_DARK};">${escapeHtml(e.mobile_number)}</a>`, { html: true })}
      ${row('Organisation', e.organisation_name)}
      ${row('What is this about', e.topic)}
      ${row('Additional details', e.message ? nl2br(e.message) : null, { html: true })}
      ${row('Marketing consent', e.marketing_consent ? 'Yes — promotional calls, SMS, WhatsApp and email permitted' : 'No')}
      ${row('Submitted (IST)', submitted?.display)}
      ${row('Page', e.page_url)}
    </table>
    ${
      portalUrl
        ? `<p style="margin:24px 0 0;"><a href="${escapeHtml(portalUrl)}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:8px;">Open in Marketing portal</a></p>`
        : ''
    }
    <p style="color:#9ca3af;font-size:12px;margin:24px 0 0;">Target: first response within one working day. Log the call / email in the portal so the response time is tracked.</p>`;

  const text = [
    `New contact enquiry ${e.reference_no}`,
    `Submitted (IST): ${submitted?.display || ''}`,
    `Name: ${e.full_name}`,
    `Email: ${e.email}`,
    `Mobile: ${e.mobile_number}`,
    `Organisation: ${e.organisation_name || '-'}`,
    `Topic: ${e.topic || '-'}`,
    `Details: ${e.message || '-'}`,
    `Marketing consent: ${e.marketing_consent ? 'Yes' : 'No'}`,
    portalUrl ? `Portal: ${portalUrl}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  return {
    subject,
    text,
    html: shell({ title: subject, preheader: `${e.full_name} · ${e.topic || 'Contact enquiry'}`, bodyHtml }),
  };
}

/**
 * Acknowledgement to the visitor.
 */
function buildAcknowledgementEmail(e) {
  const submitted = e.submitted_at_ist || formatIST(e.submitted_at);
  const subject = `We received your message — Jurinex (${e.reference_no})`;

  const bodyHtml = `
    <h1 style="font-size:20px;color:#111827;margin:0 0 12px;">Thank you, ${escapeHtml(e.first_name)}.</h1>
    <p style="color:#374151;font-size:15px;line-height:1.7;margin:0 0 18px;">
      We have received your message and a member of the Jurinex team will get back to you
      <strong>within one working day</strong>. Please keep the reference below for any follow-up.
    </p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      ${row('Reference', e.reference_no)}
      ${row('Received (IST)', submitted?.display)}
      ${row('Topic', e.topic)}
      ${row('Your message', e.message ? nl2br(e.message) : null, { html: true })}
    </table>
    <p style="color:#6b7280;font-size:13px;line-height:1.7;margin:0;">
      Need to add something? Reply to this email or write to
      <a href="mailto:connect@jurinex.ai" style="color:${BRAND_DARK};">connect@jurinex.ai</a>
      · +91 96840 27372
    </p>`;

  const text = [
    `Thank you, ${e.first_name}.`,
    'We have received your message and a member of the Jurinex team will get back to you within one working day.',
    `Reference: ${e.reference_no}`,
    `Received (IST): ${submitted?.display || ''}`,
    e.topic ? `Topic: ${e.topic}` : '',
    'Questions? connect@jurinex.ai · +91 96840 27372',
  ]
    .filter(Boolean)
    .join('\n');

  return { subject, text, html: shell({ title: subject, preheader: 'We will reply within one working day.', bodyHtml }) };
}

module.exports = { buildInternalNotificationEmail, buildAcknowledgementEmail, escapeHtml };
