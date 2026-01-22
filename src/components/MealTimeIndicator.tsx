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
          label: 'Breakfast Time',
          timeRange: '7:00 AM - 11:00 AM',
          color: '#F39C12',
          bgColor: '#FEF5E7',
        };
      case 'lunch':
        return {
          icon: Sun,
          label: 'Lunch Time',
          timeRange: '11:00 AM - 3:00 PM',
          color: '#E74C3C',
          bgColor: '#FADBD8',
        };
      case 'dinner':
        return {
          icon: Moon,
          label: 'Dinner Time',
          timeRange: '5:00 PM - 10:00 PM',
          color: '#8E44AD',
          bgColor: '#E8DAEF',
        };
      default:
        return {
          icon: Clock,
          label: 'Off Hours',
          timeRange: `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')} - Limited options`,
          color: '#95A5A6',
          bgColor: '#E8E8E8',
        };
    }
  };

  const info = getMealTimeInfo();
  const Icon = info.icon;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl"
      style={{ backgroundColor: info.bgColor }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center"
        style={{ backgroundColor: `${info.color}20` }}
      >
        <Icon size={20} style={{ color: info.color }} />
      </div>
      <div>
        <p className="font-heading font-bold text-brand-black text-sm">
          {info.label}
        </p>
        <p className="text-xs text-eatspin-gray-1">{info.timeRange}</p>
      </div>
    </div>
  );
}
