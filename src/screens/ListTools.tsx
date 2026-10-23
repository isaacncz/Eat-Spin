import { useRef, useState } from 'react';
import { Check, FileJson, SlidersHorizontal, Upload } from 'lucide-react';
import { toast } from 'sonner';
import type { ManualList } from '@/types';
import { ArcadeButton } from '@/screens/arcade';
import { ListSheet } from '@/components/ListSheet';

interface Props {
  inRoom: boolean;
  status: string;
  error: string | null;
  onRetry: () => void;
  onDuplicate: () => unknown;
  onExport: (ids: string[]) => string;
  onPreview: (text: string) => ManualList[];
  onImport: (text: string, ids: string[]) => number;
  canDuplicate: boolean;
  lists: ManualList[];
  selectedListId: string;
}

type Panel = 'tools' | 'export' | 'restore' | null;
export function ListTools({ inRoom, status, error, onRetry, onDuplicate, onExport, onPreview, onImport, canDuplicate, lists, selectedListId }: Props) {
  const [panel, setPanel] = useState<Panel>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [preview, setPreview] = useState<{ text: string; lists: ManualList[]; filename: string } | null>(null);
  const [fileError, setFileError] = useState('');
  const [reading, setReading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const generation = useRef(0);
  const close = () => { generation.current++; setPanel(null); setPreview(null); setFileError(''); setReading(false); };
  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
  const download = () => {
    try {
      const url = URL.createObjectURL(new Blob([onExport(selected)], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url; link.download = 'eatspin-lists.json'; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      close();
    } catch (err) { setFileError(String(err)); }
  };
  const choices = panel === 'export' ? lists : preview?.lists ?? [];
  const currentIds = choices.filter(list => selected.includes(list.id)).map(list => list.id);
  const count = currentIds.length;
  return <section aria-label="List tools" className="flex flex-wrap items-center justify-between gap-2">
    <p role="status" className="flex items-center gap-2 text-sm font-semibold"><Check size={16} aria-hidden="true" />{status}</p>
    {!inRoom && <ArcadeButton onClick={() => setPanel('tools')} className="px-3 text-sm"><SlidersHorizontal size={18} aria-hidden="true" />List tools</ArcadeButton>}
    {error && <p role="alert" className="w-full break-words text-sm">{error}</p>}
    {(error || status.startsWith('Offline')) && <ArcadeButton onClick={onRetry}>Retry saving</ArcadeButton>}
    {panel && !inRoom && <ListSheet onClose={close}
      title={panel === 'tools' ? 'List tools' : panel === 'export' ? 'Choose lists to export' : preview ? 'Ready to restore' : 'Restore lists'}
      description={panel === 'tools' ? 'Make a copy or manage your list backups.' : panel === 'export' ? 'Only selected lists will be included in your backup.' : preview ? 'Select the lists to add to your current collection.' : 'Add saved lists from a backup file.'}>
      {panel === 'tools' ? <>
        <ArcadeButton disabled={!canDuplicate} onClick={() => { try { onDuplicate(); close(); } catch (err) { toast.error(String(err)); } }}>Duplicate list</ArcadeButton>
        <ArcadeButton onClick={() => { setSelected(lists.some(list => list.id === selectedListId) ? [selectedListId] : []); setPanel('export'); }}>Export lists</ArcadeButton>
        <ArcadeButton onClick={() => { setPanel('restore'); setPreview(null); setFileError(''); }}>Restore lists</ArcadeButton>
      </> : <>
        {panel === 'restore' && <>
          <input ref={fileRef} type="file" accept="application/json,.json" aria-label="Choose backup file" className="hidden" onChange={async event => {
            const file = event.target.files?.[0]; event.target.value = '';
            if (!file) return;
            const ticket = ++generation.current;
            setFileError(''); setReading(true); setPreview(null); setSelected([]);
            try {
              if (file.size > 2_000_000) throw new Error('Backup exceeds the 2 MB limit.');
              const text = await file.text();
              if (ticket !== generation.current) return;
              const parsed = onPreview(text);
              setPreview({ text, lists: parsed, filename: file.name }); setSelected(parsed.map(list => list.id));
            } catch (err) { if (ticket === generation.current) setFileError(String(err)); }
            finally { if (ticket === generation.current) setReading(false); }
          }} />
          {preview ? <div className="flex min-w-0 items-center gap-3 rounded-2xl border-2 bg-brand-linen p-3">
            <FileJson aria-hidden="true" className="shrink-0" /><span className="min-w-0 flex-1 break-all text-sm font-bold">{preview.filename}</span>
            <ArcadeButton className="shrink-0 px-2 text-sm" onClick={() => fileRef.current?.click()}>Change file</ArcadeButton>
          </div> : <div className="rounded-2xl border-2 border-dashed border-brand-ink/50 p-5 text-center">
            <Upload className="mx-auto mb-3" size={32} aria-hidden="true" />
            <p className="font-bold">Choose backup file</p><p className="mb-4 text-sm">JSON file · up to 2 MB</p>
            <ArcadeButton variant="pink" className="w-full" disabled={reading} onClick={() => fileRef.current?.click()}>{reading ? 'Reading file…' : 'Choose file'}</ArcadeButton>
          </div>}
        </>}
        {(panel === 'export' || preview) && <>
          <ArcadeButton className="text-sm" onClick={() => setSelected(count === choices.length ? [] : choices.map(list => list.id))}>{count === choices.length && choices.length > 0 ? 'Deselect all' : 'Select all'}</ArcadeButton>
          <div className="max-h-[35dvh] space-y-2 overflow-y-auto" role="group" aria-label={panel === 'export' ? 'Lists to export' : 'Lists to restore'}>
            {choices.map(list => <label key={list.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-brand-ink/20 p-3">
              <input className="size-5 shrink-0 accent-arcade-pink" type="checkbox" checked={selected.includes(list.id)} onChange={() => toggle(list.id)} />
              <span className="min-w-0 break-words"><span className="block font-bold">{list.name}</span><span className="text-sm">{list.restaurants.length} places</span></span>
            </label>)}
          </div>
          {panel === 'restore' && <p className="text-center text-sm">Your existing lists stay saved. Restored lists are independent copies.</p>}
          <ArcadeButton variant="pink" disabled={count === 0 || reading} onClick={() => {
            if (panel === 'export') { download(); return; }
            if (!preview) return;
            try { const restored = onImport(preview.text, currentIds); close(); toast.success(`Restored ${restored} ${restored === 1 ? 'list' : 'lists'}.`); }
            catch (err) { setFileError(String(err)); }
          }}>{panel === 'export' ? 'Export' : 'Restore'} {count} {count === 1 ? 'list' : 'lists'}</ArcadeButton>
        </>}
        {fileError && <p role="alert" className="break-words text-sm">{fileError}</p>}
      </>}
      <ArcadeButton onClick={close}>Cancel</ArcadeButton>
    </ListSheet>}
  </section>;
}
