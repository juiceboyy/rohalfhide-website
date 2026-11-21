import {
  isCommentsStoreConfigured,
  getCommentsBySlug,
  appendComment,
  getAllCommentCounts,
} from './utils/comments-store.mjs';
import { isBrevoConfigured, sendCommentNotificationEmail } from './utils/brevo-mail.mjs';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RO_EMAILS = ['halfhide@gmail.com'];

function sanitizeText(str = '') {
  return String(str)
    // Strip HTML tags entirely
    .replace(/<[^>]*>?/gm, '')
    // Replace quotes and ampersands
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .trim();
}

export default async (req) => {
  const url = new URL(req.url);

  // 1. GET: Fetch approved comments for a post slug, or all comment counts
  if (req.method === 'GET') {
    const wantsCounts = url.searchParams.get('counts') === 'true' || url.searchParams.has('counts');
    if (wantsCounts) {
      try {
        const counts = await getAllCommentCounts();
        return Response.json(
          { ok: true, counts },
          {
            status: 200,
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=60, s-maxage=60',
            },
          }
        );
      } catch (err) {
        console.error('Error fetching comment counts:', err);
        return Response.json(
          { error: 'Unable to retrieve comment counts at this time.', counts: {} },
          { status: 500 }
        );
      }
    }

    const slug = (url.searchParams.get('slug') || '').trim();
    if (!slug) {
      return Response.json({ error: 'Missing slug parameter.' }, { status: 400 });
    }

    try {
      const comments = await getCommentsBySlug(slug);
      return Response.json(
        { ok: true, comments },
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      );
    } catch (err) {
      console.error('Error fetching comments:', err);
      return Response.json(
        { error: 'Unable to retrieve comments at this time.', comments: [] },
        { status: 500 }
      );
    }
  }

  // 2. POST: Submit a new comment
  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: 'Invalid JSON payload.' }, { status: 400 });
    }

    // Anti-spam 1: Honeypot check
    if (body?.['bot-field'] || body?.botField || body?.website) {
      return Response.json({ ok: true, message: 'Comment submitted successfully.' }, { status: 200 });
    }

    // Anti-spam 2: Submission speed threshold (< 2 seconds is bot behavior)
    const renderedAt = Number(body?.renderedAt);
    if (renderedAt && Date.now() - renderedAt < 2000) {
      return Response.json({ ok: true, message: 'Comment submitted successfully.' }, { status: 200 });
    }

    const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
    const postTitle = typeof body?.postTitle === 'string' ? body.postTitle.trim() : slug;
    const rawName = typeof body?.name === 'string' ? body.name.trim() : '';
    const rawComment = typeof body?.comment === 'string' ? body.comment.trim() : '';
    const rawEmail = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!slug) {
      return Response.json({ error: 'Post slug is required.' }, { status: 400 });
    }

    const cleanName = sanitizeText(rawName);
    const cleanComment = sanitizeText(rawComment);

    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      return Response.json(
        { error: 'Please enter a name between 2 and 80 characters.' },
        { status: 400 }
      );
    }

    if (!cleanComment || cleanComment.length < 2 || cleanComment.length > 2000) {
      return Response.json(
        { error: 'Please enter a comment between 2 and 2000 characters.' },
        { status: 400 }
      );
    }

    if (rawEmail && (!EMAIL_REGEX.test(rawEmail) || rawEmail.length > 120)) {
      return Response.json(
        { error: 'Please enter a valid email address or leave the field blank.' },
        { status: 400 }
      );
    }

    const isArtist = RO_EMAILS.includes(rawEmail);

    if (!isCommentsStoreConfigured()) {
      return Response.json(
        { error: 'Comments store is currently not configured.' },
        { status: 503 }
      );
    }

    try {
      const savedComment = await appendComment({
        postSlug: slug,
        name: cleanName,
        email: rawEmail,
        comment: cleanComment,
        isArtist,
        status: 'Approved',
      });

      // Notify Ro via Brevo email in background (non-blocking failure)
      if (isBrevoConfigured()) {
        sendCommentNotificationEmail({
          postSlug: slug,
          postTitle,
          name: cleanName,
          email: rawEmail,
          comment: cleanComment,
        }).catch((mailErr) => {
          console.warn('Failed to send comment notification email:', mailErr);
        });
      }

      return Response.json(
        {
          ok: true,
          message: 'Comment posted successfully.',
          comment: {
            id: savedComment.id,
            date: savedComment.date,
            postSlug: savedComment.postSlug,
            name: savedComment.name,
            comment: savedComment.comment,
            isArtist: savedComment.isArtist,
          },
        },
        { status: 201 }
      );
    } catch (err) {
      console.error('Error saving comment:', err);
      return Response.json(
        { error: 'Failed to save comment. Please try again later.' },
        { status: 500 }
      );
    }
  }

  return Response.json({ error: 'Method not allowed.' }, { status: 405 });
};

export const config = {
  path: '/api/comments',
};
