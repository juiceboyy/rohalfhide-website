export async function initCommentCounts() {
  const elements = document.querySelectorAll<HTMLElement>('[data-comment-count-for]');
  if (elements.length === 0) return;

  try {
    const res = await fetch('/api/comments?counts=true', {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return;

    const data = await res.json();
    const counts: Record<string, number> = data.counts || {};

    elements.forEach((el) => {
      const slug = (el.dataset.commentCountFor || '').trim().toLowerCase();
      const count = counts[slug] || 0;

      if (count > 0) {
        const textEl = el.querySelector('[data-comment-count-text]');
        if (textEl) {
          textEl.textContent = count === 1 ? '1 comment' : `${count} comments`;
        } else {
          el.textContent = count === 1 ? '1 comment' : `${count} comments`;
        }
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    });
  } catch (err) {
    // Graceful degradation: elements remain hidden if request fails
    console.debug('Comment counts unavailable:', err);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCommentCounts);
} else {
  initCommentCounts();
}
