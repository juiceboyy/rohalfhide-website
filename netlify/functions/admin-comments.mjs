import { requireAdminAuth } from './utils/admin-auth-guard.mjs';
import {
  getAllCommentsForModeration,
  updateCommentStatus,
  deleteComment,
  isCommentsStoreConfigured,
} from './utils/comments-store.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export default async (req) => {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);

  // 1. GET: Fetch all comments for moderation
  if (req.method === 'GET') {
    if (!isCommentsStoreConfigured()) {
      return Response.json(
        { ok: true, configured: false, comments: [] },
        { status: 200, headers: JSON_HEADERS }
      );
    }

    try {
      const comments = await getAllCommentsForModeration();
      return Response.json(
        { ok: true, configured: true, comments },
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (err) {
      console.error('Error fetching comments for moderation:', err);
      return Response.json(
        { error: 'Failed to retrieve comments.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  // 2. PATCH: Update moderation status
  if (req.method === 'PATCH') {
    try {
      const body = await req.json();
      const { id, status } = body;

      if (!id || !status) {
        return Response.json(
          { error: 'Comment id and new status are required.' },
          { status: 400, headers: JSON_HEADERS }
        );
      }

      const validStatuses = ['Approved', 'Pending', 'Rejected'];
      const normalizedStatus =
        validStatuses.find((s) => s.toLowerCase() === status.toLowerCase()) || status;

      await updateCommentStatus(id, normalizedStatus);

      return Response.json(
        { ok: true, id, status: normalizedStatus, message: `Comment marked as ${normalizedStatus}.` },
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (err) {
      console.error('Error updating comment status:', err);
      return Response.json(
        { error: 'Failed to update comment status.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  // 3. DELETE: Delete comment
  if (req.method === 'DELETE') {
    try {
      const id = (url.searchParams.get('id') || '').trim();
      if (!id) {
        return Response.json({ error: 'Comment id is required.' }, { status: 400, headers: JSON_HEADERS });
      }

      await deleteComment(id);

      return Response.json(
        { ok: true, id, message: 'Comment deleted successfully.' },
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (err) {
      console.error('Error deleting comment:', err);
      return Response.json(
        { error: 'Failed to delete comment.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: JSON_HEADERS });
};
