import { fetchWithAuth, showToast, uploadMedia } from './api';
import type { MusicTrack } from './music-types';

export function formatSecondsToDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export async function detectAudioDuration(file: File): Promise<string> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const dur = formatSecondsToDuration(audio.duration);
      URL.revokeObjectURL(url);
      resolve(dur);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      resolve('0:00');
    };
    audio.src = url;
  });
}

export function openTrackEditor(track: MusicTrack | null = null): void {
  const modal = document.getElementById('track-editor-modal');
  const modalTitle = document.getElementById('track-modal-title');
  const form = document.getElementById('track-form') as HTMLFormElement | null;
  if (!modal || !form) return;

  form.reset();

  if (track) {
    if (modalTitle) modalTitle.textContent = 'Edit Track';
    (document.getElementById('track-form-id') as HTMLInputElement).value = track.id;
    (document.getElementById('track-form-title') as HTMLInputElement).value = track.title;
    (document.getElementById('track-form-artist') as HTMLInputElement).value = track.artist || 'Ro Halfhide';
    (document.getElementById('track-form-src') as HTMLInputElement).value = track.src;
    (document.getElementById('track-form-duration') as HTMLInputElement).value = track.duration;
    (document.getElementById('track-form-cover') as HTMLInputElement).value = track.cover;
    (document.getElementById('track-form-date') as HTMLInputElement).value = track.releaseDate || '';
    (document.getElementById('track-form-draft') as HTMLInputElement).checked = Boolean(track.draft);
    (document.getElementById('track-form-spotify') as HTMLInputElement).value = track.links?.spotify || '';
    (document.getElementById('track-form-bandcamp') as HTMLInputElement).value = track.links?.bandcamp || '';
    (document.getElementById('track-form-apple') as HTMLInputElement).value = track.links?.appleMusic || '';

    const imgPreview = document.getElementById('track-cover-preview') as HTMLImageElement | null;
    if (imgPreview && track.cover) {
      imgPreview.src = track.cover;
      imgPreview.classList.remove('hidden');
    }
  } else {
    if (modalTitle) modalTitle.textContent = 'Add Track';
    (document.getElementById('track-form-id') as HTMLInputElement).value = '';
    (document.getElementById('track-form-artist') as HTMLInputElement).value = 'Ro Halfhide';
    (document.getElementById('track-form-date') as HTMLInputElement).value = new Date().toISOString().split('T')[0];
    const imgPreview = document.getElementById('track-cover-preview') as HTMLImageElement | null;
    if (imgPreview) imgPreview.classList.add('hidden');
  }

  modal.classList.remove('hidden');
}

export function closeTrackEditor(): void {
  const modal = document.getElementById('track-editor-modal');
  if (modal) modal.classList.add('hidden');
}

export function setupTrackModalEvents(onSaveSuccess: () => Promise<void>): void {
  const addBtn = document.getElementById('admin-add-track-btn');
  const closeBtn = document.getElementById('track-modal-close-btn');
  const cancelBtn = document.getElementById('track-modal-cancel-btn');
  const audioUploadInput = document.getElementById('track-audio-upload') as HTMLInputElement | null;
  const coverUploadInput = document.getElementById('track-cover-upload') as HTMLInputElement | null;
  const form = document.getElementById('track-form') as HTMLFormElement | null;

  addBtn?.addEventListener('click', () => openTrackEditor(null));
  closeBtn?.addEventListener('click', closeTrackEditor);
  cancelBtn?.addEventListener('click', closeTrackEditor);

  audioUploadInput?.addEventListener('change', async () => {
    const file = audioUploadInput.files?.[0];
    if (!file) return;

    showToast('Detecting duration & uploading MP3...', 'info');
    try {
      const dur = await detectAudioDuration(file);
      const durField = document.getElementById('track-form-duration') as HTMLInputElement | null;
      if (durField && dur !== '0:00') durField.value = dur;

      const audioUrl = await uploadMedia(file, 'audio');
      const srcField = document.getElementById('track-form-src') as HTMLInputElement | null;
      if (srcField) srcField.value = audioUrl;
    } catch {
      // Handled in uploadMedia
    }
  });

  coverUploadInput?.addEventListener('change', async () => {
    const file = coverUploadInput.files?.[0];
    if (!file) return;

    try {
      const imgUrl = await uploadMedia(file, 'image');
      const coverField = document.getElementById('track-form-cover') as HTMLInputElement | null;
      const imgPreview = document.getElementById('track-cover-preview') as HTMLImageElement | null;
      if (coverField) coverField.value = imgUrl;
      if (imgPreview) {
        imgPreview.src = imgUrl;
        imgPreview.classList.remove('hidden');
      }
    } catch {
      // Handled in uploadMedia
    }
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('track-modal-save-btn') as HTMLButtonElement | null;
    if (saveBtn) saveBtn.disabled = true;

    try {
      const payload = {
        id: (document.getElementById('track-form-id') as HTMLInputElement).value,
        title: (document.getElementById('track-form-title') as HTMLInputElement).value,
        artist: (document.getElementById('track-form-artist') as HTMLInputElement).value,
        src: (document.getElementById('track-form-src') as HTMLInputElement).value,
        duration: (document.getElementById('track-form-duration') as HTMLInputElement).value,
        cover: (document.getElementById('track-form-cover') as HTMLInputElement).value,
        releaseDate: (document.getElementById('track-form-date') as HTMLInputElement).value,
        draft: (document.getElementById('track-form-draft') as HTMLInputElement).checked,
        links: {
          spotify: (document.getElementById('track-form-spotify') as HTMLInputElement).value,
          bandcamp: (document.getElementById('track-form-bandcamp') as HTMLInputElement).value,
          appleMusic: (document.getElementById('track-form-apple') as HTMLInputElement).value,
        },
      };

      showToast('Saving track to playlist...', 'info');

      const res = await fetchWithAuth('/api/admin/music', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to save track');

      showToast('Track saved successfully.', 'success');
      closeTrackEditor();
      await onSaveSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });
}
