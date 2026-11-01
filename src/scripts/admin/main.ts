import { checkSession, loginAdmin, logoutAdmin, showToast } from './api';
import { loadNewsList, setupNewsEvents } from './news';
import { loadMusicList, setupMusicEvents } from './music';
import { loadCommentsList, setupCommentsEvents } from './comments';

let isInitialized = false;

function switchTab(tabId: 'news' | 'music' | 'comments'): void {
  const sections = ['news', 'music', 'comments'];

  sections.forEach((s) => {
    const secEl = document.getElementById(`section-${s}`);
    const tabBtn = document.getElementById(`tab-btn-${s}`);

    if (s === tabId) {
      secEl?.classList.remove('hidden');
      tabBtn?.classList.add('bg-surface-raised', 'text-surface-ink', 'shadow-hairline');
      tabBtn?.classList.remove('text-surface-muted', 'hover:text-surface-ink');
    } else {
      secEl?.classList.add('hidden');
      tabBtn?.classList.remove('bg-surface-raised', 'text-surface-ink', 'shadow-hairline');
      tabBtn?.classList.add('text-surface-muted', 'hover:text-surface-ink');
    }
  });

  if (tabId === 'news') loadNewsList();
  if (tabId === 'music') loadMusicList();
  if (tabId === 'comments') loadCommentsList();
}

async function showDashboard(session: any): Promise<void> {
  const loginView = document.getElementById('admin-login-view');
  const dashboardView = document.getElementById('admin-dashboard-view');
  const branchIndicator = document.getElementById('admin-branch-indicator');

  loginView?.classList.add('hidden');
  dashboardView?.classList.remove('hidden');

  if (branchIndicator && session.gitHub) {
    const isGit = session.gitHub.isConfigured;
    const isHosted = !['localhost', '127.0.0.1'].includes(window.location.hostname);

    if (isHosted && !isGit) {
      branchIndicator.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
        <span class="text-amber-300">GITHUB_TOKEN missing in Netlify</span>
      `;
      branchIndicator.title = `GITHUB_TOKEN is not set in Netlify environment variables for branch "${session.gitHub.branch}". Set it in Netlify to enable Git publishing.`;
    } else {
      branchIndicator.innerHTML = `
        <span class="w-1.5 h-1.5 rounded-full ${isGit ? 'bg-emerald-400' : 'bg-zinc-400'} animate-pulse"></span>
        <span>${isGit ? `git:${session.gitHub.branch}` : 'local mode'}</span>
      `;
    }
  }

  if (!isInitialized) {
    setupNewsEvents();
    setupMusicEvents();
    setupCommentsEvents();
    setupTabButtons();
    isInitialized = true;
  }

  await Promise.all([loadNewsList(), loadMusicList(), loadCommentsList()]);
}

function showLogin(): void {
  const loginView = document.getElementById('admin-login-view');
  const dashboardView = document.getElementById('admin-dashboard-view');

  dashboardView?.classList.add('hidden');
  loginView?.classList.remove('hidden');
}

function setupTabButtons(): void {
  document.getElementById('tab-btn-news')?.addEventListener('click', () => switchTab('news'));
  document.getElementById('tab-btn-music')?.addEventListener('click', () => switchTab('music'));
  document.getElementById('tab-btn-comments')?.addEventListener('click', () => switchTab('comments'));
}

async function initAdmin(): Promise<void> {
  const loginForm = document.getElementById('admin-login-form') as HTMLFormElement | null;
  const passwordInput = document.getElementById('admin-password-input') as HTMLInputElement | null;
  const loginSubmitBtn = document.getElementById('admin-login-submit') as HTMLButtonElement | null;
  const logoutBtn = document.getElementById('admin-logout-btn');

  logoutBtn?.addEventListener('click', () => {
    logoutAdmin();
    showLogin();
  });

  window.addEventListener('ro-admin:logout', () => {
    showLogin();
  });

  loginForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = passwordInput?.value || '';
    if (!password) {
      showToast('Please enter your admin password.', 'error');
      return;
    }

    if (loginSubmitBtn) loginSubmitBtn.disabled = true;

    try {
      const ok = await loginAdmin(password);
      if (ok) {
        const session = await checkSession();
        await showDashboard(session);
        if (passwordInput) passwordInput.value = '';
      }
    } finally {
      if (loginSubmitBtn) loginSubmitBtn.disabled = false;
    }
  });

  // Initial check
  const session = await checkSession();
  if (session.authenticated) {
    await showDashboard(session);
  } else {
    showLogin();
  }
}

// DOMContentLoaded Guard
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdmin);
} else {
  initAdmin();
}
