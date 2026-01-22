import { MapPin, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface LocationPermissionProps {
  isLoading: boolean;
  error: string | null;
  onRequestLocation: () => void;
  location: { lat: number; lng: number } | null;
}

export function LocationPermission({
  isLoading,
  error,
  onRequestLocation,
  location,
}: LocationPermissionProps) {
  if (location) {
    return (
      <div className="flex items-center gap-2 px-4 py-2 bg-eatspin-success/10 rounded-full">
        <div className="w-2 h-2 bg-eatspin-success rounded-full animate-pulse" />
        <MapPin size={16} className="text-eatspin-success" />
        <span className="text-sm font-medium text-eatspin-success">
          Location detected
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-2xl shadow-lg border border-eatspin-peach">
      <div className="w-16 h-16 bg-eatspin-peach rounded-full flex items-center justify-center">
        <MapPin size={32} className="text-eatspin-orange" />
      </div>

      <div className="text-center">
        <h3 className="font-heading text-xl font-bold text-brand-black mb-2">
          Enable Location Access
        </h3>
        <p className="text-sm text-eatspin-gray-1 max-w-xs">
          We need your location to find restaurants within 1-2km from you. This helps us recommend nearby places you can easily reach.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-3 bg-eatspin-error/10 rounded-lg">
          <AlertCircle size={20} className="text-eatspin-error flex-shrink-0 mt-0.5" />
          <p className="text-sm text-eatspin-error">{error}</p>
        </div>
      )}

      <Button
        onClick={onRequestLocation}
        disabled={isLoading}
        className="bg-brand-orange hover:bg-brand-orange/90 text-white font-medium px-8"
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Detecting location...
          </>
        ) : (
          'Allow Location Access'
        )}
      </Button>

      <p className="text-xs text-eatspin-gray-2 text-center">
        Your location is only used to find nearby restaurants and is never stored.
      </p>
    </div>
  );
}
