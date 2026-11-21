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

export interface VideoMetaResult {
  duration: string;
  width: number;
  height: number;
  aspectRatio: '9:16' | '16:9' | '1:1';
}

export async function detectVideoMetadata(file: File): Promise<VideoMetaResult> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const width = video.videoWidth || 360;
      const height = video.videoHeight || 640;
      const ratio = width / height;
      const aspectRatio: '9:16' | '16:9' | '1:1' =
        ratio > 1.2 ? '16:9' : ratio < 0.85 ? '9:16' : '1:1';
      const duration = formatSecondsToDuration(video.duration);
      URL.revokeObjectURL(url);
      resolve({ duration, width, height, aspectRatio });
    };
    video.onerror = () => {
      URL.revokeObjectURL(url);
      resolve({ duration: '0:00', width: 360, height: 640, aspectRatio: '9:16' });
    };
    video.src = url;
  });
}
