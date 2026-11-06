import type { SearchScope } from '@/lib/mallSearch';
import { cn } from '@/lib/utils';

export function MallSearchScope({ scope, disabled, onChange }: {
  scope: SearchScope;
  disabled: boolean;
  onChange: (scope: SearchScope) => void;
}) {
  return <div>
    <div role="group" aria-label="Mall search scope" className="flex gap-1 rounded-xl border-[3px] border-brand-ink bg-brand-linen p-1">
      {(['inside', 'around'] as const).map((value) => <button
        type="button" key={value} disabled={disabled} aria-pressed={scope === value}
        onClick={() => onChange(value)}
        className={cn('min-h-11 min-w-0 flex-1 rounded-lg px-2 font-heading text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-brand-orange disabled:opacity-50',
          scope === value ? 'bg-brand-ink text-white' : 'text-brand-ink hover:bg-white')}
      >{value === 'inside' ? 'Inside this mall' : 'Around this mall'}</button>)}
    </div>
    <p className="mt-1.5 text-xs leading-relaxed text-brand-ink">
      {scope === 'inside' ? 'Only restaurants confirmed inside this mall.' : 'Includes places inside and outside this mall. Set the distance in Filters.'}
    </p>
  </div>;
}
