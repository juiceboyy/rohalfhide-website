import { getEnv } from './google-auth.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';

const GITHUB_API_URL = 'https://api.github.com';
const FETCH_TIMEOUT_MS = 8000;

export function getGitHubConfig() {
  const token = getEnv('GITHUB_TOKEN');
  const owner = getEnv('GITHUB_REPO_OWNER') || 'juiceboyy';
  const repo = getEnv('GITHUB_REPO_NAME') || 'rohalfhide-website';
  const branch = getEnv('GITHUB_BRANCH') || 'dev';

  return { token, owner, repo, branch, isConfigured: Boolean(token) };
}

function getLocalRoot() {
  return process.cwd();
}

async function githubFetch(endpoint, options = {}) {
  const { token } = getGitHubConfig();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(`${GITHUB_API_URL}${endpoint}`, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'RoHalfhide-CMS/1.0',
        ...(options.headers || {}),
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * List files in a repository directory.
 */
export async function listDirectory(dirPath) {
  const { isConfigured, owner, repo, branch } = getGitHubConfig();

  if (!isConfigured) {
    const fullLocalPath = path.join(getLocalRoot(), dirPath);
    try {
      const entries = await fs.readdir(fullLocalPath, { withFileTypes: true });
      return entries
        .filter((entry) => entry.isFile())
        .map((entry) => ({
          name: entry.name,
          path: `${dirPath}/${entry.name}`,
          type: 'file',
        }));
    } catch {
      return [];
    }
  }

  const res = await githubFetch(
    `/repos/${owner}/${repo}/contents/${dirPath}?ref=${encodeURIComponent(branch)}`
  );

  if (res.status === 404) return [];
  if (!res.ok) {
    throw new Error(`GitHub API error listing directory (${res.status})`);
  }

  const data = await res.json();
  return Array.isArray(data) ? data : [];
}

/**
 * Read a file's UTF-8 contents and current SHA.
 */
export async function readFile(filePath) {
  const { isConfigured, owner, repo, branch } = getGitHubConfig();

  if (!isConfigured) {
    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT) {
      throw new Error(
        `GITHUB_TOKEN is not configured in Netlify environment variables for branch "${branch}". Please set GITHUB_TOKEN in your Netlify site settings.`
      );
    }
    const fullLocalPath = path.join(getLocalRoot(), filePath);
    try {
      const content = await fs.readFile(fullLocalPath, 'utf8');
      return { content, sha: 'local', path: filePath };
    } catch {
      return null;
    }
  }

  const res = await githubFetch(
    `/repos/${owner}/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`
  );

  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`GitHub API error reading ${filePath} (${res.status})`);
  }

  const data = await res.json();
  const decoded = Buffer.from(data.content || '', 'base64').toString('utf8');
  return { content: decoded, sha: data.sha, path: data.path };
}

/**
 * Save or update a file.
 * Accepts either UTF-8 text or Base64 (for binary files such as images/audio).
 */
export async function saveFile({
  filePath,
  content,
  commitMessage,
  isBase64 = false,
  sha = null,
}) {
  const { isConfigured, owner, repo, branch } = getGitHubConfig();

  if (!isConfigured) {
    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT) {
      throw new Error(
        `GITHUB_TOKEN is not configured in Netlify environment variables for branch "${branch}". Please set GITHUB_TOKEN in your Netlify site settings so changes can be committed to Git.`
      );
    }
    const fullLocalPath = path.join(getLocalRoot(), filePath);
    await fs.mkdir(path.dirname(fullLocalPath), { recursive: true });
    if (isBase64) {
      await fs.writeFile(fullLocalPath, Buffer.from(content, 'base64'));
    } else {
      await fs.writeFile(fullLocalPath, content, 'utf8');
    }
    return { ok: true, mode: 'local', path: filePath };
  }

  let fileSha = sha;
  if (!fileSha) {
    const existing = await readFile(filePath);
    if (existing) fileSha = existing.sha;
  }

  const base64Content = isBase64
    ? content
    : Buffer.from(content, 'utf8').toString('base64');

  const body = {
    message: commitMessage || `CMS update: ${filePath}`,
    content: base64Content,
    branch,
  };

  if (fileSha) {
    body.sha = fileSha;
  }

  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`GitHub API error committing ${filePath} (${res.status}): ${errText}`);
  }

  const data = await res.json();
  return { ok: true, mode: 'github', sha: data.content?.sha, path: filePath };
}

/**
 * Delete a file from the repository.
 */
export async function deleteFile({ filePath, commitMessage, sha = null }) {
  const { isConfigured, owner, repo, branch } = getGitHubConfig();

  if (!isConfigured) {
    if (process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT) {
      throw new Error(
        `GITHUB_TOKEN is not configured in Netlify environment variables for branch "${branch}". Please set GITHUB_TOKEN in your Netlify site settings.`
      );
    }
    const fullLocalPath = path.join(getLocalRoot(), filePath);
    try {
      await fs.unlink(fullLocalPath);
      return { ok: true, mode: 'local', path: filePath };
    } catch {
      return { ok: false, mode: 'local', path: filePath };
    }
  }

  let fileSha = sha;
  if (!fileSha) {
    const existing = await readFile(filePath);
    if (!existing) {
      return { ok: true, message: 'File already deleted' };
    }
    fileSha = existing.sha;
  }

  const body = {
    message: commitMessage || `CMS delete: ${filePath}`,
    sha: fileSha,
    branch,
  };

  const res = await githubFetch(`/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok && res.status !== 404) {
    const errText = await res.text();
    throw new Error(`GitHub API error deleting ${filePath} (${res.status}): ${errText}`);
  }

  return { ok: true, mode: 'github', path: filePath };
}
