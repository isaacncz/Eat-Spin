import { useId, useRef, useState, type CSSProperties } from 'react';
import { Check, ChevronDown, Heart, List, Plus, Search, X } from 'lucide-react';

import { ListSheet } from '@/components/ListSheet';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { cn } from '@/lib/utils';
import { ArcadeButton, ArcadeIconButton, FOCUS_RING } from '@/screens/arcade';
import type { ManualList } from '@/types';

interface ListPickerProps {
  lists: ManualList[];
  selectedListId: string | null;
  favouritesCount: number;
  showingFavourites: boolean;
  disabled: boolean;
  onSelectList: (id: string) => void;
  onShowFavourites: () => void;
  onCreateList: () => void;
}

export function ListPicker(props: ListPickerProps) {
  const [open, setOpen] = useState(false);
  const [opener, setOpener] = useState<HTMLButtonElement | null>(null);
  const selected = props.lists.find(list => list.id === props.selectedListId);
  const name = props.showingFavourites ? 'Favourites' : selected?.name ?? 'Choose a list';
  const count = props.showingFavourites ? props.favouritesCount : selected?.restaurants.length ?? 0;
  const CurrentIcon = props.showingFavourites ? Heart : List;

  return <>
    <div className="flex min-w-0 gap-2">
      <button type="button" disabled={props.disabled}
        aria-label={`Choose a list: ${name}, ${count} ${count === 1 ? 'place' : 'places'}`} aria-haspopup="dialog" aria-expanded={open}
        onClick={event => { setOpener(event.currentTarget); setOpen(true); }}
        className={cn('flex min-h-[68px] min-w-0 flex-1 items-center gap-2 rounded-2xl border-[3px] border-brand-ink bg-white p-2.5 text-left shadow-pop disabled:opacity-50', FOCUS_RING)}>
        <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl border-2 border-brand-ink', props.showingFavourites ? 'bg-arcade-pink/30' : 'bg-arcade-cyan')}>
          <CurrentIcon size={20} aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-heading text-base font-bold">{name}</span>
          <span className="block text-xs text-eatspin-gray-1">{count} {count === 1 ? 'place' : 'places'}</span>
        </span>
        <ChevronDown size={18} aria-hidden="true" className="shrink-0" />
      </button>
      <ArcadeButton aria-label="Create new list" disabled={props.disabled} onClick={props.onCreateList}
        className="shrink-0 gap-1 bg-arcade-yellow/30 px-3 text-sm shadow-pop">
        <Plus size={17} aria-hidden="true" />New list
      </ArcadeButton>
    </div>
    {open && <PickerSheet {...props} focusTarget={opener} onClose={() => setOpen(false)} />}
  </>;
}

function PickerSheet({ lists, selectedListId, favouritesCount, showingFavourites, disabled, onSelectList, onShowFavourites, onCreateList, focusTarget, onClose }: ListPickerProps & {
  focusTarget: HTMLElement | null;
  onClose: () => void;
}) {
  // Mount a fresh search on every opening; editing the collection never stores search state.
  const [query, setQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const searchId = useId();
  const viewport = useVisualViewport(true);
  const height = viewport ? Math.min(710, Math.max(0, viewport.height - 12)) : null;
  const style = viewport && height !== null ? {
    '--picker-height': `${height}px`,
    '--picker-top': `${viewport.offsetTop + viewport.height - height}px`,
  } as CSSProperties : undefined;
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const matches = lists.filter(list => list.name.toLocaleLowerCase().includes(normalizedQuery)).sort((a, b) => {
    if (!showingFavourites) {
      if (a.id === selectedListId) return -1;
      if (b.id === selectedListId) return 1;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true }) || a.id.localeCompare(b.id);
  });
  const clearSearch = () => { setQuery(''); searchRef.current?.focus(); };
  const create = () => { if (!disabled) { onClose(); onCreateList(); } };

  return <ListSheet title="Choose a list" description="Your saved lists, all in one place." focusTarget={focusTarget} onClose={onClose}
    style={style}
    onOpenAutoFocus={event => {
      event.preventDefault();
      // Avoid opening a phone keyboard just to switch lists.
      if (window.matchMedia('(min-width: 640px)').matches) searchRef.current?.focus();
      else closeRef.current?.focus();
    }}
    className={cn('flex h-[min(710px,90dvh)] flex-col gap-0 overflow-hidden border-[3px] border-brand-ink sm:h-[min(710px,90dvh)]',
      viewport && 'max-sm:bottom-auto max-sm:top-[var(--picker-top)] max-sm:h-[var(--picker-height)] max-sm:max-h-[var(--picker-height)]',
      '[&>[data-slot=dialog-title]]:pr-11 [&>[data-slot=dialog-description]]:mb-4 [&>[data-slot=dialog-description]]:mt-1 [&>[data-slot=dialog-description]]:text-sm')}>
    <button ref={closeRef} type="button" onClick={onClose} aria-label="Close list picker"
      className={cn('absolute right-4 top-7 flex size-9 items-center justify-center rounded-full border-2 border-brand-ink bg-white sm:top-4', FOCUS_RING)}>
      <X size={19} aria-hidden="true" />
    </button>
    <label htmlFor={searchId} className={cn('flex min-h-12 shrink-0 items-center gap-2 rounded-xl border-[3px] border-brand-ink bg-white px-3 focus-within:ring-2 focus-within:ring-brand-orange')}>
      <Search size={20} aria-hidden="true" />
      <span className="sr-only">Search your lists</span>
      <input ref={searchRef} id={searchId} value={query} onChange={event => setQuery(event.target.value)}
        placeholder="Search your lists…" autoComplete="off" enterKeyHint="search"
        className="h-11 min-w-0 flex-1 bg-transparent text-base outline-none" />
      {query && <ArcadeIconButton aria-label="Clear search" onClick={clearSearch} className="-mr-2 size-11 shrink-0"><X size={18} aria-hidden="true" /></ArcadeIconButton>}
    </label>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      {(favouritesCount > 0 || showingFavourites) && <button type="button" disabled={disabled} aria-label="Open favourites" aria-pressed={showingFavourites}
        onClick={() => { onShowFavourites(); onClose(); }}
        className={cn('my-3 flex min-h-14 w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left disabled:opacity-50', showingFavourites ? 'border-brand-ink bg-arcade-pink/20' : 'border-transparent bg-arcade-pink/10', FOCUS_RING)}>
        <Heart size={22} aria-hidden="true" /><span className="min-w-0 flex-1 font-semibold">Favourites</span>
        <span className="text-xs">{favouritesCount} {favouritesCount === 1 ? 'place' : 'places'}</span>
      </button>}
      <p role="status" className="mb-2 mt-3 shrink-0 text-xs font-medium uppercase tracking-wide text-eatspin-gray-1">
        {normalizedQuery ? 'Matching lists' : 'Your lists'} · {matches.length}
      </p>
      {matches.length ? <ul aria-label="Saved lists" className="space-y-1.5">
        {matches.map(list => <PickerRow key={list.id} list={list} selected={!showingFavourites && list.id === selectedListId} disabled={disabled}
          onSelect={() => { onSelectList(list.id); onClose(); }} />)}
      </ul> : <div className="px-2 py-6 text-center text-sm text-eatspin-gray-1">
        <p>{normalizedQuery ? 'No lists match your search.' : 'No saved lists yet. Create your first list below.'}</p>
        {normalizedQuery && <button type="button" onClick={clearSearch} className={cn('mt-2 min-h-11 rounded px-3 font-semibold underline underline-offset-4', FOCUS_RING)}>Clear search</button>}
      </div>}
    </div>
    <ArcadeButton aria-label="Create new list" variant="yellow" disabled={disabled} onClick={create} className="mt-3 shrink-0 shadow-pop">
      <Plus size={20} aria-hidden="true" />New list
    </ArcadeButton>
  </ListSheet>;
}

function PickerRow({ list, selected, disabled, onSelect }: { list: ManualList; selected: boolean; disabled: boolean; onSelect: () => void }) {
  const descriptionId = useId();
  const count = list.restaurants.length;
  const meal = list.mealTime ? list.mealTime.charAt(0).toUpperCase() + list.mealTime.slice(1) : 'Any meal';
  return <li>
    <button type="button" aria-label={`Open list ${list.name}`} aria-describedby={descriptionId} aria-pressed={selected}
      disabled={disabled} onClick={onSelect}
      className={cn('flex min-h-[60px] w-full items-center gap-3 rounded-xl border-2 px-3 py-2 text-left disabled:opacity-50',
        selected ? 'border-brand-ink bg-arcade-pink/20' : 'border-transparent bg-white hover:bg-arcade-yellow/20', FOCUS_RING)}>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-base font-semibold">{list.name}</span>
        <span id={descriptionId} className="block text-xs text-eatspin-gray-1">{count} {count === 1 ? 'place' : 'places'} · {meal}</span>
      </span>
      {selected && <span aria-hidden="true" className="flex size-6 shrink-0 items-center justify-center rounded-full border-2 border-brand-ink bg-arcade-pink"><Check size={14} strokeWidth={3} /></span>}
    </button>
  </li>;
}
