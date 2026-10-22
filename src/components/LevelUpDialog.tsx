import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface LevelUpDialogProps {
  open: boolean;
  level: number;
  onOpenChange: (open: boolean) => void;
}

/** Shown once when a claimed reward carries the player across an XP threshold. */
export function LevelUpDialog({ open, level, onOpenChange }: LevelUpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-white text-center text-brand-ink sm:max-w-sm" data-testid="level-up-dialog">
        <DialogHeader className="items-center text-center sm:text-center">
          <span
            aria-hidden="true"
            className="mb-1 inline-flex h-24 w-24 items-center justify-center rounded-full border-4 border-brand-ink bg-arcade-yellow font-heading text-5xl font-bold text-brand-ink shadow-pop"
          >
            {level}
          </span>
          <DialogTitle className="text-2xl text-brand-ink">Level up!</DialogTitle>
          <DialogDescription className="text-base font-medium text-brand-ink">
            You are now level {level} Foodie.
          </DialogDescription>
        </DialogHeader>
        <Button
          className="h-12 w-full bg-brand-orange text-lg text-white hover:bg-brand-orange/90"
          onClick={() => onOpenChange(false)}
        >
          Keep going
        </Button>
      </DialogContent>
    </Dialog>
  );
}
