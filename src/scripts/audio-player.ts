function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const min = Math.floor(seconds / 60);
  const sec = Math.floor(seconds % 60);
  return `${min}:${sec < 10 ? '0' : ''}${sec}`;
}

function initAudioPlayer() {
  const audio = document.getElementById('audio-element') as HTMLAudioElement | null;
  if (!audio) return;

  const playBtn = document.getElementById('play-btn');
  const playIcon = document.getElementById('play-icon');
  const pauseIcon = document.getElementById('pause-icon');
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  const titleEl = document.getElementById('player-title');
  const artistEl = document.getElementById('player-artist');
  const coverEl = document.getElementById('player-cover') as HTMLImageElement | null;
  const auraEl = document.getElementById('player-ambient-aura') as HTMLImageElement | null;
  const currentTimeEl = document.getElementById('current-time');
  const totalDurationEl = document.getElementById('total-duration');
  const progressContainer = document.getElementById('progress-container');
  const progressBar = document.getElementById('progress-bar');

  const trackItems = document.querySelectorAll<HTMLButtonElement>('.track-item');
  if (trackItems.length === 0) return;

  let currentIdx = 0;

  function updatePlayState(isPlaying: boolean) {
    if (isPlaying) {
      playIcon?.classList.add('hidden');
      pauseIcon?.classList.remove('hidden');
      playBtn?.setAttribute('aria-label', 'Pause track');
    } else {
      playIcon?.classList.remove('hidden');
      pauseIcon?.classList.add('hidden');
      playBtn?.setAttribute('aria-label', 'Play track');
    }
  }

  function syncTrackRowStyles(activeIndex: number) {
    trackItems.forEach((el, i) => {
      const indexSpan = el.querySelector<HTMLElement>('.track-index');
      const titleSpan = el.querySelector<HTMLElement>('.track-row-title');
      if (i === activeIndex) {
        el.classList.add('bg-white/[0.05]');
        el.setAttribute('aria-current', 'true');
        indexSpan?.classList.add('text-accent');
        indexSpan?.classList.remove('text-surface-subtle');
        titleSpan?.classList.add('text-surface-ink');
        titleSpan?.classList.remove('text-surface-muted');
      } else {
        el.classList.remove('bg-white/[0.05]');
        el.removeAttribute('aria-current');
        indexSpan?.classList.remove('text-accent');
        indexSpan?.classList.add('text-surface-subtle');
        titleSpan?.classList.remove('text-surface-ink');
        titleSpan?.classList.add('text-surface-muted');
      }
    });
  }

  function setTrack(index: number, autoPlay: boolean = false) {
    if (index < 0) index = trackItems.length - 1;
    if (index >= trackItems.length) index = 0;
    currentIdx = index;

    const item = trackItems[index];
    const src = item.getAttribute('data-src') || '';
    const title = item.getAttribute('data-title') || '';
    const artist = item.getAttribute('data-artist') || '';
    const duration = item.getAttribute('data-duration') || '0:00';
    const cover = item.getAttribute('data-cover') || '';

    if (titleEl) titleEl.textContent = title;
    if (artistEl) artistEl.textContent = artist;
    if (coverEl) {
      coverEl.src = cover;
      coverEl.alt = title;
    }
    if (auraEl) {
      auraEl.src = cover;
    }
    if (totalDurationEl) totalDurationEl.textContent = duration;
    if (currentTimeEl) currentTimeEl.textContent = '0:00';
    if (progressBar) progressBar.style.width = '0%';
    progressContainer?.setAttribute('aria-valuenow', '0');

    syncTrackRowStyles(index);

    audio.src = src;
    if (autoPlay) {
      audio.play().then(() => updatePlayState(true)).catch(console.error);
    } else {
      updatePlayState(false);
    }
  }

  syncTrackRowStyles(0);

  playBtn?.addEventListener('click', () => {
    if (audio.paused) {
      audio.play().then(() => updatePlayState(true)).catch(console.error);
    } else {
      audio.pause();
      updatePlayState(false);
    }
  });

  prevBtn?.addEventListener('click', () => setTrack(currentIdx - 1, !audio.paused));
  nextBtn?.addEventListener('click', () => setTrack(currentIdx + 1, !audio.paused));

  trackItems.forEach((item, index) => {
    item.addEventListener('click', () => setTrack(index, true));
  });

  audio.addEventListener('timeupdate', () => {
    if (!audio.duration) return;
    const progress = (audio.currentTime / audio.duration) * 100;
    if (progressBar) progressBar.style.width = `${progress}%`;
    progressContainer?.setAttribute('aria-valuenow', String(Math.round(progress)));
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audio.currentTime);
  });

  audio.addEventListener('ended', () => setTrack(currentIdx + 1, true));

  progressContainer?.addEventListener('click', (e) => {
    const rect = progressContainer.getBoundingClientRect();
    const seekRatio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    if (audio.duration) {
      audio.currentTime = seekRatio * audio.duration;
    }
  });

  progressContainer?.addEventListener('keydown', (e) => {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAudioPlayer);
} else {
  initAudioPlayer();
}
