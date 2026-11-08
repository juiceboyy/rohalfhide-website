import { requireAdminAuth } from './utils/admin-auth-guard.mjs';
import { readFile, saveFile } from './utils/github-api.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const PRODUCER_PATH = 'src/data/producer.json';

function emptyCatalog() {
  return {
    instagramHighlightsUrl: 'https://www.instagram.com/stories/highlights/18158156884248319/',
    hero: { eyebrowLeft: 'Producer & Songwriter', eyebrowRight: 'Jupiterkade 2, The Hague', title: '', subtitle: '' },
    studio: { name: 'Jupiterkade 2 Studio', address: 'Jupiterkade 2', city: 'The Hague, The Netherlands', summary: '', approach: '', setupHighlights: [] },
    services: [],
    chapters: [],
    songIdeas: [],
    credits: [],
    testimonials: [],
  };
}

async function loadProducerData() {
  const fileData = await readFile(PRODUCER_PATH);
  if (!fileData || !fileData.content) {
    return { data: emptyCatalog(), sha: null };
  }
  try {
    const parsed = JSON.parse(fileData.content);
    return { data: { ...emptyCatalog(), ...parsed }, sha: fileData.sha };
  } catch {
    return { data: emptyCatalog(), sha: fileData.sha };
  }
}

function upsertById(list, item) {
  const idx = list.findIndex((entry) => entry.id === item.id);
  if (idx !== -1) {
    const next = [...list];
    next[idx] = item;
    return { list: next, isUpdate: true };
  }
  return { list: [...list, item], isUpdate: false };
}

export default async (req) => {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);

  if (req.method === 'GET') {
    try {
      const { data } = await loadProducerData();
      return Response.json({ ok: true, data }, { status: 200, headers: JSON_HEADERS });
    } catch (err) {
      return Response.json(
        { error: 'Failed to load producer catalog.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  if (req.method === 'POST') {
    try {
      const body = await req.json();
      const { action, payload } = body || {};
      if (!action || !payload) {
        return Response.json({ error: 'Action and payload are required.' }, { status: 400, headers: JSON_HEADERS });
      }

      const { data, sha } = await loadProducerData();
      let commitMessage = 'CMS: Update producer portfolio';

      if (action === 'upsert-chapter') {
        if (!payload.title?.trim()) {
          return Response.json({ error: 'Chapter title is required.' }, { status: 400, headers: JSON_HEADERS });
        }
        const chapter = {
          id: payload.id || `chapter-${Date.now()}`,
          indexLabel: (payload.indexLabel || String(data.chapters.length + 1).padStart(2, '0')).trim(),
          title: payload.title.trim(),
          description: (payload.description || '').trim(),
          draft: Boolean(payload.draft),
        };
        const res = upsertById(data.chapters, chapter);
        data.chapters = res.list;
        commitMessage = `CMS: ${res.isUpdate ? 'Update' : 'Add'} producer chapter "${chapter.title}"`;
      } else if (action === 'upsert-idea') {
        if (!payload.title?.trim() || !payload.src?.trim() || !payload.chapterId?.trim()) {
          return Response.json({ error: 'Title, chapter, and media source are required.' }, { status: 400, headers: JSON_HEADERS });
        }
        const mediaType = payload.mediaType === 'video' ? 'video' : 'audio';
        const aspectRatio = ['9:16', '16:9', '1:1'].includes(payload.aspectRatio)
          ? payload.aspectRatio
          : mediaType === 'video' ? '9:16' : '1:1';
        const idea = {
          id: payload.id || `idea-${Date.now()}`,
          chapterId: payload.chapterId.trim(),
          title: payload.title.trim(),
          mediaType,
          src: payload.src.trim(),
          poster: (payload.poster || '').trim(),
          cover: (payload.cover || '/images/hero-portrait.jpg').trim(),
          duration: (payload.duration || '0:00').trim(),
          note: (payload.note || '').trim(),
          year: (payload.year || '').trim(),
          aspectRatio,
          width: Number(payload.width) || (aspectRatio === '16:9' ? 640 : mediaType === 'video' ? 360 : 600),
          height: Number(payload.height) || (aspectRatio === '16:9' ? 360 : mediaType === 'video' ? 640 : 600),
          instagramUrl: (payload.instagramUrl || '').trim(),
          draft: Boolean(payload.draft),
        };
        const res = upsertById(data.songIdeas, idea);
        data.songIdeas = res.list;
        commitMessage = `CMS: ${res.isUpdate ? 'Update' : 'Add'} song idea "${idea.title}"`;
      } else if (action === 'upsert-credit') {
        if (!payload.artist?.trim() || !payload.title?.trim()) {
          return Response.json({ error: 'Artist and title are required.' }, { status: 400, headers: JSON_HEADERS });
        }
        const credit = {
          id: payload.id || `credit-${Date.now()}`,
          title: payload.title.trim(),
          artist: payload.artist.trim(),
          role: (payload.role || 'Producer').trim(),
          year: (payload.year || '').trim(),
          cover: (payload.cover || '/images/hero-portrait.jpg').trim(),
          audioPreview: (payload.audioPreview || '').trim(),
          externalUrl: (payload.externalUrl || '').trim(),
          notes: (payload.notes || '').trim(),
          draft: Boolean(payload.draft),
        };
        const res = upsertById(data.credits, credit);
        data.credits = res.list;
        commitMessage = `CMS: ${res.isUpdate ? 'Update' : 'Add'} credit "${credit.artist} - ${credit.title}"`;
      } else if (action === 'upsert-testimonial') {
        if (!payload.quote?.trim() || !payload.author?.trim()) {
          return Response.json({ error: 'Quote and author are required.' }, { status: 400, headers: JSON_HEADERS });
        }
        const testimonial = {
          id: payload.id || `testimonial-${Date.now()}`,
          quote: payload.quote.trim(),
          author: payload.author.trim(),
          roleOrProject: (payload.roleOrProject || '').trim(),
          draft: Boolean(payload.draft),
        };
        const res = upsertById(data.testimonials, testimonial);
        data.testimonials = res.list;
        commitMessage = `CMS: ${res.isUpdate ? 'Update' : 'Add'} testimonial from "${testimonial.author}"`;
      } else if (action === 'update-settings') {
        if (payload.instagramHighlightsUrl) {
          data.instagramHighlightsUrl = String(payload.instagramHighlightsUrl).trim();
        }
        if (payload.hero) data.hero = { ...data.hero, ...payload.hero };
        if (payload.studio) data.studio = { ...data.studio, ...payload.studio };
        if (Array.isArray(payload.services)) data.services = payload.services;
        commitMessage = 'CMS: Update producer studio & page copy';
      } else {
        return Response.json({ error: `Unknown action "${action}".` }, { status: 400, headers: JSON_HEADERS });
      }

      await saveFile({
        filePath: PRODUCER_PATH,
        content: JSON.stringify(data, null, 2) + '\n',
        commitMessage,
        sha,
      });

      return Response.json({ ok: true, data, message: commitMessage }, { status: 200, headers: JSON_HEADERS });
    } catch (err) {
      return Response.json(
        { error: 'Failed to save producer update.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  if (req.method === 'PUT') {
    try {
      const { section, items } = await req.json();
      const allowed = ['chapters', 'songIdeas', 'credits', 'testimonials'];
      if (!allowed.includes(section) || !Array.isArray(items)) {
        return Response.json({ error: 'Invalid section or items array.' }, { status: 400, headers: JSON_HEADERS });
      }
      const { data, sha } = await loadProducerData();
      data[section] = items;
      await saveFile({
        filePath: PRODUCER_PATH,
        content: JSON.stringify(data, null, 2) + '\n',
        commitMessage: `CMS: Reorder producer ${section}`,
        sha,
      });
      return Response.json({ ok: true, data, message: 'Order updated.' }, { status: 200, headers: JSON_HEADERS });
    } catch (err) {
      return Response.json(
        { error: 'Failed to reorder producer section.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  if (req.method === 'DELETE') {
    try {
      const section = (url.searchParams.get('section') || '').trim();
      const id = (url.searchParams.get('id') || '').trim();
      const allowed = ['chapters', 'songIdeas', 'credits', 'testimonials'];
      if (!allowed.includes(section) || !id) {
        return Response.json({ error: 'Valid section and id are required.' }, { status: 400, headers: JSON_HEADERS });
      }
      const { data, sha } = await loadProducerData();
      const before = data[section].length;
      data[section] = data[section].filter((item) => item.id !== id);
      if (data[section].length === before) {
        return Response.json({ error: 'Entry not found.' }, { status: 404, headers: JSON_HEADERS });
      }
      await saveFile({
        filePath: PRODUCER_PATH,
        content: JSON.stringify(data, null, 2) + '\n',
        commitMessage: `CMS: Delete producer ${section} entry ${id}`,
        sha,
      });
      return Response.json({ ok: true, data, message: 'Entry deleted.' }, { status: 200, headers: JSON_HEADERS });
    } catch (err) {
      return Response.json(
        { error: 'Failed to delete entry.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: JSON_HEADERS });
};
