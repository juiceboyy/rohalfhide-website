const BREVO_SMTP_URL = 'https://api.brevo.com/v3/smtp/email';

function getEnv(key) {
  if (typeof Netlify !== 'undefined' && Netlify.env?.get(key)) {
    return Netlify.env.get(key);
  }
  return process.env[key];
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function isBrevoConfigured() {
  return Boolean(getEnv('BREVO_API_KEY'));
}

async function sendBrevoEmail(payload) {
  const apiKey = getEnv('BREVO_API_KEY');
  if (!apiKey) return { ok: false, skipped: true };

  const res = await fetch(BREVO_SMTP_URL, {
    method: 'POST',
    headers: {
      accept: 'application/json',
      'content-type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Brevo API error (${res.status}): ${errText}`);
  }

  return { ok: true };
}

export async function sendSubscriptionEmails({ email, isUpdate = false, country = '' }) {
  const senderEmail = getEnv('SENDER_EMAIL') || getEnv('EMAIL_USER') || 'halfhide@gmail.com';
  const senderName = getEnv('SENDER_NAME') || 'Ro Halfhide';
  const notificationEmail = getEnv('NOTIFICATION_EMAIL') || 'halfhide@gmail.com';
  const safeEmail = escapeHtml(email);
  const actionLabel = isUpdate ? 'Updated Subscriber' : 'New Subscriber';

  const adminHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b; max-width: 560px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #71717a; margin: 0 0 8px;">Mailing List (${actionLabel})</p>
      <h2 style="font-size: 20px; font-weight: 600; margin: 0 0 16px;">${safeEmail}</h2>
      <p style="font-size: 14px; color: #3f3f46; line-height: 1.6; margin: 0;">
        <strong>Status:</strong> ${actionLabel}<br />
        <strong>Email:</strong> ${safeEmail}<br />
        ${country ? `<strong>Country:</strong> ${escapeHtml(country)}<br />` : ''}
        <strong>Saved to:</strong> Google Sheets (Subscribers tab)
      </p>
    </div>
  `;

  const welcomeHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #09090b; color: #f4f4f5; max-width: 560px; margin: 0 auto; padding: 40px 32px; border-radius: 12px;">
      <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #d4a373; margin: 0 0 12px;">Ro Halfhide</p>
      <h1 style="font-family: Georgia, serif; font-size: 28px; font-weight: 600; color: #fafafa; margin: 0 0 16px;">Thank you for subscribing.</h1>
      <p style="font-size: 15px; line-height: 1.7; color: #a1a1aa; margin: 0 0 24px;">
        You are now on the mailing list. You will be the first to hear about new releases, studio sessions, and upcoming live dates.
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #d4d4d8; margin: 0;">
        Warm regards,<br />
        <strong>Ro Halfhide</strong>
      </p>
    </div>
  `;

  await sendBrevoEmail({
    sender: { name: senderName, email: senderEmail },
    subject: `Mailing List (${actionLabel}): ${email}`,
    htmlContent: adminHtml,
    messageVersions: [
      {
        to: [{ email: notificationEmail, name: 'Ro Halfhide' }],
        subject: `Mailing List (${actionLabel}): ${email}`,
        htmlContent: adminHtml,
      },
      {
        to: [{ email }],
        replyTo: { email: notificationEmail, name: 'Ro Halfhide' },
        subject: 'Welcome to the Ro Halfhide Mailing List',
        htmlContent: welcomeHtml,
      },
    ],
  });
}

export async function sendContactInquiryEmails({ name, email, subject, message }) {
  const senderEmail = getEnv('SENDER_EMAIL') || getEnv('EMAIL_USER') || 'halfhide@gmail.com';
  const senderName = getEnv('SENDER_NAME') || 'Ro Halfhide Website';
  const notificationEmail = getEnv('NOTIFICATION_EMAIL') || 'halfhide@gmail.com';

  const safeName = escapeHtml(name);
  const safeEmail = escapeHtml(email);
  const safeSubject = escapeHtml(subject);
  const safeMessage = escapeHtml(message).replace(/\n/g, '<br />');

  const adminHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #18181b; max-width: 600px; margin: 0 auto; padding: 24px;">
      <p style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.16em; color: #71717a; margin: 0 0 8px;">Website Inquiry</p>
      <h2 style="font-size: 22px; font-weight: 600; margin: 0 0 16px;">${safeSubject}: ${safeName}</h2>
      <p style="font-size: 14px; color: #3f3f46; line-height: 1.6; margin: 0 0 20px;">
        <strong>Name:</strong> ${safeName}<br />
        <strong>Email:</strong> <a href="mailto:${safeEmail}">${safeEmail}</a><br />
        <strong>Subject:</strong> ${safeSubject}
      </p>
      <div style="padding: 16px 20px; background-color: #f4f4f5; border-radius: 8px; font-size: 14px; line-height: 1.7; color: #18181b;">
        ${safeMessage}
      </div>
    </div>
  `;

  const senderConfirmationHtml = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background-color: #09090b; color: #f4f4f5; max-width: 560px; margin: 0 auto; padding: 40px 32px; border-radius: 12px;">
      <p style="font-family: monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #d4a373; margin: 0 0 12px;">Message Received</p>
      <h1 style="font-family: Georgia, serif; font-size: 26px; font-weight: 600; color: #fafafa; margin: 0 0 16px;">Hi ${safeName},</h1>
      <p style="font-size: 15px; line-height: 1.7; color: #a1a1aa; margin: 0 0 20px;">
        Thank you for getting in touch regarding <strong>${safeSubject}</strong>. Your message has been received and Ro or his team will get back to you shortly.
      </p>
      <div style="padding: 16px; background-color: #18181b; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #a1a1aa; margin: 0 0 24px;">
        ${safeMessage}
      </div>
      <p style="font-size: 14px; line-height: 1.6; color: #d4d4d8; margin: 0;">
        Warm regards,<br />
        <strong>Ro Halfhide</strong>
      </p>
    </div>
  `;

  await sendBrevoEmail({
    sender: { name: senderName, email: senderEmail },
    subject: `[${subject}] New message from ${name}`,
    htmlContent: adminHtml,
    messageVersions: [
      {
        to: [{ email: notificationEmail, name: 'Ro Halfhide' }],
        replyTo: { email: email.trim(), name: name.trim() },
        subject: `[${subject}] New message from ${name}`,
        htmlContent: adminHtml,
      },
      {
        to: [{ email: email.trim(), name: name.trim() }],
        replyTo: { email: notificationEmail, name: 'Ro Halfhide' },
        subject: `We received your message - Ro Halfhide`,
        htmlContent: senderConfirmationHtml,
      },
    ],
  });
}
