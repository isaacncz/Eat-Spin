import type { CSSProperties } from 'react';
import type { FoodCategory } from '@/types';
import { foodCategories } from '@/data/restaurants';
import { Check } from 'lucide-react';

interface FoodCategorySelectorProps {
  selectedCategories: FoodCategory[];
  onCategoryChange: (categories: FoodCategory[]) => void;
  maxSelection?: number;
}

export function FoodCategorySelector({
  selectedCategories,
  onCategoryChange,
  maxSelection = 3,
}: FoodCategorySelectorProps) {
  const handleCategoryToggle = (categoryId: FoodCategory) => {
    const isSelected = selectedCategories.includes(categoryId);
    
    if (isSelected) {
      // Remove category
      onCategoryChange(selectedCategories.filter((c) => c !== categoryId));
    } else {
      // Add category if not exceeding max
      if (selectedCategories.length < maxSelection) {
        onCategoryChange([...selectedCategories, categoryId]);
      }
    }
  };

  const selectedConfigs = selectedCategories.map(
    (id) => foodCategories.find((c) => c.id === id)!
  );

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
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {foodCategories.map((category) => {
          const isSelected = selectedCategories.includes(category.id);
          const isDisabled = !isSelected && selectedCategories.length >= maxSelection;

          return (
            <button
              key={category.id}
              onClick={() => handleCategoryToggle(category.id)}
              disabled={isDisabled}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl transition-all duration-200 hover:scale-105 ${
                isSelected
                  ? 'ring-2 ring-offset-2'
                  : isDisabled
                  ? 'opacity-40 cursor-not-allowed'
                  : 'hover:shadow-lg'
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
                  isSelected ? 'text-white' : 'text-brand-black'
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
}
