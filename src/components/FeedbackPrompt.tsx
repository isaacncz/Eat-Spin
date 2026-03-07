import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ThumbsUp, Meh, ThumbsDown, HelpCircle } from 'lucide-react';
import type { FavouriteEntry } from '@/types/favourites';

interface FeedbackPromptProps {
  /** Restaurant name to display. */
  restaurantName: string;
  /** Whether the dialog is open. */
  open: boolean;
  /** Called when the user selects a rating. */
  onRate: (rating: FavouriteEntry['userRating']) => void;
  /** Called when the user says they didn't go. */
  onDidntGo: () => void;
}

export function FeedbackPrompt({
  restaurantName,
  open,
  onRate,
  onDidntGo,
}: FeedbackPromptProps) {
  return (
    <Dialog open={open}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(e) => e.preventDefault()}
        // Hide the default close X — we want explicit answers only
        // eslint-disable-next-line @typescript-eslint/no-empty-function
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-lg text-brand-black text-center">
            How was <span className="text-brand-orange">{restaurantName}</span>?
          </DialogTitle>
          <DialogDescription className="text-center text-sm text-eatspin-gray-1">
            Your feedback helps us suggest better places next time.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4 border-green-200 hover:bg-green-50 hover:border-green-400"
            onClick={() => onRate('suggest')}
          >
            <ThumbsUp size={24} className="text-green-600" />
            <span className="text-sm font-semibold text-green-700">Suggest again</span>
            <span className="text-xs text-eatspin-gray-1">I'd go back!</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4 border-yellow-200 hover:bg-yellow-50 hover:border-yellow-400"
            onClick={() => onRate('neutral')}
          >
            <Meh size={24} className="text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-700">It was okay</span>
            <span className="text-xs text-eatspin-gray-1">No preference</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4 border-red-200 hover:bg-red-50 hover:border-red-400"
            onClick={() => onRate('avoid')}
          >
            <ThumbsDown size={24} className="text-red-500" />
            <span className="text-sm font-semibold text-red-600">Don't suggest</span>
            <span className="text-xs text-eatspin-gray-1">Not for me</span>
          </Button>

          <Button
            variant="outline"
            className="h-auto flex-col gap-2 py-4 border-gray-200 hover:bg-gray-50 hover:border-gray-400"
            onClick={onDidntGo}
          >
            <HelpCircle size={24} className="text-eatspin-gray-1" />
            <span className="text-sm font-semibold text-eatspin-gray-1">Didn't go</span>
            <span className="text-xs text-eatspin-gray-2">Ended up elsewhere</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
