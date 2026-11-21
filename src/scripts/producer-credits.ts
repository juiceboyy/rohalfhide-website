const PLAY_PATH = 'M8 5v14l11-7z';
const STOP_PATH = 'M6 6h12v12H6z';

function setIconAndLabel(
  btn: HTMLButtonElement | null,
  iconSelector: string,
  labelSelector: string,
  active: boolean,
  activeLabel: string,
  idleLabel: string,
  attrName: 'aria-pressed' | 'aria-expanded'
): void {
  if (!btn) return;
  btn.setAttribute(attrName, active ? 'true' : 'false');
  const label = btn.querySelector(labelSelector);
  if (label) label.textContent = active ? activeLabel : idleLabel;
  const path = btn.querySelector(`${iconSelector} path`);
  if (path) path.setAttribute('d', active ? STOP_PATH : PLAY_PATH);
}

function initProducerCredits(): void {
  const previewButtons = document.querySelectorAll<HTMLButtonElement>('.credit-preview-btn');
  const ytButtons = document.querySelectorAll<HTMLButtonElement>('.credit-yt-btn');
  if (previewButtons.length === 0 && ytButtons.length === 0) return;

  let activeAudio: HTMLAudioElement | null = null;
  let activeAudioBtn: HTMLButtonElement | null = null;
  let activeYtBtn: HTMLButtonElement | null = null;
  let activeYtSlot: HTMLElement | null = null;

  function stopAudio(): void {
    if (activeAudio) {
      activeAudio.pause();
      activeAudio.currentTime = 0;
      activeAudio = null;
    }
    setIconAndLabel(
      activeAudioBtn,
      '.credit-preview-icon',
      '.credit-preview-label',
      false,
      'Stop',
      'Play',
      'aria-pressed'
    );
    activeAudioBtn = null;
  }

  function closeYouTube(): void {
    if (activeYtSlot) {
      activeYtSlot.innerHTML = '';
      activeYtSlot.classList.add('hidden');
      activeYtSlot = null;
    }
    setIconAndLabel(
      activeYtBtn,
      '.credit-yt-icon',
      '.credit-yt-label',
      false,
      'Close',
      'Play',
      'aria-expanded'
    );
    activeYtBtn = null;
  }

  window.addEventListener('ro-media:play', (e: Event) => {
    const source = (e as CustomEvent).detail?.source;
    if (source !== 'credit-preview') {
      stopAudio();
      closeYouTube();
    }
  });

  previewButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const src = btn.getAttribute('data-credit-preview');
      if (!src) return;

      if (activeAudioBtn === btn && activeAudio) {
        stopAudio();
        return;
      }

      closeYouTube();
      stopAudio();
      window.dispatchEvent(new CustomEvent('ro-media:play', { detail: { source: 'credit-preview' } }));

      const audio = new Audio(src);
      activeAudio = audio;
      activeAudioBtn = btn;
      setIconAndLabel(btn, '.credit-preview-icon', '.credit-preview-label', true, 'Stop', 'Play', 'aria-pressed');

      audio.play().catch((err) => {
        if (err?.name !== 'NotAllowedError') console.error(err);
        if (activeAudio === audio) stopAudio();
      });
      audio.onended = () => {
        if (activeAudio === audio) stopAudio();
      };
    });
  });

  ytButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const ytId = btn.getAttribute('data-yt-id');
      const targetId = btn.getAttribute('data-yt-target');
      const title = btn.getAttribute('data-yt-title') || 'Production audio player';
      if (!ytId || !targetId) return;

      const slot = document.getElementById(targetId);
      if (!slot) return;

      if (activeYtBtn === btn) {
        closeYouTube();
        return;
      }

      stopAudio();
      closeYouTube();
      window.dispatchEvent(new CustomEvent('ro-media:play', { detail: { source: 'credit-preview' } }));

      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(ytId)}?autoplay=1&rel=0`;
      iframe.title = title;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.className = 'w-full h-[120px] block border-0';

      slot.appendChild(iframe);
      slot.classList.remove('hidden');
      activeYtBtn = btn;
      activeYtSlot = slot;
      setIconAndLabel(btn, '.credit-yt-icon', '.credit-yt-label', true, 'Close', 'Play', 'aria-expanded');
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProducerCredits);
} else {
  initProducerCredits();
}
