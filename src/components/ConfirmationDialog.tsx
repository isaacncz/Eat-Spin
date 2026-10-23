import { AlertDialog, AlertDialogContent, AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import type { ConfirmationRequest } from '@/hooks/useConfirmation';
import { Trash2, CircleAlert } from 'lucide-react';
export function ConfirmationDialog({ request, onAnswer, onRestoreFocus }: { request: ConfirmationRequest | null; onAnswer: (accepted: boolean) => void; onRestoreFocus: () => void }) {
  const Icon = request?.accept.startsWith('Delete') || request?.accept.startsWith('Clear') ? Trash2 : CircleAlert;
  return <AlertDialog open={Boolean(request)} onOpenChange={open => { if (!open) onAnswer(false); }}>
    <AlertDialogContent onCloseAutoFocus={event => { event.preventDefault(); onRestoreFocus(); }} className="rounded-[28px] border-4 border-brand-ink bg-white font-heading text-brand-ink shadow-pop-lg">
      <div className="mx-auto rounded-full bg-arcade-pink/15 p-4"><Icon size={32} aria-hidden="true" /></div>
      <AlertDialogTitle className="text-center text-2xl font-bold">{request?.title}</AlertDialogTitle>
      <AlertDialogDescription className="text-center text-base text-brand-ink/80">{request?.description}</AlertDialogDescription>
      <AlertDialogCancel className="min-h-12 rounded-2xl border-[3px] border-brand-ink bg-white font-bold text-brand-ink" onClick={() => onAnswer(false)}>{request?.cancel}</AlertDialogCancel>
      <AlertDialogAction className="min-h-12 rounded-2xl border-[3px] border-brand-ink bg-arcade-pink font-bold text-brand-ink hover:bg-arcade-pink/90" onClick={() => onAnswer(true)}>{request?.accept}</AlertDialogAction>
    </AlertDialogContent>
  </AlertDialog>;
}
