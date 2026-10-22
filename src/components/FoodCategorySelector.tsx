import { useMemo, memo, type CSSProperties } from 'react';
import { trackEvent } from '@/lib/analytics';
import type { FoodCategory } from '@/types';
import { cuisineCategories, foodCategories } from '@/data/restaurants';
import { Check } from 'lucide-react';

interface FoodCategorySelectorProps {
  selectedCategories: FoodCategory[];
  onCategoryChange: (categories: FoodCategory[]) => void;
  maxSelection?: number;
  /** Visit counts per category from favourites — used to boost popular categories. */
  favouriteCategoryCounts?: Partial<Record<FoodCategory, number>>;
}

export const FoodCategorySelector = memo(function FoodCategorySelector({
  selectedCategories,
  onCategoryChange,
  maxSelection = 3,
  favouriteCategoryCounts,
}: FoodCategorySelectorProps) {
  // Sort categories: boosted favourites first, then original order
  const sortedCategories = useMemo(() => {
    if (!favouriteCategoryCounts) return cuisineCategories;
    return [...cuisineCategories].sort((a, b) => {
      const countA = favouriteCategoryCounts[a.id] ?? 0;
      const countB = favouriteCategoryCounts[b.id] ?? 0;
      return countB - countA;
    });
  }, [favouriteCategoryCounts]);

  const hasBoosted = favouriteCategoryCounts
    && Object.values(favouriteCategoryCounts).some((v) => (v ?? 0) > 0);
  const handleCategoryToggle = (categoryId: FoodCategory) => {
    const isSelected = selectedCategories.includes(categoryId);
    
    if (isSelected) {
      // Remove category
      const next = selectedCategories.filter((c) => c !== categoryId);
      trackEvent('category_deselected', { category: categoryId, selected_count: next.length });
      onCategoryChange(next);
    } else {
      // Add category if not exceeding max
      if (selectedCategories.length < maxSelection) {
        const next = [...selectedCategories, categoryId];
        trackEvent('category_selected', { category: categoryId, selected_count: next.length });
        onCategoryChange(next);
      }
    }
  };

  const selectedConfigs = selectedCategories
    .map((id) => foodCategories.find((c) => c.id === id))
    .filter((c): c is NonNullable<typeof c> => c != null);

  return (
    <div className="w-full">
      <div className="mb-4">
        <h3 className="font-heading text-lg font-semibold text-brand-black mb-2">
          What are you craving?
        </h3>
        <p className="text-sm text-eatspin-gray-1">
          Select up to {maxSelection} categories
        </p>
      </div>

      {/* Selected Categories Display */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {selectedConfigs.map((category) => (
            <button
              key={category.id}
              onClick={() => handleCategoryToggle(category.id)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200 hover:scale-105"
              style={{ 
                backgroundColor: category.color,
                color: '#fff',
                boxShadow: `0 4px 12px ${category.color}40`
              }}
            >
              <span>{category.icon}</span>
              <span>{category.name}</span>
              <span className="ml-1">
                <Check size={14} />
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Category Grid */}
      {hasBoosted && (
        <p className="mb-2 text-[11px] font-medium text-brand-orange">
          ⭐ Based on your favourites
        </p>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {sortedCategories.map((category) => {
          const isSelected = selectedCategories.includes(category.id);
          const isDisabled = !isSelected && selectedCategories.length >= maxSelection;

          return (
            <button
              key={category.id}
              onClick={() => handleCategoryToggle(category.id)}
              disabled={isDisabled}
              className={`flex flex-col items-center justify-center p-3 min-h-11 rounded-2xl border-2 border-brand-ink shadow-pop transition-all duration-200 hover:scale-105 ${
                isSelected
                  ? 'ring-2 ring-offset-2 ring-brand-ink'
                  : isDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:shadow-pop-lg'
              }`}
              style={{
                backgroundColor: isSelected ? category.color : '#fff',
                ...(isSelected
                  ? ({ ['--tw-ring-color' as any]: category.color } as CSSProperties)
                  : {}),
              }}
            >
              <span className="text-2xl mb-1">{category.icon}</span>
              <span
                className={`text-xs font-medium text-center ${
                  'text-brand-ink'
                }`}
              >
                {category.name}
              </span>
            </button>
          );
        })}
      </div>

    </div>
  );
});
