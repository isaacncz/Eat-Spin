import { useEffect, useId, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Check, ChevronDown, ChevronLeft, LoaderPinwheel, MapPin, Pencil, Plus, Share2, Trash2, X } from 'lucide-react';

import { RarityBadge } from '@/components/RarityBadge';
import { ListPicker } from '@/components/ListPicker';
import { buildVisitCountsByName, formatVisitCount, getVisitCountForName } from '@/lib/placeVisits';
import type { Rarity } from '@/lib/rarity';
import { cn } from '@/lib/utils';
import type { ManualList, ManualListMealTime, Restaurant } from '@/types';
import type { FavouriteEntry } from '@/types/favourites';
import {
  ArcadeButton,
  ArcadeIconButton,
  FOCUS_RING,
  InitialTile,
  ScreenFrame,
  SectionLabel,
} from '@/screens/arcade';

const SUGGESTED_PLACES = ['Sushi Place', 'Burger Spot', 'Local Noodles', 'Pizza Corner'];

const ROW_CLASS =
  'flex items-center gap-3 rounded-[18px] border-[3px] border-brand-ink bg-white py-2.5 pl-3 pr-2.5 shadow-[0_3px_0_theme(colors.brand.ink)]';

const TEXT_FIELD_CLASS = cn(
  'h-12 w-full rounded-xl border-[3px] border-brand-ink bg-white px-3 font-heading text-base font-medium text-brand-ink',
  'placeholder:text-eatspin-gray-2 disabled:opacity-60',
  FOCUS_RING,
);

/** Room details shown above the list while the user is in a Group room. */
export interface ListRoomInfo {
  roomId: string;
  role: 'host' | 'cohost' | 'participant';
  /** Host and co-host can change the shared list; everyone else only views it. */
  canEdit: boolean;
  lastSpinText: string | null;
  isLateJoin: boolean;
  canSaveCopy: boolean;
  onSaveCopy: () => void;
  onLeave: () => void;
}

/** The rename / new list form. Present only while the user is editing a list's details. */
export interface ListDetailsForm {
  isCreating: boolean;
  name: string;
  mealTime: ManualListMealTime;
  helperText: string;
  hasDuplicate: boolean;
  showSuggestion: boolean;
  canSave: boolean;
  canDelete: boolean;
  onNameChange: (value: string) => void;
  onMealTimeChange: (value: ManualListMealTime) => void;
  onUseSuggestion: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
}

export interface NearbyFavouriteRow {
  favouriteId: string;
  name: string;
  travelText: string;
  rarity: Rarity;
}

export interface ListScreenProps {
  tools?: ReactNode;
  /** Saved manual lists (chips). */
  lists: ManualList[];
  selectedListId: string | null;
  /** True when the shown list belongs to a room the user cannot edit. */
  isReadOnly: boolean;
  onSelectList: (listId: string) => void;
  onCreateList: () => void;
  onShareList?: () => void;
  openWheelRequested?: boolean;
  onStartEditing: () => void;
  onDeleteSelectedList: () => void;
  canDeleteList: boolean;
  details: ListDetailsForm | null;

  /** Places on the list being shown (the room list while in a room). */
  places: Restaurant[];
  addValue: string;
  onAddValueChange: (value: string) => void;
  onAddPlace: () => void;
  onAddSuggestedPlace: (name: string) => void;
  onRemovePlace: (id: string) => void;
  onClearPlaces: () => void;

  favourites: FavouriteEntry[];
  nearbyFavourites: NearbyFavouriteRow[];
  onAddFavouriteToList: (name: string) => void;
  onRemoveFavourite: (id: string, name: string) => void;

  room: ListRoomInfo | null;

  /** The existing roulette wheel, built by the app. Shown in the spin view. */
  wheel: ReactNode;
  /** Id of a room spin that should be replayed right now, or null. Opens the spin view. */
  externalSpinId: string | null;
}

type ListView = 'list' | 'wheel';
type ListSource = 'list' | 'favourites';

/**
 * My list: the saved lists, the places on the current list and a pinned "Add a place" bar.
 * Spinning the list happens in a second view of the same tab ("Spin this list"), which hosts
 * the existing wheel, so the pinned add bar and the wheel's own pinned Spin button never
 * compete for the same spot above the tab bar.
 */
export function ListScreen({
  tools,
  lists,
  selectedListId,
  isReadOnly,
  onSelectList,
  onCreateList,
  onShareList,
  openWheelRequested = false,
  onStartEditing,
  onDeleteSelectedList,
  canDeleteList,
  details,
  places,
  addValue,
  onAddValueChange,
  onAddPlace,
  onAddSuggestedPlace,
  onRemovePlace,
  onClearPlaces,
  favourites,
  nearbyFavourites,
  onAddFavouriteToList,
  onRemoveFavourite,
  room,
  wheel,
  externalSpinId,
}: ListScreenProps) {
  const [view, setView] = useState<ListView>(externalSpinId ? 'wheel' : 'list');
  useEffect(() => { if (openWheelRequested) setView('wheel'); }, [openWheelRequested]);
  const [source, setSource] = useState<ListSource>('list');

  // A room spin that arrives while this tab is open brings the wheel up so it can play.
  const [seenSpinId, setSeenSpinId] = useState(externalSpinId);
  if (externalSpinId !== seenSpinId) {
    setSeenSpinId(externalSpinId);
    if (externalSpinId) setView('wheel');
  }

  const addInputId = useId();
  const visitCounts = useMemo(() => buildVisitCountsByName(favourites), [favourites]);
  const visibleFavourites = useMemo(
    () => favourites.filter((favourite) => favourite.userRating !== 'avoid'),
    [favourites],
  );
  const hiddenFavouriteCount = favourites.length - visibleFavourites.length;

  const selectedList = lists.find((list) => list.id === selectedListId) ?? null;
  const isInList = (name: string) => places.some((place) => place.name.toLowerCase() === name.toLowerCase());

  const placeCountText = `${places.length} ${places.length === 1 ? 'place' : 'places'}`;
  const roomBanner = room && <RoomBanner room={room} />;

  if (view === 'wheel') {
    return (
      <ScreenFrame
        title="Spin your list"
        subtitle={room ? `Room ${room.roomId} · ${placeCountText}` : placeCountText}
        headerAction={(
          <ArcadeButton className="h-11 min-h-11 shrink-0 px-3" onClick={() => setView('list')}>
            <ChevronLeft size={20} strokeWidth={3} aria-hidden="true" />
            Back to list
          </ArcadeButton>
        )}
      >
        {roomBanner}
        {tools}
        {wheel}
      </ScreenFrame>
    );
  }

  const canOpenWheel = places.length >= 2 || (room !== null && !room.canEdit);
  const openWheelLabel = room && !room.canEdit
    ? 'Open the shared wheel'
    : places.length >= 2
      ? 'Spin this list'
      : 'Add 2 places to spin';
  const showingFavourites = source === 'favourites';

  const handleAddSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onAddPlace();
  };

  const addBar = (
    <form onSubmit={handleAddSubmit} className="flex gap-2">
      <div className="min-w-0 flex-1">
        <label htmlFor={addInputId} className="sr-only">Add a place</label>
        <input
          id={addInputId}
          type="text"
          value={addValue}
          onChange={(event) => onAddValueChange(event.target.value)}
          placeholder={isReadOnly ? 'Only the host can add places' : 'Add a place...'}
          disabled={isReadOnly}
          autoComplete="off"
          enterKeyHint="done"
          className={cn(TEXT_FIELD_CLASS, 'h-[52px] rounded-2xl px-3.5')}
        />
      </div>
      <ArcadeButton
        type="submit"
        variant="pink"
        disabled={isReadOnly}
        className="h-[52px] shrink-0 rounded-2xl border-4 px-5 text-[17px] shadow-pop"
      >
        Add
      </ArcadeButton>
    </form>
  );

  const headerAction = !details && !showingFavourites && selectedList && (
    <div className="flex shrink-0 gap-1">
      {onShareList && !room && <ArcadeIconButton aria-label="Share this list" onClick={onShareList}
        className="border-[3px] border-brand-ink bg-white"><Share2 size={20} aria-hidden="true" /></ArcadeIconButton>}
      <ArcadeIconButton
        aria-label="Edit list name and meal time"
        disabled={isReadOnly}
        onClick={onStartEditing}
        className="border-[3px] border-brand-ink bg-white"
      >
        <Pencil size={20} strokeWidth={2.5} aria-hidden="true" />
      </ArcadeIconButton>
      {canDeleteList && (
        <ArcadeIconButton
          aria-label={`Delete ${selectedList.name}`}
          disabled={isReadOnly}
          onClick={onDeleteSelectedList}
          className="border-[3px] border-brand-ink bg-white"
        >
          <Trash2 size={20} strokeWidth={2.5} aria-hidden="true" />
        </ArcadeIconButton>
      )}
    </div>
  );

  return (
    <ScreenFrame
      title="My list"
      subtitle={(
        <span aria-live="polite">
          {showingFavourites
            ? `${visibleFavourites.length} saved ${visibleFavourites.length === 1 ? 'favourite' : 'favourites'}`
            : `${room ? 'Shared room list · ' : ''}${placeCountText} · spin any time`}
        </span>
      )}
      headerAction={headerAction || undefined}
      pinned={!details && !showingFavourites ? addBar : undefined}
    >
      {roomBanner}
      {tools}

      <ListPicker
        lists={lists}
        selectedListId={selectedListId}
        favouritesCount={visibleFavourites.length}
        showingFavourites={showingFavourites}
        disabled={isReadOnly}
        onSelectList={id => {
          setSource('list');
          if (id !== selectedListId || showingFavourites) onSelectList(id);
        }}
        onShowFavourites={() => setSource('favourites')}
        onCreateList={() => { setSource('list'); onCreateList(); }}
      />

      {details && <ListDetailsFormCard form={details} />}

      {!details && !showingFavourites && (
        <>
          <ArcadeButton
            variant="cyan"
            disabled={!canOpenWheel}
            onClick={() => setView('wheel')}
            className="w-full"
          >
            <LoaderPinwheel size={22} strokeWidth={2.5} aria-hidden="true" />
            {openWheelLabel}
          </ArcadeButton>

          {places.length === 0 ? (
            <EmptyListCard
              isReadOnly={isReadOnly}
              onAddSuggestedPlace={onAddSuggestedPlace}
            />
          ) : (
            <ul aria-label="Places on this list" className="flex flex-col gap-2.5">
              {places.map((place) => (
                <li key={place.id} className={ROW_CLASS}>
                  <InitialTile name={place.name} />
                  <div className="min-w-0 flex-1">
                    <p className="break-words font-heading text-[17px] font-semibold leading-snug text-brand-ink">
                      {place.name}
                    </p>
                    <p className="font-heading text-[13px] font-medium text-eatspin-gray-1">
                      {formatVisitCount(getVisitCountForName(visitCounts, place.name))}
                    </p>
                  </div>
                  <ArcadeIconButton
                    aria-label={`Remove ${place.name}`}
                    disabled={isReadOnly}
                    onClick={() => onRemovePlace(place.id)}
                  >
                    <X size={20} strokeWidth={3} aria-hidden="true" />
                  </ArcadeIconButton>
                </li>
              ))}
            </ul>
          )}

          {places.length > 1 && !isReadOnly && (
            <div className="flex justify-end">
              <ArcadeButton
                aria-label="Clear all places"
                className="min-h-11 border-[3px] px-4 text-sm"
                onClick={onClearPlaces}
              >
                Clear all
              </ArcadeButton>
            </div>
          )}

          {nearbyFavourites.length > 0 && (
            <section aria-labelledby="near-you-heading">
              <SectionLabel id="near-you-heading">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={16} aria-hidden="true" />
                  Near you
                </span>
              </SectionLabel>
              <ul className="flex flex-col gap-2.5">
                {nearbyFavourites.map((nearby) => (
                  <li key={nearby.favouriteId} className={ROW_CLASS}>
                    <InitialTile name={nearby.name} />
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-heading text-[17px] font-semibold leading-snug text-brand-ink">
                        {nearby.name}
                      </p>
                      <div className="flex flex-wrap items-center gap-1.5 font-heading text-[13px] font-medium text-eatspin-gray-1">
                        <span>{nearby.travelText}</span>
                        <RarityBadge rarity={nearby.rarity} />
                      </div>
                    </div>
                    <AddToListAction
                      name={nearby.name}
                      alreadyInList={isInList(nearby.name)}
                      isReadOnly={isReadOnly}
                      onAdd={onAddFavouriteToList}
                    />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {!details && showingFavourites && (
        <>
          <ul aria-label="Favourites" className="flex flex-col gap-2.5">
            {visibleFavourites.map((favourite) => (
              <li key={favourite.id} className={ROW_CLASS}>
                <InitialTile name={favourite.restaurant.name} />
                <div className="min-w-0 flex-1">
                  <p className="break-words font-heading text-[17px] font-semibold leading-snug text-brand-ink">
                    {favourite.restaurant.name}
                  </p>
                  <p className="font-heading text-[13px] font-medium text-eatspin-gray-1">
                    {formatVisitCount(favourite.visitCount)}
                  </p>
                </div>
                <AddToListAction
                  name={favourite.restaurant.name}
                  alreadyInList={isInList(favourite.restaurant.name)}
                  isReadOnly={isReadOnly}
                  onAdd={onAddFavouriteToList}
                />
                <ArcadeIconButton
                  aria-label={`Remove ${favourite.restaurant.name} from favourites`}
                  onClick={() => onRemoveFavourite(favourite.id, favourite.restaurant.name)}
                >
                  <X size={20} strokeWidth={3} aria-hidden="true" />
                </ArcadeIconButton>
              </li>
            ))}
          </ul>
          {hiddenFavouriteCount > 0 && (
            <p className="font-heading text-sm font-medium text-eatspin-gray-1">
              {hiddenFavouriteCount} hidden (marked &quot;don&apos;t suggest&quot;)
            </p>
          )}
        </>
      )}
    </ScreenFrame>
  );
}

const chipClass = (isSelected: boolean) => cn(
  'inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full border-[3px] border-brand-ink px-4 font-heading text-[15px] text-brand-ink',
  'transition-colors motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-40',
  FOCUS_RING,
  isSelected ? 'bg-arcade-pink font-bold' : 'bg-white font-semibold hover:bg-arcade-yellow/60',
);

interface AddToListActionProps {
  name: string;
  alreadyInList: boolean;
  isReadOnly: boolean;
  onAdd: (name: string) => void;
}

/** "Add" for a place that is not on the list yet, a check mark for one that is. */
function AddToListAction({ name, alreadyInList, isReadOnly, onAdd }: AddToListActionProps) {
  if (alreadyInList) {
    return (
      <span className="inline-flex min-h-11 shrink-0 items-center gap-1 font-heading text-sm font-semibold text-eatspin-success">
        <Check size={16} strokeWidth={3} aria-hidden="true" />
        In list
      </span>
    );
  }
  if (isReadOnly) return null;

  return (
    <ArcadeButton
      variant="cyan"
      aria-label={`Add ${name} to spin list`}
      onClick={() => onAdd(name)}
      className="min-h-11 shrink-0 px-3 text-sm"
    >
      <Plus size={16} strokeWidth={3} aria-hidden="true" />
      Add
    </ArcadeButton>
  );
}

function EmptyListCard({
  isReadOnly,
  onAddSuggestedPlace,
}: {
  isReadOnly: boolean;
  onAddSuggestedPlace: (name: string) => void;
}) {
  return (
    <div className="rounded-2xl border-[3px] border-dashed border-brand-ink bg-white/70 p-4">
      <p className="font-heading text-base font-semibold text-brand-ink">
        {isReadOnly ? 'The host has not added any places yet.' : 'Add at least 2 places to spin.'}
      </p>
      {!isReadOnly && (
        <>
          <p className="mt-0.5 font-heading text-sm font-medium text-eatspin-gray-1">
            Type a place below, or start with one of these.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SUGGESTED_PLACES.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onAddSuggestedPlace(suggestion)}
                className={cn(chipClass(false), 'gap-1.5 px-3 text-sm')}
              >
                <Plus size={14} strokeWidth={3} aria-hidden="true" />
                {suggestion}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RoomBanner({ room }: { room: ListRoomInfo }) {
  const roleLabel = room.role === 'host' ? 'Host' : room.role === 'cohost' ? 'Co-host' : 'Participant';
  const message = room.role === 'host'
    ? 'Your list edits sync to everyone in this room.'
    : room.role === 'cohost'
      ? 'You can edit the shared list as co-host and start spins for everyone.'
      : "You are viewing the room's shared list. Leave the room anytime to return to your saved personal list.";

  return (
    <section
      aria-label="Room"
      className="rounded-2xl border-[3px] border-brand-ink bg-white p-3 font-heading text-sm text-brand-ink"
    >
      <p className="text-base font-bold">
        Room {room.roomId} ({roleLabel})
      </p>
      <p className="font-medium text-eatspin-gray-1">{message}</p>
      <p className="mt-1 font-medium text-eatspin-gray-1">{room.lastSpinText ?? 'No spin yet.'}</p>
      {room.isLateJoin && <p className="font-semibold">Result was decided earlier.</p>}

      {!room.canEdit && (
        <div className="mt-3 flex flex-col gap-2">
          <p className="font-medium text-eatspin-gray-1">
            Like this list? We will save a copy to your own lists without changing the host&apos;s list.
          </p>
          <div className="flex flex-wrap gap-2">
            <ArcadeButton
              className="min-h-11 flex-1 px-3 text-sm"
              disabled={!room.canSaveCopy}
              onClick={room.onSaveCopy}
            >
              Add to my list
            </ArcadeButton>
            <ArcadeButton className="min-h-11 flex-1 px-3 text-sm" onClick={room.onLeave}>
              Leave room to spin on your own
            </ArcadeButton>
          </div>
        </div>
      )}
    </section>
  );
}

function ListDetailsFormCard({ form }: { form: ListDetailsForm }) {
  return (
    <form
      className="flex flex-col gap-3 rounded-2xl border-[3px] border-brand-ink bg-white p-3.5"
      onSubmit={(event) => {
        event.preventDefault();
        if (form.canSave) form.onSave();
      }}
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="saved-manual-name" className="font-heading text-sm font-semibold text-eatspin-gray-1">
          List name
        </label>
        <input
          id="saved-manual-name"
          type="text"
          value={form.name}
          onChange={(event) => form.onNameChange(event.target.value)}
          placeholder="Isaac lunch list"
          autoComplete="off"
          className={TEXT_FIELD_CLASS}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="saved-manual-mealtime" className="font-heading text-sm font-semibold text-eatspin-gray-1">
          Meal time
        </label>
        <div className="relative">
          <select
            id="saved-manual-mealtime"
            value={form.mealTime ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              form.onMealTimeChange(value === 'breakfast' || value === 'lunch' || value === 'dinner' ? value : null);
            }}
            className={cn(TEXT_FIELD_CLASS, 'preset-select pr-10')}
          >
            <option value="">🕒 No meal time</option>
            <option value="breakfast">🌅 Breakfast</option>
            <option value="lunch">☀️ Lunch</option>
            <option value="dinner">🌙 Dinner</option>
          </select>
          <ChevronDown
            size={18}
            strokeWidth={3}
            aria-hidden="true"
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-brand-ink"
          />
        </div>
      </div>

      {form.hasDuplicate ? (
        <p role="alert" className="font-heading text-sm font-semibold text-eatspin-error">{form.helperText}</p>
      ) : form.showSuggestion ? (
        <button
          type="button"
          onClick={form.onUseSuggestion}
          className={cn('min-h-11 text-left font-heading text-sm font-semibold text-brand-orange underline', FOCUS_RING)}
        >
          {form.helperText}
        </button>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <ArcadeButton
          disabled={!form.canDelete}
          onClick={form.onDelete}
          className="min-h-11 px-3 text-sm"
        >
          <Trash2 size={16} strokeWidth={2.5} aria-hidden="true" />
          Delete
        </ArcadeButton>
        <div className="flex gap-2">
          <ArcadeButton onClick={form.onCancel} className="min-h-11 px-4 text-sm">
            Cancel
          </ArcadeButton>
          <ArcadeButton
            type="submit"
            variant="pink"
            disabled={!form.canSave}
            className="min-h-11 px-4 text-sm"
          >
            Save
          </ArcadeButton>
        </div>
      </div>
    </form>
  );
}
