import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MapPin } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { autocompleteDestinations, resolveDestination, type DestinationSuggestion } from '@/lib/googlePlacesDestinations';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import type { SearchDestination } from '@/lib/searchDestination';

export interface DestinationPickerProps {
  /** Renders a small labelled button instead of the full-width "where" row. */
  triggerLabel?: string;
  initialQuery?: string;
  destination: SearchDestination | null;
  /** Whether the device location is known (labels the row "Near you" instead of asking). */
  hasDeviceLocation: boolean;
  disabled: boolean;
  onSelect: (destination: SearchDestination) => void;
  onCurrentLocation: () => void;
}
const control = 'min-h-11 rounded-xl border-[3px] border-brand-ink px-3 font-semibold outline-none focus-visible:ring-2 focus-visible:ring-brand-orange disabled:opacity-50';

/**
 * "Where" control. The default is a labelled pill ("📍 Mont Kiara ⌄") at the start of the quick
 * picks row, so the wheel stays above the fold; radius and open-now live in Filters. Callers show
 * the "Google Maps" attribution next to it whenever a destination name is displayed.
 */
export function DestinationPicker(props: DestinationPickerProps) {
  const [open, setOpen] = useState(false);
  const viewport = useVisualViewport(open);
  const label = props.destination?.label ?? (props.hasDeviceLocation ? 'Near you' : 'Choose an area');
  return <div className={props.triggerLabel ? 'min-w-0 text-brand-ink' : 'ml-5 mt-2 min-w-0 max-w-[48%] shrink-0 text-brand-ink'}>
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{props.triggerLabel
        ? <button disabled={props.disabled} className={`${control} flex items-center justify-center gap-2 bg-white text-sm`}>
            <MapPin size={16} aria-hidden="true" /><span>{props.triggerLabel}</span>
          </button>
        : <button
            disabled={props.disabled}
            aria-label={`Search around ${label}. Change area`}
            className="flex h-11 max-w-full items-center gap-1.5 rounded-full border-[3px] border-brand-ink bg-brand-ink pl-2.5 pr-2 text-left font-heading text-[15px] text-white shadow-[0_3px_0_#1E1B4B] outline-none transition-transform focus-visible:ring-[3px] focus-visible:ring-brand-ink focus-visible:ring-offset-2 active:translate-y-[2px] active:shadow-none disabled:opacity-50"
          >
            <MapPin size={18} strokeWidth={2.5} aria-hidden="true" className="shrink-0 text-arcade-yellow" />
            <span className="min-w-0 truncate font-bold">{label}</span>
            <ChevronDown size={16} strokeWidth={3} aria-hidden="true" className="shrink-0" />
          </button>}
      </SheetTrigger>
      <SheetContent side="top" style={viewport ? { top: viewport.offsetTop, maxHeight: Math.max(viewport.height - 8, 200) } : undefined} className="mx-auto max-h-[85dvh] max-w-lg overflow-y-auto overscroll-contain rounded-b-3xl border-[3px] border-brand-ink bg-white p-5 pb-5 text-brand-ink">
        <SheetTitle className="pr-6 font-heading text-2xl font-bold">Where are you heading?</SheetTitle>
        <SheetDescription className={viewport && viewport.height < 600 ? 'sr-only' : undefined}>Choose an area, landmark, mall, or address to find food around it. Set how far in Filters.</SheetDescription>
        {open && <DestinationSearch initialQuery={props.initialQuery} onSelect={(destination) => { props.onSelect(destination); setOpen(false); }} onCurrentLocation={() => { props.onCurrentLocation(); setOpen(false); }} />}
      </SheetContent>
    </Sheet>
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
