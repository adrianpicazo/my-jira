import { useMemo } from 'react';
import type { Column, Issue, Status } from '../types';
import { Icon, StatusIcon } from './icons';
import { Menu } from './Menu';
import { Popover } from './Popover';

/** Statuses present in the given issues, in board column order. */
export function statusesOf(issues: Issue[], columns: Column[] = []) {
  const map = new Map<string, Status>();
  for (const i of issues) if (i.status) map.set(i.status.id, i.status);
  const pos = (id: string) => {
    const idx = columns.findIndex((c) => c.statusIds.includes(id));
    return idx < 0 ? Infinity : idx;
  };
  return [...map.values()].sort((a, b) => pos(a.id) - pos(b.id) || a.name.localeCompare(b.name));
}

export function StatusFilter({
  statuses,
  hidden,
  onChange,
}: {
  statuses: Status[];
  hidden: string[];
  onChange: (ids: string[]) => void;
}) {
  const count = useMemo(() => statuses.filter((s) => hidden.includes(s.id)).length, [statuses, hidden]);
  return (
    <Popover
      width={260}
      renderTrigger={(p) => (
        <button className={`btn btn-ghost${count ? ' on' : ''}`} {...p}>
          <Icon.Filter /> Estados{count > 0 && <span className="badge">{count} ocultos</span>}
        </button>
      )}
    >
      {() => (
        <Menu
          placeholder="Estados visibles…"
          items={[
            ...statuses.map((s) => ({ id: s.id, label: s.name, icon: <StatusIcon status={s} />, selected: !hidden.includes(s.id) })),
            ...(count ? [{ id: '*', label: 'Mostrar todos', icon: <Icon.Refresh size={13} /> }] : []),
          ]}
          onSelect={(item) => {
            if (item.id === '*') return onChange([]);
            onChange(hidden.includes(item.id) ? hidden.filter((x) => x !== item.id) : [...hidden, item.id]);
          }}
        />
      )}
    </Popover>
  );
}
