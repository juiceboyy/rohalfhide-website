import { getEnv, getAccessToken, isSheetsConfigured } from './google-auth.mjs';

export { isSheetsConfigured };

const SHEETS_BASE_URL = 'https://sheets.googleapis.com/v4/spreadsheets';

export const SUBSCRIBERS_TAB = 'Subscribers';
export const SUBSCRIBERS_HEADERS = [
  'Email',
  'Name',
  'Type',
  'Source',
  'Country',
  'Subscribed',
  'Date Added',
  'Last Updated',
  'Notes',
];

export const INQUIRIES_TAB = 'Inquiries';
export const INQUIRIES_HEADERS = [
  'Date',
  'Name',
  'Email',
  'Subject',
  'Message',
  'Status',
  'Notes',
];

async function ensureTabAndHeaders(spreadsheetId, token, tabName, expectedHeaders) {
  const metaRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}?fields=sheets.properties`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!metaRes.ok) {
    throw new Error(`Failed to read spreadsheet metadata (${metaRes.status})`);
  }

  const meta = await metaRes.json();
  const tabExists = (meta.sheets || []).some(
    (s) => s.properties?.title === tabName
  );

  if (!tabExists) {
    const addSheetRes = await fetch(`${SHEETS_BASE_URL}/${spreadsheetId}:batchUpdate`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requests: [{ addSheet: { properties: { title: tabName } } }],
      }),
    });

    if (!addSheetRes.ok) {
      throw new Error(`Failed to create tab ${tabName} (${addSheetRes.status})`);
    }
  }

  const rangeRes = await fetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(tabName)}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!rangeRes.ok) {
    throw new Error(`Failed to read tab ${tabName} (${rangeRes.status})`);
  }

  const rangeData = await rangeRes.json();
  const rows = rangeData.values || [];

  if (rows.length === 0) {
    await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(`${tabName}!A1`)}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [expectedHeaders] }),
      }
    );
    return { headers: expectedHeaders, rows: [] };
  }

  return { headers: rows[0], rows: rows.slice(1) };
}

export async function upsertSubscriber({
  email,
  name = '',
  type = 'Fan',
  source = 'Website Mailing List',
  country = '',
  subscribed = true,
  notes = 'Newsletter',
}) {
  const spreadsheetId = getEnv('SPREADSHEET_ID');
  const token = await getAccessToken();
  const { rows } = await ensureTabAndHeaders(
    spreadsheetId,
    token,
    SUBSCRIBERS_TAB,
    SUBSCRIBERS_HEADERS
  );

  const normalizedEmail = email.trim().toLowerCase();
  const today = new Date().toISOString().split('T')[0];

  const existingIndex = rows.findIndex(
    (row) => (row[0] || '').trim().toLowerCase() === normalizedEmail
  );

  if (existingIndex !== -1) {
    const existingRow = rows[existingIndex];
    const sheetRowNumber = existingIndex + 2;
    const mergedName = name.trim() || existingRow[1] || '';
    const mergedType = existingRow[2] || type;
    const mergedSource = existingRow[3] || source;
    const mergedCountry = country || existingRow[4] || '';
    const mergedSubscribed = subscribed ? 'TRUE' : existingRow[5] || 'FALSE';
    const dateAdded = existingRow[6] || today;
    const existingNotes = (existingRow[8] || '').trim();
    const mergedNotes =
      notes && !existingNotes.includes(notes)
        ? existingNotes
          ? `${existingNotes} | ${notes}`
          : notes
        : existingNotes;

    const updatedValues = [
      normalizedEmail,
      mergedName,
      mergedType,
      mergedSource,
      mergedCountry,
      mergedSubscribed,
      dateAdded,
      today,
      mergedNotes,
    ];

    await fetch(
      `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(
        `${SUBSCRIBERS_TAB}!A${sheetRowNumber}:I${sheetRowNumber}`
      )}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [updatedValues] }),
      }
    );

    return { isUpdate: true, rowNumber: sheetRowNumber };
  }

  const newRow = [
    normalizedEmail,
    name.trim(),
    type,
    source,
    country,
    subscribed ? 'TRUE' : 'FALSE',
    today,
    today,
    notes,
  ];

  await fetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(
      SUBSCRIBERS_TAB
    )}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [newRow] }),
    }
  );

  return { isUpdate: false };
}

export async function appendInquiry({ name, email, subject, message }) {
  const spreadsheetId = getEnv('SPREADSHEET_ID');
  const token = await getAccessToken();

  await ensureTabAndHeaders(
    spreadsheetId,
    token,
    INQUIRIES_TAB,
    INQUIRIES_HEADERS
  );

  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const newRow = [
    timestamp,
    name.trim(),
    email.trim().toLowerCase(),
    subject.trim(),
    message.trim(),
    'New',
    '',
  ];

  await fetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(
      INQUIRIES_TAB
    )}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [newRow] }),
    }
  );
}
