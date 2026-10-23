import { useEffect, useRef, useState } from 'react';
import { ChevronRight, MapPin } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { autocompleteDestinations, resolveDestination, type DestinationSuggestion } from '@/lib/googlePlacesDestinations';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { SEARCH_RADII, type SearchDestination, type SearchRadius } from '@/lib/searchDestination';

export interface DestinationPickerProps {
  triggerLabel?: string;
  initialQuery?: string;
  destination: SearchDestination | null;
  radiusKm: SearchRadius | null;
  effectiveRadiusKm: number;
  openNowOnly: boolean;
  disabled: boolean;
  onSelect: (destination: SearchDestination) => void;
  onCurrentLocation: () => void;
  onRadiusChange: (radius: SearchRadius) => void;
  onOpenNowChange: (value: boolean) => void;
}
const control = 'min-h-11 rounded-xl border-[3px] border-brand-ink px-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-orange disabled:opacity-50';

export function DestinationPicker(props: DestinationPickerProps) {
  const [open, setOpen] = useState(false);
  const viewport = useVisualViewport(open);
  const compact = Boolean(props.triggerLabel) || (!props.destination && props.radiusKm == null);
  return <div className={props.triggerLabel ? 'min-w-0 text-brand-ink' : compact ? 'ml-5 mt-2 shrink-0 text-brand-ink' : 'mx-5 mt-3 rounded-2xl border-[3px] border-brand-ink bg-white p-3 text-brand-ink shadow-pop'}>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild><button disabled={props.disabled} className={props.triggerLabel ? `${control} flex items-center justify-center gap-2 bg-white text-sm` : compact ? `${control} flex size-11 items-center justify-center bg-white px-0` : "flex min-h-11 w-full items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"}>
        {props.triggerLabel ? <><MapPin size={16} aria-hidden="true" /><span>{props.triggerLabel}</span></> : <>
        <MapPin aria-hidden="true" className="shrink-0 text-brand-orange" /><span className={compact ? "sr-only" : "min-w-0 flex-1"}><span className="block text-xs font-bold uppercase">Search around</span><span className="block truncate font-heading text-lg font-bold">{props.destination?.label ?? 'Current location'}</span>{props.destination?.address && <span className="block truncate text-xs">{props.destination.address}</span>}</span>{!compact && <ChevronRight aria-hidden="true" />}</>}

      </button></SheetTrigger>
      <SheetContent side="top" style={viewport ? { top: viewport.offsetTop, maxHeight: Math.max(viewport.height - 8, 200) } : undefined} className="mx-auto max-h-[85dvh] max-w-lg overflow-y-auto overscroll-contain rounded-b-3xl border-[3px] border-brand-ink bg-white p-5 pb-5 text-brand-ink">
        <SheetTitle className="pr-6 font-heading text-2xl font-bold">Where are you heading?</SheetTitle>
        <SheetDescription className={viewport && viewport.height < 600 ? 'sr-only' : undefined}>Choose an area, landmark, mall, or address to find food around it.</SheetDescription>
        {open && <DestinationSearch initialQuery={props.initialQuery} onSelect={(destination) => { props.onSelect(destination); setOpen(false); }} onCurrentLocation={() => { props.onCurrentLocation(); setOpen(false); }} />}
        {compact && !props.triggerLabel && <RadiusControls {...props} />}
      </SheetContent>
    </Sheet>
    {!compact && <RadiusControls {...props} />}
    {props.destination && !props.triggerLabel && <p translate="no" className="mt-2 font-sans text-xs font-normal text-[#5E5E5E]">Google Maps</p>}
  </div>;
}

function DestinationSearch({ onSelect, onCurrentLocation, initialQuery }: Pick<DestinationPickerProps, 'onSelect' | 'onCurrentLocation' | 'initialQuery'>) {
  const [query, setQuery] = useState(initialQuery ?? '');
  const [suggestions, setSuggestions] = useState<DestinationSuggestion[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const token = useRef<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    if (query.trim().length < 2) return;
    const abort = new AbortController();
    controller.current = abort;
    const timer = setTimeout(async () => {
      setBusy(true);
      token.current ??= crypto.randomUUID();
      try { const results = await autocompleteDestinations(query.trim(), token.current, abort.signal); if (!abort.signal.aborted) setSuggestions(results); }
      catch (err) { if (!abort.signal.aborted) setError(err instanceof Error ? err.message : 'Destination search failed'); }
      finally { if (!abort.signal.aborted) setBusy(false); }
    }, 400);
    return () => { clearTimeout(timer); abort.abort(); };
  }, [query]);
  useEffect(() => () => { controller.current?.abort(); token.current = null; }, []);
  const select = async (suggestion: DestinationSuggestion) => {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    const sessionToken = token.current;
    token.current = null; // Details terminates the session, including failed/abandoned attempts.
    if (!sessionToken) { setSuggestions([]); setError('Please search again to choose a destination.'); return; }
    setBusy(true); setError(null);
    try { const destination = await resolveDestination(suggestion, sessionToken, abort.signal); if (!abort.signal.aborted) onSelect(destination); }
    catch (err) { if (!abort.signal.aborted) { setError(err instanceof Error ? err.message : 'Unable to select destination'); setSuggestions([]); } }
    finally { if (!abort.signal.aborted) setBusy(false); }
  };
  return <>
    <label className="sr-only" htmlFor="destination-query">Search destination</label>
    <input id="destination-query" type="search" enterKeyHint="search" autoComplete="off" placeholder="Search area, mall, or address" value={query} onChange={(e) => { controller.current?.abort(); setBusy(false); setError(null); setSuggestions([]); setQuery(e.target.value); }} className={`${control} w-full bg-white text-base`} />
    <button className={`${control} bg-arcade-cyan`} onClick={onCurrentLocation}>Use my current location</button>
    {busy && <p role="status">Finding your destination…</p>}
    {error && <p role="alert" className="text-sm text-eatspin-error">{error}</p>}
    {!busy && !error && query.trim().length >= 2 && suggestions.length === 0 && <p className="text-sm">No matching places yet. Try a more specific name.</p>}
    <ul aria-label="Matching places" className="space-y-2">{suggestions.map((s) => <li key={s.placeId}><button disabled={busy} onClick={() => void select(s)} className={`${control} w-full bg-white py-2 text-left`}><span className="block font-bold">{s.label}</span><span className="block text-sm font-normal">{s.address}</span></button></li>)}</ul>
    <p translate="no" className="font-sans text-xs font-normal text-[#5E5E5E]">Google Maps</p>
  </>;
}

function RadiusControls(props: DestinationPickerProps) {
  return <>    <div className="mt-3 border-t border-brand-ink/20 pt-3"><p className="mb-2 text-sm font-semibold">Radius · {props.effectiveRadiusKm} km</p><div role="group" aria-label="Search radius" className="grid grid-cols-4 gap-2">{SEARCH_RADII.map((radius) => <button key={radius} disabled={props.disabled} aria-pressed={props.radiusKm === radius} onClick={() => props.onRadiusChange(radius)} className={`${control} px-1 ${props.radiusKm === radius ? 'bg-arcade-pink' : 'bg-white'}`}>{radius} km</button>)}</div></div>
    <button type="button" role="checkbox" aria-checked={props.openNowOnly} disabled={props.disabled} onClick={() => props.onOpenNowChange(!props.openNowOnly)} className="mt-2 flex min-h-11 w-full items-center gap-2 rounded-lg text-left text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-orange"><span aria-hidden="true" className={`flex size-5 items-center justify-center rounded border-2 border-brand-ink ${props.openNowOnly ? 'bg-arcade-cyan' : 'bg-white'}`}>{props.openNowOnly ? '✓' : ''}</span>Open now only</button>
    <p className="text-xs text-eatspin-gray-1">Distances are from {props.destination ? props.destination.label : 'your current location'}. {props.openNowOnly ? '' : 'Check opening hours before you go.'}</p>
  </>;
}
