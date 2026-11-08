import { formatVaultTime, initLazyMediaFallback, setupVaultChapters } from './vault-media-utils';

function initProducerVault(): void {
  initLazyMediaFallback();
  const activateChapter = setupVaultChapters();

  const audioEl = document.getElementById('vault-audio-element') as HTMLAudioElement | null;
  const videoEl = document.getElementById('vault-video-element') as HTMLVideoElement | null;
  const audioStage = document.getElementById('vault-audio-stage');
  const videoStage = document.getElementById('vault-video-stage');
  const videoFrame = document.getElementById('vault-video-frame');

  const coverEl = document.getElementById('vault-cover') as HTMLImageElement | null;
  const audioTitleEl = document.getElementById('vault-audio-title');
  const audioNoteEl = document.getElementById('vault-audio-note');
  const videoTitleEl = document.getElementById('vault-video-title');
  const videoNoteEl = document.getElementById('vault-video-note');

  const playBtn = document.getElementById('vault-play-btn');
  const playIcon = document.getElementById('vault-play-icon');
  const pauseIcon = document.getElementById('vault-pause-icon');
  const prevBtn = document.getElementById('vault-prev-btn');
  const nextBtn = document.getElementById('vault-next-btn');
  const videoPrevBtn = document.getElementById('vault-video-prev-btn');
  const videoNextBtn = document.getElementById('vault-video-next-btn');
  const currentTimeEl = document.getElementById('vault-current-time');
  const totalDurationEl = document.getElementById('vault-total-duration');
  const progressContainer = document.getElementById('vault-progress-container');
  const progressBar = document.getElementById('vault-progress-bar');

  const ideaItems = Array.from(document.querySelectorAll<HTMLButtonElement>('.vault-idea-item'));
  if (ideaItems.length === 0) return;

  const initialIdx = ideaItems.findIndex((el) => el.getAttribute('aria-current') === 'true');
  let activeIdeaIndex = initialIdx >= 0 ? initialIdx : 0;

  function updateAudioPlayIcon(isPlaying: boolean): void {
    playIcon?.classList.toggle('hidden', isPlaying);
    pauseIcon?.classList.toggle('hidden', !isPlaying);
    playBtn?.setAttribute('aria-label', isPlaying ? 'Pause song idea' : 'Play song idea');
  }

  function syncRowHighlight(index: number): void {
    ideaItems.forEach((el, i) => {
      const active = i === index;
      el.classList.toggle('bg-white/[0.05]', active);
      if (active) el.setAttribute('aria-current', 'true');
      else el.removeAttribute('aria-current');

      const idxEl = el.querySelector('.idea-index');
      const titleEl = el.querySelector('.idea-row-title');
      idxEl?.classList.toggle('text-accent', active);
      idxEl?.classList.toggle('text-surface-subtle', !active);
      titleEl?.classList.toggle('text-surface-ink', active);
      titleEl?.classList.toggle('text-surface-muted', !active);
    });
  }

  function pauseAllOtherPlayers(source: 'vault-audio' | 'vault-video'): void {
    if (source !== 'vault-audio' && audioEl && !audioEl.paused) {
      audioEl.pause();
      updateAudioPlayIcon(false);
    }
    if (source !== 'vault-video' && videoEl && !videoEl.paused) {
      videoEl.pause();
    }
    window.dispatchEvent(new CustomEvent('ro-media:play', { detail: { source } }));
  }

  window.addEventListener('ro-media:play', (e: Event) => {
    const detail = (e as CustomEvent).detail;
    if (detail?.source === 'credit-preview') {
      if (audioEl && !audioEl.paused) {
        audioEl.pause();
        updateAudioPlayIcon(false);
      }
      if (videoEl && !videoEl.paused) videoEl.pause();
    }
  });

  function selectIdea(index: number, autoPlay = false): void {
    if (index < 0) index = ideaItems.length - 1;
    if (index >= ideaItems.length) index = 0;
    activeIdeaIndex = index;

    const item = ideaItems[index];
    const chapterId = item.getAttribute('data-chapter-id') || '';
    const mediaType = item.getAttribute('data-media-type') || 'audio';
    const src = item.getAttribute('data-src') || '';
    const poster = item.getAttribute('data-poster') || '';
    const cover = item.getAttribute('data-cover') || '/images/hero-portrait.jpg';
    const title = item.getAttribute('data-title') || '';
    const note = item.getAttribute('data-note') || '';
    const duration = item.getAttribute('data-duration') || '0:00';
    const aspect = item.getAttribute('data-aspect') || '9:16';
    const width = item.getAttribute('data-width') || '360';
    const height = item.getAttribute('data-height') || '640';

    if (chapterId) activateChapter(chapterId);
    syncRowHighlight(index);

    if (mediaType === 'video' && videoEl) {
      pauseAllOtherPlayers('vault-video');
      audioStage?.classList.add('hidden');
      audioStage?.classList.remove('flex');
      videoStage?.classList.remove('hidden');
      videoStage?.classList.add('flex');

      if (videoFrame) {
        videoFrame.className =
          aspect === '16:9'
            ? 'w-full sm:w-72 shrink-0 rounded-xl overflow-hidden bg-surface-void shadow-hairline'
            : aspect === '1:1'
              ? 'w-52 sm:w-60 shrink-0 rounded-xl overflow-hidden bg-surface-void shadow-hairline'
              : 'w-44 sm:w-52 shrink-0 rounded-xl overflow-hidden bg-surface-void shadow-hairline';
      }

      videoEl.width = Number(width) || 360;
      videoEl.height = Number(height) || 640;
      if (poster) videoEl.poster = poster;
      else videoEl.removeAttribute('poster');
      videoEl.src = src;
      if (videoTitleEl) videoTitleEl.textContent = title;
      if (videoNoteEl) videoNoteEl.textContent = note;

      if (autoPlay) {
        videoEl.play().catch((err) => {
          if (err?.name !== 'NotAllowedError') console.error(err);
        });
      }
    } else if (audioEl) {
      pauseAllOtherPlayers('vault-audio');
      videoStage?.classList.add('hidden');
      videoStage?.classList.remove('flex');
      audioStage?.classList.remove('hidden');
      audioStage?.classList.add('flex');

      if (coverEl) {
        coverEl.src = cover;
        coverEl.alt = title;
      }
      if (audioTitleEl) audioTitleEl.textContent = title;
      if (audioNoteEl) audioNoteEl.textContent = note;
      if (totalDurationEl) totalDurationEl.textContent = duration;
      if (currentTimeEl) currentTimeEl.textContent = '0:00';
      if (progressBar) progressBar.style.width = '0%';
      progressContainer?.setAttribute('aria-valuenow', '0');

      audioEl.src = src;
      if (autoPlay) {
        audioEl
          .play()
          .then(() => updateAudioPlayIcon(true))
          .catch((err) => {
            if (err?.name !== 'NotAllowedError') console.error(err);
            updateAudioPlayIcon(false);
          });
      } else {
        updateAudioPlayIcon(false);
      }
    }
  }

  playBtn?.addEventListener('click', () => {
    if (!audioEl) return;
    if (audioEl.paused) {
      pauseAllOtherPlayers('vault-audio');
      audioEl
        .play()
        .then(() => updateAudioPlayIcon(true))
        .catch((err) => {
          if (err?.name !== 'NotAllowedError') console.error(err);
          updateAudioPlayIcon(false);
        });
    } else {
      audioEl.pause();
      updateAudioPlayIcon(false);
    }
  });

  videoEl?.addEventListener('play', () => pauseAllOtherPlayers('vault-video'));
  prevBtn?.addEventListener('click', () => selectIdea(activeIdeaIndex - 1, true));
  nextBtn?.addEventListener('click', () => selectIdea(activeIdeaIndex + 1, true));
  videoPrevBtn?.addEventListener('click', () => selectIdea(activeIdeaIndex - 1, true));
  videoNextBtn?.addEventListener('click', () => selectIdea(activeIdeaIndex + 1, true));

  ideaItems.forEach((item, idx) => item.addEventListener('click', () => selectIdea(idx, true)));

  audioEl?.addEventListener('timeupdate', () => {
    if (!audioEl.duration) return;
    const progress = (audioEl.currentTime / audioEl.duration) * 100;
    if (progressBar) progressBar.style.width = `${progress}%`;
    progressContainer?.setAttribute('aria-valuenow', String(Math.round(progress)));
    if (currentTimeEl) currentTimeEl.textContent = formatVaultTime(audioEl.currentTime);
  });

  audioEl?.addEventListener('ended', () => selectIdea(activeIdeaIndex + 1, true));
  videoEl?.addEventListener('ended', () => selectIdea(activeIdeaIndex + 1, true));

  progressContainer?.addEventListener('click', (e) => {
    if (!audioEl?.duration) return;
    const rect = progressContainer.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioEl.currentTime = ratio * audioEl.duration;
  });

  progressContainer?.addEventListener('keydown', (e) => {
    if (!audioEl?.duration) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      audioEl.currentTime = Math.min(audioEl.duration, audioEl.currentTime + 5);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      audioEl.currentTime = Math.max(0, audioEl.currentTime - 5);
    }
  });

  document.querySelectorAll('[data-inquire-active]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const title = ideaItems[activeIdeaIndex]?.getAttribute('data-title') || 'Song Idea';
      window.dispatchEvent(
        new CustomEvent('ro-contact:prefill', {
          detail: {
            subject: 'Studio & Production',
            message: `Hi Ro,\n\nI'd love to discuss or collaborate around the song idea "${title}" from your Producer Vault.\n\n`,
          },
        })
      );
      document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' });
    });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProducerVault);
} else {
  initProducerVault();
}
