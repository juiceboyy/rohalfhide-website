import { fetchWithAuth, showToast } from './api';
import { openProducerItemModal, setupProducerModals } from './producer-modals';
import type { ProducerPortfolioData } from './producer-types';

let catalog: ProducerPortfolioData = {
  instagramHighlightsUrl: '',
  hero: { eyebrowLeft: '', eyebrowRight: '', title: '', subtitle: '' },
  studio: { name: '', address: '', city: '', summary: '', approach: '', setupHighlights: [] },
  services: [],
  chapters: [],
  songIdeas: [],
  credits: [],
  testimonials: [],
};

function escapeHtml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function statusChip(isDraft?: boolean): string {
  return `<span class="inline-flex px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded ${
    isDraft ? 'bg-amber-500/15 text-amber-300 shadow-hairline' : 'bg-emerald-500/15 text-emerald-300 shadow-hairline'
  }">${isDraft ? 'Draft' : 'Published'}</span>`;
}

function moveControls(section: string, idx: number, total: number): string {
  return `
    <div class="flex flex-col items-center gap-0.5 shrink-0">
      <button type="button" data-p-move="up" data-section="${section}" data-index="${idx}" ${idx === 0 ? 'disabled' : ''} class="p-1 rounded text-surface-subtle hover:text-surface-ink disabled:opacity-20 disabled:pointer-events-none focus-ring" title="Move up">
        <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>
      </button>
      <button type="button" data-p-move="down" data-section="${section}" data-index="${idx}" ${idx === total - 1 ? 'disabled' : ''} class="p-1 rounded text-surface-subtle hover:text-surface-ink disabled:opacity-20 disabled:pointer-events-none focus-ring" title="Move down">
        <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
      </button>
    </div>
  `;
}

function renderChapters(): void {
  const el = document.getElementById('producer-chapters-container');
  if (!el) return;
  if (catalog.chapters.length === 0) {
    el.innerHTML = `<p class="text-sm text-surface-muted py-4">No chapters yet.</p>`;
    return;
  }
  el.innerHTML = `<div class="divide-y divide-white/[0.06]">${catalog.chapters
    .map(
      (ch, idx) => `
      <div class="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div class="flex items-center gap-3 min-w-0">
          ${moveControls('chapters', idx, catalog.chapters.length)}
          <span class="font-mono text-xs text-accent shrink-0">${escapeHtml(ch.indexLabel)}</span>
          <div class="min-w-0">
            <div class="flex items-center gap-2">
              <span class="font-serif text-base text-surface-ink font-medium">${escapeHtml(ch.title)}</span>
              ${statusChip(ch.draft)}
            </div>
            <p class="font-sans text-xs text-surface-muted line-clamp-1">${escapeHtml(ch.description)}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button type="button" data-p-edit="chapter" data-id="${escapeHtml(ch.id)}" class="px-3 py-1.5 rounded text-xs font-sans font-medium bg-surface-raised hover:bg-white/[0.08] text-surface-ink shadow-hairline focus-ring">Edit</button>
          <button type="button" data-p-delete="chapters" data-id="${escapeHtml(ch.id)}" data-label="${escapeHtml(ch.title)}" class="px-2.5 py-1.5 rounded text-xs font-mono text-red-400/80 hover:text-red-400 hover:bg-red-950/30 focus-ring">Delete</button>
        </div>
      </div>`
    )
    .join('')}</div>`;
}

function renderIdeas(): void {
  const el = document.getElementById('producer-ideas-container');
  if (!el) return;
  if (catalog.songIdeas.length === 0) {
    el.innerHTML = `<p class="text-sm text-surface-muted py-4">No song ideas yet. Add one or run npm run import:producer.</p>`;
    return;
  }
  const chMap = new Map(catalog.chapters.map((c) => [c.id, c.title]));
  el.innerHTML = `<div class="divide-y divide-white/[0.06]">${catalog.songIdeas
    .map(
      (idea, idx) => `
      <div class="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          ${moveControls('songIdeas', idx, catalog.songIdeas.length)}
          <div class="min-w-0 space-y-1">
            <div class="flex flex-wrap items-center gap-2">
              ${statusChip(idea.draft)}
              <span class="font-mono text-[11px] uppercase text-surface-subtle">${idea.mediaType === 'video' ? 'Clip' : 'Audio'}</span>
              <span class="font-mono text-xs text-surface-subtle">${escapeHtml(idea.duration)}</span>
              <span class="font-mono text-[11px] text-accent">${escapeHtml(chMap.get(idea.chapterId) || idea.chapterId)}</span>
            </div>
            <p class="font-serif text-base font-medium text-surface-ink truncate">${escapeHtml(idea.title)}</p>
            <p class="font-sans text-xs text-surface-muted line-clamp-1">${escapeHtml(idea.note)}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <a href="${escapeHtml(idea.src)}" target="_blank" rel="noopener noreferrer" class="px-2.5 py-1.5 rounded text-xs font-mono text-surface-muted hover:text-surface-ink bg-surface-base shadow-hairline focus-ring">Media</a>
          <button type="button" data-p-edit="idea" data-id="${escapeHtml(idea.id)}" class="px-3 py-1.5 rounded text-xs font-sans font-medium bg-surface-raised hover:bg-white/[0.08] text-surface-ink shadow-hairline focus-ring">Edit</button>
          <button type="button" data-p-delete="songIdeas" data-id="${escapeHtml(idea.id)}" data-label="${escapeHtml(idea.title)}" class="px-2.5 py-1.5 rounded text-xs font-mono text-red-400/80 hover:text-red-400 hover:bg-red-950/30 focus-ring">Delete</button>
        </div>
      </div>`
    )
    .join('')}</div>`;
}

function renderCredits(): void {
  const el = document.getElementById('producer-credits-container');
  if (!el) return;
  if (catalog.credits.length === 0) {
    el.innerHTML = `<p class="text-sm text-surface-muted py-4">No credits yet.</p>`;
    return;
  }
  el.innerHTML = `<div class="divide-y divide-white/[0.06]">${catalog.credits
    .map(
      (cr, idx) => `
      <div class="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-center gap-3 min-w-0">
          ${moveControls('credits', idx, catalog.credits.length)}
          <img src="${escapeHtml(cr.cover || '/images/hero-portrait.jpg')}" alt="${escapeHtml(cr.title)}" class="w-12 h-12 rounded-lg object-cover bg-surface-base shadow-hairline shrink-0" />
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              ${statusChip(cr.draft)}
              <span class="font-mono text-xs text-surface-subtle">${escapeHtml(cr.year)} / ${escapeHtml(cr.role)}</span>
            </div>
            <p class="font-serif text-base font-medium text-surface-ink truncate">${escapeHtml(cr.artist)} - ${escapeHtml(cr.title)}</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button type="button" data-p-edit="credit" data-id="${escapeHtml(cr.id)}" class="px-3 py-1.5 rounded text-xs font-sans font-medium bg-surface-raised hover:bg-white/[0.08] text-surface-ink shadow-hairline focus-ring">Edit</button>
          <button type="button" data-p-delete="credits" data-id="${escapeHtml(cr.id)}" data-label="${escapeHtml(cr.title)}" class="px-2.5 py-1.5 rounded text-xs font-mono text-red-400/80 hover:text-red-400 hover:bg-red-950/30 focus-ring">Delete</button>
        </div>
      </div>`
    )
    .join('')}</div>`;
}

function renderTestimonials(): void {
  const el = document.getElementById('producer-testimonials-container');
  if (!el) return;
  if (catalog.testimonials.length === 0) {
    el.innerHTML = `<p class="text-sm text-surface-muted py-4">No testimonials yet.</p>`;
    return;
  }
  el.innerHTML = `<div class="divide-y divide-white/[0.06]">${catalog.testimonials
    .map(
      (ts, idx) => `
      <div class="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div class="flex items-start gap-3 min-w-0">
          ${moveControls('testimonials', idx, catalog.testimonials.length)}
          <div class="min-w-0 space-y-1">
            <div class="flex items-center gap-2">
              ${statusChip(ts.draft)}
              <span class="font-mono text-xs text-surface-subtle">${escapeHtml(ts.author)} / ${escapeHtml(ts.roleOrProject)}</span>
            </div>
            <p class="font-sans text-xs text-surface-muted line-clamp-2">"${escapeHtml(ts.quote)}"</p>
          </div>
        </div>
        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <button type="button" data-p-edit="testimonial" data-id="${escapeHtml(ts.id)}" class="px-3 py-1.5 rounded text-xs font-sans font-medium bg-surface-raised hover:bg-white/[0.08] text-surface-ink shadow-hairline focus-ring">Edit</button>
          <button type="button" data-p-delete="testimonials" data-id="${escapeHtml(ts.id)}" data-label="${escapeHtml(ts.author)}" class="px-2.5 py-1.5 rounded text-xs font-mono text-red-400/80 hover:text-red-400 hover:bg-red-950/30 focus-ring">Delete</button>
        </div>
      </div>`
    )
    .join('')}</div>`;
}

function bindProducerListListeners(): void {
  document.querySelectorAll('[data-p-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const kind = el.getAttribute('data-p-edit') as 'chapter' | 'idea' | 'credit' | 'testimonial';
      const id = el.getAttribute('data-id');
      if (kind === 'chapter') openProducerItemModal('chapter', catalog.chapters.find((c) => c.id === id) || null);
      if (kind === 'idea') openProducerItemModal('idea', catalog.songIdeas.find((i) => i.id === id) || null);
      if (kind === 'credit') openProducerItemModal('credit', catalog.credits.find((c) => c.id === id) || null);
      if (kind === 'testimonial') openProducerItemModal('testimonial', catalog.testimonials.find((t) => t.id === id) || null);
    });
  });

  document.querySelectorAll('[data-p-delete]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const el = e.currentTarget as HTMLElement;
      const section = el.getAttribute('data-p-delete');
      const id = el.getAttribute('data-id');
      const label = el.getAttribute('data-label') || id;
      if (!section || !id || !window.confirm(`Delete "${label}"?`)) return;
      try {
        const res = await fetchWithAuth(`/api/admin/producer?section=${encodeURIComponent(section)}&id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to delete entry.');
        showToast('Entry deleted.', 'success');
        await loadProducerData();
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    });
  });

  document.querySelectorAll('[data-p-move]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const el = e.currentTarget as HTMLElement;
      const dir = el.getAttribute('data-p-move');
      const section = el.getAttribute('data-section') as 'chapters' | 'songIdeas' | 'credits' | 'testimonials';
      const idx = Number(el.getAttribute('data-index'));
      const list = catalog[section] as unknown[];
      const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
      if (!Array.isArray(list) || targetIdx < 0 || targetIdx >= list.length) return;
      const next = [...list];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      (catalog[section] as unknown[]) = next;
      renderAll();
      try {
        const res = await fetchWithAuth('/api/admin/producer', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ section, items: next }),
        });
        if (!res.ok) throw new Error('Failed to save order');
        showToast('Order updated.', 'success');
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    });
  });
}

function renderAll(): void {
  renderChapters();
  renderIdeas();
  renderCredits();
  renderTestimonials();
  bindProducerListListeners();
}

export async function loadProducerData(): Promise<void> {
  const badge = document.getElementById('producer-count-badge');
  try {
    const res = await fetchWithAuth('/api/admin/producer');
    if (!res.ok) throw new Error('Failed to load producer portfolio');
    const json = await res.json();
    if (json.data) catalog = json.data;
    if (badge) badge.textContent = String(catalog.songIdeas.length);
    renderAll();
  } catch (err: any) {
    showToast(err.message || 'Error loading producer data', 'error');
  }
}

export function setupProducerEvents(): void {
  setupProducerModals(() => catalog, loadProducerData);

  const subTabs = document.querySelectorAll<HTMLButtonElement>('[data-producer-subtab]');
  subTabs.forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-producer-subtab');
      ['ideas', 'credits', 'testimonials'].forEach((name) => {
        document.getElementById(`producer-subview-${name}`)?.classList.toggle('hidden', name !== target);
      });
      subTabs.forEach((b) => {
        const active = b === btn;
        b.classList.toggle('bg-surface-raised', active);
        b.classList.toggle('text-surface-ink', active);
        b.classList.toggle('text-surface-muted', !active);
      });
    });
  });
}
