export interface SessionState {
  authenticated: boolean;
  token: string | null;
  gitHub?: {
    isConfigured: boolean;
    branch: string;
    owner: string;
    repo: string;
    token?: string;
  };
}

const TOKEN_KEY = 'ro_admin_token';
let currentSessionState: SessionState | null = null;

export function getStoredToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string, remember = false): void {
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    if (remember) {
      localStorage.setItem(TOKEN_KEY, token);
    }
  } catch (err) {
    console.error('Failed to store session token:', err);
  }
}

export function clearStoredToken(): void {
  try {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
    currentSessionState = null;
  } catch (err) {
    console.error('Failed to clear session token:', err);
  }
}

export function showToast(message: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const container = document.getElementById('admin-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  const colorMap = {
    info: 'bg-surface-raised text-surface-ink shadow-hairline border-l-2 border-accent',
    success: 'bg-[#142318] text-[#86efac] shadow-hairline border-l-2 border-[#22c55e]',
    error: 'bg-[#291415] text-[#fca5a5] shadow-hairline border-l-2 border-[#ef4444]',
  };

  toast.className = `px-4 py-3 rounded-lg text-xs font-sans font-medium flex items-center justify-between gap-3 transition-all duration-300 transform translate-y-2 opacity-0 ${colorMap[type]}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button type="button" class="text-surface-subtle hover:text-surface-ink text-sm leading-none focus-ring rounded-sm">&times;</button>
  `;

  const closeBtn = toast.querySelector('button');
  closeBtn?.addEventListener('click', () => {
    toast.remove();
  });

  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.classList.remove('translate-y-2', 'opacity-0');
  });

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-y-2');
    setTimeout(() => toast.remove(), 300);
  }, 5500);
}

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearStoredToken();
    window.dispatchEvent(new CustomEvent('ro-admin:logout'));
    showToast('Session expired. Please sign in again.', 'error');
  }

  return response;
}

export async function checkSession(): Promise<SessionState> {
  const token = getStoredToken();
  if (!token) {
    currentSessionState = { authenticated: false, token: null };
    return currentSessionState;
  }

  try {
    const res = await fetchWithAuth('/api/admin/auth', { method: 'GET' });
    if (!res.ok) {
      currentSessionState = { authenticated: false, token: null };
      return currentSessionState;
    }
    const data = await res.json();
    currentSessionState = {
      authenticated: true,
      token,
      gitHub: data.gitHub,
    };
    return currentSessionState;
  } catch {
    currentSessionState = { authenticated: false, token: null };
    return currentSessionState;
  }
}

export async function loginAdmin(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const rawText = await res.text();
    let data: any = {};
    try {
      data = JSON.parse(rawText);
    } catch {
      throw new Error(`Authentication server error (HTTP ${res.status})`);
    }

    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Login failed.');
    }

    setStoredToken(data.token, true);
    if (data.gitHub) {
      currentSessionState = {
        authenticated: true,
        token: data.token,
        gitHub: data.gitHub,
      };
    }
    showToast('Signed in successfully.', 'success');
    return true;
  } catch (err: any) {
    showToast(err.message || 'Login error.', 'error');
    return false;
  }
}

export function logoutAdmin(): void {
  clearStoredToken();
  window.dispatchEvent(new CustomEvent('ro-admin:logout'));
  showToast('Signed out.', 'info');
}

function sanitizeFilename(name = ''): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

/**
 * Uploads media either directly to GitHub REST API (bypassing Netlify's 6MB payload limit
 * and 10s function timeout, supporting files up to 25MB) or falls back to Netlify Functions.
 */
export async function uploadMedia(
  file: File,
  type: 'image' | 'audio'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const cleanName = sanitizeFilename(file.name);
        const isAudio = type === 'audio' || cleanName.endsWith('.mp3');
        const targetDir = isAudio ? 'public/audio' : 'public/images';
        const targetPath = `${targetDir}/${cleanName}`;
        const publicUrl = `/${isAudio ? 'audio' : 'images'}/${cleanName}`;

        const gh = currentSessionState?.gitHub;

        // Path A: Direct GitHub REST API upload (high capacity, up to 25MB)
        if (gh?.isConfigured && gh.token) {
          showToast(`Uploading ${cleanName} to GitHub (${(file.size / (1024 * 1024)).toFixed(1)}MB)...`, 'info');

          let sha: string | undefined;
          try {
            const checkRes = await fetch(
              `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${targetPath}?ref=${encodeURIComponent(gh.branch)}`,
              {
                headers: {
                  Authorization: `Bearer ${gh.token}`,
                  Accept: 'application/vnd.github.v3+json',
                },
              }
            );
            if (checkRes.ok) {
              const fileData = await checkRes.json();
              sha = fileData.sha;
            }
          } catch {
            // New file, no sha needed
          }

          const ghRes = await fetch(
            `https://api.github.com/repos/${gh.owner}/${gh.repo}/contents/${targetPath}`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${gh.token}`,
                Accept: 'application/vnd.github.v3+json',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message: `CMS: Upload ${type} "${cleanName}"`,
                content: base64Data,
                branch: gh.branch,
                sha,
              }),
            }
          );

          const ghText = await ghRes.text();
          let ghData: any = {};
          try {
            ghData = JSON.parse(ghText);
          } catch {}

          if (!ghRes.ok) {
            throw new Error(ghData.message || `GitHub upload failed (HTTP ${ghRes.status})`);
          }

          showToast(`Uploaded ${cleanName} successfully.`, 'success');
          resolve(publicUrl);
          return;
        }

        // Path B: Fallback to serverless function
        const res = await fetchWithAuth('/api/admin/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            base64Data,
            type,
          }),
        });

        const rawText = await res.text();
        let data: any = {};
        try {
          data = JSON.parse(rawText);
        } catch {
          if (res.status === 413) {
            throw new Error(
              `File is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Netlify serverless limit is 4.5MB. Set GITHUB_TOKEN in Netlify for direct high-capacity uploads.`
            );
          }
          throw new Error(rawText || `Upload failed (HTTP ${res.status})`);
        }

        if (!res.ok || !data.ok) {
          throw new Error(data.error || data.message || `Upload failed (HTTP ${res.status})`);
        }

        showToast(`Uploaded ${data.filename}`, 'success');
        resolve(data.url);
      } catch (err: any) {
        showToast(err.message || 'Upload failed', 'error');
        reject(err);
      }
    };

    reader.onerror = () => {
      const err = new Error('Failed to read file from disk.');
      showToast(err.message, 'error');
      reject(err);
    };

    reader.readAsDataURL(file);
  });
}
