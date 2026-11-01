import { getEnv, getAccessToken, isSheetsConfigured } from './google-auth.mjs';
import { ensureTabAndHeaders, SHEETS_BASE_URL } from './google-sheets.mjs';

export const COMMENTS_TAB = 'Comments';
export const COMMENTS_HEADERS = [
  'ID',
  'Date',
  'PostSlug',
  'Name',
  'Email',
  'Comment',
  'Status',
  'IsArtist',
];

export function isCommentsStoreConfigured() {
  return isSheetsConfigured();
}

/**
 * Fetch total approved comment counts grouped by post slug.
 * Returns an object map: { [slug]: number }
 */
export async function getAllCommentCounts() {
  if (!isSheetsConfigured()) {
    return {};
  }

  const spreadsheetId = getEnv('SPREADSHEET_ID');
  const token = await getAccessToken();

  const { rows } = await ensureTabAndHeaders(
    spreadsheetId,
    token,
    COMMENTS_TAB,
    COMMENTS_HEADERS
  );

  const counts = {};

  for (const row of rows) {
    const rowSlug = (row[2] || '').trim().toLowerCase();
    const status = (row[6] || '').trim().toLowerCase();

    if (rowSlug && status === 'approved') {
      counts[rowSlug] = (counts[rowSlug] || 0) + 1;
    }
  }

  return counts;
}

/**
 * Fetch approved comments for a specific post slug.
 * Private email addresses are intentionally filtered out to protect visitor privacy.
 */
export async function getCommentsBySlug(postSlug) {
  if (!isSheetsConfigured()) {
    return [];
  }

  const spreadsheetId = getEnv('SPREADSHEET_ID');
  const token = await getAccessToken();

  const { rows } = await ensureTabAndHeaders(
    spreadsheetId,
    token,
    COMMENTS_TAB,
    COMMENTS_HEADERS
  );

  const normalizedSlug = (postSlug || '').trim().toLowerCase();

  return rows
    .filter((row) => {
      const rowSlug = (row[2] || '').trim().toLowerCase();
      const status = (row[6] || '').trim().toLowerCase();
      return rowSlug === normalizedSlug && status === 'approved';
    })
    .map((row) => ({
      id: row[0] || '',
      date: row[1] || '',
      postSlug: row[2] || '',
      name: row[3] || 'Anonymous',
      comment: row[5] || '',
      isArtist: (row[7] || '').trim().toUpperCase() === 'TRUE',
    }));
}

/**
 * Append a newly submitted comment to the Comments sheet tab.
 */
export async function appendComment({
  id,
  postSlug,
  name,
  email = '',
  comment,
  isArtist = false,
  status = 'Approved',
}) {
  const spreadsheetId = getEnv('SPREADSHEET_ID');
  const token = await getAccessToken();

  await ensureTabAndHeaders(
    spreadsheetId,
    token,
    COMMENTS_TAB,
    COMMENTS_HEADERS
  );

  const commentId = id || `c_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const newRow = [
    commentId,
    timestamp,
    postSlug.trim(),
    name.trim(),
    email ? email.trim().toLowerCase() : '',
    comment.trim(),
    status,
    isArtist ? 'TRUE' : 'FALSE',
  ];

  await fetch(
    `${SHEETS_BASE_URL}/${spreadsheetId}/values/${encodeURIComponent(
      COMMENTS_TAB
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

  return {
    id: commentId,
    date: timestamp,
    postSlug: postSlug.trim(),
    name: name.trim(),
    comment: comment.trim(),
    isArtist: Boolean(isArtist),
    status,
  };
}
