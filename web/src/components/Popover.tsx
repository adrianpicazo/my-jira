import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode, type Ref } from 'react';
import { createPortal } from 'react-dom';

interface TriggerProps {
  ref: Ref<HTMLButtonElement>;
  onClick: (e: MouseEvent) => void;
  'aria-expanded': boolean;
}

interface Props {
  renderTrigger: (p: TriggerProps) => ReactNode;
  children: (close: () => void) => ReactNode;
  width?: number;
  align?: 'start' | 'end';
}

export function Popover({ renderTrigger, children, width = 260, align = 'start' }: Props) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>({});
  const trigger = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const r = trigger.current.getBoundingClientRect();
    const left = Math.max(8, Math.min(align === 'end' ? r.right - width : r.left, innerWidth - width - 8));
    const below = innerHeight - r.bottom;
    setStyle(
      below < 320 && r.top > below
        ? { left, width, bottom: innerHeight - r.top + 4, maxHeight: r.top - 16 }
        : { left, width, top: r.bottom + 4, maxHeight: below - 16 },
    );
  }, [open, width, align]);

  useEffect(() => {
    if (!open) return;
    const inside = (t: EventTarget | null) =>
      t instanceof Node && (pop.current?.contains(t) || trigger.current?.contains(t));
    const onDown = (e: Event) => !inside(e.target) && setOpen(false);
    const onScroll = (e: Event) => !inside(e.target) && setOpen(false);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  return (
    <>
      {renderTrigger({
        ref: trigger,
        onClick: (e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        },
        'aria-expanded': open,
      })}
      {open &&
        createPortal(
          <div className="popover" ref={pop} style={style} onClick={(e) => e.stopPropagation()}>
            {children(() => setOpen(false))}
          </div>,
          document.body,
        )}
    </>
  );
}
