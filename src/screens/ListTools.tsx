import { useId, useState } from 'react';
import { toast } from 'sonner';
import type { ManualList } from '@/types';
import { ArcadeButton } from '@/screens/arcade';

interface Props {
  inRoom: boolean;
  status: string;
  error: string | null;
  onRetry: () => void;
  onDuplicate: () => unknown;
  onExport: () => string;
  onPreview: (text: string) => ManualList[];
  onImport: (text: string) => number;
  canDuplicate: boolean;
}

export function ListTools({ inRoom, status, error, onRetry, onDuplicate, onExport, onPreview, onImport, canDuplicate }: Props) {
  const fileId = useId();
  const [preview, setPreview] = useState<{ text: string; lists: ManualList[] } | null>(null);
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([onExport()], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'eatspin-lists.json'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) { toast.error(String(err)); }
  };
  return <section aria-label="List tools" className="rounded-xl border-2 border-brand-ink bg-white p-3">
    <p role="status" className="text-sm font-semibold">{status}</p>
    {error && <p role="alert" className="break-words text-sm">{error}</p>}
    {(error || status.startsWith('Offline')) && <ArcadeButton className="min-h-11" onClick={onRetry}>Retry saving</ArcadeButton>}
    {!inRoom && <>
      <div className="mt-2 flex flex-wrap gap-2">
        <ArcadeButton className="min-h-11" disabled={!canDuplicate} onClick={() => { try { onDuplicate(); } catch (err) { toast.error(String(err)); } }}>Duplicate list</ArcadeButton>
        <ArcadeButton className="min-h-11" onClick={download}>Export lists</ArcadeButton>
      </div>
      <label htmlFor={fileId} className="mt-3 block text-sm font-semibold">Restore lists from backup (adds independent copies)</label>
      <input id={fileId} type="file" accept="application/json,.json" className="min-h-11 max-w-full py-2" onChange={async event => {
        const file = event.target.files?.[0]; event.target.value = '';
        setPreview(null);
        if (!file) return;
        try {
          if (file.size > 2_000_000) throw new Error('Backup exceeds the 2 MB limit.');
          const text = await file.text();
          setPreview({ text, lists: onPreview(text) });
        } catch (err) { toast.error(String(err)); }
      }} />
      {preview && <div className="mt-2 text-sm">
        <p>{preview.lists.length} lists to add. Existing lists stay saved.</p>
        <ul>{preview.lists.map(list => <li key={list.id}>{list.name} · {list.restaurants.length} places</li>)}</ul>
        <div className="mt-2 flex gap-2">
          <ArcadeButton disabled={preview.lists.length === 0} onClick={() => {
            try { const count = onImport(preview.text); setPreview(null); toast.success(`Restored ${count} lists.`); }
            catch (err) { toast.error(String(err)); }
          }}>Restore copies</ArcadeButton>
          <ArcadeButton onClick={() => setPreview(null)}>Cancel</ArcadeButton>
        </div>
      </div>}
    </>}
  </section>;
}
