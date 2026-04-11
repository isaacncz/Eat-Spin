import { SERVES_FILTERS, type ServesFilterId } from '@/lib/servesFilters';

interface ServesFilterPillsProps {
  activeFilters: ServesFilterId[];
  onToggle: (id: ServesFilterId) => void;
}

export function ServesFilterPills({ activeFilters, onToggle }: ServesFilterPillsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide"
      role="group"
      aria-label="Filter by what's served"
    >
      {SERVES_FILTERS.map(({ id, label, emoji }) => {
        const isActive = activeFilters.includes(id);
        return (
          <button
            key={id}
            onClick={() => onToggle(id)}
            aria-pressed={isActive}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5
                        text-xs font-semibold transition-all duration-200
                        hover:scale-[1.04] active:scale-[0.97]
                        ${
                          isActive
                            ? 'border-[var(--eatspin-orange)] bg-[var(--eatspin-orange)]/10 text-[var(--eatspin-orange)] shadow-sm'
                            : 'border-[var(--eatspin-gray-3)] bg-white text-[var(--eatspin-gray-1)] hover:border-[var(--eatspin-peach)]'
                        }`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            {label}
          </button>
        );
      })}
    </div>
  );
}
