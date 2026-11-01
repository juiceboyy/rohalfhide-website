export interface SessionState {
  authenticated: boolean;
  token: string | null;
  gitHub?: {
    isConfigured: boolean;
    branch: string;
    owner: string;
    repo: string;
  };
}

const TOKEN_KEY = 'ro_admin_token';

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
  }, 4500);
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
    return { authenticated: false, token: null };
  }

  try {
    const res = await fetchWithAuth('/api/admin/auth', { method: 'GET' });
    if (!res.ok) {
      return { authenticated: false, token: null };
    }
    const data = await res.json();
    return {
      authenticated: true,
      token,
      gitHub: data.gitHub,
    };
  } catch {
    return { authenticated: false, token: null };
  }
}

export async function loginAdmin(password: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json();
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Login failed.');
    }

    setStoredToken(data.token, true);
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

export async function uploadMedia(
  file: File,
  type: 'image' | 'audio'
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = (reader.result as string).split(',')[1];
        const res = await fetchWithAuth('/api/admin/media', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            base64Data,
            type,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Failed to upload media file.');
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
