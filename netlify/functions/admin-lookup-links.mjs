import { requireAdminAuth } from './utils/admin-auth-guard.mjs';

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Cache-Control': 'no-cache, no-store, must-revalidate',
};

const SPOTIFY_ARTIST_ID = '79dS9zvJ6QCjz54EUdjs9u';
const BANDCAMP_ROOT = 'https://rohalfhide.bandcamp.com';
const TIMEOUT_MS = 4500;

// Verified catalog of Ro Halfhide direct Spotify track URLs
const KNOWN_SPOTIFY_CATALOG = [
  { name: 'Surabaya Kutha', url: 'https://open.spotify.com/track/7Efy8Sn5G66PLjl3V7CcHV' },
  { name: 'Evening Sun', url: 'https://open.spotify.com/track/1cedTVv89YDonTGkwjt72X' },
  { name: "It's Been Good", url: 'https://open.spotify.com/track/1ZtrRsMJlTWw7g1MDmluJP' },
  { name: 'Paint the Town', url: 'https://open.spotify.com/track/0M3F2KLZjnFVI6M7CQ5odP' },
  { name: 'Louise', url: 'https://open.spotify.com/track/5nq7mUZFb0SyKjNtG1ULXc' },
  { name: 'Malaysiastyle', url: 'https://open.spotify.com/track/4IIyCrXxdmPXcnXp70loUq' },
  { name: 'Santa Claus Is Here', url: 'https://open.spotify.com/track/4lKPNZKwkcTpeMtsF37WbV' },
  { name: 'For it is Xmas time', url: 'https://open.spotify.com/track/0cnoapEqroHsDKOD99AhJW' },
  { name: 'For Yasser Murtaja (Free Palestine)', url: 'https://open.spotify.com/track/4aoMsM4AEMjZTZi1I0owcg' },
  { name: 'They were only laughing', url: 'https://open.spotify.com/track/1k8cxFlypQfcQZx5cnr22o' },
  { name: 'Eat The Rich', url: 'https://open.spotify.com/track/2YXTFWSdD4dwRqbwDvfLcH' },
  { name: "It's Getting Better", url: 'https://open.spotify.com/track/4npjKwlZixwtjQnNF94YDl' },
  { name: "Why Can't We Be friends? (Cos I Love You Too Much For That)", url: 'https://open.spotify.com/track/1ycCjy7mAft5Uba6QsIPov' },
  { name: 'Friendship', url: 'https://open.spotify.com/track/62EZyrrmxaVKPa0VVCZ1KH' },
];

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function cleanString(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function lookupAppleMusic(title, artist = 'Ro Halfhide') {
  try {
    const query = `${artist} ${title}`.trim();
    const res = await fetchWithTimeout(
      `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=5`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.results || data.results.length === 0) return null;

    const targetClean = cleanString(title);
    const match =
      data.results.find((r) => {
        const itemClean = cleanString(r.trackName);
        return itemClean.includes(targetClean) || targetClean.includes(itemClean);
      }) || data.results[0];

    const cleanUrl = match.trackViewUrl ? match.trackViewUrl.split('?')[0] : '';
    const releaseDate = match.releaseDate ? match.releaseDate.split('T')[0] : '';
    const durationSec = match.trackTimeMillis ? Math.round(match.trackTimeMillis / 1000) : 0;
    const duration = durationSec
      ? `${Math.floor(durationSec / 60)}:${(durationSec % 60).toString().padStart(2, '0')}`
      : '';

    return {
      url: cleanUrl,
      releaseDate,
      duration,
      artwork: match.artworkUrl100
        ? match.artworkUrl100.replace('100x100bb', '1000x1000bb')
        : '',
    };
  } catch (err) {
    console.error('Apple Music lookup error:', err.message);
    return null;
  }
}

async function lookupSpotify(title) {
  const cleanTarget = cleanString(title);
  if (!cleanTarget || cleanTarget.length < 2) return null;

  // 1. Instant match from verified catalog (0ms latency, immune to bot challenges)
  for (const item of KNOWN_SPOTIFY_CATALOG) {
    const itemClean = cleanString(item.name);
    if (itemClean === cleanTarget || itemClean.includes(cleanTarget) || cleanTarget.includes(itemClean)) {
      console.log(`[Spotify Lookup] Matched known track: "${item.name}" -> ${item.url}`);
      return item.url;
    }
  }

  // 2. Dynamic lookup on Spotify artist profile
  try {
    const res = await fetchWithTimeout(
      `https://open.spotify.com/artist/${SPOTIFY_ARTIST_ID}`,
      {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }
    );
    if (!res.ok) {
      console.warn(`[Spotify Lookup] Artist page returned HTTP ${res.status}`);
      return null;
    }

    const html = await res.text();
    let matchedAlbumId = null;

    const scriptTags = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
    for (const tag of scriptTags) {
      const content = tag.replace(/<\/?script[^>]*>/g, '').trim();
      if (!content || content.length < 50) continue;

      try {
        const decoded = Buffer.from(content, 'base64').toString('utf8');
        const matches = [
          ...decoded.matchAll(
            /"name":"([^"]+)"[^}]*?"uri":"spotify:album:([a-zA-Z0-9]+)"/g
          ),
        ];

        for (const m of matches) {
          const albName = cleanString(m[1]);
          if (albName.includes(cleanTarget) || cleanTarget.includes(albName)) {
            matchedAlbumId = m[2];
            break;
          }
        }
      } catch {
        // Skip unparseable non-base64 scripts
      }

      if (matchedAlbumId) break;
    }

    if (!matchedAlbumId) return null;

    // Fetch album page to extract direct track URL
    const albRes = await fetchWithTimeout(
      `https://open.spotify.com/album/${matchedAlbumId}`,
      {
        headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      }
    );
    if (!albRes.ok) return `https://open.spotify.com/album/${matchedAlbumId}`;

    const albHtml = await albRes.text();
    const trackMatch = albHtml.match(
      /https:\/\/open\.spotify\.com\/track\/([a-zA-Z0-9]+)/
    );

    if (trackMatch) {
      return `https://open.spotify.com/track/${trackMatch[1]}`;
    }

    return `https://open.spotify.com/album/${matchedAlbumId}`;
  } catch (err) {
    console.error('Spotify dynamic lookup error:', err.message);
    return null;
  }
}

async function lookupBandcamp(title) {
  try {
    const slug = slugify(title);
    if (!slug) return null;
    return `${BANDCAMP_ROOT}/track/${slug}`;
  } catch (err) {
    console.error('Bandcamp lookup error:', err.message);
    return null;
  }
}

export default async (req) => {
  const authError = requireAdminAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const title = (url.searchParams.get('title') || '').trim();
  const artist = (url.searchParams.get('artist') || 'Ro Halfhide').trim();

  if (!title) {
    return Response.json(
      { error: 'Track title is required.' },
      { status: 400, headers: JSON_HEADERS }
    );
  }

  try {
    const [appleData, spotifyUrl, bandcampUrl] = await Promise.all([
      lookupAppleMusic(title, artist),
      lookupSpotify(title),
      lookupBandcamp(title),
    ]);

    const links = {
      spotify: spotifyUrl || '',
      appleMusic: appleData?.url || '',
      bandcamp: bandcampUrl || '',
    };

    return Response.json(
      {
        ok: true,
        title,
        artist,
        links,
        releaseDate: appleData?.releaseDate || '',
        duration: appleData?.duration || '',
        artwork: appleData?.artwork || '',
      },
      { status: 200, headers: JSON_HEADERS }
    );
  } catch (err) {
    console.error('Error finding streaming links:', err);
    return Response.json(
      { error: 'Failed to look up streaming links.', message: err.message },
      { status: 500, headers: JSON_HEADERS }
    );
  }
};
