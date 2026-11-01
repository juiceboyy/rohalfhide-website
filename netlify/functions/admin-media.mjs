import { requireAdminAuth } from './utils/admin-auth-guard.mjs';
import { saveFile } from './utils/github-api.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const ALLOWED_AUDIO_EXT = ['.mp3'];
const ALLOWED_IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.webp', '.svg', '.gif'];

function sanitizeFilename(name = '') {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

export default async (req) => {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  if (req.method !== 'POST') {
    return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: JSON_HEADERS });
  }

  try {
    const body = await req.json();
    const { filename, base64Data, type } = body;

    if (!filename || !base64Data) {
      return Response.json(
        { error: 'Filename and base64Data are required.' },
        { status: 400, headers: JSON_HEADERS }
      );
    }

    const cleanName = sanitizeFilename(filename);
    const ext = cleanName.slice(cleanName.lastIndexOf('.'));

    let targetDir = 'public/images';
    let publicUrlPrefix = '/images';

    if (type === 'audio' || ALLOWED_AUDIO_EXT.includes(ext)) {
      if (!ALLOWED_AUDIO_EXT.includes(ext)) {
        return Response.json(
          { error: `Invalid audio format. Allowed: ${ALLOWED_AUDIO_EXT.join(', ')}` },
          { status: 400, headers: JSON_HEADERS }
        );
      }
      targetDir = 'public/audio';
      publicUrlPrefix = '/audio';
    } else {
      if (!ALLOWED_IMAGE_EXT.includes(ext)) {
        return Response.json(
          { error: `Invalid image format. Allowed: ${ALLOWED_IMAGE_EXT.join(', ')}` },
          { status: 400, headers: JSON_HEADERS }
        );
      }
    }

    // Strip data URI scheme prefix if present (e.g., data:image/png;base64,...)
    const pureBase64 = base64Data.replace(/^data:[^;]+;base64,/, '');

    const targetPath = `${targetDir}/${cleanName}`;
    await saveFile({
      filePath: targetPath,
      content: pureBase64,
      isBase64: true,
      commitMessage: `CMS: Upload ${type || 'media'} file "${cleanName}"`,
    });

    const publicUrl = `${publicUrlPrefix}/${cleanName}`;

    return Response.json(
      {
        ok: true,
        url: publicUrl,
        path: targetPath,
        filename: cleanName,
        message: 'File uploaded successfully.',
      },
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err) {
    console.error('Error uploading media:', err);
    return Response.json(
      { error: 'Failed to upload media.', message: err.message },
      { status: 500, headers: JSON_HEADERS }
    );
  }
};
