import { fetchWithAuth, showToast } from './api';
import type { ProducerPortfolioData } from './producer-types';

export function installClosedByFallback(dialog: HTMLDialogElement | null): void {
  if (!dialog || 'closedBy' in HTMLDialogElement.prototype) return;
  const outside = (e: PointerEvent) => {
    const r = dialog.getBoundingClientRect();
    return e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom;
  };
  let pressedOutside = false;
  dialog.addEventListener('pointerdown', (e) => {
    pressedOutside = outside(e);
  });
  dialog.addEventListener('pointerup', (e) => {
    if (pressedOutside && outside(e)) dialog.close();
  });
}

export function openProducerSettingsModal(data: ProducerPortfolioData): void {
  const dialog = document.getElementById('producer-settings-dialog') as HTMLDialogElement | null;
  if (!dialog) return;
  (document.getElementById('ps-ig-url') as HTMLInputElement).value = data.instagramHighlightsUrl || '';
  (document.getElementById('ps-hero-left') as HTMLInputElement).value = data.hero?.eyebrowLeft || '';
  (document.getElementById('ps-hero-right') as HTMLInputElement).value = data.hero?.eyebrowRight || '';
  (document.getElementById('ps-hero-title') as HTMLInputElement).value = data.hero?.title || '';
  (document.getElementById('ps-hero-subtitle') as HTMLTextAreaElement).value = data.hero?.subtitle || '';
  (document.getElementById('ps-studio-name') as HTMLInputElement).value = data.studio?.name || '';
  (document.getElementById('ps-studio-city') as HTMLInputElement).value = data.studio?.city || '';
  (document.getElementById('ps-studio-summary') as HTMLTextAreaElement).value = data.studio?.summary || '';
  (document.getElementById('ps-studio-approach') as HTMLTextAreaElement).value = data.studio?.approach || '';
  (document.getElementById('ps-studio-highlights') as HTMLTextAreaElement).value = (
    data.studio?.setupHighlights || []
  ).join('\n');
  dialog.showModal();
}

export function setupProducerSettingsModal(
  getCatalog: () => ProducerPortfolioData,
  onSaveSuccess: () => Promise<void>
): void {
  const settingsDialog = document.getElementById('producer-settings-dialog') as HTMLDialogElement | null;
  installClosedByFallback(settingsDialog);

  settingsDialog?.addEventListener('close', () => {
    settingsDialog.returnValue = '';
  });

  document.getElementById('producer-settings-close-btn')?.addEventListener('click', () => settingsDialog?.close());
  document.getElementById('producer-settings-cancel-btn')?.addEventListener('click', () => settingsDialog?.close());
  document
    .getElementById('admin-edit-producer-settings-btn')
    ?.addEventListener('click', () => openProducerSettingsModal(getCatalog()));

  document.getElementById('producer-settings-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('producer-settings-save-btn') as HTMLButtonElement | null;
    if (saveBtn) saveBtn.disabled = true;
    try {
      const highlights = (document.getElementById('ps-studio-highlights') as HTMLTextAreaElement).value
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        instagramHighlightsUrl: (document.getElementById('ps-ig-url') as HTMLInputElement).value.trim(),
        hero: {
          eyebrowLeft: (document.getElementById('ps-hero-left') as HTMLInputElement).value.trim(),
          eyebrowRight: (document.getElementById('ps-hero-right') as HTMLInputElement).value.trim(),
          title: (document.getElementById('ps-hero-title') as HTMLInputElement).value.trim(),
          subtitle: (document.getElementById('ps-hero-subtitle') as HTMLTextAreaElement).value.trim(),
        },
        studio: {
          name: (document.getElementById('ps-studio-name') as HTMLInputElement).value.trim(),
          city: (document.getElementById('ps-studio-city') as HTMLInputElement).value.trim(),
          summary: (document.getElementById('ps-studio-summary') as HTMLTextAreaElement).value.trim(),
          approach: (document.getElementById('ps-studio-approach') as HTMLTextAreaElement).value.trim(),
          setupHighlights: highlights,
        },
      };
      const res = await fetchWithAuth('/api/admin/producer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-settings', payload }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || 'Failed to save settings.');
      showToast('Studio & hero copy updated.', 'success');
      settingsDialog?.close();
      await onSaveSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  });
}
