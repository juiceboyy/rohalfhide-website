import {
  verifyAdminPassword,
  createSessionToken,
  requireAdminAuth,
  isAuthConfigured,
} from './utils/admin-auth-guard.mjs';
import { getGitHubConfig } from './utils/github-api.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

export default async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  // 1. POST: Login with password
  if (req.method === 'POST') {
    try {
      const body = await req.json().catch(() => ({}));
      const { password } = body;

      if (!password) {
        return Response.json(
          { error: 'Password is required.' },
          { status: 400, headers: JSON_HEADERS }
        );
      }

      if (!isAuthConfigured()) {
        return Response.json(
          {
            error:
              'ADMIN_PASSWORD is not set in environment variables. Please configure ADMIN_PASSWORD in Netlify.',
          },
          { status: 503, headers: JSON_HEADERS }
        );
      }

      const isValid = verifyAdminPassword(password);
      if (!isValid) {
        return Response.json(
          { error: 'Invalid password. Please check your credentials.' },
          { status: 401, headers: JSON_HEADERS }
        );
      }

      const token = createSessionToken();
      const { branch, owner, repo } = getGitHubConfig();

      return Response.json(
        {
          ok: true,
          token,
          repoInfo: { owner, repo, branch },
          message: 'Authenticated successfully.',
        },
        { status: 200, headers: JSON_HEADERS }
      );
    } catch (err) {
      console.error('admin-auth error:', err);
      return Response.json(
        { error: 'Internal server error during authentication.' },
        { status: 500, headers: JSON_HEADERS }
      );
    }
  }

  // 2. GET: Session verification & status check
  if (req.method === 'GET') {
    const authError = requireAdminAuth(req);
    if (authError) {
      return authError;
    }

    const { branch, owner, repo, isConfigured } = getGitHubConfig();
    return Response.json(
      {
        ok: true,
        authenticated: true,
        gitHub: {
          isConfigured,
          branch,
          owner,
          repo,
        },
      },
      { status: 200, headers: JSON_HEADERS }
    );
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
};
