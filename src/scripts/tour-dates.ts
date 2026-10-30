interface BandsintownOffer {
  type: string;
  url: string;
  status: string;
}

interface BandsintownEvent {
  id: string;
  datetime: string;
  title?: string;
  url: string;
  venue: {
    name: string;
    city: string;
    country?: string;
    region?: string;
  };
  offers?: BandsintownOffer[];
}

interface PastShowItem {
  date: string;
  timestamp: number;
  venue: string;
  city: string;
}

const ARTIST_NAME = 'Ro Halfhide';
const APP_ID = 'js_rohalfhide.com';
const API_TIMEOUT_MS = 6000;

function formatEventDate(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return isoStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoStr;
  }
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(id);
    return response;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function fetchUpcomingEvents(): Promise<BandsintownEvent[]> {
  const url = `https://rest.bandsintown.com/V3.1/artists/${encodeURIComponent(ARTIST_NAME)}/events?app_id=${APP_ID}`;
  const response = await fetchWithTimeout(url, API_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Bandsintown API returned HTTP ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function fetchPastEvents(): Promise<BandsintownEvent[]> {
  const url = `https://rest.bandsintown.com/V3.1/artists/${encodeURIComponent(ARTIST_NAME)}/events?app_id=${APP_ID}&date=past`;
  const response = await fetchWithTimeout(url, API_TIMEOUT_MS);
  if (!response.ok) {
    throw new Error(`Bandsintown API returned HTTP ${response.status}`);
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

function renderUpcomingShows(events: BandsintownEvent[]) {
  const skeletonEl = document.getElementById('shows-skeleton');
  const emptyStateEl = document.getElementById('shows-empty-state');
  const listEl = document.getElementById('shows-list');
  const countEl = document.getElementById('shows-count');

  if (skeletonEl) skeletonEl.classList.add('hidden');

  if (events.length === 0) {
    if (emptyStateEl) emptyStateEl.classList.remove('hidden');
    if (listEl) listEl.classList.add('hidden');
    if (countEl) countEl.classList.add('hidden');
    return;
  }

  if (emptyStateEl) emptyStateEl.classList.add('hidden');
  if (!listEl) return;

  listEl.innerHTML = '';
  listEl.classList.remove('hidden');

  if (countEl) {
    countEl.textContent = `${events.length} ${events.length === 1 ? 'Date' : 'Dates'}`;
    countEl.classList.remove('hidden');
  }

  events.forEach((event) => {
    const row = document.createElement('div');
    row.className = 'py-4 grid grid-cols-12 gap-4 items-center shadow-divider-b last:shadow-none';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'col-span-4 sm:col-span-3 font-mono text-xs text-accent font-medium';
    dateSpan.textContent = formatEventDate(event.datetime);

    const venueSpan = document.createElement('span');
    venueSpan.className = 'col-span-5 sm:col-span-5 font-sans font-medium text-sm text-surface-ink truncate';
    venueSpan.textContent = event.venue?.name || event.title || 'Live Performance';

    const locationSpan = document.createElement('span');
    locationSpan.className = 'hidden sm:block col-span-2 text-right font-mono text-xs uppercase tracking-[0.16em] text-surface-subtle truncate';
    locationSpan.textContent = event.venue?.city || '';

    const actionCol = document.createElement('div');
    actionCol.className = 'col-span-3 sm:col-span-2 text-right';

    const ticketOffer = event.offers && event.offers.length > 0 ? event.offers[0] : null;
    if (ticketOffer && ticketOffer.url) {
      const ticketLink = document.createElement('a');
      ticketLink.href = ticketOffer.url;
      ticketLink.target = '_blank';
      ticketLink.rel = 'noopener noreferrer';
      ticketLink.className = 'inline-flex items-center font-mono text-xs text-accent hover:text-accent-hover tracking-wider uppercase underline underline-offset-4 transition-colors';
      ticketLink.textContent = 'Tickets';
      ticketLink.setAttribute('aria-label', `Buy tickets for ${event.venue?.name || 'show'}`);
      actionCol.appendChild(ticketLink);
    } else {
      const mobileCity = document.createElement('span');
      mobileCity.className = 'sm:hidden font-mono text-xs uppercase tracking-[0.16em] text-surface-subtle';
      mobileCity.textContent = event.venue?.city || '';
      actionCol.appendChild(mobileCity);
    }

    row.appendChild(dateSpan);
    row.appendChild(venueSpan);
    row.appendChild(locationSpan);
    row.appendChild(actionCol);
    listEl.appendChild(row);
  });
}

function handleUpcomingError() {
  const skeletonEl = document.getElementById('shows-skeleton');
  const errorEl = document.getElementById('shows-error-state');
  const listEl = document.getElementById('shows-list');
  const emptyStateEl = document.getElementById('shows-empty-state');

  if (skeletonEl) skeletonEl.classList.add('hidden');
  if (listEl) listEl.classList.add('hidden');
  if (emptyStateEl) emptyStateEl.classList.add('hidden');
  if (errorEl) errorEl.classList.remove('hidden');
}

function renderPastShows(apiPastEvents: BandsintownEvent[]) {
  const container = document.getElementById('past-shows-list');
  if (!container) return;

  const existingItems: PastShowItem[] = [
    { date: 'Sep 21, 2025', timestamp: new Date('2025-09-21').getTime(), venue: 'De Vos', city: 'Tilburg' },
    { date: 'May 25, 2025', timestamp: new Date('2025-05-25').getTime(), venue: 'Café de Bruine Pij', city: 'Breda' },
  ];

  apiPastEvents.forEach((ev) => {
    const formatted = formatEventDate(ev.datetime);
    const venueName = ev.venue?.name || 'Live Show';
    const cityName = ev.venue?.city || '';
    const timestamp = new Date(ev.datetime).getTime();

    const isDuplicate = existingItems.some(
      (item) => item.venue.toLowerCase() === venueName.toLowerCase() || item.date === formatted
    );

    if (!isDuplicate) {
      existingItems.push({
        date: formatted,
        timestamp: isNaN(timestamp) ? 0 : timestamp,
        venue: venueName,
        city: cityName,
      });
    }
  });

  existingItems.sort((a, b) => b.timestamp - a.timestamp);

  container.innerHTML = '';
  existingItems.forEach((show) => {
    const row = document.createElement('div');
    row.className = 'py-4 grid grid-cols-12 gap-4 items-center shadow-divider-b last:shadow-none past-show-item';

    const dateSpan = document.createElement('span');
    dateSpan.className = 'col-span-4 sm:col-span-3 font-mono text-xs text-surface-muted';
    dateSpan.textContent = show.date;

    const venueSpan = document.createElement('span');
    venueSpan.className = 'col-span-5 sm:col-span-6 font-sans font-medium text-sm text-surface-ink';
    venueSpan.textContent = show.venue;

    const citySpan = document.createElement('span');
    citySpan.className = 'col-span-3 text-right font-mono text-xs uppercase tracking-[0.16em] text-surface-subtle';
    citySpan.textContent = show.city;

    row.appendChild(dateSpan);
    row.appendChild(venueSpan);
    row.appendChild(citySpan);
    container.appendChild(row);
  });
}

async function initTourDates() {
  const showsSection = document.getElementById('shows');
  if (!showsSection) return;

  try {
    const upcomingEvents = await fetchUpcomingEvents();
    renderUpcomingShows(upcomingEvents);
  } catch (err) {
    handleUpcomingError();
  }

  try {
    const pastEvents = await fetchPastEvents();
    if (pastEvents.length > 0) {
      renderPastShows(pastEvents);
    }
  } catch {
    // Keep statically rendered fallback list if past events fetch fails
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initTourDates);
} else {
  initTourDates();
}
