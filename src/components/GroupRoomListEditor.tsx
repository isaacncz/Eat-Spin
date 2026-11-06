import { useId, useState, type FormEvent, type ReactNode } from 'react';
import { Copy, MoreHorizontal, Plus, RotateCw, Trash2, X } from 'lucide-react';

import type { ManualList, Restaurant } from '@/types';
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useVisualViewport } from '@/hooks/useVisualViewport';
import { ArcadeButton, ArcadeIconButton, FOCUS_RING } from '@/screens/arcade';
import { cn } from '@/lib/utils';

export interface GroupRoomListEditorProps {
  lists: ManualList[];
  places: Restaurant[];
  canEdit: boolean;
  isSpinning: boolean;
  connected: boolean;
  syncState: 'saved' | 'saving' | 'error';
  syncError: string | null;
  onRetry: () => void;
  /** True means the change was accepted locally, not necessarily saved to the room yet. */
  onAdd: (name: string) => boolean;
  onRemove: (id: string) => void;
  onClear: () => void;
  /** The parent confirms replacement of an existing room list. */
  onUseSavedList: (listId: string) => Promise<boolean>;
  onSaveCopy: () => void;
  /** Host/co-host panel that fills the room from a Google Maps nearby search; `done` closes the sheet. */
  renderNearbyFill?: (done: () => void) => ReactNode;
}

type AddTab = 'nearby' | 'saved' | 'type';

const FIELD_CLASS = cn(
  'min-h-12 w-full rounded-xl border-[3px] border-brand-ink bg-white px-3 py-2 font-heading text-base text-brand-ink',
  'placeholder:text-eatspin-gray-2 disabled:cursor-not-allowed disabled:opacity-60',
  FOCUS_RING,
);
const TAB_CLASS = cn(
  'min-h-10 flex-1 rounded-[10px] border-0 px-2 font-heading text-sm font-semibold text-brand-ink',
  'data-[state=active]:bg-brand-ink data-[state=active]:font-bold data-[state=active]:text-white data-[state=active]:shadow-none',
  FOCUS_RING,
);

/**
 * Room-only places as removable chips. One "Add places" sheet holds the three ways to add:
 * nearby search, a saved personal list (previewed until the explicit button publishes it) and
 * typing a name.
 */
export function GroupRoomListEditor({
  lists,
  places,
  canEdit,
  isSpinning,
  connected,
  syncState,
  syncError,
  onRetry,
  onAdd,
  onRemove,
  onClear,
  onUseSavedList,
  onSaveCopy,
  renderNearbyFill,
}: GroupRoomListEditorProps) {
  const [input, setInput] = useState('');
  const [selectedListId, setSelectedListId] = useState(() => lists[0]?.id ?? '');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState<AddTab>(renderNearbyFill ? 'nearby' : lists.length ? 'saved' : 'type');
  const viewport = useVisualViewport(sheetOpen);
  const inputId = useId();
  const pickerId = useId();
  const previewId = useId();
  const headingId = useId();
  const selectedList = lists.find(list => list.id === selectedListId) ?? lists[0] ?? null;
  const editsDisabled = !canEdit || isSpinning || isLoadingList;
  const status = !connected
    ? syncState === 'saved' ? 'Offline · reconnecting…' : 'Offline · room changes are pending'
    : syncState === 'saving' ? 'Saving to room…'
      : syncState === 'error' ? 'Room changes could not be saved' : 'Saved to room';
  const close = () => setSheetOpen(false);
  const needed = Math.max(0, 2 - places.length);

  const handleAdd = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = input.trim();
    if (!name || editsDisabled) return;
    if (onAdd(name)) setInput('');
  };

  const handleUseSavedList = async () => {
    if (!selectedList || editsDisabled || !connected) return;
    setIsLoadingList(true);
    setLoadError(null);
    try {
      if (await onUseSavedList(selectedList.id)) close();
    } catch {
      setLoadError('Could not load this list. Your personal list is unchanged. Try again.');
    } finally {
      setIsLoadingList(false);
    }
  };

  // Keep the sheet above an overlaying software keyboard.
  const sheetStyle = viewport && typeof window !== 'undefined'
    ? { bottom: Math.max(0, window.innerHeight - viewport.offsetTop - viewport.height), maxHeight: Math.max(viewport.height - 8, 240) }
    : undefined;

  return (
    <section aria-labelledby={headingId} className="space-y-3 font-heading text-brand-ink">
      <h2 id={headingId} className="sr-only">Room places</h2>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold">{places.length} {places.length === 1 ? 'place' : 'places'} on the wheel</p>
          <p role="status" className="text-xs font-semibold text-eatspin-gray-1">{status}</p>
        </div>
        {places.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ArcadeIconButton aria-label="More room place actions"><MoreHorizontal size={20} aria-hidden="true" /></ArcadeIconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl border-[3px] border-brand-ink font-heading text-brand-ink">
              <DropdownMenuItem className="min-h-11 font-semibold" onSelect={onSaveCopy}>
                <Copy size={16} aria-hidden="true" />Save a personal copy
              </DropdownMenuItem>
              {canEdit && <DropdownMenuItem className="min-h-11 font-semibold" disabled={editsDisabled} onSelect={onClear}>
                <Trash2 size={16} aria-hidden="true" />Clear room places
              </DropdownMenuItem>}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
      {syncState === 'error' && (
        <div className="space-y-2 rounded-xl border-2 border-brand-ink bg-arcade-yellow/60 p-3">
          {syncError && <p role="alert" className="break-words text-sm">{syncError}</p>}
          {canEdit && (
            <ArcadeButton disabled={!connected || isSpinning || isLoadingList} onClick={onRetry} className="min-h-11 px-3 text-sm">
              <RotateCw size={16} aria-hidden="true" />
              Retry room save
            </ArcadeButton>
          )}
        </div>
      )}

      {places.length > 0 ? (
        <ul aria-label="Places in this room" className="flex flex-wrap gap-1.5">
          {places.map(place => (
            <li key={place.id} className="flex min-h-11 max-w-full items-center rounded-full border-[3px] border-brand-ink bg-eatspin-linen pl-3 text-sm font-semibold">
              <span className="min-w-0 break-words py-1">{place.name}</span>
              {canEdit ? (
                <button
                  type="button"
                  aria-label={`Remove ${place.name} from room`}
                  disabled={editsDisabled}
                  onClick={() => onRemove(place.id)}
                  className={cn('inline-flex size-10 shrink-0 items-center justify-center rounded-full disabled:opacity-50', FOCUS_RING)}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              ) : <span className="pr-3" />}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border-[3px] border-dashed border-brand-ink bg-white p-3 text-sm font-semibold">
          {canEdit ? 'Add at least 2 places to spin: search nearby, load a saved list, or type a name.' : 'The host or a co-host is preparing the room places.'}
        </p>
      )}

      {canEdit ? (
        <>
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <ArcadeButton variant="pink" disabled={editsDisabled} className="w-full px-3 text-base">
                <Plus size={18} aria-hidden="true" />
                Add places{needed > 0 ? ` · ${needed} more to spin` : ''}
              </ArcadeButton>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              style={sheetStyle}
              className="mx-auto max-h-[88dvh] max-w-lg gap-3 overflow-y-auto overscroll-contain rounded-t-3xl border-x-[3px] border-t-4 border-brand-ink bg-white p-4 pb-6 font-heading text-brand-ink"
            >
              <SheetTitle className="pr-8 font-heading text-2xl font-bold">Add places</SheetTitle>
              <SheetDescription className="text-sm">Places you add are shared with everyone in this room. Your personal lists stay unchanged.</SheetDescription>
              <Tabs value={tab} onValueChange={value => setTab(value as AddTab)}>
                <TabsList aria-label="Ways to add places" className="flex h-auto w-full gap-1 rounded-[14px] border-[3px] border-brand-ink bg-eatspin-linen p-1">
                  {renderNearbyFill && <TabsTrigger value="nearby" className={TAB_CLASS}>Nearby</TabsTrigger>}
                  {lists.length > 0 && <TabsTrigger value="saved" className={TAB_CLASS}>Saved list</TabsTrigger>}
                  <TabsTrigger value="type" className={TAB_CLASS}>Type a name</TabsTrigger>
                </TabsList>

                {renderNearbyFill && <TabsContent value="nearby" className="-mx-3 pt-2">{renderNearbyFill(close)}</TabsContent>}

                {lists.length > 0 && <TabsContent value="saved" className="space-y-2 pt-2">
                  <label htmlFor={pickerId} className="block text-sm font-semibold">Choose a saved list</label>
                  <select
                    id={pickerId}
                    value={selectedList?.id ?? ''}
                    onChange={event => { setSelectedListId(event.target.value); setLoadError(null); }}
                    disabled={editsDisabled}
                    aria-describedby={previewId}
                    className={FIELD_CLASS}
                  >
                    {lists.map(list => (
                      <option key={list.id} value={list.id}>
                        {list.name} · {list.restaurants.length} {list.restaurants.length === 1 ? 'place' : 'places'}
                      </option>
                    ))}
                  </select>
                  <p id={previewId} className="break-words text-sm">
                    {selectedList ? `${selectedList.name} has ${selectedList.restaurants.length} ${selectedList.restaurants.length === 1 ? 'place' : 'places'}. ` : ''}
                    Only the list you load will be shared with this room. Your personal copy stays unchanged.
                  </p>
                  <ArcadeButton
                    variant="cyan"
                    disabled={editsDisabled || !connected || !selectedList || selectedList.restaurants.length === 0}
                    onClick={() => { void handleUseSavedList(); }}
                    className="w-full px-3 text-sm"
                  >
                    {isLoadingList ? 'Loading list…' : 'Use this list in room'}
                  </ArcadeButton>
                  {loadError && <p role="alert" className="text-sm font-semibold">{loadError}</p>}
                </TabsContent>}

                <TabsContent value="type" className="pt-2">
                  <form onSubmit={handleAdd} className="space-y-2">
                    <label htmlFor={inputId} className="block text-sm font-semibold">Add a room place</label>
                    <div className="flex gap-2">
                      <input
                        id={inputId}
                        value={input}
                        onChange={event => setInput(event.target.value)}
                        disabled={editsDisabled}
                        placeholder="Restaurant name"
                        autoComplete="off"
                        enterKeyHint="done"
                        className={cn(FIELD_CLASS, 'min-w-0 flex-1')}
                      />
                      <ArcadeButton type="submit" variant="pink" disabled={editsDisabled || !input.trim()} className="shrink-0 px-3 text-sm">
                        <Plus size={18} aria-hidden="true" />
                        Add to room
                      </ArcadeButton>
                    </div>
                    <p className="text-sm">{places.length} {places.length === 1 ? 'place' : 'places'} in the room so far.</p>
                  </form>
                </TabsContent>
              </Tabs>
              {isSpinning && <p className="text-sm">You can edit the room places after the spin finishes.</p>}
            </SheetContent>
          </Sheet>
        </>
      ) : (
        <p className="text-sm">Only the host and co-hosts can change these places.</p>
      )}

      {isSpinning && canEdit && <p className="text-sm">You can edit the room places after the spin finishes.</p>}
    </section>
  );
}
