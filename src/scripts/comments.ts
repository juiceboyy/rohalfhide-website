interface CommentItem {
  id: string;
  date: string;
  postSlug: string;
  name: string;
  comment: string;
  isArtist?: boolean;
}

function formatDate(isoOrDateStr: string): string {
  try {
    const d = new Date(isoOrDateStr.replace(' ', 'T'));
    if (isNaN(d.getTime())) return isoOrDateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return isoOrDateStr;
  }
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderCommentCard(item: CommentItem): string {
  const safeName = escapeHtml(item.name || 'Anonymous');
  const safeComment = escapeHtml(item.comment || '').replace(/\n/g, '<br />');
  const formattedDate = formatDate(item.date);

  const artistBadge = item.isArtist
    ? `<span class="inline-flex items-center px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-accent border border-accent/40 rounded bg-accent/5">Artist</span>`
    : '';

  const artistBorder = item.isArtist ? 'border-l-2 border-accent pl-4 sm:pl-6' : '';

  return `
    <article id="${item.id}" class="group py-6 first:pt-0 last:pb-0 shadow-divider-b last:shadow-none space-y-3 ${artistBorder}">
      <header class="flex items-center justify-between gap-4">
        <div class="flex items-center gap-2.5 flex-wrap">
          <span class="font-mono text-xs uppercase tracking-[0.16em] text-surface-ink font-medium">
            ${safeName}
          </span>
          ${artistBadge}
        </div>
        <time datetime="${item.date}" class="font-mono text-[11px] uppercase tracking-wider text-surface-subtle shrink-0">
          ${formattedDate}
        </time>
      </header>
      <div class="font-sans text-sm sm:text-base text-surface-ink/90 leading-relaxed break-words">
        ${safeComment}
      </div>
    </article>
  `;
}

export function initComments() {
  const root = document.getElementById('comments-root');
  if (!root) return;

  const slug = root.dataset.slug;
  const postTitle = root.dataset.postTitle || slug || '';
  if (!slug) return;

  const countEl = document.getElementById('comments-count');
  const listEl = document.getElementById('comments-list');
  const loadingEl = document.getElementById('comments-loading');
  const emptyEl = document.getElementById('comments-empty');
  const form = document.getElementById('comment-form') as HTMLFormElement | null;
  const submitBtn = document.getElementById('comment-submit') as HTMLButtonElement | null;
  const statusEl = document.getElementById('comment-status');
  const renderedAtInput = document.getElementById('comment-rendered-at') as HTMLInputElement | null;

  if (renderedAtInput) {
    renderedAtInput.value = String(Date.now());
  }

  const updateCount = (count: number) => {
    if (!countEl) return;
    countEl.textContent = count > 0 ? `(${count})` : '(0)';
  };

  // Fetch comments
  const fetchComments = async () => {
    try {
      const res = await fetch(`/api/comments?slug=${encodeURIComponent(slug)}`, {
        headers: { Accept: 'application/json' },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const comments: CommentItem[] = Array.isArray(data.comments) ? data.comments : [];

      if (loadingEl) loadingEl.classList.add('hidden');

      if (comments.length === 0) {
        if (emptyEl) emptyEl.classList.remove('hidden');
        if (listEl) listEl.innerHTML = '';
        updateCount(0);
        return;
      }

      if (emptyEl) emptyEl.classList.add('hidden');
      if (listEl) {
        listEl.innerHTML = comments.map(renderCommentCard).join('');
      }
      updateCount(comments.length);
    } catch (err) {
      console.warn('Could not load comments:', err);
      if (loadingEl) loadingEl.classList.add('hidden');
      if (emptyEl) {
        emptyEl.textContent = 'Comments are currently unavailable.';
        emptyEl.classList.remove('hidden');
      }
    }
  };

  fetchComments();

  // Form submit handler
  if (!form || !submitBtn) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const nameInput = form.elements.namedItem('name') as HTMLInputElement | null;
    const emailInput = form.elements.namedItem('email') as HTMLInputElement | null;
    const commentInput = form.elements.namedItem('comment') as HTMLTextAreaElement | null;
    const botFieldInput = form.elements.namedItem('bot-field') as HTMLInputElement | null;

    const name = nameInput?.value.trim() || '';
    const email = emailInput?.value.trim() || '';
    const comment = commentInput?.value.trim() || '';
    const botField = botFieldInput?.value.trim() || '';
    const renderedAt = renderedAtInput?.value || String(Date.now());

    if (!name || !comment) return;

    const originalText = submitBtn.textContent || 'Post Comment';
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    if (statusEl) {
      statusEl.classList.add('hidden');
      statusEl.textContent = '';
      statusEl.className = 'font-mono text-xs pt-1 hidden';
    }

    try {
      const res = await fetch('/api/comments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          slug,
          postTitle,
          name,
          email,
          comment,
          'bot-field': botField,
          renderedAt,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Failed to post comment.');
      }

      // Optimistically insert newly created comment
      if (data.comment) {
        const newCardHtml = renderCommentCard(data.comment);
        if (listEl) {
          listEl.insertAdjacentHTML('beforeend', newCardHtml);
        }
        if (emptyEl) {
          emptyEl.classList.add('hidden');
        }

        const currentCount = listEl ? listEl.children.length : 1;
        updateCount(currentCount);

        // Smooth scroll to the comment
        const newEl = document.getElementById(data.comment.id);
        if (newEl) {
          newEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }

      form.reset();
      if (renderedAtInput) {
        renderedAtInput.value = String(Date.now());
      }

      if (statusEl) {
        statusEl.textContent = 'Your comment has been posted.';
        statusEl.className = 'font-mono text-xs text-accent pt-1';
        statusEl.classList.remove('hidden');
      }
    } catch (err: any) {
      if (statusEl) {
        statusEl.textContent = err.message || 'Unable to post comment. Please try again.';
        statusEl.className = 'font-mono text-xs text-red-400 pt-1';
        statusEl.classList.remove('hidden');
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalText;
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initComments);
} else {
  initComments();
}
