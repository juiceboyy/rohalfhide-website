import {
  isSheetsConfigured,
  appendInquiry,
  upsertSubscriber,
} from './utils/google-sheets.mjs';
import { isBrevoConfigured, sendContactInquiryEmails } from './utils/brevo-mail.mjs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req, context) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: 'Invalid request payload.' }, { status: 400 });
  }

  // Honeypot trap for bots
  if (body?.['bot-field']) {
    return Response.json({ ok: true, message: 'Message received.' }, { status: 200 });
  }

  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const subject =
    typeof body?.subject === 'string' && body.subject.trim()
      ? body.subject.trim()
      : 'General Inquiry';
  const message = typeof body?.message === 'string' ? body.message.trim() : '';

  if (!name || !email || !EMAIL_REGEX.test(email) || !message) {
    return Response.json(
      { error: 'Please fill out your name, a valid email address, and a message.' },
      { status: 400 }
    );
  }

  const sheetsReady = isSheetsConfigured();
  const brevoReady = isBrevoConfigured();

  if (!sheetsReady && !brevoReady) {
    return Response.json(
      { ok: false, fallbackOnly: true },
      { status: 202 }
    );
  }

  const country = context?.geo?.country?.code || '';

  try {
    const tasks = [];

    if (sheetsReady) {
      tasks.push(appendInquiry({ name, email, subject, message }));
      tasks.push(
        upsertSubscriber({
          email,
          name,
          type: subject,
          source: 'Website Contact Form',
          country,
          subscribed: false,
          notes: `Contact Form (${subject})`,
        })
      );
    }

    if (brevoReady) {
      tasks.push(sendContactInquiryEmails({ name, email, subject, message }));
    }

    await Promise.all(tasks);

    return Response.json({ ok: true, message: 'Message sent successfully.' }, { status: 200 });
  } catch (err) {
    console.error('Error in /api/contact:', err);
    return Response.json(
      { error: 'Could not process contact request.' },
      { status: 502 }
    );
  }
};

export const config = {
  path: '/api/contact',
  method: 'POST',
};
