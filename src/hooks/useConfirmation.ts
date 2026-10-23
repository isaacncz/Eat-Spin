import { useCallback, useEffect, useRef, useState } from 'react';
export interface ConfirmationRequest { title: string; description: string; accept: string; cancel: string }
export function useConfirmation() {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const trigger = useRef<HTMLElement | null>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const confirm = useCallback((next: ConfirmationRequest) => new Promise<boolean>(resolve => {
    resolver.current?.(false);
    trigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    resolver.current = resolve;
    setRequest(next);
  }), []);
  const answer = useCallback((accepted: boolean) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    resolve?.(accepted);
  }, []);
  useEffect(() => () => { resolver.current?.(false); resolver.current = null; }, []);
  const restoreFocus = useCallback(() => {
    if (document.querySelector('[role="dialog"], [role="alertdialog"]')) return;
    if (trigger.current?.isConnected) trigger.current.focus();
    else document.querySelector<HTMLElement>('nav button')?.focus();
  }, []);
  return { confirm, request, answer, restoreFocus };
}
