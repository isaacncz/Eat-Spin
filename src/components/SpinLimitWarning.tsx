import { Crown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { MealTime } from '@/types';

interface SpinLimitWarningProps {
  mealTime: MealTime;
  onUpgrade: () => void;
  onClose: () => void;
}

export function SpinLimitWarning({ mealTime, onUpgrade, onClose }: SpinLimitWarningProps) {
  const mealTimeLabels: Record<MealTime, string> = {
    breakfast: 'Breakfast',
    lunch: 'Lunch',
    dinner: 'Dinner',
    none: 'Meal Time',
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-eatspin-peach p-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-eatspin-orange/10 rounded-full flex items-center justify-center">
            <Crown size={24} className="text-eatspin-orange" />
          </div>
          <div>
            <h3 className="font-heading font-bold text-brand-black">
              Spin Limit Reached
            </h3>
            <p className="text-sm text-eatspin-gray-1">
              {mealTimeLabels[mealTime]} spins used
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-full hover:bg-eatspin-gray-3 transition-colors"
        >
          <X size={18} className="text-eatspin-gray-1" />
        </button>
      </div>

      <p className="text-sm text-eatspin-gray-1 mb-4">
        You've used your free spin for {mealTimeLabels[mealTime].toLowerCase()}. 
        Upgrade to premium for unlimited spins and discover more amazing restaurants!
      </p>

      <div className="flex gap-3">
        <Button
          onClick={onUpgrade}
          className="flex-1 bg-brand-orange hover:bg-brand-orange/90 text-white font-medium"
        >
          <Crown size={16} className="mr-2" />
          Upgrade to Premium
        </Button>
      </div>
    </div>
  );
}
