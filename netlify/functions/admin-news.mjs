import { requireAdminAuth } from './utils/admin-auth-guard.mjs';
import { listDirectory, readFile, saveFile, deleteFile } from './utils/github-api.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const NEWS_DIR = 'src/content/news';

function parseFrontmatterAndBody(fileContent = '') {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: fileContent };
  }

  const yamlBlock = match[1];
  const body = match[2];
  const data = {};

  for (const line of yamlBlock.split('\n')) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;
    const key = line.slice(0, colonIndex).trim();
    let value = line.slice(colonIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else if (value.toLowerCase() === 'true') {
      value = true;
    } else if (value.toLowerCase() === 'false') {
      value = false;
    }

    if (key) {
      data[key] = value;
    }
  }

  return { data, body };
}

function serializeMarkdown({
  title = '',
  pubDate = '',
  description = '',
  image = '',
  imageAlt = '',
  mediaType = 'standard',
  mediaEmbedUrl = '',
  mediaPlatform = '',
  draft = false,
  body = '',
}) {
  const cleanDate = (pubDate ? new Date(pubDate) : new Date())
    .toISOString()
    .split('T')[0];

  const lines = ['---'];
  lines.push(`title: ${JSON.stringify(title)}`);
  lines.push(`pubDate: ${cleanDate}`);
  lines.push(`description: ${JSON.stringify(description)}`);
  lines.push(`image: ${JSON.stringify(image)}`);
  lines.push(`imageAlt: ${JSON.stringify(imageAlt || title)}`);
  lines.push(`mediaType: ${JSON.stringify(mediaType || 'standard')}`);
  if (mediaEmbedUrl) {
    lines.push(`mediaEmbedUrl: ${JSON.stringify(mediaEmbedUrl)}`);
  }
  if (mediaPlatform) {
    lines.push(`mediaPlatform: ${JSON.stringify(mediaPlatform)}`);
  }
  lines.push(`draft: ${Boolean(draft)}`);
  lines.push('---');
  lines.push('');
  lines.push(body.trim());
  lines.push('');

  return lines.join('\n');
}

export default async (req) => {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);

  // 1. GET: List all news or fetch single post
  if (req.method === 'GET') {
    const slug = (url.searchParams.get('slug') || '').trim();

    if (slug) {
      const filePath = `${NEWS_DIR}/${slug}.md`;
      const fileData = await readFile(filePath);
      if (!fileData) {
        return Response.json({ error: 'Post not found.' }, { status: 404, headers: JSON_HEADERS });
      }

      const { data, body } = parseFrontmatterAndBody(fileData.content);
      return Response.json(
        {
          ok: true,
          post: {
            slug,
            sha: fileData.sha,
            body,
            title: data.title || '',
            pubDate: data.pubDate || '',
            description: data.description || '',
            image: data.image || '',
            imageAlt: data.imageAlt || '',
            mediaType: data.mediaType || 'standard',
            mediaEmbedUrl: data.mediaEmbedUrl || '',
            mediaPlatform: data.mediaPlatform || '',
            draft: Boolean(data.draft),
          },
        },
        { status: 200, headers: JSON_HEADERS }
      );
    }

    try {
      const files = await listDirectory(NEWS_DIR);
      const mdFiles = files.filter((f) => f.name.endsWith('.md'));

      const posts = await Promise.all(
        mdFiles.map(async (file) => {
          const fileData = await readFile(file.path || `${NEWS_DIR}/${file.name}`);
          const fileSlug = file.name.replace(/\.md$/, '');
          if (!fileData) {
            return { slug: fileSlug, title: fileSlug, draft: false };
          }
          const { data, body } = parseFrontmatterAndBody(fileData.content);
          return {
            slug: fileSlug,
            sha: fileData.sha,
            title: data.title || fileSlug,
            pubDate: data.pubDate || '',
            description: data.description || '',
            image: data.image || '',
            imageAlt: data.imageAlt || '',
            mediaType: data.mediaType || 'standard',
            mediaEmbedUrl: data.mediaEmbedUrl || '',
            mediaPlatform: data.mediaPlatform || '',
            draft: Boolean(data.draft),
            bodyPreview: body.slice(0, 150).replace(/\n/g, ' '),
          };
        })
      );

      posts.sort((a, b) => new Date(b.pubDate || 0) - new Date(a.pubDate || 0));

      return Response.json({ ok: true, posts }, { status: 200, headers: JSON_HEADERS });
    } catch (err) {
      console.error('Error listing news:', err);
      return Response.json(
        { error: 'Failed to retrieve news articles.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  // 2. POST: Create or update news article
  if (req.method === 'POST') {
    try {
      const payload = await req.json();
      const {
        title,
        slug: rawSlug,
        pubDate,
        description,
        image,
        imageAlt,
        mediaType,
        mediaEmbedUrl,
        mediaPlatform,
        draft,
        body,
        originalSlug,
      } = payload;

      if (!title || !title.trim()) {
        return Response.json({ error: 'Title is required.' }, { status: 400, headers: JSON_HEADERS });
      }

      const slug = (
        rawSlug ||
        title
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/(^-|-$)/g, '')
      ).trim();

      const markdownContent = serializeMarkdown({
        title: title.trim(),
        pubDate,
        description: description || '',
        image: image || '',
        imageAlt: imageAlt || title.trim(),
        mediaType: mediaType || 'standard',
        mediaEmbedUrl: mediaEmbedUrl || '',
        mediaPlatform: mediaPlatform || '',
        draft: Boolean(draft),
        body: body || '',
      });

      const targetPath = `${NEWS_DIR}/${slug}.md`;
      const isRename = originalSlug && originalSlug !== slug;

      if (isRename) {
        await deleteFile({
          filePath: `${NEWS_DIR}/${originalSlug}.md`,
          commitMessage: `CMS rename: removed old article ${originalSlug}`,
        });
      }

      const saveResult = await saveFile({
        filePath: targetPath,
        content: markdownContent,
        commitMessage: `CMS: ${isRename ? 'Rename & update' : 'Publish'} news article "${title.trim()}"`,
      });

      return Response.json(
        {
          ok: true,
          slug,
          path: targetPath,
          message: 'News article published successfully.',
          result: saveResult,
        },
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (err) {
      console.error('Error saving news post:', err);
      return Response.json(
        { error: 'Failed to save news article.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  // 3. DELETE: Remove news article
  if (req.method === 'DELETE') {
    try {
      const slug = (url.searchParams.get('slug') || '').trim();
      if (!slug) {
        return Response.json({ error: 'Slug parameter is required.' }, { status: 400, headers: JSON_HEADERS });
      }

      const filePath = `${NEWS_DIR}/${slug}.md`;
      const deleteResult = await deleteFile({
        filePath,
        commitMessage: `CMS: Delete news article ${slug}`,
      });

      return Response.json(
        { ok: true, message: `Article ${slug} deleted successfully.`, result: deleteResult },
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (err) {
      console.error('Error deleting news post:', err);
      return Response.json(
        { error: 'Failed to delete news article.', message: err.message },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: JSON_HEADERS });
};
