import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './icons';

export interface ContextItem {
  label: string;
  icon?: ReactNode;
  onSelect?: () => void;
  /** Rendered beside the item while it's hovered. */
  submenu?: (close: () => void) => ReactNode;
  danger?: boolean;
}

export type ContextEntry = ContextItem | 'separator';

const SUB_WIDTH = 280;

/** Right-click menu anchored at the pointer, with hover submenus. */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: ContextEntry[]; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });
  const [open, setOpen] = useState<number | null>(null);
  const [subUp, setSubUp] = useState(false);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({ left: Math.min(x, innerWidth - width - 8), top: Math.min(y, innerHeight - height - 8) });
  }, [x, y]);

  useEffect(() => {
    const onDown = (e: Event) => !ref.current?.contains(e.target as Node) && onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose();
    };
    const onScroll = (e: Event) => !ref.current?.contains(e.target as Node) && onClose();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose]);

  const flip = pos.left + (ref.current?.offsetWidth ?? 220) + SUB_WIDTH > innerWidth;

  return createPortal(
    <div className="ctx" ref={ref} style={pos} onContextMenu={(e) => e.preventDefault()} onClick={(e) => e.stopPropagation()}>
      {items.map((item, idx) =>
        item === 'separator' ? (
          <div key={`sep${idx}`} className="ctx-sep" />
        ) : (
          <div
            key={item.label}
            className={`ctx-item${open === idx ? ' active' : ''}${item.danger ? ' danger' : ''}`}
            onMouseEnter={(e) => {
              setOpen(item.submenu ? idx : null);
              setSubUp(e.currentTarget.getBoundingClientRect().top > innerHeight - 380);
            }}
            onClick={() => {
              if (item.submenu) return setOpen(idx);
              onClose();
              item.onSelect?.();
            }}
          >
            {item.icon && <span className="menu-icon">{item.icon}</span>}
            <span className="menu-label">{item.label}</span>
            {item.submenu && <Icon.Chevron size={10} />}
            {item.submenu && open === idx && (
              <div className={`ctx-sub${flip ? ' flip' : ''}${subUp ? ' up' : ''}`} style={{ width: SUB_WIDTH }} onClick={(e) => e.stopPropagation()}>
                {item.submenu(onClose)}
              </div>
            )}
          </div>
        ),
      )}
    </div>,
    document.body,
  );
}
