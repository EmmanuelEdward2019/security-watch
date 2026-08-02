import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Crosshair, Search, Check, LoaderCircle } from 'lucide-react';
import { Input } from './Input';
import { Button } from './Button';
import { reverseGeocode, searchPlaces, locateMe, type PlaceResult } from '@/services/geocodingService';
import { cn } from '@/utils/cn';
import toast from 'react-hot-toast';

export interface LocationValue {
  location: string;
  latitude?: number;
  longitude?: number;
}

export interface LocationPickerProps {
  value: LocationValue;
  onChange: (value: LocationValue) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  required?: boolean;
}

/**
 * Address entry that resolves coordinates to a real place name.
 *
 * The case form previously captured latitude and longitude into bare number
 * fields and left the Location field for the user to type. That produced case
 * records reading "6.5244, 3.3792" — which is unusable for the investigator who
 * has to go there, and unsearchable for everyone else.
 *
 * Three ways in, all of which populate both the address and the coordinates:
 *   * "Use my location" — device GPS, reverse-geocoded
 *   * typing — debounced search with suggestions
 *   * pasting coordinates — detected and reverse-geocoded automatically
 */
export function LocationPicker({
  value,
  onChange,
  label = 'Location',
  placeholder = 'Street, area, city — or use your current location',
  error,
  required,
}: LocationPickerProps) {
  const [query, setQuery] = useState(value.location);
  const [suggestions, setSuggestions] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [open, setOpen] = useState(false);
  const [resolved, setResolved] = useState(!!value.latitude);

  const boxRef = useRef<HTMLDivElement | null>(null);
  const debounceRef = useRef<number | null>(null);
  // Suppresses the search that would otherwise fire from programmatic setQuery.
  const skipNextSearch = useRef(false);

  useEffect(() => {
    setQuery(value.location);
    setResolved(!!value.latitude);
  }, [value.location, value.latitude]);

  // Close the suggestion list on an outside click.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const commit = useCallback(
    (place: PlaceResult) => {
      skipNextSearch.current = true;
      setQuery(place.shortName);
      setSuggestions([]);
      setOpen(false);
      setResolved(true);
      onChange({
        location: place.shortName,
        latitude: place.latitude,
        longitude: place.longitude,
      });
    },
    [onChange]
  );

  /** "6.5244, 3.3792" pasted into the field — resolve it rather than storing it. */
  const tryCoordinatePaste = useCallback(
    async (text: string): Promise<boolean> => {
      const m = text.trim().match(/^(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)$/);
      if (!m) return false;

      const lat = parseFloat(m[1]);
      const lon = parseFloat(m[2]);
      if (Math.abs(lat) > 90 || Math.abs(lon) > 180) return false;

      setSearching(true);
      const place = await reverseGeocode(lat, lon);
      setSearching(false);

      if (place) {
        commit(place);
        toast.success('Coordinates resolved to an address.');
      } else {
        // Keep the coordinates rather than losing them, but say so.
        skipNextSearch.current = true;
        setQuery(`${lat}, ${lon}`);
        setResolved(false);
        onChange({ location: `${lat}, ${lon}`, latitude: lat, longitude: lon });
        toast('Coordinates saved, but no address was found for them.', { icon: 'ℹ️' });
      }
      return true;
    },
    [commit, onChange]
  );

  const handleChange = (next: string) => {
    setQuery(next);
    setResolved(false);
    onChange({ ...value, location: next });

    if (skipNextSearch.current) {
      skipNextSearch.current = false;
      return;
    }

    if (debounceRef.current) window.clearTimeout(debounceRef.current);

    debounceRef.current = window.setTimeout(async () => {
      if (await tryCoordinatePaste(next)) return;
      if (next.trim().length < 3) {
        setSuggestions([]);
        return;
      }
      setSearching(true);
      const results = await searchPlaces(next);
      setSearching(false);
      setSuggestions(results);
      setOpen(results.length > 0);
    }, 500);
  };

  const handleLocateMe = async () => {
    setLocating(true);
    const { coords, place, error: locErr } = await locateMe();
    setLocating(false);

    if (locErr || !coords) {
      toast.error(locErr ?? 'Could not determine your location.');
      return;
    }

    if (place) {
      commit(place);
      toast.success(`Located: ${place.shortName}`);
      return;
    }

    // GPS worked but the address lookup did not — keep the fix.
    skipNextSearch.current = true;
    const fallback = `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;
    setQuery(fallback);
    setResolved(false);
    onChange({ location: fallback, latitude: coords.latitude, longitude: coords.longitude });
    toast('Location captured, but no street address was found.', { icon: 'ℹ️' });
  };

  return (
    <div className="w-full" ref={boxRef}>
      <div className="relative">
        <Input
          label={label}
          placeholder={placeholder}
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          error={error}
          required={required}
          icon={MapPin}
          autoComplete="off"
          aria-expanded={open}
          aria-autocomplete="list"
        />

        {(searching || locating) && (
          <LoaderCircle
            size={16}
            className="absolute right-3 top-9 animate-spin text-surface-400"
            aria-hidden
          />
        )}

        {open && suggestions.length > 0 && (
          <ul
            role="listbox"
            className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-surface-200 bg-white shadow-lg"
          >
            {suggestions.map((place) => (
              <li key={`${place.latitude},${place.longitude}`}>
                <button
                  type="button"
                  role="option"
                  aria-selected="false"
                  onClick={() => commit(place)}
                  className="flex w-full items-start gap-2 px-3 py-2.5 text-left hover:bg-surface-50 focus:outline-none focus-visible:bg-surface-50"
                >
                  <MapPin size={15} className="mt-0.5 shrink-0 text-surface-400" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-surface-800">
                      {place.shortName}
                    </span>
                    <span className="block truncate text-xs text-surface-500">
                      {place.displayName}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={locating ? LoaderCircle : Crosshair}
          onClick={() => void handleLocateMe()}
          disabled={locating}
        >
          {locating ? 'Locating…' : 'Use my location'}
        </Button>

        {value.latitude != null && value.longitude != null && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5 text-xs tabular-nums',
              resolved ? 'text-brand-700' : 'text-amber-700'
            )}
          >
            {resolved ? <Check size={12} /> : <Search size={12} />}
            {value.latitude.toFixed(5)}, {value.longitude.toFixed(5)}
            {!resolved && ' — address not resolved'}
          </span>
        )}
      </div>

      <p className="mt-1.5 text-xs text-surface-500">
        Start typing an address, or use your current location. Coordinates are recorded alongside
        the address so the assigned professional can navigate to the exact spot.
      </p>
    </div>
  );
}
