import { useEffect, useId, useMemo, useState } from 'react';
import { LocateFixed, Search } from 'lucide-react';

import type { UserLocation } from '@/types';
import { DestinationPicker } from '@/components/DestinationPicker';
import { useNearbyRestaurants } from '@/hooks/useNearbyRestaurants';
import { buildRoomNearbyPlaces, type RoomNearbyPlace } from '@/lib/groupNearbyPlaces';
import { DEFAULT_SEARCH_RADIUS, SEARCH_RADII, SEARCH_RADIUS_HINT, type SearchDestination, type SearchRadius } from '@/lib/searchDestination';
import { ArcadeButton, FOCUS_RING } from '@/screens/arcade';
import { cn } from '@/lib/utils';

export interface GroupNearbyFillProps {
  deviceLocation: UserLocation | null;
  locationLoading: boolean;
  locationError: string | null;
  onRequestLocation: () => void;
  disabled: boolean;
  /** The parent confirms replacement of existing room places. Resolves true when shared. */
  onUseNearby: (places: RoomNearbyPlace[]) => Promise<boolean>;
}

type Center = { kind: 'device' } | { kind: 'destination'; destination: SearchDestination };

/**
 * Host/co-host only: search Google Maps around the host's location or a searched area, then
 * share the ticked places with the room. Members never call Google; they read the shared list.
 */
export function GroupNearbyFill({ deviceLocation, locationLoading, locationError, onRequestLocation, disabled, onUseNearby }: GroupNearbyFillProps) {
  const [center, setCenter] = useState<Center>({ kind: 'device' });
  const [radiusKm, setRadiusKm] = useState<SearchRadius>(DEFAULT_SEARCH_RADIUS);
  const [requested, setRequested] = useState(false);
  const [deselected, setDeselected] = useState<Set<string>>(() => new Set());
  const [isSharing, setIsSharing] = useState(false);
  const radiusId = useId();
  const resultsId = useId();
  const location = center.kind === 'destination' ? center.destination.coordinates : deviceLocation;
  const nearby = useNearbyRestaurants({ enabled: requested && Boolean(location), location, radiusKm, openNowOnly: true });
  const places = useMemo(() => buildRoomNearbyPlaces(nearby.restaurants), [nearby.restaurants]);
  const selected = places.filter(place => !deselected.has(place.name.toLowerCase()));
  const centerLabel = center.kind === 'destination' ? center.destination.label : deviceLocation ? 'Near you' : 'Your location';

  // A new center or radius starts a fresh search and selection.
  const reset = () => { setRequested(false); setDeselected(new Set()); };
  useEffect(() => { if (!deviceLocation && center.kind === 'device') setRequested(false); }, [center.kind, deviceLocation]);

  const find = () => {
    if (center.kind === 'device' && !deviceLocation) onRequestLocation();
    setDeselected(new Set());
    setRequested(true);
  };

  const toggle = (name: string) => setDeselected(prev => {
    const next = new Set(prev);
    const key = name.toLowerCase();
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });

  const share = async () => {
    if (selected.length < 1 || disabled || isSharing) return;
    setIsSharing(true);
    try { if (await onUseNearby(selected)) reset(); } finally { setIsSharing(false); }
  };

  const waitingForDevice = requested && center.kind === 'device' && !deviceLocation;
  const busy = nearby.isLoading || (waitingForDevice && locationLoading);

  return (
    <div className="space-y-2 px-3 pb-3">
      <p className="text-sm">Search around you or another area. The places you tick are shared with everyone in the room.</p>
      <p className="break-words text-sm font-semibold">Around: {centerLabel}</p>
      <div className="flex flex-wrap gap-2">
        <ArcadeButton
          disabled={disabled}
          aria-pressed={center.kind === 'device'}
          onClick={() => { setCenter({ kind: 'device' }); reset(); if (!deviceLocation) onRequestLocation(); }}
          className="min-h-11 flex-1 px-3 text-sm"
        >
          <LocateFixed size={16} aria-hidden="true" />
          Use my location
        </ArcadeButton>
        <div className="flex-1">
          <DestinationPicker
            triggerLabel="Search an area"
            destination={center.kind === 'destination' ? center.destination : null}
            hasDeviceLocation={Boolean(deviceLocation)}
            disabled={disabled}
            onSelect={destination => { setCenter({ kind: 'destination', destination }); reset(); }}
            onCurrentLocation={() => { setCenter({ kind: 'device' }); reset(); if (!deviceLocation) onRequestLocation(); }}
          />
        </div>
      </div>
      <label htmlFor={radiusId} className="block text-sm font-semibold">Distance</label>
      <select
        id={radiusId}
        value={radiusKm}
        disabled={disabled}
        onChange={event => { setRadiusKm(Number(event.target.value) as SearchRadius); reset(); }}
        className={cn('min-h-12 w-full rounded-xl border-[3px] border-brand-ink bg-white px-3 py-2 font-heading text-base text-brand-ink disabled:opacity-60', FOCUS_RING)}
      >
        {SEARCH_RADII.map(radius => <option key={radius} value={radius}>{radius} km · {SEARCH_RADIUS_HINT[radius]}</option>)}
      </select>
      <ArcadeButton variant="cyan" disabled={disabled || busy} onClick={find} className="w-full px-3 text-sm">
        <Search size={16} aria-hidden="true" />
        {busy ? 'Finding places…' : 'Find places'}
      </ArcadeButton>
      {waitingForDevice && locationError && <p role="alert" className="text-sm font-semibold">{locationError} Try searching an area instead.</p>}
      {requested && nearby.error && <p role="alert" className="break-words text-sm font-semibold">{nearby.error}</p>}
      {requested && !busy && location && !nearby.error && places.length === 0 && (
        <p role="status" className="text-sm">No open places found. Try a wider distance or another area.</p>
      )}
      {places.length > 0 && (
        <>
          <fieldset aria-describedby={resultsId} className="space-y-1">
            <legend className="text-sm font-semibold">{selected.length} of {places.length} places selected</legend>
            <ul className="max-h-72 space-y-1 overflow-y-auto overscroll-contain">
              {places.map(place => (
                <li key={place.name}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border-2 border-brand-ink bg-white px-2 py-1">
                    <input
                      type="checkbox"
                      checked={!deselected.has(place.name.toLowerCase())}
                      disabled={disabled || isSharing}
                      onChange={() => toggle(place.name)}
                      className="h-5 w-5 shrink-0 accent-brand-ink"
                    />
                    <span className="min-w-0 break-words text-sm font-semibold">{place.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          <p id={resultsId} className="text-xs">Long names are shortened to fit the room.</p>
          <ArcadeButton variant="pink" disabled={disabled || isSharing || selected.length === 0} onClick={() => { void share(); }} className="w-full px-3 text-sm">
            {isSharing ? 'Sharing…' : `Share ${selected.length} ${selected.length === 1 ? 'place' : 'places'} with room`}
          </ArcadeButton>
        </>
      )}
      <p translate="no" className="font-sans text-xs font-normal text-[#5E5E5E]">Google Maps</p>
    </div>
  );
}
