export const KNOWN_SPOTIFY_TRACKS: Record<string, string> = {
  surabayakutha: 'https://open.spotify.com/track/7Efy8Sn5G66PLjl3V7CcHV',
  eveningsun: 'https://open.spotify.com/track/1cedTVv89YDonTGkwjt72X',
  itsbeengood: 'https://open.spotify.com/track/1ZtrRsMJlTWw7g1MDmluJP',
  paintthetown: 'https://open.spotify.com/track/0M3F2KLZjnFVI6M7CQ5odP',
  louise: 'https://open.spotify.com/track/5nq7mUZFb0SyKjNtG1ULXc',
  malaysiastyle: 'https://open.spotify.com/track/4IIyCrXxdmPXcnXp70loUq',
  santaclausishere: 'https://open.spotify.com/track/4lKPNZKwkcTpeMtsF37WbV',
  foritisxmastime: 'https://open.spotify.com/track/0cnoapEqroHsDKOD99AhJW',
  foryassermurtajafreepalestine: 'https://open.spotify.com/track/4aoMsM4AEMjZTZi1I0owcg',
  foryassermurtaja: 'https://open.spotify.com/track/4aoMsM4AEMjZTZi1I0owcg',
  freepalestine: 'https://open.spotify.com/track/4aoMsM4AEMjZTZi1I0owcg',
  theywereonlylaughing: 'https://open.spotify.com/track/1k8cxFlypQfcQZx5cnr22o',
  eattherich: 'https://open.spotify.com/track/2YXTFWSdD4dwRqbwDvfLcH',
  itsgettingbetter: 'https://open.spotify.com/track/4npjKwlZixwtjQnNF94YDl',
  whycantwebefriends: 'https://open.spotify.com/track/1ycCjy7mAft5Uba6QsIPov',
  whycantwebefriendscosiloveyoutoomuchforthat: 'https://open.spotify.com/track/1ycCjy7mAft5Uba6QsIPov',
  friendship: 'https://open.spotify.com/track/62EZyrrmxaVKPa0VVCZ1KH',
};

export function cleanTrackTitle(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export function slugifyTrackTitle(text: string): string {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function findKnownSpotifyTrack(title: string): string | null {
  const target = cleanTrackTitle(title);
  if (!target || target.length < 2) return null;

  for (const [key, url] of Object.entries(KNOWN_SPOTIFY_TRACKS)) {
    if (key === target || key.includes(target) || target.includes(key)) {
      return url;
    }
  }
  return null;
}

export function buildBandcampUrl(title: string): string | null {
  const slug = slugifyTrackTitle(title);
  if (!slug) return null;
  return `https://rohalfhide.bandcamp.com/track/${slug}`;
}
