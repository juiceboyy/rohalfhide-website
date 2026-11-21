import { fetchWithAuth, showToast } from './api';
import type { MusicTrack } from './music-types';
import { openTrackEditor, setupTrackModalEvents } from './music-modal';

export type { MusicTrack } from './music-types';

let activeTracks: MusicTrack[] = [];
let currentPreviewAudio: HTMLAudioElement | null = null;
let currentPreviewId: string | null = null;

export async function loadMusicList(): Promise<void> {
  const container = document.getElementById('music-list-container');
  const countBadge = document.getElementById('music-count-badge');
  if (!container) return;

  container.innerHTML = `
    <div class="py-12 text-center text-xs font-mono text-surface-subtle animate-pulse">
      Loading music tracks...
    </div>
  `;

  try {
    const res = await fetchWithAuth('/api/admin/music');
    if (!res.ok) throw new Error('Failed to fetch tracks');
    const data = await res.json();
    activeTracks = data.tracks || [];

    if (countBadge) countBadge.textContent = String(activeTracks.length);

    if (activeTracks.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-sm text-surface-muted">
          No tracks found in playlist. Click "Add Track" to upload your first song.
        </div>
      `;
      return;
    }

    renderTracksTable();
  } catch (err: any) {
    container.innerHTML = `
      <div class="py-8 text-center text-xs font-mono text-red-400">
        Error loading tracks: ${err.message}
      </div>
    `;
  }
}

function renderTracksTable(): void {
  const container = document.getElementById('music-list-container');
  if (!container) return;

  container.innerHTML = `
    <div class="divide-y divide-white/[0.06]">
      ${activeTracks
        .map(
          (track, idx) => `
        <div class="py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group">
          <div class="flex items-center gap-4">
            <div class="flex flex-col items-center gap-1 shrink-0">
              <button
                type="button"
                data-action="move-track-up"
                data-index="${idx}"
                ${idx === 0 ? 'disabled' : ''}
                class="p-1 rounded text-surface-subtle hover:text-surface-ink disabled:opacity-20 disabled:pointer-events-none transition-colors focus-ring"
                title="Move track up"
              >
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M7 14l5-5 5 5z"/></svg>
              </button>
              <span class="font-mono text-xs text-surface-subtle w-5 text-center">
                ${String(idx + 1).padStart(2, '0')}
              </span>
              <button
                type="button"
                data-action="move-track-down"
                data-index="${idx}"
                ${idx === activeTracks.length - 1 ? 'disabled' : ''}
                class="p-1 rounded text-surface-subtle hover:text-surface-ink disabled:opacity-20 disabled:pointer-events-none transition-colors focus-ring"
                title="Move track down"
              >
                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M7 10l5 5 5-5z"/></svg>
              </button>
            </div>

            <img
              src="${track.cover || '/images/hero-portrait.jpg'}"
              alt="${track.title}"
              class="w-14 h-14 rounded-lg object-cover bg-surface-base shadow-hairline shrink-0"
            />

            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span class="inline-flex px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider rounded ${
                  track.draft
                    ? 'bg-amber-500/15 text-amber-300 shadow-hairline'
                    : 'bg-emerald-500/15 text-emerald-300 shadow-hairline'
                }">
                  ${track.draft ? 'Draft' : 'Published'}
                </span>
                <span class="text-xs font-mono text-surface-subtle">${track.duration}</span>
                ${track.releaseDate ? `<span class="text-xs font-mono text-surface-subtle">${track.releaseDate}</span>` : ''}
              </div>
              <h3 class="font-serif text-base font-semibold text-surface-ink leading-snug">
                ${track.title}
              </h3>
              <p class="font-sans text-xs text-surface-muted">
                ${track.artist || 'Ro Halfhide'}
              </p>
            </div>
          </div>

          <div class="flex items-center gap-2 self-end sm:self-center shrink-0">
            <button
              type="button"
              data-action="preview-audio"
              data-id="${track.id}"
              data-src="${track.src}"
              class="px-3 py-1.5 rounded text-xs font-sans font-medium text-surface-ink bg-surface-base hover:bg-white/[0.08] shadow-hairline transition-colors flex items-center gap-1.5 focus-ring"
            >
              <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              <span>Play</span>
            </button>

            <button
              type="button"
              data-action="edit-track"
              data-id="${track.id}"
              class="px-3 py-1.5 rounded text-xs font-sans font-medium text-surface-ink bg-surface-raised hover:bg-white/[0.08] shadow-hairline transition-colors focus-ring"
            >
              Edit
            </button>

            <button
              type="button"
              data-action="delete-track"
              data-id="${track.id}"
              data-title="${track.title}"
              class="px-2.5 py-1.5 rounded text-xs font-mono text-red-400/80 hover:text-red-400 hover:bg-red-950/30 transition-colors focus-ring"
            >
              Delete
            </button>
          </div>
        </div>
      `
        )
        .join('')}
    </div>
  `;

  attachMusicRowListeners();
}

function attachMusicRowListeners(): void {
  document.querySelectorAll('[data-action="move-track-up"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
      if (idx > 0) {
        const temp = activeTracks[idx];
        activeTracks[idx] = activeTracks[idx - 1];
        activeTracks[idx - 1] = temp;
        renderTracksTable();
        await saveTrackOrder();
      }
    });
  });

  document.querySelectorAll('[data-action="move-track-down"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const idx = Number((e.currentTarget as HTMLElement).getAttribute('data-index'));
      if (idx < activeTracks.length - 1) {
        const temp = activeTracks[idx];
        activeTracks[idx] = activeTracks[idx + 1];
        activeTracks[idx + 1] = temp;
        renderTracksTable();
        await saveTrackOrder();
      }
    });
  });

  document.querySelectorAll('[data-action="preview-audio"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const el = e.currentTarget as HTMLElement;
      const id = el.getAttribute('data-id');
      const src = el.getAttribute('data-src');
      if (!src) return;

      if (currentPreviewId === id && currentPreviewAudio && !currentPreviewAudio.paused) {
        currentPreviewAudio.pause();
        el.querySelector('span')!.textContent = 'Play';
        currentPreviewId = null;
        return;
      }

      if (currentPreviewAudio) {
        currentPreviewAudio.pause();
        document.querySelectorAll('[data-action="preview-audio"] span').forEach((s) => (s.textContent = 'Play'));
      }

      currentPreviewAudio = new Audio(src);
      currentPreviewId = id;
      el.querySelector('span')!.textContent = 'Stop';
      currentPreviewAudio.play();

      currentPreviewAudio.onended = () => {
        el.querySelector('span')!.textContent = 'Play';
        currentPreviewId = null;
      };
    });
  });

  document.querySelectorAll('[data-action="edit-track"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const id = (e.currentTarget as HTMLElement).getAttribute('data-id');
      const track = activeTracks.find((t) => t.id === id);
      if (track) openTrackEditor(track);
    });
  });

  document.querySelectorAll('[data-action="delete-track"]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const el = e.currentTarget as HTMLElement;
      const id = el.getAttribute('data-id');
      const title = el.getAttribute('data-title');
      if (!id) return;

      const confirmed = window.confirm(`Remove track "${title}" from the playlist?`);
      if (!confirmed) return;

      try {
        const res = await fetchWithAuth(`/api/admin/music?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to delete track');
        showToast('Track removed from playlist.', 'success');
        await loadMusicList();
      } catch (err: any) {
        showToast(err.message, 'error');
      }
    });
  });
}

async function saveTrackOrder(): Promise<void> {
  try {
    const res = await fetchWithAuth('/api/admin/music', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tracks: activeTracks }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update track order');
    showToast('Playlist order updated.', 'success');
  } catch (err: any) {
    showToast(err.message, 'error');
  }
}

export function setupMusicEvents(): void {
  setupTrackModalEvents(loadMusicList);
}
