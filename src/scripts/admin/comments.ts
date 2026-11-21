import { fetchWithAuth, showToast } from './api';

export interface CommentItem {
  id: string;
  date: string;
  postSlug: string;
  name: string;
  email: string;
  comment: string;
  status: string;
  isArtist: boolean;
}

let activeComments: CommentItem[] = [];
let activeFilter = 'all';

export async function loadCommentsList(): Promise<void> {
  const container = document.getElementById('comments-list-container');
  const countBadge = document.getElementById('comments-count-badge');
  if (!container) return;

  container.innerHTML = `
    <div class="py-12 text-center text-xs font-mono text-surface-subtle animate-pulse">
      Loading comments from Google Sheets...
    </div>
  `;

  try {
    const res = await fetchWithAuth('/api/admin/comments');
    if (!res.ok) throw new Error('Failed to fetch comments');
    const data = await res.json();

    if (!data.configured) {
      container.innerHTML = `
        <div class="py-12 text-center text-sm text-surface-muted space-y-2">
          <p>Google Sheets comments database is not configured.</p>
          <p class="text-xs font-mono text-surface-subtle">Set SPREADSHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in Netlify to enable comments.</p>
        </div>
      `;
      return;
    }

    activeComments = data.comments || [];
    if (countBadge) countBadge.textContent = String(activeComments.length);

    renderComments();
  } catch (err: any) {
    container.innerHTML = `
      <div class="py-8 text-center text-xs font-mono text-red-400">
        Error loading comments: ${err.message}
      </div>
    `;
  }
}

function renderComments(): void {
  const container = document.getElementById('comments-list-container');
  if (!container) return;

  const filtered = activeComments.filter((c) => {
    if (activeFilter === 'all') return true;
    return c.status.toLowerCase() === activeFilter.toLowerCase();
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="py-12 text-center text-sm text-surface-muted">
        No ${activeFilter !== 'all' ? activeFilter : ''} comments found.
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="divide-y divide-white/[0.06]">
      ${filtered
        .map(
          (c) => `
        <div class="py-4 space-y-2 group">
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div class="flex items-center gap-2 flex-wrap">
              <span class="font-sans font-semibold text-sm text-surface-ink">${c.name}</span>
              ${c.isArtist ? `<span class="px-1.5 py-0.5 text-[10px] font-mono uppercase rounded bg-accent/20 text-accent">Artist</span>` : ''}
              ${c.email ? `<a href="mailto:${c.email}" class="text-xs font-mono text-surface-subtle hover:text-surface-muted transition-colors">${c.email}</a>` : ''}
              <span class="text-surface-subtle text-xs">&bull;</span>
              <span class="text-xs font-mono text-surface-subtle">${c.date}</span>
              <span class="text-surface-subtle text-xs">&bull;</span>
              <a href="/news/${c.postSlug}" target="_blank" rel="noopener noreferrer" class="text-xs font-mono text-accent hover:text-accent-hover underline underline-offset-2">
                /${c.postSlug}
              </a>
            </div>

            <div class="flex items-center gap-2 self-start sm:self-auto">
              <span class="inline-flex px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded ${
                c.status.toLowerCase() === 'approved'
                  ? 'bg-emerald-500/15 text-emerald-300 shadow-hairline'
                  : c.status.toLowerCase() === 'rejected'
                  ? 'bg-red-500/15 text-red-300 shadow-hairline'
                  : 'bg-amber-500/15 text-amber-300 shadow-hairline'
              }">
                ${c.status}
              </span>

              ${
                c.status.toLowerCase() !== 'approved'
                  ? `
                <button
                  type="button"
                  data-action="approve-comment"
                  data-id="${c.id}"
                  class="px-2.5 py-1 rounded text-xs font-mono text-emerald-400 hover:bg-emerald-950/30 transition-colors focus-ring"
                >
                  Approve
                </button>
              `
                  : ''
              }

              ${
                c.status.toLowerCase() !== 'rejected'
                  ? `
                <button
                  type="button"
                  data-action="reject-comment"
                  data-id="${c.id}"
                  class="px-2.5 py-1 rounded text-xs font-mono text-amber-400 hover:bg-amber-950/30 transition-colors focus-ring"
                >
                  Reject
                </button>
              `
                  : ''
              }

              <button
                type="button"
                data-action="delete-comment"
                data-id="${c.id}"
                class="px-2 py-1 rounded text-xs font-mono text-red-400 hover:bg-red-950/30 transition-colors focus-ring"
                title="Delete comment"
              >
                Delete
              </button>
            </div>
          </div>

          <div class="text-sm font-sans text-surface-muted leading-relaxed pl-2 border-l border-white/[0.08]">
            ${c.comment}
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  attachCommentListeners();
}

function attachCommentListeners(): void {
  document.querySelectorAll('[data-action="approve-comment"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (id) await updateStatus(id, 'Approved');
    });
  });

  document.querySelectorAll('[data-action="reject-comment"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (id) await updateStatus(id, 'Rejected');
    });
  });

  document.querySelectorAll('[data-action="delete-comment"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      if (!id) return;
      const confirmed = window.confirm('Permanently delete this comment?');
      if (!confirmed) return;

      try {
        const res = await fetchWithAuth(`/api/admin/comments?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete comment');
        showToast('Comment deleted.', 'success');
        await loadCommentsList();
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    });
  });
}

async function updateStatus(id: string, newStatus: string): Promise<void> {
  try {
    const res = await fetchWithAuth('/api/admin/comments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update status');
    showToast(`Comment marked as ${newStatus}.`, 'success');
    await loadCommentsList();
  } catch (err: any) {
    showToast(err.message, 'error');
  }
}

export function setupCommentsEvents(): void {
  document.querySelectorAll('[data-comments-filter]').forEach((tab) => {
    tab.addEventListener('click', (e) => {
      const filter = (e.currentTarget as HTMLElement).getAttribute('data-comments-filter') || 'all';
      activeFilter = filter;

      document.querySelectorAll('[data-comments-filter]').forEach((t) => {
        t.classList.remove('bg-surface-raised', 'text-surface-ink');
        t.classList.add('text-surface-muted');
      });
      (e.currentTarget as HTMLElement).classList.add('bg-surface-raised', 'text-surface-ink');
      (e.currentTarget as HTMLElement).classList.remove('text-surface-muted');

      renderComments();
    });
  });
}
