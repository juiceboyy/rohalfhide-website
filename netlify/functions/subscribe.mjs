const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async (req) => {
  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405 });
  }

  const apiKey =
    (typeof Netlify !== 'undefined' && Netlify.env?.get('BREVO_API_KEY')) ||
    process.env.BREVO_API_KEY;
  const rawListId =
    (typeof Netlify !== 'undefined' && Netlify.env?.get('BREVO_LIST_ID')) ||
    process.env.BREVO_LIST_ID;

  if (!apiKey) {
    return Response.json(
      { error: 'Newsletter service is not configured yet (missing BREVO_API_KEY).' },
      { status: 503 }
    );
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

  const payload = {
    email,
    updateEnabled: true,
  };

  if (rawListId) {
    const parsedListId = Number.parseInt(rawListId, 10);
    if (!Number.isNaN(parsedListId) && parsedListId > 0) {
      payload.listIds = [parsedListId];
    }
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      return Response.json({ ok: true, message: 'Subscribed successfully.' }, { status: 200 });
    }

    let errorDetail = 'Could not complete subscription. Please try again later.';
    try {
      const errData = await response.json();
      if (errData?.code === 'duplicate_parameter') {
        return Response.json({ ok: true, message: 'You are already subscribed.' }, { status: 200 });
      }
      if (typeof errData?.message === 'string') {
        errorDetail = errData.message;
      }
    } catch {
      // Ignore JSON parse errors on upstream error response
    }

    return Response.json({ error: errorDetail }, { status: response.status });
  } catch {
    return Response.json(
      { error: 'Unable to reach the mailing list service. Please try again later.' },
      { status: 502 }
    );
  }
};

export const config = {
  path: '/api/subscribe',
  method: 'POST',
};
