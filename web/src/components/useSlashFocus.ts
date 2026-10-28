import { useEffect, type RefObject } from 'react';

/** Focus the given input when "/" is pressed outside of a text field. */
export function useSlashFocus(ref: RefObject<HTMLInputElement | null>) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key !== '/' || t.closest('input, textarea, [contenteditable]')) return;
      e.preventDefault();
      ref.current?.focus();
    };
    window.addEventListener('keydown', on);
    return () => window.removeEventListener('keydown', on);
  }, [ref]);
}
