import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}brand/eatspin-mark.png`} width={32} height={32}
    alt="" aria-hidden="true" className={cn('shrink-0 object-contain', className)} />;
}
