/**
 * Address lookup for case and property locations.
 *
 * Uses OpenStreetMap Nominatim: no API key, no billing account, and it covers
 * Nigeria well enough for street-level results in the cities this platform
 * operates in. Google Places would give better rural coverage but needs a key
 * in the client bundle and a card on file.
 *
 * Nominatim's usage policy requires an identifying User-Agent or Referer and
 * caps automated use at one request per second. Browsers set Referer
 * automatically and forbid setting User-Agent, so the referer satisfies the
 * attribution requirement; the rate limit is enforced below.
 */

const NOMINATIM = 'https://nominatim.openstreetmap.org';

/** Bias results toward Nigeria — this is a Nigerian platform. */
const COUNTRY_CODES = 'ng';

export interface PlaceResult {
  /** Full formatted address, suitable for the Location field. */
  displayName: string;
  /** Short label: street + area, for a compact UI. */
  shortName: string;
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
}

interface NominatimAddress {
  road?: string;
  neighbourhood?: string;
  suburb?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  country?: string;
  postcode?: string;
  house_number?: string;
}

interface NominatimPlace {
  display_name: string;
  lat: string;
  lon: string;
  address?: NominatimAddress;
}

/**
 * Nominatim rejects bursts. Requests are serialised with a minimum gap so a
 * user dragging a map pin does not get themselves rate-limited.
 */
let lastRequestAt = 0;
const MIN_GAP_MS = 1100;

async function throttle(): Promise<void> {
  const wait = Math.max(0, lastRequestAt + MIN_GAP_MS - Date.now());
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
}

function toPlace(raw: NominatimPlace): PlaceResult {
  const a = raw.address ?? {};
  const city = a.city ?? a.town ?? a.village;

  // A concise label beats Nominatim's full comma-chain, which often runs to
  // eight segments including the postcode and country.
  const shortName =
    [
      [a.house_number, a.road].filter(Boolean).join(' '),
      a.neighbourhood ?? a.suburb,
      city,
      a.state,
    ]
      .filter(Boolean)
      .join(', ') || raw.display_name;

  return {
    displayName: raw.display_name,
    shortName,
    latitude: parseFloat(raw.lat),
    longitude: parseFloat(raw.lon),
    city,
    state: a.state,
    country: a.country,
  };
}

/**
 * Coordinates → address.
 *
 * Returns null rather than throwing: a case must still be fileable when the
 * lookup fails, and a missing street name is not a reason to block someone
 * reporting a crime.
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<PlaceResult | null> {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  try {
    await throttle();
    const url = new URL(`${NOMINATIM}/reverse`);
    url.searchParams.set('lat', String(latitude));
    url.searchParams.set('lon', String(longitude));
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    // 18 = building level. Lower numbers give a wider area when the exact
    // building is unmapped, which is common outside major Nigerian cities.
    url.searchParams.set('zoom', '18');

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;

    const data = (await res.json()) as NominatimPlace & { error?: string };
    if (data.error || !data.display_name) return null;

    return toPlace(data);
  } catch {
    return null;
  }
}

/** Free-text → candidate places, for an autocomplete field. */
export async function searchPlaces(
  query: string,
  limit = 5
): Promise<PlaceResult[]> {
  const q = query.trim();
  if (q.length < 3) return [];

  try {
    await throttle();
    const url = new URL(`${NOMINATIM}/search`);
    url.searchParams.set('q', q);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('countrycodes', COUNTRY_CODES);

    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return [];

    const data = (await res.json()) as NominatimPlace[];
    return Array.isArray(data) ? data.map(toPlace) : [];
  } catch {
    return [];
  }
}

/**
 * Asks the browser for the device position, then resolves it to an address.
 *
 * The two are returned together because callers always want both: the
 * coordinates for the record, the address for the human reading it.
 */
export async function locateMe(): Promise<{
  coords: { latitude: number; longitude: number; accuracy: number } | null;
  place: PlaceResult | null;
  error: string | null;
}> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return { coords: null, place: null, error: 'This device does not report location.' };
  }

  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(p),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 }
    );
  });

  if (!position) {
    return {
      coords: null,
      place: null,
      error:
        'Could not get your location. Allow location access in your browser, or type the address instead.',
    };
  }

  const coords = {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
  };

  const place = await reverseGeocode(coords.latitude, coords.longitude);
  return { coords, place, error: null };
}
