import { useEffect, useState } from 'react';
import { Coffee, Sun, Moon, Clock } from 'lucide-react';
import { getCurrentMealTime } from '@/data/restaurants';

export function MealTimeIndicator() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const mealTime = getCurrentMealTime();

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(timer);
  }, []);

  const hour = currentTime.getHours();
  const minute = currentTime.getMinutes();

  const getMealTimeInfo = () => {
    switch (mealTime) {
      case 'breakfast':
        return {
          icon: Coffee,
          label: 'Breakfast',
          shortLabel: 'Breakfast',
          timeRange: '7:00 AM - 11:00 AM',
          color: '#F39C12',
          bgColor: '#FFF7EB',
          borderColor: '#F9D7A5',
        };
      case 'lunch':
        return {
          icon: Sun,
          label: 'Lunch',
          shortLabel: 'Lunch',
          timeRange: '11:00 AM - 3:00 PM',
          color: '#E74C3C',
          bgColor: '#FFF1EE',
          borderColor: '#F6C4BC',
        };
      case 'dinner':
        return {
          icon: Moon,
          label: 'Dinner',
          shortLabel: 'Dinner',
          timeRange: '5:00 PM - 10:00 PM',
          color: '#8E44AD',
          bgColor: '#F6EEFA',
          borderColor: '#DDC7EA',
        };
      default:
        return {
          icon: Clock,
          label: 'Off Hours',
          shortLabel: 'Off hours',
          timeRange: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} - Limited options`,
          color: '#95A5A6',
          bgColor: '#F5F5F5',
          borderColor: '#DCDCDC',
        };
    }
  };

  const info = getMealTimeInfo();
  const Icon = info.icon;

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border px-2.5 py-2 shadow-sm"
      style={{ backgroundColor: info.bgColor, borderColor: info.borderColor }}
    >
      <div
        className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${info.color}20` }}
      >
        <Icon size={16} style={{ color: info.color }} />
      </div>
      <div className="flex items-center gap-2 pr-1">
        <p className="font-heading text-base leading-none text-brand-black">
          {info.shortLabel}
        </p>
        <span className="hidden sm:inline text-xs text-eatspin-gray-2">|</span>
        <p className="hidden sm:block text-xs leading-none text-eatspin-gray-1">
          {info.timeRange}
        </p>
      </div>
    </div>
  );
}
