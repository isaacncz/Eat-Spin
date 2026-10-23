import { useId, useState, type FormEvent } from 'react';
import { Copy, Plus, RotateCw, Trash2, X } from 'lucide-react';

import type { ManualList, Restaurant } from '@/types';
import { ArcadeButton, ArcadeIconButton, FOCUS_RING, InitialTile } from '@/screens/arcade';
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
}

const FIELD_CLASS = cn(
  'min-h-12 w-full rounded-xl border-[3px] border-brand-ink bg-white px-3 py-2 font-heading text-base text-brand-ink',
  'placeholder:text-eatspin-gray-2 disabled:cursor-not-allowed disabled:opacity-60',
  FOCUS_RING,
);

/** Room-only places. Choosing a personal list previews it; the explicit button publishes it. */
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
}: GroupRoomListEditorProps) {
  const [input, setInput] = useState('');
  const [selectedListId, setSelectedListId] = useState(() => lists[0]?.id ?? '');
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
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
      await onUseSavedList(selectedList.id);
    } catch {
      setLoadError('Could not load this list. Your personal list is unchanged. Try again.');
    } finally {
      setIsLoadingList(false);
    }
  };

  return (
    <section aria-labelledby={headingId} className="space-y-3 font-heading text-brand-ink">
      <h2 id={headingId} className="sr-only">Room places</h2>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="text-sm font-semibold">{places.length} {places.length === 1 ? 'place' : 'places'}</p>
        <p role="status" className="text-sm font-semibold">{status}</p>
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

      {canEdit && lists.length > 0 && (
        <details open={places.length === 0} className="rounded-2xl border-[3px] border-brand-ink bg-arcade-yellow/40">
          <summary className={cn('min-h-11 cursor-pointer rounded-xl px-3 py-3 text-sm font-semibold', FOCUS_RING)}>
            Load a saved list
          </summary>
          <div className="space-y-2 px-3 pb-3">
            <label htmlFor={pickerId} className="block text-sm font-semibold">Saved list</label>
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
          </div>
        </details>
      )}

      {places.length > 0 ? (
        <ul aria-label="Places in this room" className="space-y-2">
          {places.map(place => (
            <li key={place.id} className="flex items-center gap-2 rounded-2xl border-[3px] border-brand-ink bg-white p-2">
              <InitialTile name={place.name} />
              <span className="min-w-0 flex-1 break-words font-semibold">{place.name}</span>
              {canEdit && (
                <ArcadeIconButton
                  aria-label={`Remove ${place.name} from room`}
                  disabled={editsDisabled}
                  onClick={() => onRemove(place.id)}
                >
                  <X size={20} aria-hidden="true" />
                </ArcadeIconButton>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-2xl border-[3px] border-dashed border-brand-ink bg-white p-3 text-sm font-semibold">
          {canEdit ? 'Add at least 2 places to spin, or load one of your saved lists.' : 'The host or a co-host is preparing the room places.'}
        </p>
      )}

      {canEdit ? (
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
        </form>
      ) : (
        <p className="text-sm">Only the host and co-hosts can change these places.</p>
      )}

      {isSpinning && canEdit && <p className="text-sm">You can edit the room places after the spin finishes.</p>}

      {places.length > 0 && (
        <div className="flex flex-wrap gap-2">
          <ArcadeButton onClick={onSaveCopy} className="min-h-11 flex-1 px-3 text-sm">
            <Copy size={16} aria-hidden="true" />
            Save a personal copy
          </ArcadeButton>
          {canEdit && (
            <ArcadeButton onClick={onClear} disabled={editsDisabled} className="min-h-11 flex-1 px-3 text-sm">
              <Trash2 size={16} aria-hidden="true" />
              Clear room places
            </ArcadeButton>
          )}
        </div>
      )}
    </section>
  );
}
