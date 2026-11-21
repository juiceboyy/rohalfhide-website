export function previewLocalFile(
  img: HTMLImageElement | null,
  file: File
): string {
  if (!img) return '';
  const objectUrl = URL.createObjectURL(file);
  img.src = objectUrl;
  img.classList.remove('hidden');
  return objectUrl;
}

export function setSafeImagePreview(
  img: HTMLImageElement | null,
  url: string,
  branch = 'dev'
): void {
  if (!img) return;
  const cleanUrl = url.trim();
  if (!cleanUrl) {
    img.src = '';
    img.classList.add('hidden');
    return;
  }

  img.classList.remove('hidden');

  img.onerror = () => {
    // If local /images/... path fails (e.g. uploaded before Netlify finishes build), fallback to GitHub raw
    if (cleanUrl.startsWith('/images/')) {
      img.onerror = () => {
        img.onerror = null;
        img.classList.add('hidden');
      };
      img.src = `https://raw.githubusercontent.com/juiceboyy/rohalfhide-website/${branch}/public${cleanUrl}`;
    } else {
      img.classList.add('hidden');
    }
  };

  img.src = cleanUrl;
}
