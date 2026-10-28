import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Icon } from './icons';

export interface MenuItem {
  id: string;
  label: string;
  icon?: ReactNode;
  hint?: ReactNode;
  selected?: boolean;
}

interface Props {
  items: MenuItem[];
  onSelect: (item: MenuItem) => void;
  placeholder?: string;
  /** Controlled query; when given, the caller does the filtering. */
  query?: string;
  onQuery?: (q: string) => void;
  loading?: boolean;
  empty?: string;
  limit?: number;
}

export function Menu({ items, onSelect, placeholder = 'Buscar…', query, onQuery, loading, empty = 'Sin resultados', limit = 100 }: Props) {
  const [ownQuery, setOwnQuery] = useState('');
  const q = query ?? ownQuery;
  const [active, setActive] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const filtered = onQuery || !needle ? items : items.filter((i) => i.label.toLowerCase().includes(needle));
    return filtered.slice(0, limit);
  }, [items, q, onQuery, limit]);

  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    list.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div className="menu">
      <div className="menu-search">
        <input
          autoFocus
          value={q}
          placeholder={placeholder}
          onChange={(e) => (onQuery ? onQuery(e.target.value) : setOwnQuery(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, shown.length - 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === 'Enter' && shown[active]) {
              e.preventDefault();
              onSelect(shown[active]);
            }
          }}
        />
        {loading && <span className="spinner" />}
      </div>
      <div className="menu-list" ref={list}>
        {shown.map((item, idx) => (
          <button
            key={item.id}
            data-idx={idx}
            className={`menu-item${idx === active ? ' active' : ''}`}
            onMouseEnter={() => setActive(idx)}
            onClick={() => onSelect(item)}
          >
            {item.icon && <span className="menu-icon">{item.icon}</span>}
            <span className="menu-label">{item.label}</span>
            {item.hint && <span className="menu-hint">{item.hint}</span>}
            {item.selected && (
              <span className="menu-check">
                <Icon.Check size={13} />
              </span>
            )}
          </button>
        ))}
        {!shown.length && !loading && <div className="menu-empty">{empty}</div>}
      </div>
    </div>
  );
}
