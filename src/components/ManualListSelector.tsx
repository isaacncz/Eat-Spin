import { ChevronDown, PencilLine, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getMealTimeEmoji } from '@/hooks/useManualLists';
import type { ManualList, ManualListMealTime } from '@/types';

interface ManualListSelectorProps {
  manualLists: ManualList[];
  selectedManualListId: string;
  selectedManualList: ManualList | null;
  isManualListReadOnly: boolean;
  isEditingListDetails: boolean;
  isCreatingNewList: boolean;
  listNameInput: string;
  listMealTimeInput: ManualListMealTime;
  listNameSuggestion: string;
  manualListNameHelperText: string;
  hasDuplicateName: boolean;
  hasManualListDetailsChanged: boolean;
  onSelectList: (id: string) => void;
  onCreateList: () => void;
  onStartEditDetails: () => void;
  onDeleteList: () => void;
  onListNameInputChange: (value: string) => void;
  onListMealTimeChange: (value: ManualListMealTime) => void;
  onUseSuggestedName: () => void;
  onCancelEditDetails: () => void;
  onSaveDetails: () => void;
}

/**
 * Chip-based selector for the user's saved manual wheels, plus the inline
 * rename / meal-time editor. Presentational — all state lives in the parent.
 */
export function ManualListSelector({
  manualLists,
  selectedManualListId,
  selectedManualList,
  isManualListReadOnly,
  isEditingListDetails,
  isCreatingNewList,
  listNameInput,
  listMealTimeInput,
  listNameSuggestion,
  manualListNameHelperText,
  hasDuplicateName,
  hasManualListDetailsChanged,
  onSelectList,
  onCreateList,
  onStartEditDetails,
  onDeleteList,
  onListNameInputChange,
  onListMealTimeChange,
  onUseSuggestedName,
  onCancelEditDetails,
  onSaveDetails,
}: ManualListSelectorProps) {
  return (
    <div className="mb-6 max-w-2xl mx-auto rounded-2xl border border-eatspin-peach/60 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        {/* Header */}
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-eatspin-gray-1">Saved lists</p>

        {/* Horizontal chip bar with overflow fade hint */}
        <div className="relative">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide" role="listbox" aria-label="Saved lists">
            {manualLists.map((list) => {
              const isSelected = list.id === selectedManualListId;
              const emoji = getMealTimeEmoji(list.mealTime);
              return (
                <button
                  key={list.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  title={`${list.name} — ${list.restaurants.length} picks`}
                  onClick={() => {
                    if (!isSelected) onSelectList(list.id);
                  }}
                  disabled={isManualListReadOnly}
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    isSelected
                      ? 'bg-brand-orange text-white shadow-sm'
                      : 'border border-eatspin-peach/70 bg-white text-brand-black hover:border-brand-orange/40 hover:bg-brand-linen'
                  } disabled:opacity-40`}
                >
                  {emoji && <span>{emoji}</span>}
                  <span className="truncate max-w-[140px]">{list.name}</span>
                  <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-xs tabular-nums ${
                    isSelected
                      ? list.restaurants.length === 0 ? 'bg-white/20 text-white/90' : 'bg-white/25 text-white'
                      : list.restaurants.length === 0 ? 'bg-eatspin-peach/50 text-eatspin-gray-1' : 'bg-eatspin-peach/70 text-brand-black'
                  }`}>
                    {list.restaurants.length}
                  </span>
                </button>
              );
            })}
            {/* New list chip */}
            <button
              type="button"
              onClick={onCreateList}
              disabled={isManualListReadOnly}
              className="flex shrink-0 items-center gap-1 rounded-full border border-dashed border-eatspin-peach px-3 py-2 text-sm font-medium text-eatspin-gray-1 transition hover:border-brand-orange/50 hover:text-brand-orange disabled:opacity-40"
              aria-label="Create new list"
            >
              <Plus size={14} />
              <span>New</span>
            </button>
          </div>
          {/* Right fade hint when many lists */}
          {manualLists.length > 3 && (
            <div className="pointer-events-none absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-white to-transparent" aria-hidden="true" />
          )}
        </div>

        {/* Inline actions for selected list (view mode) */}
        {!isEditingListDetails && selectedManualList && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onStartEditDetails}
              disabled={isManualListReadOnly}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-eatspin-gray-1 transition hover:bg-eatspin-peach/30 hover:text-brand-black disabled:opacity-40"
              aria-label="Edit list name and meal time"
            >
              <PencilLine size={13} />
              <span>Rename</span>
            </button>
            {manualLists.length > 1 && (
              <button
                type="button"
                onClick={onDeleteList}
                disabled={isManualListReadOnly}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                aria-label={`Delete ${selectedManualList.name}`}
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            )}
          </div>
        )}

        {/* Edit mode (inline expansion) */}
        {isEditingListDetails && (
          <div className="space-y-3 rounded-lg border border-eatspin-peach/50 bg-brand-linen/50 p-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-eatspin-gray-1" htmlFor="saved-manual-name">List name</label>
                <Input
                  id="saved-manual-name"
                  value={listNameInput}
                  onChange={(e) => onListNameInputChange(e.target.value)}
                  placeholder="Isaac lunch list"
                  className="h-10"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-eatspin-gray-1" htmlFor="saved-manual-mealtime">Meal time</label>
                <div className="relative">
                  <select
                    id="saved-manual-mealtime"
                    value={listMealTimeInput ?? ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === 'breakfast' || value === 'lunch' || value === 'dinner') {
                        onListMealTimeChange(value);
                        return;
                      }
                      onListMealTimeChange(null);
                    }}
                    className="preset-select h-10 w-full rounded-md border border-eatspin-peach/70 bg-white px-3 pr-10 text-sm text-brand-black"
                  >
                    <option value="">🕒 No meal time</option>
                    <option value="breakfast">🌅 Breakfast</option>
                    <option value="lunch">☀️ Lunch</option>
                    <option value="dinner">🌙 Dinner</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-eatspin-gray-1" />
                </div>
              </div>
            </div>
            {hasDuplicateName ? (
              <p className="text-xs text-red-600">{manualListNameHelperText}</p>
            ) : listNameSuggestion.trim() !== listNameInput.trim() ? (
              <button
                type="button"
                onClick={onUseSuggestedName}
                className="text-left text-xs text-brand-orange hover:underline"
              >
                {manualListNameHelperText}
              </button>
            ) : null}
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onDeleteList}
                disabled={isManualListReadOnly || !selectedManualList}
                className="h-9 border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50"
              >
                <Trash2 size={14} className="mr-1" /> Delete
              </Button>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onCancelEditDetails}
                  className="h-9 px-3 text-xs font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={onSaveDetails}
                  disabled={isManualListReadOnly || (!isCreatingNewList && (!selectedManualList || !hasManualListDetailsChanged)) || hasDuplicateName}
                  className="h-9 bg-brand-orange px-3 text-xs font-semibold text-white hover:bg-brand-orange/90"
                >
                  Save
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
