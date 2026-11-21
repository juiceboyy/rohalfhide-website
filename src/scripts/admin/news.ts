import { fetchWithAuth, showToast, uploadMedia } from './api';
import { previewLocalFile, setSafeImagePreview } from './media-preview';

export interface NewsPost {
  slug: string;
  sha?: string;
  title: string;
  pubDate: string;
  description: string;
  image: string;
  imageAlt: string;
  mediaType: 'standard' | 'audio' | 'video';
  mediaEmbedUrl?: string;
  mediaPlatform?: 'soundcloud' | 'youtube';
  draft: boolean;
  body?: string;
  bodyPreview?: string;
}

let currentOriginalSlug: string | null = null;

function renderSimpleMarkdown(md: string): string {
  if (!md) return '<p class="text-surface-subtle italic">No content yet.</p>';

  const escapeHtml = (text: string) =>
    text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  let html = md;
  // Headings
  html = html.replace(/^### (.*$)/gim, '<h3 class="font-serif text-lg font-semibold text-surface-ink mt-4 mb-2">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="font-serif text-xl font-semibold text-surface-ink mt-6 mb-3">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="font-serif text-2xl font-semibold text-surface-ink mt-6 mb-3">$1</h1>');
  // Bold & Italic
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-surface-ink">$1</strong>');
  html = html.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>');
  // Blockquotes
  html = html.replace(/^\> (.*$)/gim, '<blockquote class="border-l-2 border-accent pl-4 py-1 italic text-surface-muted my-3">$1</blockquote>');
  // Links
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-accent underline underline-offset-4 hover:text-accent-hover">$1</a>');
  // Paragraphs
  const paragraphs = html.split(/\n\s*\n/).map((p) => {
    const trimmed = p.trim();
    if (!trimmed) return '';
    if (trimmed.startsWith('<h') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol')) {
      return trimmed;
    }
    return `<p class="font-sans text-sm text-surface-muted leading-relaxed mb-3">${trimmed}</p>`;
  });

  return paragraphs.join('\n');
}

export function updateNewsPreview(): void {
  const bodyInput = document.getElementById('news-form-body') as HTMLTextAreaElement | null;
  const previewContainer = document.getElementById('news-markdown-preview');
  if (!bodyInput || !previewContainer) return;

  previewContainer.innerHTML = renderSimpleMarkdown(bodyInput.value);
}

export async function loadNewsList(): Promise<void> {
  const container = document.getElementById('news-list-container');
  const countBadge = document.getElementById('news-count-badge');
  if (!container) return;

  container.innerHTML = `
    <div class="py-12 text-center text-xs font-mono text-surface-subtle animate-pulse">
      Loading news articles...
    </div>
  `;

  try {
    const res = await fetchWithAuth('/api/admin/news');
    if (!res.ok) throw new Error('Failed to fetch articles');
    const data = await res.json();
    const posts: NewsPost[] = data.posts || [];

    if (countBadge) countBadge.textContent = String(posts.length);

    if (posts.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-sm text-surface-muted">
          No articles found. Click "New Article" to publish your first post.
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="divide-y divide-white/[0.06]">
        ${posts
          .map((post) => `
          <div class="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
            <div class="flex items-start gap-4">
              <img
                src="${post.image || '/images/hero-portrait.jpg'}"
                alt="${post.title}"
                class="w-14 h-14 rounded-lg object-cover bg-surface-base shadow-hairline shrink-0"
              />
              <div class="space-y-1">
                <div class="flex items-center gap-2">
                  <span class="inline-flex px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded ${
                    post.draft
                      ? 'bg-amber-500/15 text-amber-300 shadow-hairline'
                      : 'bg-emerald-500/15 text-emerald-300 shadow-hairline'
                  }">
                    ${post.draft ? 'Draft' : 'Published'}
                  </span>
                  <span class="text-xs font-mono text-surface-subtle">${post.pubDate || 'No date'}</span>
                  ${post.mediaType && post.mediaType !== 'standard' ? `
                    <span class="text-[10px] font-mono text-surface-subtle uppercase px-1.5 py-0.5 rounded bg-white/[0.04]">
                      ${post.mediaType}
                    </span>
                  ` : ''}
                </div>
                <h3 class="font-serif text-base font-semibold text-surface-ink leading-snug">
                  ${post.title}
                </h3>
                <p class="font-sans text-xs text-surface-muted line-clamp-1 max-w-xl">
                  ${post.description || post.bodyPreview || ''}
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
              <a
                href="/news/${post.slug}"
                target="_blank"
                rel="noopener noreferrer"
                class="px-2.5 py-1.5 rounded text-xs font-mono text-surface-muted hover:text-surface-ink bg-surface-base hover:bg-white/[0.06] transition-colors focus-ring"
                title="View live page"
              >
                View
              </a>
              <button
                type="button"
                data-action="edit-news"
                data-slug="${post.slug}"
                class="px-3 py-1.5 rounded text-xs font-sans font-medium text-surface-ink bg-surface-raised hover:bg-white/[0.08] shadow-hairline transition-colors focus-ring"
              >
                Edit
              </button>
              <button
                type="button"
                data-action="delete-news"
                data-slug="${post.slug}"
                data-title="${post.title}"
                class="px-2.5 py-1.5 rounded text-xs font-mono text-red-400/80 hover:text-red-400 hover:bg-red-950/30 transition-colors focus-ring"
              >
                Delete
              </button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    attachNewsRowListeners();
  } catch (err: any) {
    container.innerHTML = `
      <div class="py-8 text-center text-xs font-mono text-red-400">
        Error loading news: ${err.message}
      </div>
    `;
  }
}

function attachNewsRowListeners(): void {
  document.querySelectorAll('[data-action="edit-news"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const slug = (e.currentTarget as HTMLElement).getAttribute('data-slug');
      if (slug) await openNewsEditor(slug);
    });
  });

  document.querySelectorAll('[data-action="delete-news"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const el = e.currentTarget as HTMLElement;
      const slug = el.getAttribute('data-slug');
      const title = el.getAttribute('data-title');
      if (!slug) return;

      const confirmed = window.confirm(`Are you sure you want to delete "${title || slug}"? This will delete the file from the repository.`);
      if (!confirmed) return;

      try {
        const res = await fetchWithAuth(`/api/admin/news?slug=${encodeURIComponent(slug)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete');
        showToast('Article deleted.', 'success');
        await loadNewsList();
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    });
  });
}

export async function openNewsEditor(slug: string | null = null): Promise<void> {
  const modal = document.getElementById('news-editor-modal');
  const modalTitle = document.getElementById('news-modal-title');
  const form = document.getElementById('news-form') as HTMLFormElement | null;
  if (!modal || !form) return;

  currentOriginalSlug = slug;
  form.reset();

  if (slug) {
    if (modalTitle) modalTitle.textContent = 'Edit Article';
    showToast('Fetching article details...', 'info');

    try {
      const res = await fetchWithAuth(`/api/admin/news?slug=${encodeURIComponent(slug)}`);
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to fetch article');
      const post: NewsPost = data.post;

      (document.getElementById('news-form-title') as HTMLInputElement).value = post.title;
      (document.getElementById('news-form-slug') as HTMLInputElement).value = post.slug;
      (document.getElementById('news-form-date') as HTMLInputElement).value = post.pubDate;
      (document.getElementById('news-form-description') as HTMLTextAreaElement).value = post.description;
      (document.getElementById('news-form-image') as HTMLInputElement).value = post.image;
      (document.getElementById('news-form-image-alt') as HTMLInputElement).value = post.imageAlt;
      (document.getElementById('news-form-media-type') as HTMLSelectElement).value = post.mediaType || 'standard';
      (document.getElementById('news-form-media-embed') as HTMLInputElement).value = post.mediaEmbedUrl || '';
      (document.getElementById('news-form-media-platform') as HTMLSelectElement).value = post.mediaPlatform || '';
      (document.getElementById('news-form-draft') as HTMLInputElement).checked = Boolean(post.draft);
      (document.getElementById('news-form-body') as HTMLTextAreaElement).value = post.body || '';

      const imgPreview = document.getElementById('news-image-preview') as HTMLImageElement | null;
      setSafeImagePreview(imgPreview, post.image || '');
    } catch (err: any) {
      showToast(err.message, 'error');
      return;
    }
  } else {
    if (modalTitle) modalTitle.textContent = 'New Article';
    (document.getElementById('news-form-date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
    const imgPreview = document.getElementById('news-image-preview') as HTMLImageElement | null;
    if (imgPreview) imgPreview.classList.add('hidden');
  }

  updateNewsPreview();
  modal.classList.remove('hidden');
}

export function closeNewsEditor(): void {
  const modal = document.getElementById('news-editor-modal');
  if (modal) modal.classList.add('hidden');
  currentOriginalSlug = null;
}

export function setupNewsEvents(): void {
  const newBtn = document.getElementById('admin-new-post-btn');
  const closeBtn = document.getElementById('news-modal-close-btn');
  const cancelBtn = document.getElementById('news-modal-cancel-btn');
  const bodyInput = document.getElementById('news-form-body') as HTMLTextAreaElement | null;
  const titleInput = document.getElementById('news-form-title') as HTMLInputElement | null;
  const slugInput = document.getElementById('news-form-slug') as HTMLInputElement | null;
  const imageUploadInput = document.getElementById('news-image-upload') as HTMLInputElement | null;
  const form = document.getElementById('news-form') as HTMLFormElement | null;

  newBtn?.addEventListener('click', () => openNewsEditor(null));
  closeBtn?.addEventListener('click', closeNewsEditor);
  cancelBtn?.addEventListener('click', closeNewsEditor);

  titleInput?.addEventListener('input', () => {
    if (!currentOriginalSlug && slugInput) {
      slugInput.value = titleInput.value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }
  });

  bodyInput?.addEventListener('input', updateNewsPreview);

  const imgField = document.getElementById('news-form-image') as HTMLInputElement | null;
  const imgPreview = document.getElementById('news-image-preview') as HTMLImageElement | null;

  imgField?.addEventListener('input', () => {
    setSafeImagePreview(imgPreview, imgField.value);
  });

  imageUploadInput?.addEventListener('change', async () => {
    const file = imageUploadInput.files?.[0];
    if (!file) return;

    previewLocalFile(imgPreview, file);

    try {
      const url = await uploadMedia(file, 'image');
      if (imgField) imgField.value = url;
    } catch {
      // Handled in uploadMedia
    }
  });

  // Markdown toolbar actions
  document.querySelectorAll('[data-md-action]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const action = (e.currentTarget as HTMLElement).getAttribute('data-md-action');
      if (!bodyInput) return;

      const start = bodyInput.selectionStart;
      const end = bodyInput.selectionEnd;
      const text = bodyInput.value;
      const selected = text.slice(start, end);

      const transforms: Record<string, string> = {
        bold: `**${selected || 'bold text'}**`,
        italic: `*${selected || 'italic text'}*`,
        h2: `\n## ${selected || 'Heading'}\n`,
        h3: `\n### ${selected || 'Subheading'}\n`,
        quote: `\n> ${selected || 'Quote'}\n`,
        link: `[${selected || 'link title'}](https://)`,
        list: `\n- ${selected || 'List item'}\n`,
      };

      if (action && transforms[action]) {
        bodyInput.value = text.slice(0, start) + transforms[action] + text.slice(end);
        updateNewsPreview();
        bodyInput.focus();
      }
    });
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('news-modal-save-btn') as HTMLButtonElement | null;
    if (saveBtn) saveBtn.disabled = true;

    try {
      const payload = {
        title: (document.getElementById('news-form-title') as HTMLInputElement).value,
        slug: (document.getElementById('news-form-slug') as HTMLInputElement).value,
        pubDate: (document.getElementById('news-form-date') as HTMLInputElement).value,
        description: (document.getElementById('news-form-description') as HTMLTextAreaElement).value,
        image: (document.getElementById('news-form-image') as HTMLInputElement).value,
        imageAlt: (document.getElementById('news-form-image-alt') as HTMLInputElement).value,
        mediaType: (document.getElementById('news-form-media-type') as HTMLSelectElement).value,
        mediaEmbedUrl: (document.getElementById('news-form-media-embed') as HTMLInputElement).value,
        mediaPlatform: (document.getElementById('news-form-media-platform') as HTMLSelectElement).value,
        draft: (document.getElementById('news-form-draft') as HTMLInputElement).checked,
        body: (document.getElementById('news-form-body') as HTMLTextAreaElement).value,
        originalSlug: currentOriginalSlug,
      };

      showToast('Saving article to Git...', 'info');

      const res = await fetchWithAuth('/api/admin/news', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to save article.');

      showToast('Article saved successfully.', 'success');
      closeNewsEditor();
      await loadNewsList();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });
}
