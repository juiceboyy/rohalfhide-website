import { isSheetsConfigured, upsertSubscriber } from './utils/google-sheets.mjs';
import { isBrevoConfigured, sendSubscriptionEmails } from './utils/brevo-mail.mjs';

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

  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || !EMAIL_REGEX.test(email)) {
    return Response.json({ error: 'Please provide a valid email address.' }, { status: 400 });
  }

  const sheetsReady = isSheetsConfigured();
  const brevoReady = isBrevoConfigured();

  if (!sheetsReady && !brevoReady) {
    return Response.json(
      {
        error:
          'Mailing list service is not configured yet (missing Google Sheets or Brevo environment variables).',
      },
      { status: 503 }
    );
  }

  const country = context?.geo?.country?.code || '';
  let isUpdate = false;

  try {
    if (sheetsReady) {
      const sheetResult = await upsertSubscriber({
        email,
        type: 'Fan',
        source: 'Website Mailing List',
        country,
        subscribed: true,
        notes: 'Newsletter',
      });
      isUpdate = Boolean(sheetResult?.isUpdate);
    }

    if (brevoReady) {
      await sendSubscriptionEmails({ email, isUpdate, country });
    }

    return Response.json(
      {
        ok: true,
        message: 'Subscribed successfully.',
      },
      { status: 200 }
    );
  } catch (err) {
    console.error('Error in /api/subscribe:', err);
    return Response.json(
      { error: 'Unable to complete subscription right now. Please try again later.' },
      { status: 502 }
    );
  }
};

export const config = {
  path: '/api/subscribe',
  method: 'POST',
};
