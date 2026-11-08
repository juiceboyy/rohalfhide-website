export function formatVaultTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

export function initLazyMediaFallback(): void {
  const supportsLazyMedia = Object.hasOwn(HTMLMediaElement.prototype, 'loading');
  if (supportsLazyMedia) return;

  const lazyMediaElements = document.querySelectorAll<HTMLMediaElement>(
    'video[loading="lazy"], audio[loading="lazy"][controls]'
  );
  if (lazyMediaElements.length === 0) return;

  const mediaObserver = new IntersectionObserver(
    (entries, observer) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const media = entry.target as HTMLMediaElement;
        let restored = false;
        if (media.dataset.poster && media instanceof HTMLVideoElement) {
          media.poster = media.dataset.poster;
          delete media.dataset.poster;
          restored = true;
        }
        if (media.dataset.preload) {
          media.preload = media.dataset.preload as '' | 'none' | 'metadata' | 'auto';
          delete media.dataset.preload;
          restored = true;
        }
        if (media.dataset.src) {
          media.src = media.dataset.src;
          delete media.dataset.src;
          restored = true;
        }
        for (const source of media.querySelectorAll<HTMLSourceElement>('source[data-src]')) {
          if (source.dataset.src) {
            source.src = source.dataset.src;
            delete source.dataset.src;
            restored = true;
          }
        }
        const hasSource = Boolean(media.getAttribute('src')) || Boolean(media.querySelector('source[src]'));
        if (restored && hasSource && media.paused && media.currentTime === 0) {
          media.load();
        }
        observer.unobserve(media);
      }
    },
    { rootMargin: '200px 0px' }
  );

  lazyMediaElements.forEach((media) => {
    if (media instanceof HTMLVideoElement && media.hasAttribute('poster')) {
      const posterVal = media.getAttribute('poster') || '';
      if (posterVal) {
        media.dataset.poster = posterVal;
        media.removeAttribute('poster');
      }
    }
    if (media.hasAttribute('preload') && media.getAttribute('preload') !== 'none') {
      media.dataset.preload = media.getAttribute('preload') || 'metadata';
    }
    media.preload = 'none';
    mediaObserver.observe(media);
  });
}

export function setupVaultChapters(): (chapterId: string, scrollIntoView?: boolean) => void {
  const chaptersContainer = document.getElementById('vault-chapters-container');
  const chapterTabs = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-chapter-tab]'));
  const chapterPanels = Array.from(document.querySelectorAll<HTMLElement>('[data-chapter-panel]'));
  const supportsUntilFound = 'onbeforematch' in HTMLElement.prototype;

  if (!supportsUntilFound) {
    chapterPanels.forEach((panel) => {
      panel.removeAttribute('hidden');
      panel.classList.add('pt-6', 'first:pt-0', 'shadow-divider-t', 'first:shadow-none');
    });
  }

  function activateChapter(chapterId: string, scrollIntoView = false): void {
    chapterTabs.forEach((tab) => {
      const isMatch = tab.getAttribute('data-chapter-tab') === chapterId;
      tab.setAttribute('aria-expanded', isMatch ? 'true' : 'false');
      tab.classList.toggle('bg-white/[0.05]', isMatch);
      tab.classList.toggle('text-surface-ink', isMatch);
      tab.classList.toggle('text-surface-muted', !isMatch);
      const indexEl = tab.querySelector('.chapter-index');
      indexEl?.classList.toggle('text-accent', isMatch);
      indexEl?.classList.toggle('text-surface-subtle', !isMatch);
    });

    if (supportsUntilFound) {
      chapterPanels.forEach((panel) => {
        if (panel.getAttribute('data-chapter-panel') === chapterId) {
          panel.removeAttribute('hidden');
        } else {
          panel.setAttribute('hidden', 'until-found');
        }
      });
    } else if (scrollIntoView) {
      const targetPanel = chapterPanels.find((p) => p.getAttribute('data-chapter-panel') === chapterId);
      targetPanel?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  chapterTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const chapterId = tab.getAttribute('data-chapter-tab');
      if (chapterId) activateChapter(chapterId, true);
    });
  });

  if (supportsUntilFound && chaptersContainer) {
    chaptersContainer.addEventListener('beforematch', (e) => {
      const matchedPanel = (e.target as HTMLElement).closest('[data-chapter-panel]');
      const chapterId = matchedPanel?.getAttribute('data-chapter-panel');
      if (chapterId) activateChapter(chapterId);
    });
  }

  return activateChapter;
}
