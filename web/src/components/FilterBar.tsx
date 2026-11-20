import type { RefObject } from 'react';
import { useApp } from '../hooks';
import type { Issue, User } from '../types';
import { Avatar, Icon } from './icons';
import { Menu } from './Menu';
import { Popover } from './Popover';

export interface Filters {
  q: string;
  /** accountIds; '' means unassigned */
  assignees: string[];
}

export const emptyFilters: Filters = { q: '', assignees: [] };

export function applyFilters(issues: Issue[], f: Filters) {
  const needle = f.q.trim().toLowerCase();
  return issues.filter(
    (i) =>
      (!needle || i.summary.toLowerCase().includes(needle) || i.key.toLowerCase().includes(needle) || i.labels.some((l) => l.toLowerCase().includes(needle))) &&
      (!f.assignees.length || f.assignees.includes(i.assignee?.accountId ?? '')),
  );
}

export function assigneesOf(issues: Issue[]) {
  const map = new Map<string, User>();
  for (const i of issues) if (i.assignee) map.set(i.assignee.accountId, i.assignee);
  return [...map.values()].sort((a, b) => a.displayName.localeCompare(b.displayName));
}

export function FilterBar({
  filters,
  onChange,
  users = [],
  searchRef,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
  users?: User[];
  searchRef?: RefObject<HTMLInputElement | null>;
}) {
  const { me } = useApp();
  const toggle = (id: string) =>
    onChange({
      ...filters,
      assignees: filters.assignees.includes(id) ? filters.assignees.filter((a) => a !== id) : [...filters.assignees, id],
    });
  const mine = filters.assignees.length === 1 && filters.assignees[0] === me.accountId;
  const picked = users.filter((u) => filters.assignees.includes(u.accountId));
  return (
    <div className="filterbar">
      <label className="search">
        <Icon.Search />
        <input
          ref={searchRef}
          value={filters.q}
          placeholder="Buscar…  /"
          onChange={(e) => onChange({ ...filters, q: e.target.value })}
          onKeyDown={(e) => e.key === 'Escape' && (onChange({ ...filters, q: '' }), e.currentTarget.blur())}
        />
      </label>
      <button className={`btn btn-ghost${mine ? ' on' : ''}`} onClick={() => onChange({ ...filters, assignees: mine ? [] : [me.accountId] })}>
        <Avatar user={me} size={16} /> Mías
      </button>
      {users.length > 0 && (
        <Popover
          width={260}
          renderTrigger={(p) => (
            <button className={`btn btn-ghost${filters.assignees.length && !mine ? ' on' : ''}`} {...p}>
              {picked.length > 0 && !mine ? (
                <span className="mini-faces">
                  {picked.slice(0, 3).map((u) => (
                    <Avatar key={u.accountId} user={u} size={16} />
                  ))}
                </span>
              ) : (
                <Icon.Users />
              )}{' '}
              Personas
              {filters.assignees.length > 0 && !mine && <span className="badge">{filters.assignees.length}</span>}
            </button>
          )}
        >
          {() => (
            <Menu
              placeholder="Filtrar por persona…"
              items={[
                ...users.map((u) => ({
                  id: u.accountId,
                  label: u.displayName,
                  icon: <Avatar user={u} size={18} />,
                  selected: filters.assignees.includes(u.accountId),
                })),
                { id: '', label: 'Sin asignar', icon: <Avatar user={null} size={18} />, selected: filters.assignees.includes('') },
                ...(filters.assignees.length ? [{ id: '*', label: 'Todas las personas', icon: <Icon.Refresh size={13} /> }] : []),
              ]}
              onSelect={(i) => (i.id === '*' ? onChange({ ...filters, assignees: [] }) : toggle(i.id))}
            />
          )}
        </Popover>
      )}
      {(filters.q || filters.assignees.length > 0) && (
        <button className="btn btn-ghost" onClick={() => onChange(emptyFilters)}>
          <Icon.Close size={12} /> Limpiar
        </button>
      )}
    </div>
  );
}
