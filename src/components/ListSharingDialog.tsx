import { useEffect, useRef, useState } from 'react';
import { ListSheet } from '@/components/ListSheet';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { ArcadeButton } from '@/screens/arcade';
import { buildSharedList, type SharedListSnapshot } from '@/lib/sharedLists';
import { fetchSharedList, publishSharedList, revokeSharedList } from '@/lib/sharedListsApi';
import type { ManualList } from '@/types';
interface Props {
  open: boolean;
  incomingId: string | null;
  list: ManualList | null;
  lists?: ManualList[];
  onChooseAnother?: () => void;
  onClose: () => void;
  onImport: (snapshot: SharedListSnapshot, openWheel: boolean) => void;
}
export function ListSharingDialog(props: Props) {
  // A fresh session per opening prevents old links/errors from leaking into another list.
  if (!props.open) return null;
  return props.incomingId ? <SharingSession key={props.incomingId} {...props} /> : <OutgoingSelection {...props} />;
}
function SharingSession({ incomingId, list, onClose, onImport, onChooseAnother }: Props) {
  const [snapshot, setSnapshot] = useState<SharedListSnapshot | null>(null);
  const [link, setLink] = useState<{ id: string; url: string } | null>(null);
  const [busy, setBusy] = useState(Boolean(incomingId));
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const lock = useRef(false);
  useEffect(() => {
    if (!incomingId) return;
    let active = true;
    fetchSharedList(incomingId).then((data) => { if (active) setSnapshot(data); })
      .catch((cause: unknown) => { if (active) setError(cause instanceof Error ? cause.message : 'Could not open this list.'); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [incomingId]);
  const prepare = async () => {
    if (!list || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const data = buildSharedList(list);
      setLink(await publishSharedList(data)); setSnapshot(data);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not create a share link.'); }
    finally { lock.current = false; setBusy(false); }
  };
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link.url); setNotice('Link copied.'); }
    catch { setError('Copy failed. Select and copy the link below.'); }
  };
  const share = async () => {
    if (!link) return;
    if (!navigator.share) { await copy(); return; }
    try { await navigator.share({ title: snapshot?.name ?? 'EatSpin list', url: link.url }); }
    catch (cause) {
      if (!(cause instanceof Error && cause.name === 'AbortError')) setError('Sharing failed. Use Copy link instead.');
    }
  };
  const save = (openWheel: boolean) => {
    if (!snapshot || lock.current) return;
    lock.current = true;
    try { onImport(snapshot, openWheel); onClose(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this list.'); lock.current = false; }
  };
  return <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-h-[85dvh] overflow-y-auto">
      <DialogTitle>{incomingId ? 'A list from your friend' : 'Share this list'}</DialogTitle>
      <DialogDescription>
        A fixed copy of the list name and place names. Personal history and ratings are not shared.
        Links expire after 7 days. Anyone with the link can open it.
      </DialogDescription>
      {busy && <p role="status">Loading…</p>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {(snapshot || (!incomingId && list)) && <section>
        <h3 className="font-heading text-xl font-bold">{snapshot?.name ?? list?.name}</h3>
        <ul className="my-3 max-h-48 list-disc overflow-y-auto pl-5">
          {(snapshot?.places ?? list?.restaurants.map((place) => place.name) ?? []).map((name, index) => <li key={index}>{name}</li>)}
        </ul>
      </section>}
      {!incomingId && <p className="text-sm">Only this list is shared. Your other lists stay private. Friends receive a fixed copy.</p>}
      {incomingId ? snapshot && <>
        <ArcadeButton disabled={busy} onClick={() => save(false)}>Save a personal copy</ArcadeButton>
        <ArcadeButton disabled={busy || snapshot.places.length < 2} onClick={() => save(true)}>Save copy &amp; open wheel</ArcadeButton>
      </> : link ? <>
        <label className="text-sm">Share link<input aria-label="Share link" readOnly value={link.url} onFocus={(event) => event.target.select()} className="mt-1 min-h-11 w-full rounded border p-2" /></label>
        <ArcadeButton onClick={() => void share()}>Share with friends</ArcadeButton>
        <ArcadeButton onClick={() => void copy()}>Copy link</ArcadeButton>
        <ArcadeButton disabled={busy} onClick={() => {
          if (lock.current) return;
          lock.current = true; setBusy(true);
          void revokeSharedList(link.id).then(() => { setLink(null); setNotice('Link revoked. Saved personal copies are unaffected.'); })
            .catch(() => setError('Could not revoke this link. Try again.'))
            .finally(() => { lock.current = false; setBusy(false); });
        }}>Revoke link</ArcadeButton>
      </> : <ArcadeButton disabled={busy || !list || list.restaurants.length === 0} onClick={() => void prepare()}>Create share link</ArcadeButton>}
      {!incomingId && onChooseAnother && <ArcadeButton disabled={busy} onClick={onChooseAnother}>Choose another list</ArcadeButton>}
      <ArcadeButton disabled={busy} onClick={onClose}>Close</ArcadeButton>
    </DialogContent>
  </Dialog>;
}

function OutgoingSelection(props: Props) {
  const [opener] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [selectedId, setSelectedId] = useState(props.list?.id ?? '');
  const [preview, setPreview] = useState(false);
  const lists = props.lists ?? (props.list ? [props.list] : []);
  const selected = lists.find(list => list.id === selectedId) ?? null;
  if (preview && selected) return <SharingSession key={selected.id} {...props} list={selected} onChooseAnother={() => setPreview(false)} />;
  return <ListSheet focusTarget={opener} title="Choose a list to share" description="Share one list at a time. Your other lists stay private." onClose={props.onClose}>
    <div role="radiogroup" aria-label="List to share" className="max-h-[45dvh] space-y-2 overflow-y-auto">
      {lists.map(list => <label key={list.id} className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-2 border-brand-ink/20 p-3">
        <input className="size-5 shrink-0 accent-arcade-pink" type="radio" name="list-to-share" value={list.id} checked={selectedId === list.id} onChange={() => setSelectedId(list.id)} />
        <span className="min-w-0 break-words"><span className="block font-bold">{list.name}</span><span className="text-sm">{list.restaurants.length} places · {list.mealTime ?? 'Any meal'}</span></span>
      </label>)}
    </div>
    {selected?.restaurants.length === 0 && <p className="text-sm">Add at least one place to this list before sharing.</p>}
    <ArcadeButton variant="pink" disabled={!selected || selected.restaurants.length === 0} onClick={() => setPreview(true)}>Preview list</ArcadeButton>
    <ArcadeButton onClick={props.onClose}>Cancel</ArcadeButton>
  </ListSheet>;
}
