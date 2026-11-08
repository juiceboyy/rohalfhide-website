import { fetchWithAuth, showToast, uploadMedia } from './api';
import { detectAudioDuration, detectVideoMetadata } from './audio-utils';
import { previewLocalFile, setSafeImagePreview } from './media-preview';
import { installClosedByFallback, setupProducerSettingsModal } from './producer-settings-modal';
import type {
  ProducerChapter,
  ProducerPortfolioData,
  ProducerTestimonial,
  ProductionCredit,
  SongIdea,
} from './producer-types';

type ItemKind = 'chapter' | 'idea' | 'credit' | 'testimonial';

let getCatalogRef: () => ProducerPortfolioData = () => ({
  instagramHighlightsUrl: '',
  hero: { eyebrowLeft: '', eyebrowRight: '', title: '', subtitle: '' },
  studio: { name: '', address: '', city: '', summary: '', approach: '', setupHighlights: [] },
  services: [],
  chapters: [],
  songIdeas: [],
  credits: [],
  testimonials: [],
});

function showKindFields(kind: ItemKind): void {
  (['chapter', 'idea', 'credit', 'testimonial'] as ItemKind[]).forEach((k) => {
    document.getElementById(`pe-fields-${k}`)?.classList.toggle('hidden', k !== kind);
  });
}

function populateChapterOptions(selectedId?: string): void {
  const select = document.getElementById('pe-idea-chapter') as HTMLSelectElement | null;
  if (!select) return;
  select.innerHTML = '';
  getCatalogRef().chapters.forEach((ch) => {
    const opt = document.createElement('option');
    opt.value = ch.id;
    opt.textContent = `${ch.indexLabel} / ${ch.title}`;
    if (selectedId && ch.id === selectedId) opt.selected = true;
    select.appendChild(opt);
  });
}

export function openProducerItemModal(
  kind: ItemKind,
  item: ProducerChapter | SongIdea | ProductionCredit | ProducerTestimonial | null = null
): void {
  const dialog = document.getElementById('producer-editor-dialog') as HTMLDialogElement | null;
  const form = document.getElementById('producer-item-form') as HTMLFormElement | null;
  const titleEl = document.getElementById('producer-modal-title');
  if (!dialog || !form) return;

  form.reset();
  (document.getElementById('pe-kind') as HTMLInputElement).value = kind;
  (document.getElementById('pe-id') as HTMLInputElement).value = item?.id || '';
  (document.getElementById('pe-draft') as HTMLInputElement).checked = Boolean(item?.draft);
  showKindFields(kind);

  const labels: Record<ItemKind, string> = {
    chapter: item ? 'Edit Chapter' : 'New Chapter',
    idea: item ? 'Edit Song Idea' : 'Add Song Idea',
    credit: item ? 'Edit Production Credit' : 'Add Production Credit',
    testimonial: item ? 'Edit Testimonial' : 'Add Testimonial',
  };
  if (titleEl) titleEl.textContent = labels[kind];

  if (kind === 'chapter') {
    const ch = item as ProducerChapter | null;
    (document.getElementById('pe-ch-index') as HTMLInputElement).value =
      ch?.indexLabel || String(getCatalogRef().chapters.length + 1).padStart(2, '0');
    (document.getElementById('pe-ch-title') as HTMLInputElement).value = ch?.title || '';
    (document.getElementById('pe-ch-desc') as HTMLTextAreaElement).value = ch?.description || '';
  } else if (kind === 'idea') {
    const idea = item as SongIdea | null;
    populateChapterOptions(idea?.chapterId);
    (document.getElementById('pe-idea-title') as HTMLInputElement).value = idea?.title || '';
    (document.getElementById('pe-idea-type') as HTMLSelectElement).value = idea?.mediaType || 'audio';
    (document.getElementById('pe-idea-duration') as HTMLInputElement).value = idea?.duration || '0:30';
    (document.getElementById('pe-idea-aspect') as HTMLSelectElement).value = idea?.aspectRatio || '9:16';
    (document.getElementById('pe-idea-width') as HTMLInputElement).value = String(idea?.width || 360);
    (document.getElementById('pe-idea-height') as HTMLInputElement).value = String(idea?.height || 640);
    (document.getElementById('pe-idea-src') as HTMLInputElement).value = idea?.src || '';
    const coverVal = idea?.poster || idea?.cover || '';
    (document.getElementById('pe-idea-cover') as HTMLInputElement).value = coverVal;
    (document.getElementById('pe-idea-note') as HTMLTextAreaElement).value = idea?.note || '';
    (document.getElementById('pe-idea-year') as HTMLInputElement).value = idea?.year || String(new Date().getFullYear());
    (document.getElementById('pe-idea-ig') as HTMLInputElement).value =
      idea?.instagramUrl || getCatalogRef().instagramHighlightsUrl;
    setSafeImagePreview(document.getElementById('pe-idea-cover-preview') as HTMLImageElement | null, coverVal);
  } else if (kind === 'credit') {
    const cr = item as ProductionCredit | null;
    (document.getElementById('pe-cr-artist') as HTMLInputElement).value = cr?.artist || '';
    (document.getElementById('pe-cr-title') as HTMLInputElement).value = cr?.title || '';
    (document.getElementById('pe-cr-role') as HTMLInputElement).value = cr?.role || 'Producer';
    (document.getElementById('pe-cr-year') as HTMLInputElement).value = cr?.year || String(new Date().getFullYear());
    (document.getElementById('pe-cr-cover') as HTMLInputElement).value = cr?.cover || '';
    (document.getElementById('pe-cr-audio') as HTMLInputElement).value = cr?.audioPreview || '';
    (document.getElementById('pe-cr-url') as HTMLInputElement).value = cr?.externalUrl || '';
    (document.getElementById('pe-cr-notes') as HTMLTextAreaElement).value = cr?.notes || '';
    setSafeImagePreview(document.getElementById('pe-cr-cover-preview') as HTMLImageElement | null, cr?.cover || '');
  } else {
    const ts = item as ProducerTestimonial | null;
    (document.getElementById('pe-ts-quote') as HTMLTextAreaElement).value = ts?.quote || '';
    (document.getElementById('pe-ts-author') as HTMLInputElement).value = ts?.author || '';
    (document.getElementById('pe-ts-role') as HTMLInputElement).value = ts?.roleOrProject || '';
  }

  dialog.showModal();
}

function buildItemPayload(kind: ItemKind): { action: string; payload: Record<string, unknown> } {
  const id = (document.getElementById('pe-id') as HTMLInputElement).value.trim();
  const draft = (document.getElementById('pe-draft') as HTMLInputElement).checked;

  if (kind === 'chapter') {
    return {
      action: 'upsert-chapter',
      payload: {
        id: id || undefined,
        indexLabel: (document.getElementById('pe-ch-index') as HTMLInputElement).value,
        title: (document.getElementById('pe-ch-title') as HTMLInputElement).value,
        description: (document.getElementById('pe-ch-desc') as HTMLTextAreaElement).value,
        draft,
      },
    };
  }
  if (kind === 'idea') {
    const mediaType = (document.getElementById('pe-idea-type') as HTMLSelectElement).value as 'audio' | 'video';
    const cover = (document.getElementById('pe-idea-cover') as HTMLInputElement).value;
    return {
      action: 'upsert-idea',
      payload: {
        id: id || undefined,
        chapterId: (document.getElementById('pe-idea-chapter') as HTMLSelectElement).value,
        title: (document.getElementById('pe-idea-title') as HTMLInputElement).value,
        mediaType,
        src: (document.getElementById('pe-idea-src') as HTMLInputElement).value,
        poster: mediaType === 'video' ? cover : '',
        cover,
        duration: (document.getElementById('pe-idea-duration') as HTMLInputElement).value,
        aspectRatio: (document.getElementById('pe-idea-aspect') as HTMLSelectElement).value,
        width: Number((document.getElementById('pe-idea-width') as HTMLInputElement).value) || undefined,
        height: Number((document.getElementById('pe-idea-height') as HTMLInputElement).value) || undefined,
        note: (document.getElementById('pe-idea-note') as HTMLTextAreaElement).value,
        year: (document.getElementById('pe-idea-year') as HTMLInputElement).value,
        instagramUrl: (document.getElementById('pe-idea-ig') as HTMLInputElement).value,
        draft,
      },
    };
  }
  if (kind === 'credit') {
    return {
      action: 'upsert-credit',
      payload: {
        id: id || undefined,
        artist: (document.getElementById('pe-cr-artist') as HTMLInputElement).value,
        title: (document.getElementById('pe-cr-title') as HTMLInputElement).value,
        role: (document.getElementById('pe-cr-role') as HTMLInputElement).value,
        year: (document.getElementById('pe-cr-year') as HTMLInputElement).value,
        cover: (document.getElementById('pe-cr-cover') as HTMLInputElement).value,
        audioPreview: (document.getElementById('pe-cr-audio') as HTMLInputElement).value,
        externalUrl: (document.getElementById('pe-cr-url') as HTMLInputElement).value,
        notes: (document.getElementById('pe-cr-notes') as HTMLTextAreaElement).value,
        draft,
      },
    };
  }
  return {
    action: 'upsert-testimonial',
    payload: {
      id: id || undefined,
      quote: (document.getElementById('pe-ts-quote') as HTMLTextAreaElement).value,
      author: (document.getElementById('pe-ts-author') as HTMLInputElement).value,
      roleOrProject: (document.getElementById('pe-ts-role') as HTMLInputElement).value,
      draft,
    },
  };
}

export function setupProducerModals(
  getCatalog: () => ProducerPortfolioData,
  onSaveSuccess: () => Promise<void>
): void {
  getCatalogRef = getCatalog;
  setupProducerSettingsModal(getCatalog, onSaveSuccess);

  const itemDialog = document.getElementById('producer-editor-dialog') as HTMLDialogElement | null;
  installClosedByFallback(itemDialog);
  itemDialog?.addEventListener('close', () => {
    itemDialog.returnValue = '';
  });

  document.getElementById('producer-modal-close-btn')?.addEventListener('click', () => itemDialog?.close());
  document.getElementById('producer-modal-cancel-btn')?.addEventListener('click', () => itemDialog?.close());

  document.getElementById('admin-add-chapter-btn')?.addEventListener('click', () => openProducerItemModal('chapter', null));
  document.getElementById('admin-add-idea-btn')?.addEventListener('click', () => openProducerItemModal('idea', null));
  document.getElementById('admin-add-credit-btn')?.addEventListener('click', () => openProducerItemModal('credit', null));
  document.getElementById('admin-add-testimonial-btn')?.addEventListener('click', () => openProducerItemModal('testimonial', null));

  const ideaMediaInput = document.getElementById('pe-idea-media-upload') as HTMLInputElement | null;
  ideaMediaInput?.addEventListener('change', async () => {
    const file = ideaMediaInput.files?.[0];
    if (!file) return;
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm)$/i.test(file.name);
    const typeSelect = document.getElementById('pe-idea-type') as HTMLSelectElement | null;
    const durInput = document.getElementById('pe-idea-duration') as HTMLInputElement | null;
    const srcInput = document.getElementById('pe-idea-src') as HTMLInputElement | null;
    const titleInput = document.getElementById('pe-idea-title') as HTMLInputElement | null;

    showToast(`Inspecting & uploading ${isVideo ? 'video clip' : 'audio'}...`, 'info');
    try {
      if (isVideo) {
        if (typeSelect) typeSelect.value = 'video';
        const meta = await detectVideoMetadata(file);
        if (durInput && meta.duration !== '0:00') durInput.value = meta.duration;
        (document.getElementById('pe-idea-aspect') as HTMLSelectElement).value = meta.aspectRatio;
        (document.getElementById('pe-idea-width') as HTMLInputElement).value = String(meta.width);
        (document.getElementById('pe-idea-height') as HTMLInputElement).value = String(meta.height);
        const url = await uploadMedia(file, 'video');
        if (srcInput) srcInput.value = url;
      } else {
        if (typeSelect) typeSelect.value = 'audio';
        const dur = await detectAudioDuration(file);
        if (durInput && dur !== '0:00') durInput.value = dur;
        const url = await uploadMedia(file, 'audio');
        if (srcInput) srcInput.value = url;
      }
      if (titleInput && !titleInput.value.trim()) {
        titleInput.value = file.name.replace(/\.(mp3|mp4|webm)$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      }
    } catch {
      // Handled in uploadMedia
    }
  });

  const bindImageUpload = (inputId: string, fieldId: string, previewId: string) => {
    const fileInput = document.getElementById(inputId) as HTMLInputElement | null;
    const textField = document.getElementById(fieldId) as HTMLInputElement | null;
    const preview = document.getElementById(previewId) as HTMLImageElement | null;
    textField?.addEventListener('input', () => setSafeImagePreview(preview, textField.value));
    fileInput?.addEventListener('change', async () => {
      const file = fileInput.files?.[0];
      if (!file) return;
      previewLocalFile(preview, file);
      try {
        const url = await uploadMedia(file, 'image');
        if (textField) textField.value = url;
      } catch {
        // Handled in uploadMedia
      }
    });
  };
  bindImageUpload('pe-idea-cover-upload', 'pe-idea-cover', 'pe-idea-cover-preview');
  bindImageUpload('pe-cr-cover-upload', 'pe-cr-cover', 'pe-cr-cover-preview');

  const crAudioUpload = document.getElementById('pe-cr-audio-upload') as HTMLInputElement | null;
  crAudioUpload?.addEventListener('change', async () => {
    const file = crAudioUpload.files?.[0];
    if (!file) return;
    try {
      const url = await uploadMedia(file, 'audio');
      const field = document.getElementById('pe-cr-audio') as HTMLInputElement | null;
      if (field) field.value = url;
    } catch {
      // Handled in uploadMedia
    }
  });

  document.getElementById('producer-item-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('producer-modal-save-btn') as HTMLButtonElement | null;
    if (saveBtn) saveBtn.disabled = true;
    try {
      const kind = (document.getElementById('pe-kind') as HTMLInputElement).value as ItemKind;
      const body = buildItemPayload(kind);
      const res = await fetchWithAuth('/api/admin/producer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to save entry.');
      showToast('Saved to producer portfolio.', 'success');
      itemDialog?.close();
      await onSaveSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });
}
