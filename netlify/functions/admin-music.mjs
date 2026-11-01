import { requireAdminAuth } from './utils/admin-auth-guard.mjs';
import { readFile, saveFile } from './utils/github-api.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const TRACKS_PATH = 'src/data/tracks.json';

async function loadTracks() {
  const fileData = await readFile(TRACKS_PATH);
  if (!fileData || !fileData.content) {
    return { tracks: [], sha: null };
  }
  try {
    const tracks = JSON.parse(fileData.content);
    return { tracks: Array.isArray(tracks) ? tracks : [], sha: fileData.sha };
  } catch {
    return { tracks: [], sha: fileData.sha };
  }
}

export default async (req) => {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);

  // 1. GET: Fetch playlist
  if (req.method === 'GET') {
    try {
      const { tracks } = await loadTracks();
      return Response.json({ ok: true, tracks }, { status: 200, headers: JSON_HEADERS });
    } catch (err) {
      console.error('Error loading tracks:', err);
      return Response.json(
        { error: 'Failed to load tracks.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  // 2. POST: Add or edit track
  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { id, title, artist, src, duration, cover, releaseDate, draft, links } = body;

      if (!title || !title.trim()) {
        return Response.json({ error: 'Track title is required.' }, { status: 400, headers: JSON_HEADERS });
      }
      if (!src || !src.trim()) {
        return Response.json({ error: 'Audio source (src) is required.' }, { status: 400, headers: JSON_HEADERS });
      }

      const { tracks, sha } = await loadTracks();

      const trackPayload = {
        id: id || String(Date.now()),
        title: title.trim(),
        artist: (artist || 'Ro Halfhide').trim(),
        src: src.trim(),
        duration: (duration || '0:00').trim(),
        cover: (cover || '/images/hero-portrait.jpg').trim(),
        releaseDate: releaseDate || new Date().toISOString().split('T')[0],
        draft: Boolean(draft),
        links: links || {},
      };

      const existingIndex = tracks.findIndex((t) => t.id === trackPayload.id);
      let isUpdate = false;

      if (existingIndex !== -1) {
        tracks[existingIndex] = trackPayload;
        isUpdate = true;
      } else {
        tracks.push(trackPayload);
      }

      const formattedJson = JSON.stringify(tracks, null, 2) + '\n';
      const commitMsg = `CMS: ${isUpdate ? 'Update' : 'Add'} track "${trackPayload.title}"`;

      await saveFile({
        filePath: TRACKS_PATH,
        content: formattedJson,
        commitMessage: commitMsg,
        sha,
      });

      return Response.json(
        {
          ok: true,
          track: trackPayload,
          tracks,
          message: `Track "${trackPayload.title}" saved successfully.`,
        },
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (err) {
      console.error('Error saving track:', err);
      return Response.json(
        { error: 'Failed to save track.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  // 3. PUT: Reorder tracks playlist
  if (req.method === 'PUT') {
    try {
      const body = await req.json();
      const { tracks } = body;

      if (!Array.isArray(tracks)) {
        return Response.json({ error: 'Payload must include tracks array.' }, { status: 400, headers: JSON_HEADERS });
      }

      const { sha } = await loadTracks();
      const formattedJson = JSON.stringify(tracks, null, 2) + '\n';

      await saveFile({
        filePath: TRACKS_PATH,
        content: formattedJson,
        commitMessage: 'CMS: Update track playlist order',
        sha,
      });

      return Response.json(
        { ok: true, message: 'Track order updated successfully.', tracks },
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (err) {
      console.error('Error reordering tracks:', err);
      return Response.json(
        { error: 'Failed to update track order.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  // 4. DELETE: Remove track
  if (req.method === 'DELETE') {
    try {
      const id = (url.searchParams.get('id') || '').trim();
      if (!id) {
        return Response.json({ error: 'Track id is required.' }, { status: 400, headers: JSON_HEADERS });
      }

      const { tracks, sha } = await loadTracks();
      const filtered = tracks.filter((t) => t.id !== id);

      if (filtered.length === tracks.length) {
        return Response.json({ error: `Track with id ${id} not found.` }, { status: 404, headers: JSON_HEADERS });
      }

      const formattedJson = JSON.stringify(filtered, null, 2) + '\n';
      await saveFile({
        filePath: TRACKS_PATH,
        content: formattedJson,
        commitMessage: `CMS: Delete track id ${id}`,
        sha,
      });

      return Response.json(
        { ok: true, message: 'Track deleted successfully.', tracks: filtered },
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (err) {
      console.error('Error deleting track:', err);
      return Response.json(
        { error: 'Failed to delete track.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: JSON_HEADERS });
};
